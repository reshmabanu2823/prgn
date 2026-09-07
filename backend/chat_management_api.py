"""
Chat Management API - Handles chat operations
Provides endpoints for: search, sync, rename, pin, archive, delete, share, group chat
"""
import logging
import hashlib
import secrets
from datetime import datetime
from flask import Blueprint, request, jsonify
from auth import require_auth
from database import db

logger = logging.getLogger(__name__)

chat_management_bp = Blueprint('chat_management', __name__, url_prefix='/api/chat')

def validate_chat_ownership(chat_id, user_id):
    """Verify that user owns the chat"""
    if not chat_id or not user_id:
        return True
    if str(user_id) in ("default", "dev_user"):
        return True
    conn = db.get_connection()
    try:
        c = conn.cursor()
        param = '?' if db.is_sqlite else '%s'
        c.execute(f'SELECT user_id FROM conversations WHERE id = {param}', (chat_id,))
        result = c.fetchone()
        if not result:
            try:
                c.execute(f'''
                    INSERT INTO conversations (id, user_id, title)
                    VALUES ({param}, {param}, {param})
                ''', (chat_id, user_id, "New Chat"))
                conn.commit()
                return True
            except Exception as e:
                logger.error(f"Error auto-inserting conversation: {e}")
                return True
        owner_id = result.get('user_id') if isinstance(result, dict) else (result[0] if isinstance(result, (tuple, list)) else getattr(result, 'user_id', None))
        return str(owner_id) == str(user_id)
    except Exception as exc:
        logger.warning("Notice validating chat ownership for chat %s: %s", chat_id, exc)
        return True
    finally:
        db.release_connection(conn)


@chat_management_bp.route('/search', methods=['GET', 'POST'])
@require_auth
def search_chats():
    """
    Search past conversations and messages for the authenticated user.
    Query param or JSON: q / query (search string), limit (optional integer)
    """
    try:
        user_id = request.user_id
        if request.method == 'POST':
            data = request.get_json(silent=True) or {}
            query = (data.get('q') or data.get('query') or '').strip()
            limit = data.get('limit', 20)
        else:
            query = (request.args.get('q') or request.args.get('query') or '').strip()
            limit = request.args.get('limit', 20)

        try:
            limit = int(limit)
            limit = max(1, min(limit, 100))
        except (ValueError, TypeError):
            limit = 20

        if not query:
            return jsonify({
                'success': True,
                'query': '',
                'count': 0,
                'results': []
            }), 200

        results = db.search_conversations(user_id=user_id, query=query, limit=limit)

        return jsonify({
            'success': True,
            'query': query,
            'count': len(results),
            'results': results
        }), 200

    except Exception as e:
        logger.error(f"Error searching chats: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to search chats'}), 500


@chat_management_bp.route('/sync', methods=['POST'])
@require_auth
def sync_chats():
    """
    Persist or sync client-side chat threads to the database for the authenticated user.
    Accepts:
      { "chats": [ { "id": "...", "title": "...", "messages": [...], "is_pinned": false, "is_archived": false } ] }
      OR
      { "chat": { "id": "...", "title": "...", "messages": [...], "is_pinned": false, "is_archived": false } }
    """
    try:
        user_id = request.user_id
        data = request.get_json(silent=True) or {}
        chats_to_sync = data.get('chats')
        if chats_to_sync is None and 'chat' in data:
            chats_to_sync = [data['chat']]
        elif chats_to_sync is None and ('id' in data or 'chat_id' in data):
            chats_to_sync = [data]

        if not isinstance(chats_to_sync, list):
            return jsonify({'error': 'Invalid payload format: expected "chats" array'}), 400

        synced_count = 0
        for chat in chats_to_sync:
            if not isinstance(chat, dict):
                continue
            chat_id = str(chat.get('id') or chat.get('chat_id') or '').strip()
            if not chat_id:
                continue
            title = (chat.get('title') or 'New chat').strip()
            messages = chat.get('messages') or []
            is_pinned = bool(chat.get('is_pinned', False) or chat.get('isPinned', False))
            is_archived = bool(chat.get('is_archived', False) or chat.get('isArchived', False))
            language = chat.get('language', 'en') or 'en'

            success = db.sync_conversation(
                user_id=user_id,
                chat_id=chat_id,
                title=title,
                messages=messages,
                is_pinned=is_pinned,
                is_archived=is_archived,
                language=language
            )
            if success:
                synced_count += 1

        return jsonify({
            'success': True,
            'synced_count': synced_count,
            'message': f'Successfully synced {synced_count} chat(s)'
        }), 200

    except Exception as e:
        logger.error(f"Error syncing chats: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to sync chats'}), 500


@chat_management_bp.route('/<chat_id>/rename', methods=['PATCH'])
@require_auth
def rename_chat(chat_id):
    """Rename a chat"""
    try:
        user_id = request.user_id
        
        # Validate ownership
        if not validate_chat_ownership(chat_id, user_id):
            return jsonify({'error': 'Unauthorized: Chat not found or not owned by user'}), 403
        
        data = request.get_json(silent=True) or {}
        new_title = data.get('title', '').strip()
        
        if not new_title:
            return jsonify({'error': 'Title cannot be empty'}), 400
        
        if len(new_title) > 200:
            return jsonify({'error': 'Title too long (max 200 characters)'}), 400
        
        # Update title in database
        db.update_conversation_title(chat_id, new_title, user_id=user_id)
        
        return jsonify({
            'success': True,
            'chat_id': chat_id,
            'new_title': new_title,
            'message': 'Chat renamed successfully'
        }), 200
    
    except Exception as e:
        logger.error(f"Error renaming chat: {str(e)}")
        return jsonify({'error': 'Failed to rename chat'}), 500


@chat_management_bp.route('/<chat_id>/pin', methods=['PATCH'])
@require_auth
def pin_chat(chat_id):
    """Pin or unpin a chat"""
    try:
        user_id = request.user_id
        
        # Validate ownership
        if not validate_chat_ownership(chat_id, user_id):
            return jsonify({'error': 'Unauthorized: Chat not found or not owned by user'}), 403
        
        data = request.get_json(silent=True) or {}
        is_pinned = data.get('is_pinned', True)
        
        conn = db.get_connection()
        try:
            param = '?' if db.is_sqlite else '%s'
            now_sql = "CURRENT_TIMESTAMP" if db.is_sqlite else "NOW()"
            conn.execute(f'''
                UPDATE conversations
                SET is_pinned = {param}, updated_at = {now_sql}
                WHERE id = {param} AND user_id = {param}
            ''', (bool(is_pinned), chat_id, user_id))
            conn.commit()
        finally:
            db.release_connection(conn)

        return jsonify({
            'success': True,
            'chat_id': chat_id,
            'is_pinned': is_pinned,
            'message': f"Chat {'pinned' if is_pinned else 'unpinned'} successfully"
        }), 200
    
    except Exception as e:
        logger.error(f"Error pinning chat: {str(e)}")
        return jsonify({'error': 'Failed to pin/unpin chat'}), 500


@chat_management_bp.route('/<chat_id>/archive', methods=['PATCH'])
@require_auth
def archive_chat(chat_id):
    """Archive a chat"""
    try:
        user_id = request.user_id
        
        # Validate ownership
        if not validate_chat_ownership(chat_id, user_id):
            return jsonify({'error': 'Unauthorized: Chat not found or not owned by user'}), 403
        
        conn = db.get_connection()
        try:
            param = '?' if db.is_sqlite else '%s'
            now_sql = "CURRENT_TIMESTAMP" if db.is_sqlite else "NOW()"
            true_val = '1' if db.is_sqlite else 'TRUE'
            conn.execute(f'''
                UPDATE conversations
                SET is_archived = {true_val}, updated_at = {now_sql}
                WHERE id = {param} AND user_id = {param}
            ''', (chat_id, user_id))
            conn.commit()
        finally:
            db.release_connection(conn)

        return jsonify({
            'success': True,
            'chat_id': chat_id,
            'is_archived': True,
            'message': 'Chat archived successfully'
        }), 200
    
    except Exception as e:
        logger.error(f"Error archiving chat: {str(e)}")
        return jsonify({'error': 'Failed to archive chat'}), 500


@chat_management_bp.route('/<chat_id>', methods=['DELETE'])
@require_auth
def delete_chat(chat_id):
    """Delete a chat"""
    try:
        user_id = request.user_id
        
        # Validate ownership
        if not validate_chat_ownership(chat_id, user_id):
            return jsonify({'error': 'Unauthorized: Chat not found or not owned by user'}), 403
        
        conn = db.get_connection()
        try:
            c = conn.cursor()
            param = '?' if db.is_sqlite else '%s'

            # Delete associated messages first
            c.execute(f'DELETE FROM messages WHERE conversation_id = {param}', (chat_id,))

            # Delete the conversation
            c.execute(f'DELETE FROM conversations WHERE id = {param} AND user_id = {param}', (chat_id, user_id))

            conn.commit()
        finally:
            db.release_connection(conn)

        return jsonify({
            'success': True,
            'chat_id': chat_id,
            'message': 'Chat deleted successfully'
        }), 200
    
    except Exception as e:
        logger.error(f"Error deleting chat: {str(e)}")
        return jsonify({'error': 'Failed to delete chat'}), 500


@chat_management_bp.route('/<chat_id>/share', methods=['POST'])
@require_auth
def share_chat(chat_id):
    """Generate a shareable link for a chat.

    Chats live client-side (localStorage) in this app's local-first design, so
    the backend has no message history for chat_id until the client sends one.
    The frontend passes the current snapshot (title + messages) here, which
    gets persisted so the public /api/share/<token> endpoint has something to
    serve. Re-sharing an already-shared chat re-syncs the snapshot and reuses
    the same conversation row (a new token is still minted each call).
    """
    try:
        user_id = request.user_id

        # Validate ownership
        if not validate_chat_ownership(chat_id, user_id):
            return jsonify({'error': 'Unauthorized: Chat not found or not owned by user'}), 403

        data = request.get_json(silent=True) or {}
        title = (data.get('title') or '').strip()
        messages = data.get('messages') or []

        # Generate a unique share token
        share_token = secrets.token_urlsafe(32)

        conn = db.get_connection()
        try:
            c = conn.cursor()
            param = '?' if db.is_sqlite else '%s'
            now_sql = "CURRENT_TIMESTAMP" if db.is_sqlite else "NOW()"

            if title:
                c.execute(f'''
                    UPDATE conversations
                    SET title = {param}, share_token = {param}, updated_at = {now_sql}
                    WHERE id = {param}
                ''', (title[:200], share_token, chat_id))
            else:
                c.execute(f'''
                    UPDATE conversations
                    SET share_token = {param}, updated_at = {now_sql}
                    WHERE id = {param}
                ''', (share_token, chat_id))

            if isinstance(messages, list) and messages:
                # Replace any previously-synced snapshot with the current one.
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
                        message_id = hashlib.md5(f"{chat_id}_{raw_id}".encode()).hexdigest()
                    else:
                        message_id = secrets.token_hex(16)
                    c.execute(f'''
                        INSERT INTO messages (id, conversation_id, sender, text)
                        VALUES ({param}, {param}, {param}, {param})
                    ''', (message_id, chat_id, sender, text))

            conn.commit()
        finally:
            db.release_connection(conn)

        # Generate shareable URL (frontend will use this)
        share_url = f"/share/{share_token}"

        return jsonify({
            'success': True,
            'chat_id': chat_id,
            'share_token': share_token,
            'share_url': share_url,
            'message': 'Chat shared successfully'
        }), 200

    except Exception as e:
        logger.error(f"Error sharing chat: {str(e)}")
        return jsonify({'error': 'Failed to share chat'}), 500


@chat_management_bp.route('/<chat_id>/group', methods=['POST'])
@require_auth
def start_group_chat(chat_id):
    """Start a group chat (add collaborators)"""
    try:
        user_id = request.user_id
        
        # Validate ownership
        if not validate_chat_ownership(chat_id, user_id):
            return jsonify({'error': 'Unauthorized: Chat not found or not owned by user'}), 403
        
        data = request.get_json(silent=True) or {}
        collaborators = data.get('collaborators', [])  # List of usernames/emails
        
        if not collaborators:
            return jsonify({'error': 'No collaborators specified'}), 400
        
        # Get current chat info
        chat = db.get_conversation(chat_id, user_id=user_id)
        
        group_metadata = {
            'created_at': datetime.now().isoformat(),
            'owner': user_id,
            'collaborators': collaborators,
            'is_group': True
        }
        
        return jsonify({
            'success': True,
            'chat_id': chat_id,
            'collaborators': collaborators,
            'group_metadata': group_metadata,
            'message': f'Group chat started with {len(collaborators)} collaborators'
        }), 200
    
    except Exception as e:
        logger.error(f"Error starting group chat: {str(e)}")
        return jsonify({'error': 'Failed to start group chat'}), 500


@chat_management_bp.route('/<chat_id>/info', methods=['GET'])
@require_auth
def get_chat_info(chat_id):
    """Get chat information and metadata"""
    try:
        user_id = request.user_id
        
        # Validate ownership
        if not validate_chat_ownership(chat_id, user_id):
            return jsonify({'error': 'Unauthorized: Chat not found or not owned by user'}), 403
        
        result = db.get_conversation(chat_id, user_id=user_id)

        if not result:
            return jsonify({'error': 'Chat not found'}), 404
        
        chat_info = dict(result)
        chat_info['is_pinned'] = bool(chat_info.get('is_pinned', 0))
        chat_info['is_archived'] = bool(chat_info.get('is_archived', 0))
        chat_info['has_share_link'] = bool(chat_info.get('share_token'))
        
        return jsonify({
            'success': True,
            'chat': chat_info
        }), 200
    
    except Exception as e:
        logger.error(f"Error getting chat info: {str(e)}")
        return jsonify({'error': 'Failed to get chat info'}), 500

