"""Postgres (Supabase) persistence layer with SQLite local fallback support.
"""
import logging
import hashlib
import os
import secrets
import sqlite3
import threading
import uuid
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Any

import config

logger = logging.getLogger(__name__)


def _row_to_dict(cursor, row):
    if not row:
        return None
    if isinstance(row, dict):
        return row
    if hasattr(row, 'keys'):
        try:
            return dict(zip(row.keys(), row))
        except Exception:
            pass
    if hasattr(cursor, 'description') and cursor.description:
        colnames = [col[0] for col in cursor.description]
        try:
            return dict(zip(colnames, row))
        except Exception:
            pass
    return row

class SQLiteCursorWrapper:
    def __init__(self, cursor):
        self._cursor = cursor
    def execute(self, sql, params=()):
        sql = sql.replace('%s', '?')
        return self._cursor.execute(sql, params)
    def fetchone(self):
        row = self._cursor.fetchone()
        return _row_to_dict(self._cursor, row)
    def fetchall(self):
        rows = self._cursor.fetchall()
        return [_row_to_dict(self._cursor, r) for r in rows]
    @property
    def description(self):
        return self._cursor.description
    @property
    def rowcount(self):
        return self._cursor.rowcount

class SQLiteConnWrapper:
    def __init__(self, conn):
        self._conn = conn
    def cursor(self, *args, **kwargs):
        c = self._conn.cursor()
        return SQLiteCursorWrapper(c)
    def commit(self):
        return self._conn.commit()
    def rollback(self):
        return self._conn.rollback()
    def close(self):
        return self._conn.close()
    def execute(self, sql, params=()):
        sql = sql.replace('%s', '?')
        cur = self._conn.cursor()
        cur.execute(sql, params)
        return SQLiteCursorWrapper(cur)

class Database:
    def __init__(self):
        self.is_sqlite = False
        db_url = getattr(config, 'DATABASE_URL', '') or ''
        
        if db_url.startswith('sqlite') or not db_url or 'postgres' not in db_url:
            self.is_sqlite = True
            clean_path = db_url.replace('sqlite:///', '').replace('sqlite://', '')
            if not clean_path:
                clean_path = os.path.join(os.path.dirname(__file__), 'data', 'chatbot.db')
            os.makedirs(os.path.dirname(os.path.abspath(clean_path)), exist_ok=True)
            self.sqlite_path = clean_path
            self.init_db()
        else:
            import psycopg
            from psycopg.rows import dict_row
            from psycopg_pool import ConnectionPool

            self._connect_kwargs = {
                'connect_timeout': 10,
                'keepalives': 1,
                'keepalives_idle': 30,
                'keepalives_interval': 10,
                'keepalives_count': 3,
            }

            def _configure(conn):
                conn.execute("SET statement_timeout = '15s'")
                conn.commit()

            self._configure_cb = _configure
            self._pool = None
            self._pool_pid = None
            self._pool_lock = threading.Lock()
            try:
                self.init_db()
            except Exception as exc:
                logger.warning(f"PostgreSQL automatic table initialization deferred or failed: {exc}")


    def _get_pool(self):
        if self.is_sqlite:
            return None
        from psycopg_pool import ConnectionPool
        pool = self._pool
        if pool is not None and self._pool_pid == os.getpid():
            return pool
        with self._pool_lock:
            pid = os.getpid()
            if self._pool is not None and self._pool_pid == pid:
                return self._pool
            self._pool = ConnectionPool(
                config.DATABASE_URL, min_size=1, max_size=3, open=True,
                kwargs=self._connect_kwargs, configure=self._configure_cb,
                check=ConnectionPool.check_connection,
                timeout=10, max_lifetime=300, max_idle=60,
            )
            self._pool_pid = pid
            return self._pool

    def get_pool_stats(self):
        if self.is_sqlite:
            return {'type': 'sqlite', 'pid': os.getpid(), 'path': getattr(self, 'sqlite_path', '')}
        try:
            pool = self._get_pool()
            if pool is None:
                return {'error': 'No pool configured', 'pid': os.getpid()}
            stats = dict(pool.get_stats())
            stats['pid'] = os.getpid()
            stats['max_size_cfg'] = getattr(pool, 'max_size', 0)
            return stats
        except Exception as exc:
            return {'error': str(exc)[:100], 'pid': os.getpid()}

    def get_connection(self):
        if self.is_sqlite:
            raw_conn = sqlite3.connect(self.sqlite_path)
            raw_conn.row_factory = sqlite3.Row
            return SQLiteConnWrapper(raw_conn)
        pool = self._get_pool()
        if pool is None:
            raise RuntimeError("Database pool is not available")
        return pool.getconn()

    def release_connection(self, conn):
        if self.is_sqlite:
            try:
                conn.close()
            except Exception:
                pass
            return

        import psycopg
        try:
            if conn.info.transaction_status != psycopg.pq.TransactionStatus.IDLE:
                conn.rollback()
        except Exception:
            try:
                conn.close()
            except Exception:
                pass
        pool = self._get_pool()
        if pool is not None:
            pool.putconn(conn)

    def init_db(self):
        conn = self.get_connection()
        try:
            c: Any = conn.cursor()
            if self.is_sqlite:
                c.execute('''
                    CREATE TABLE IF NOT EXISTS users (
                        id TEXT PRIMARY KEY,
                        username TEXT UNIQUE NOT NULL,
                        email TEXT UNIQUE NOT NULL,
                        password_hash TEXT,
                        oauth_provider TEXT,
                        oauth_id TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                for col in ['oauth_provider TEXT', 'oauth_id TEXT']:
                    try:
                        c.execute(f'ALTER TABLE users ADD COLUMN {col}')
                    except Exception:
                        pass
                c.execute('''
                    CREATE TABLE IF NOT EXISTS conversations (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        title TEXT NOT NULL,
                        language TEXT DEFAULT 'en',
                        is_archived BOOLEAN DEFAULT FALSE,
                        is_pinned BOOLEAN DEFAULT FALSE,
                        share_token TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                for col in ['is_pinned BOOLEAN DEFAULT FALSE', 'share_token TEXT']:
                    try:
                        c.execute(f'ALTER TABLE conversations ADD COLUMN {col}')
                    except Exception:
                        pass
                c.execute('CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id)')
                c.execute('CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at)')
                c.execute('''
                    CREATE TABLE IF NOT EXISTS messages (
                        id TEXT PRIMARY KEY,
                        conversation_id TEXT NOT NULL,
                        sender TEXT NOT NULL,
                        text TEXT NOT NULL,
                        language TEXT DEFAULT 'en',
                        tokens_used INTEGER DEFAULT 0,
                        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                c.execute('CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id)')
                c.execute('CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)')
                c.execute('''
                    CREATE TABLE IF NOT EXISTS api_usage (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id TEXT NOT NULL,
                        endpoint TEXT NOT NULL,
                        tokens_used INTEGER DEFAULT 0,
                        cost REAL DEFAULT 0,
                        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                c.execute('''
                    CREATE TABLE IF NOT EXISTS personas (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        system_prompt TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                c.execute('''
                    CREATE TABLE IF NOT EXISTS password_reset_tokens (
                        token TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        used BOOLEAN DEFAULT FALSE,
                        expires_at TIMESTAMP NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                c.execute('''
                    CREATE TABLE IF NOT EXISTS pending_registrations (
                        email TEXT PRIMARY KEY,
                        username TEXT NOT NULL,
                        password_hash TEXT,
                        otp_code TEXT NOT NULL,
                        attempts INTEGER DEFAULT 0,
                        expires_at TIMESTAMP NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                c.execute('''
                    CREATE TABLE IF NOT EXISTS image_generations (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        prompt TEXT NOT NULL,
                        effective_prompt TEXT,
                        style TEXT,
                        quality TEXT,
                        size TEXT,
                        provider TEXT,
                        model TEXT,
                        image_url TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                c.execute('CREATE INDEX IF NOT EXISTS idx_image_generations_user ON image_generations(user_id, created_at)')
                conn.commit()
            else:
                conn.execute('''
                    CREATE TABLE IF NOT EXISTS users (
                        id VARCHAR(255) PRIMARY KEY,
                        username VARCHAR(255) UNIQUE NOT NULL,
                        email VARCHAR(255) UNIQUE NOT NULL,
                        password_hash TEXT,
                        oauth_provider VARCHAR(50),
                        oauth_id VARCHAR(255),
                        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                    );
                    ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(50);
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_id VARCHAR(255);
                    CREATE TABLE IF NOT EXISTS conversations (
                        id VARCHAR(255) PRIMARY KEY,
                        user_id VARCHAR(255) NOT NULL,
                        title TEXT NOT NULL,
                        language VARCHAR(10) DEFAULT 'en',
                        is_archived BOOLEAN DEFAULT FALSE,
                        is_pinned BOOLEAN DEFAULT FALSE,
                        share_token VARCHAR(255),
                        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                    );
                    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
                    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS share_token VARCHAR(255);
                    CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
                    CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at);
                    CREATE TABLE IF NOT EXISTS messages (
                        id VARCHAR(255) PRIMARY KEY,
                        conversation_id VARCHAR(255) NOT NULL,
                        sender VARCHAR(50) NOT NULL,
                        text TEXT NOT NULL,
                        language VARCHAR(10) DEFAULT 'en',
                        tokens_used INTEGER DEFAULT 0,
                        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
                    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
                    CREATE TABLE IF NOT EXISTS api_usage (
                        id SERIAL PRIMARY KEY,
                        user_id VARCHAR(255) NOT NULL,
                        endpoint VARCHAR(255) NOT NULL,
                        tokens_used INTEGER DEFAULT 0,
                        cost REAL DEFAULT 0,
                        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE TABLE IF NOT EXISTS personas (
                        id VARCHAR(255) PRIMARY KEY,
                        user_id VARCHAR(255) NOT NULL,
                        name VARCHAR(255) NOT NULL,
                        system_prompt TEXT NOT NULL,
                        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE TABLE IF NOT EXISTS password_reset_tokens (
                        token VARCHAR(255) PRIMARY KEY,
                        user_id VARCHAR(255) NOT NULL,
                        used BOOLEAN DEFAULT FALSE,
                        expires_at TIMESTAMPTZ NOT NULL,
                        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE TABLE IF NOT EXISTS pending_registrations (
                        email VARCHAR(255) PRIMARY KEY,
                        username VARCHAR(255) NOT NULL,
                        password_hash TEXT NOT NULL,
                        otp_code VARCHAR(10) NOT NULL,
                        attempts INTEGER DEFAULT 0,
                        expires_at TIMESTAMPTZ NOT NULL,
                        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE TABLE IF NOT EXISTS memory_messages (
                        id SERIAL PRIMARY KEY,
                        user_id VARCHAR(255) NOT NULL,
                        role VARCHAR(50) NOT NULL,
                        content TEXT NOT NULL,
                        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE INDEX IF NOT EXISTS idx_memory_messages_user ON memory_messages(user_id, id);
                    CREATE TABLE IF NOT EXISTS user_facts (
                        id SERIAL PRIMARY KEY,
                        user_id VARCHAR(255) NOT NULL,
                        fact_key VARCHAR(255) NOT NULL,
                        fact_value TEXT NOT NULL,
                        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(user_id, fact_key)
                    );
                    CREATE INDEX IF NOT EXISTS idx_user_facts_user ON user_facts(user_id);
                    CREATE TABLE IF NOT EXISTS image_generations (
                        id VARCHAR(255) PRIMARY KEY,
                        user_id VARCHAR(255) NOT NULL,
                        prompt TEXT NOT NULL,
                        effective_prompt TEXT,
                        style VARCHAR(50),
                        quality VARCHAR(50),
                        size VARCHAR(50),
                        provider VARCHAR(50),
                        model VARCHAR(100),
                        image_url TEXT NOT NULL,
                        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE INDEX IF NOT EXISTS idx_image_generations_user ON image_generations(user_id, created_at DESC);
                ''')
                conn.commit()
        finally:
            self.release_connection(conn)

    # USER MANAGEMENT
    def create_user(self, username, email, password):
        password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        return self._insert_user(username, email, password_hash)

    def _insert_user(self, username, email, password_hash, user_id=None):
        if not user_id:
            user_id = hashlib.md5(f"{username}{datetime.now()}".encode()).hexdigest()
        conn = self.get_connection()
        try:
            c = conn.cursor()
            param_placeholder = '?' if self.is_sqlite else '%s'
            c.execute(f'''
                INSERT INTO users (id, username, email, password_hash)
                VALUES ({param_placeholder}, {param_placeholder}, {param_placeholder}, {param_placeholder})
            ''', (user_id, username, email, password_hash))
            conn.commit()
            return user_id
        except Exception:
            return None
        finally:
            self.release_connection(conn)

    def get_user(self, username):
        conn = self.get_connection()
        try:
            c = conn.cursor()
            param = '?' if self.is_sqlite else '%s'
            c.execute(f'SELECT * FROM users WHERE LOWER(username) = LOWER({param}) OR LOWER(email) = LOWER({param})', (username, username))
            return _row_to_dict(c, c.fetchone())
        finally:
            self.release_connection(conn)

    def get_user_by_id(self, user_id):
        conn = self.get_connection()
        try:
            c = conn.cursor()
            param = '?' if self.is_sqlite else '%s'
            c.execute(f'SELECT * FROM users WHERE id = {param}', (user_id,))
            return _row_to_dict(c, c.fetchone())
        finally:
            self.release_connection(conn)

    def verify_password(self, stored_hash, password):
        """Verify password against stored hash. stored_hash is None for
        OAuth-only accounts (no password was ever set) - no password can
        match that, so fail closed instead of crashing on None.encode()."""
        if not stored_hash:
            return False
        return bcrypt.checkpw(password.encode(), stored_hash.encode())

    def update_password(self, user_id, new_password):
        password_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
        conn = self.get_connection()
        try:
            c = conn.cursor()
            param = '?' if self.is_sqlite else '%s'
            now_sql = "CURRENT_TIMESTAMP" if self.is_sqlite else "NOW()"
            c.execute(f'''
                UPDATE users SET password_hash = {param}, updated_at = {now_sql} WHERE id = {param}
            ''', (password_hash, user_id))
            conn.commit()
            return c.rowcount > 0
        finally:
            self.release_connection(conn)

    def delete_user(self, user_id):
        conn = self.get_connection()
        try:
            c = conn.cursor()
            param = '?' if self.is_sqlite else '%s'
            c.execute(f'''
                DELETE FROM messages WHERE conversation_id IN 
                (SELECT id FROM conversations WHERE user_id = {param})
            ''', (user_id,))
            c.execute(f'DELETE FROM conversations WHERE user_id = {param}', (user_id,))
            c.execute(f'DELETE FROM api_usage WHERE user_id = {param}', (user_id,))
            c.execute(f'DELETE FROM personas WHERE user_id = {param}', (user_id,))
            c.execute(f'DELETE FROM password_reset_tokens WHERE user_id = {param}', (user_id,))
            c.execute(f'DELETE FROM users WHERE id = {param}', (user_id,))
            conn.commit()
            return c.rowcount > 0
        finally:
            self.release_connection(conn)

    def get_user_by_email(self, email):
        conn = self.get_connection()
        try:
            c = conn.cursor()
            param = '?' if self.is_sqlite else '%s'
            c.execute(f'SELECT * FROM users WHERE email = {param}', (email,))
            return _row_to_dict(c, c.fetchone())
        finally:
            self.release_connection(conn)

    MAX_OTP_ATTEMPTS = 5

    # PENDING REGISTRATION / OTP
    def create_pending_registration(self, username, email, password, otp_code, ttl_minutes=10):
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)
        expires_str = expires_at.strftime('%Y-%m-%d %H:%M:%S')

        conn = self.get_connection()
        try:
            c = conn.cursor()
            param = '?' if self.is_sqlite else '%s'
            c.execute(f'DELETE FROM pending_registrations WHERE email = {param}', (email,))
            c.execute(f'''
                INSERT INTO pending_registrations (email, username, password_hash, otp_code, attempts, expires_at)
                VALUES ({param}, {param}, {param}, {param}, 0, {param})
            ''', (email, username, password_hash, otp_code, expires_str))
            conn.commit()
            return True
        finally:
            self.release_connection(conn)

    def get_pending_registration(self, email):
        conn = self.get_connection()
        try:
            c = conn.cursor()
            param = '?' if self.is_sqlite else '%s'
            c.execute(f'SELECT * FROM pending_registrations WHERE email = {param}', (email,))
            row = _row_to_dict(c, c.fetchone())
            if not row:
                return None
            
            exp = row.get('expires_at') if isinstance(row, dict) else None
            if isinstance(exp, str):
                try:
                    exp = datetime.fromisoformat(exp.replace('Z', '+00:00'))
                except Exception:
                    pass
            if isinstance(exp, datetime):
                if exp.tzinfo is None:
                    exp = exp.replace(tzinfo=timezone.utc)
                if exp < datetime.now(timezone.utc):
                    return None
            return row
        finally:
            self.release_connection(conn)

    def delete_pending_registration(self, email):
        conn = self.get_connection()
        try:
            param = '?' if self.is_sqlite else '%s'
            conn.execute(f'DELETE FROM pending_registrations WHERE email = {param}', (email,))
            conn.commit()
        finally:
            self.release_connection(conn)

    def increment_otp_attempts(self, email):
        conn = self.get_connection()
        try:
            param = '?' if self.is_sqlite else '%s'
            conn.execute(f'UPDATE pending_registrations SET attempts = attempts + 1 WHERE email = {param}', (email,))
            conn.commit()
        finally:
            self.release_connection(conn)

    # OAUTH (Google / GitHub)
    def get_user_by_oauth(self, provider, oauth_id):
        """Get user by (oauth_provider, oauth_id) pair"""
        conn = self.get_connection()
        try:
            c = conn.cursor()
            param = '?' if self.is_sqlite else '%s'
            c.execute(
                f'SELECT * FROM users WHERE oauth_provider = {param} AND oauth_id = {param}',
                (provider, oauth_id),
            )
            user = c.fetchone()
            return dict(user) if user else None
        finally:
            self.release_connection(conn)

    def _unique_username(self, cursor, base):
        """Derive a free username from `base` (already lowercased/sanitized
        by the caller), appending a numeric suffix on collision. Runs on the
        same connection/transaction as the insert that follows so there's no
        TOCTOU gap between checking and reserving the name."""
        candidate = base or 'user'
        suffix = 0
        param = '?' if self.is_sqlite else '%s'
        while True:
            cursor.execute(f'SELECT 1 FROM users WHERE username = {param}', (candidate,))
            if not cursor.fetchone():
                return candidate
            suffix += 1
            candidate = f"{base}{suffix}"

    def create_oauth_user(self, username, email, oauth_provider, oauth_id):
        """Create a new account with no password, identified by an OAuth
        provider + id. `username` is a suggestion - collisions are resolved
        automatically since OAuth doesn't give the user a chance to pick one
        up front."""
        user_id = hashlib.md5(f"{email}{oauth_provider}{datetime.now()}".encode()).hexdigest()
        conn = self.get_connection()
        try:
            c = conn.cursor()
            final_username = self._unique_username(c, username)
            param = '?' if self.is_sqlite else '%s'
            c.execute(f'''
                INSERT INTO users (id, username, email, password_hash, oauth_provider, oauth_id)
                VALUES ({param}, {param}, {param}, {param}, {param}, {param})
            ''', (user_id, final_username, email, '!oauth_no_password', oauth_provider, oauth_id))
            conn.commit()
            return user_id
        except Exception as exc:
            try:
                conn.rollback()
            except Exception:
                pass
            logger.warning(f"create_oauth_user error: {exc}")
            return None
        finally:
            self.release_connection(conn)

    def link_oauth_account(self, user_id, oauth_provider, oauth_id):
        """Attach an OAuth provider to an existing (password-based) account,
        so its owner can log in either way from now on."""
        conn = self.get_connection()
        try:
            c = conn.cursor()
            param = '?' if self.is_sqlite else '%s'
            updated_at_expr = 'CURRENT_TIMESTAMP' if self.is_sqlite else 'NOW()'
            c.execute(
                f'UPDATE users SET oauth_provider = {param}, oauth_id = {param}, updated_at = {updated_at_expr} WHERE id = {param}',
                (oauth_provider, oauth_id, user_id),
            )
            conn.commit()
            return c.rowcount > 0
        finally:
            self.release_connection(conn)


    # PASSWORD RESET
    def create_password_reset_token(self, user_id, ttl_minutes=60):
        conn = self.get_connection()
        try:
            c = conn.cursor()
            param = '?' if self.is_sqlite else '%s'
            true_val = '1' if self.is_sqlite else 'TRUE'
            false_val = '0' if self.is_sqlite else 'FALSE'
            c.execute(f'''
                UPDATE password_reset_tokens SET used = {true_val} WHERE user_id = {param} AND used = {false_val}
            ''', (user_id,))
            token = secrets.token_urlsafe(32)
            expires_at = datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)
            c.execute(f'''
                INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES ({param}, {param}, {param})
            ''', (token, user_id, expires_at))
            conn.commit()
            return token
        finally:
            self.release_connection(conn)

    def get_valid_reset_token(self, token):
        conn = self.get_connection()
        try:
            c = conn.cursor()
            param = '?' if self.is_sqlite else '%s'
            c.execute(f'SELECT * FROM password_reset_tokens WHERE token = {param}', (token,))
            row = _row_to_dict(c, c.fetchone())
        finally:
            self.release_connection(conn)
        if not row:
            return None
        if isinstance(row, dict) and row.get('used'):
            return None
        exp = row.get('expires_at') if isinstance(row, dict) else None
        if isinstance(exp, str):
            exp = datetime.fromisoformat(exp.replace('Z', '+00:00'))
        if exp and exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp and exp < datetime.now(timezone.utc):
            return None
        return row

    def mark_reset_token_used(self, token):
        conn = self.get_connection()
        try:
            param = '?' if self.is_sqlite else '%s'
            true_val = '1' if self.is_sqlite else 'TRUE'
            conn.execute(f'UPDATE password_reset_tokens SET used = {true_val} WHERE token = {param}', (token,))
            conn.commit()
        finally:
            self.release_connection(conn)

    # CONVERSATION MANAGEMENT
    def create_conversation(self, user_id, title, language='en', conv_id=None, is_pinned=False, is_archived=False):
        if not conv_id:
            conv_id = hashlib.md5(f"{user_id}{datetime.now().isoformat()}{secrets.token_hex(4)}".encode()).hexdigest()
        conn = self.get_connection()
        try:
            param = '?' if self.is_sqlite else '%s'
            now_sql = "CURRENT_TIMESTAMP" if self.is_sqlite else "NOW()"
            c = conn.cursor()
            c.execute(f'SELECT id FROM conversations WHERE id = {param}', (conv_id,))
            existing = c.fetchone()
            if existing:
                c.execute(f'''
                    UPDATE conversations
                    SET title = {param}, language = {param}, updated_at = {now_sql}
                    WHERE id = {param} AND user_id = {param}
                ''', (title, language, conv_id, user_id))
            else:
                c.execute(f'''
                    INSERT INTO conversations (id, user_id, title, language, is_pinned, is_archived)
                    VALUES ({param}, {param}, {param}, {param}, {param}, {param})
                ''', (conv_id, user_id, title, language, bool(is_pinned), bool(is_archived)))
            conn.commit()
            return conv_id
        finally:
            self.release_connection(conn)

    def get_conversation(self, conv_id, user_id=None):
        conn = self.get_connection()
        try:
            c = conn.cursor()
            param = '?' if self.is_sqlite else '%s'
            if user_id:
                c.execute(f'SELECT * FROM conversations WHERE id = {param} AND user_id = {param}', (conv_id, user_id))
            else:
                c.execute(f'SELECT * FROM conversations WHERE id = {param}', (conv_id,))
            row = c.fetchone()
            return _row_to_dict(c, row)
        finally:
            self.release_connection(conn)

    def get_conversations(self, user_id, limit=50, include_archived=False):
        conn = self.get_connection()
        try:
            c = conn.cursor()
            param = '?' if self.is_sqlite else '%s'
            false_val = '0' if self.is_sqlite else 'FALSE'
            if include_archived:
                c.execute(f'''
                    SELECT * FROM conversations
                    WHERE user_id = {param}
                    ORDER BY updated_at DESC
                    LIMIT {param}
                ''', (user_id, limit))
            else:
                c.execute(f'''
                    SELECT * FROM conversations
                    WHERE user_id = {param} AND is_archived = {false_val}
                    ORDER BY updated_at DESC
                    LIMIT {param}
                ''', (user_id, limit))
            rows = c.fetchall()
            return [_row_to_dict(c, r) for r in rows]
        finally:
            self.release_connection(conn)

    def update_conversation_title(self, conv_id, title, user_id=None):
        conn = self.get_connection()
        try:
            param = '?' if self.is_sqlite else '%s'
            now_sql = "CURRENT_TIMESTAMP" if self.is_sqlite else "NOW()"
            if user_id:
                conn.execute(f'''
                    UPDATE conversations
                    SET title = {param}, updated_at = {now_sql}
                    WHERE id = {param} AND user_id = {param}
                ''', (title, conv_id, user_id))
            else:
                conn.execute(f'''
                    UPDATE conversations
                    SET title = {param}, updated_at = {now_sql}
                    WHERE id = {param}
                ''', (title, conv_id))
            conn.commit()
        finally:
            self.release_connection(conn)

    # MESSAGE MANAGEMENT
    def add_message(self, conv_id, sender, text, language='en', tokens=0, msg_id=None):
        if not text or not str(text).strip():
            return None
        if not msg_id:
            msg_id = secrets.token_hex(16)
        conn = self.get_connection()
        try:
            c = conn.cursor()
            param = '?' if self.is_sqlite else '%s'
            now_sql = "CURRENT_TIMESTAMP" if self.is_sqlite else "NOW()"
            c.execute(f'''
                INSERT INTO messages (id, conversation_id, sender, text, language, tokens_used)
                VALUES ({param}, {param}, {param}, {param}, {param}, {param})
            ''', (msg_id, conv_id, sender, str(text).strip(), language, tokens))
            c.execute(f'''
                UPDATE conversations
                SET updated_at = {now_sql}
                WHERE id = {param}
            ''', (conv_id,))
            conn.commit()
            return msg_id
        finally:
            self.release_connection(conn)

    def get_messages(self, conv_id, limit=100):
        conn = self.get_connection()
        try:
            c = conn.cursor()
            param = '?' if self.is_sqlite else '%s'
            c.execute(f'''
                SELECT * FROM messages
                WHERE conversation_id = {param}
                ORDER BY timestamp ASC
                LIMIT {param}
            ''', (conv_id, limit))
            rows = c.fetchall()
            return [_row_to_dict(c, r) for r in rows]
        finally:
            self.release_connection(conn)

    def get_conversation_history(self, conv_id, max_tokens=4000):
        messages = self.get_messages(conv_id, limit=50)
        history = []
        token_count = 0
        for msg in messages:
            if not msg or not isinstance(msg, dict):
                continue
            text = str(msg.get('text') or '')
            sender = str(msg.get('sender') or '')
            msg_tokens = len(text.split())
            if token_count + msg_tokens > max_tokens:
                break
            history.append({
                'role': 'user' if sender == 'user' else 'assistant',
                'content': text
            })
            token_count += msg_tokens
        return history

    def sync_conversation(self, user_id, chat_id, title=None, messages=None, is_pinned=False, is_archived=False, language='en'):
        """Upsert a conversation and its messages for user_id."""
        if not chat_id or not user_id:
            return False
        conn = self.get_connection()
        try:
            c = conn.cursor()
            param = '?' if self.is_sqlite else '%s'
            now_sql = "CURRENT_TIMESTAMP" if self.is_sqlite else "NOW()"
            c.execute(f'SELECT id, user_id, title FROM conversations WHERE id = {param}', (chat_id,))
            existing = _row_to_dict(c, c.fetchone())

            clean_title = (title or "New chat")[:200]
            if existing:
                if str(existing.get('user_id')) != str(user_id) and str(user_id) not in ("default", "dev_user"):
                    return False
                c.execute(f'''
                    UPDATE conversations
                    SET title = {param}, is_pinned = {param}, is_archived = {param}, updated_at = {now_sql}
                    WHERE id = {param} AND user_id = {param}
                ''', (clean_title, bool(is_pinned), bool(is_archived), chat_id, user_id))
            else:
                c.execute(f'''
                    INSERT INTO conversations (id, user_id, title, language, is_pinned, is_archived)
                    VALUES ({param}, {param}, {param}, {param}, {param}, {param})
                ''', (chat_id, user_id, clean_title, language, bool(is_pinned), bool(is_archived)))

            if isinstance(messages, list) and messages:
                c.execute(f'DELETE FROM messages WHERE conversation_id = {param}', (chat_id,))
                for msg in messages:
                    sender = (msg.get('sender') or msg.get('role') or '').strip()
                    if sender in ('assistant', 'model'):
                        sender = 'bot'
                    text = (msg.get('text') or msg.get('content') or '').strip()
                    if sender not in ('user', 'bot') or not text:
                        continue
                    raw_id = str(msg.get('id') or '').strip()
                    if raw_id:
                        m_id = hashlib.md5(f"{chat_id}_{raw_id}".encode()).hexdigest()
                    else:
                        m_id = secrets.token_hex(16)
                    lang = msg.get('language', language) or 'en'
                    tokens = msg.get('tokens_used', 0) or 0
                    c.execute(f'''
                        INSERT INTO messages (id, conversation_id, sender, text, language, tokens_used)
                        VALUES ({param}, {param}, {param}, {param}, {param}, {param})
                    ''', (m_id, chat_id, sender, text, lang, tokens))

            conn.commit()
            return True
        finally:
            self.release_connection(conn)

    def search_conversations(self, user_id, query, limit=20):
        """Search past conversation thread titles and message contents for user_id.

        Returns a list of structured match objects:
        [
            {
                "chat_id": "...",
                "title": "...",
                "snippet": "...",
                "match_type": "title" | "message",
                "sender": "user" | "bot" | None,
                "message_id": "...",
                "timestamp": "...",
                "is_pinned": False,
                "updated_at": "..."
            }
        ]
        Strictly isolated by user_id.
        """
        q = (query or "").strip()
        if not q or not user_id:
            return []

        conn = self.get_connection()
        try:
            c = conn.cursor()
            param = '?' if self.is_sqlite else '%s'
            false_val = '0' if self.is_sqlite else 'FALSE'
            search_param = f"%{q}%"

            # 1. First search matching messages
            query_messages = f'''
                SELECT 
                    m.id AS message_id,
                    m.conversation_id,
                    m.sender,
                    m.text AS message_text,
                    m.timestamp AS message_timestamp,
                    c.title AS conversation_title,
                    c.updated_at AS conversation_updated_at,
                    c.is_pinned
                FROM messages m
                INNER JOIN conversations c ON c.id = m.conversation_id
                WHERE c.user_id = {param}
                  AND c.is_archived = {false_val}
                  AND LOWER(m.text) LIKE LOWER({param})
                ORDER BY c.updated_at DESC, m.timestamp DESC
                LIMIT {param}
            '''
            c.execute(query_messages, (user_id, search_param, limit))
            message_rows = c.fetchall()

            # 2. Second search matching thread titles
            query_titles = f'''
                SELECT 
                    c.id AS conversation_id,
                    c.title AS conversation_title,
                    c.updated_at AS conversation_updated_at,
                    c.is_pinned
                FROM conversations c
                WHERE c.user_id = {param}
                  AND c.is_archived = {false_val}
                  AND LOWER(c.title) LIKE LOWER({param})
                ORDER BY c.updated_at DESC
                LIMIT {param}
            '''
            c.execute(query_titles, (user_id, search_param, limit))
            title_rows = c.fetchall()

            results = []
            seen_entries = set()

            def extract_snippet(text: str, search_query: str, window: int = 60) -> str:
                if not text:
                    return ""
                idx = text.lower().find(search_query.lower())
                if idx == -1:
                    return (text[:window * 2] + ("..." if len(text) > window * 2 else "")).strip()
                start = max(0, idx - window)
                end = min(len(text), idx + len(search_query) + window)
                prefix = "..." if start > 0 else ""
                suffix = "..." if end < len(text) else ""
                return f"{prefix}{text[start:end].strip()}{suffix}"

            # Process title matches
            for r in title_rows:
                row = _row_to_dict(c, r)
                if not row or not isinstance(row, dict):
                    continue
                chat_id = row.get("conversation_id")
                entry_key = f"title:{chat_id}"
                if entry_key not in seen_entries:
                    seen_entries.add(entry_key)
                    t_str = row.get("conversation_updated_at")
                    if isinstance(t_str, datetime):
                        t_str = t_str.isoformat()
                    results.append({
                        "chat_id": chat_id,
                        "conversation_id": chat_id,
                        "title": row.get("conversation_title") or "New chat",
                        "snippet": row.get("conversation_title") or "New chat",
                        "match_type": "title",
                        "sender": None,
                        "message_id": None,
                        "timestamp": t_str,
                        "updated_at": t_str,
                        "is_pinned": bool(row.get("is_pinned", 0)),
                    })

            # Process message matches
            for r in message_rows:
                row = _row_to_dict(c, r)
                if not row or not isinstance(row, dict):
                    continue
                chat_id = row.get("conversation_id")
                msg_id = row.get("message_id")
                entry_key = f"msg:{chat_id}:{msg_id}"
                if entry_key not in seen_entries:
                    seen_entries.add(entry_key)
                    snippet = extract_snippet(row.get("message_text") or "", q)
                    m_time = row.get("message_timestamp") or row.get("conversation_updated_at")
                    if isinstance(m_time, datetime):
                        m_time = m_time.isoformat()
                    results.append({
                        "chat_id": chat_id,
                        "conversation_id": chat_id,
                        "title": row.get("conversation_title") or "New chat",
                        "snippet": snippet,
                        "match_type": "message",
                        "sender": row.get("sender"),
                        "message_id": msg_id,
                        "timestamp": m_time,
                        "updated_at": m_time,
                        "is_pinned": bool(row.get("is_pinned", 0)),
                    })

            return results[:limit]
        finally:
            self.release_connection(conn)

    # ANALYTICS
    def log_api_usage(self, user_id, endpoint, tokens_used=0, cost=0):
        conn = self.get_connection()
        try:
            param = '?' if self.is_sqlite else '%s'
            conn.execute(f'''
                INSERT INTO api_usage (user_id, endpoint, tokens_used, cost)
                VALUES ({param}, {param}, {param}, {param})
            ''', (user_id, endpoint, tokens_used, cost))
            conn.commit()
        finally:
            self.release_connection(conn)

    def get_user_stats(self, user_id):
        conn = self.get_connection()
        try:
            c = conn.cursor()
            param = '?' if self.is_sqlite else '%s'
            false_val = '0' if self.is_sqlite else 'FALSE'
            c.execute(f'''
                SELECT SUM(tokens_used) as total_tokens FROM api_usage
                WHERE user_id = {param}
            ''', (user_id,))
            row = _row_to_dict(c, c.fetchone())
            total_tokens = (row.get('total_tokens') if isinstance(row, dict) else 0) or 0

            c.execute(f'''
                SELECT COUNT(*) as count FROM conversations
                WHERE user_id = {param} AND is_archived = {false_val}
            ''', (user_id,))
            row_c = _row_to_dict(c, c.fetchone())
            total_conversations = (row_c.get('count') if isinstance(row_c, dict) else 0) or 0

            return {
                'total_tokens': total_tokens,
                'total_conversations': total_conversations
            }
        finally:
            self.release_connection(conn)

    # PERSONA MANAGEMENT
    def create_persona(self, user_id, name, system_prompt):
        persona_id = hashlib.md5(f"{user_id}{name}{datetime.now()}".encode()).hexdigest()
        conn = self.get_connection()
        try:
            param = '?' if self.is_sqlite else '%s'
            conn.execute(f'''
                INSERT INTO personas (id, user_id, name, system_prompt)
                VALUES ({param}, {param}, {param}, {param})
            ''', (persona_id, user_id, name, system_prompt))
            conn.commit()
            return persona_id
        finally:
            self.release_connection(conn)

    def list_personas(self, user_id):
        conn = self.get_connection()
        try:
            c = conn.cursor()
            param = '?' if self.is_sqlite else '%s'
            c.execute(f'''
                SELECT * FROM personas WHERE user_id = {param} ORDER BY created_at ASC
            ''', (user_id,))
            rows = c.fetchall()
            return [_row_to_dict(c, r) for r in rows]
        finally:
            self.release_connection(conn)

    def get_persona(self, persona_id, user_id):
        conn = self.get_connection()
        try:
            c = conn.cursor()
            param = '?' if self.is_sqlite else '%s'
            c.execute(f'''
                SELECT * FROM personas WHERE id = {param} AND user_id = {param}
            ''', (persona_id, user_id))
            return _row_to_dict(c, c.fetchone())
        finally:
            self.release_connection(conn)

    def update_persona(self, persona_id, user_id, name, system_prompt):
        if not self.get_persona(persona_id, user_id):
            return False
        conn = self.get_connection()
        try:
            param = '?' if self.is_sqlite else '%s'
            now_sql = "CURRENT_TIMESTAMP" if self.is_sqlite else "NOW()"
            conn.execute(f'''
                UPDATE personas
                SET name = {param}, system_prompt = {param}, updated_at = {now_sql}
                WHERE id = {param} AND user_id = {param}
            ''', (name, system_prompt, persona_id, user_id))
            conn.commit()
            return True
        finally:
            self.release_connection(conn)

    def delete_persona(self, persona_id, user_id):
        if not self.get_persona(persona_id, user_id):
            return False
        conn = self.get_connection()
        try:
            param = '?' if self.is_sqlite else '%s'
            conn.execute(f'DELETE FROM personas WHERE id = {param} AND user_id = {param}', (persona_id, user_id))
            conn.commit()
            return True
        finally:
            self.release_connection(conn)

    # IMAGE GENERATION HISTORY
    def save_image_generation(self, user_id, prompt, image_url, effective_prompt=None, style='cinematic', quality='hd', size='1024x1024', provider='auto', model='dall-e-3'):
        image_id = str(uuid.uuid4())
        conn = self.get_connection()
        try:
            param = '?' if self.is_sqlite else '%s'
            conn.execute(f'''
                INSERT INTO image_generations (id, user_id, prompt, effective_prompt, style, quality, size, provider, model, image_url)
                VALUES ({param}, {param}, {param}, {param}, {param}, {param}, {param}, {param}, {param}, {param})
            ''', (image_id, str(user_id or 'default'), prompt, effective_prompt or prompt, style, quality, size, provider, model, image_url))
            conn.commit()
            return image_id
        except Exception as exc:
            logger.warning(f"save_image_generation failed: {exc}")
            return None
        finally:
            self.release_connection(conn)

    def get_user_image_history(self, user_id, limit=50, offset=0):
        conn = self.get_connection()
        try:
            c = conn.cursor()
            param = '?' if self.is_sqlite else '%s'
            c.execute(f'''
                SELECT * FROM image_generations
                WHERE user_id = {param}
                ORDER BY created_at DESC
                LIMIT {param} OFFSET {param}
            ''', (str(user_id or 'default'), limit, offset))
            rows = c.fetchall()
            return [_row_to_dict(c, r) for r in rows]
        except Exception as exc:
            logger.warning(f"get_user_image_history failed: {exc}")
            return []
        finally:
            self.release_connection(conn)

    def delete_image_generation(self, image_id, user_id):
        conn = self.get_connection()
        try:
            param = '?' if self.is_sqlite else '%s'
            c = conn.cursor()
            c.execute(f'''
                DELETE FROM image_generations WHERE id = {param} AND user_id = {param}
            ''', (str(image_id), str(user_id or 'default')))
            conn.commit()
            return getattr(c, 'rowcount', 0) > 0
        except Exception as exc:
            logger.warning(f"delete_image_generation failed: {exc}")
            return False
        finally:
            self.release_connection(conn)

    def clear_user_image_history(self, user_id):
        conn = self.get_connection()
        try:
            param = '?' if self.is_sqlite else '%s'
            c = conn.cursor()
            c.execute(f'''
                DELETE FROM image_generations WHERE user_id = {param}
            ''', (str(user_id or 'default'),))
            conn.commit()
            return True
        except Exception as exc:
            logger.warning(f"clear_user_image_history failed: {exc}")
            return False
        finally:
            self.release_connection(conn)


db = Database()
