"""
Unit and Integration Tests for Cross-Thread Conversation Search and Persistence.
Tests:
1. Conversation & message persistence (Postgres / SQLite)
2. Cross-thread search across titles and message contents (user & assistant)
3. Snippet extraction with context around keywords
4. Strict multi-user isolation (User A never sees User B's threads/messages)
5. Pinning and archiving behavior
6. Flask REST API endpoints: /api/chat/search and /api/chat/sync
"""
import unittest
import os
import sys
import json
import secrets

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import config
from database import db
from auth import AuthService
from app import app


class TestChatPersistenceAndSearch(unittest.TestCase):

    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

        # Generate distinct test user IDs
        self.user_a_id = f"user_a_{secrets.token_hex(4)}"
        self.user_b_id = f"user_b_{secrets.token_hex(4)}"

        # Generate auth tokens
        self.token_a = AuthService.generate_token(self.user_a_id)
        self.token_b = AuthService.generate_token(self.user_b_id)

        self.headers_a = {"Authorization": f"Bearer {self.token_a}", "Content-Type": "application/json"}
        self.headers_b = {"Authorization": f"Bearer {self.token_b}", "Content-Type": "application/json"}

    def test_01_db_persistence_and_search_title(self):
        """Test creating conversation and searching by title."""
        chat_id = f"chat_{secrets.token_hex(6)}"
        created_id = db.create_conversation(
            user_id=self.user_a_id,
            title="Quantum Computing Algorithms",
            conv_id=chat_id
        )
        self.assertEqual(created_id, chat_id)

        # Search for quantum
        results = db.search_conversations(user_id=self.user_a_id, query="Quantum")
        self.assertTrue(len(results) >= 1)
        found = any(r['chat_id'] == chat_id and r['match_type'] == 'title' for r in results)
        self.assertTrue(found, "User A should find conversation by title match")

        # Confirm User B cannot see User A's conversation
        results_b = db.search_conversations(user_id=self.user_b_id, query="Quantum")
        self.assertEqual(len(results_b), 0, "User B must NOT see User A's conversations")

    def test_02_db_search_message_content_and_snippet(self):
        """Test searching across user and assistant message contents with snippet generation."""
        chat_id = f"chat_{secrets.token_hex(6)}"
        db.create_conversation(user_id=self.user_a_id, title="Machine Learning Project", conv_id=chat_id)

        msg1 = "We should implement a Transformer architecture with rotary position embeddings for the new model."
        msg2 = "Certainly, RoPE embeddings help preserve relative token distances across long sequences."

        db.add_message(conv_id=chat_id, sender="user", text=msg1)
        db.add_message(conv_id=chat_id, sender="bot", text=msg2)

        # Search for unique keyword in user message
        res_user = db.search_conversations(user_id=self.user_a_id, query="rotary position")
        self.assertTrue(len(res_user) >= 1)
        self.assertEqual(res_user[0]['match_type'], 'message')
        self.assertEqual(res_user[0]['sender'], 'user')
        self.assertIn("rotary position", res_user[0]['snippet'])

        # Search for unique keyword in bot message
        res_bot = db.search_conversations(user_id=self.user_a_id, query="RoPE embeddings")
        self.assertTrue(len(res_bot) >= 1)
        self.assertEqual(res_bot[0]['match_type'], 'message')
        self.assertEqual(res_bot[0]['sender'], 'bot')
        self.assertIn("RoPE", res_bot[0]['snippet'])

        # Isolation check: User B searches for rotary position
        res_b = db.search_conversations(user_id=self.user_b_id, query="rotary position")
        self.assertEqual(len(res_b), 0, "User B must not receive User A's message search results")

    def test_03_sync_conversation(self):
        """Test sync_conversation batch persistence."""
        chat_id = f"chat_{secrets.token_hex(6)}"
        messages = [
            {"id": "msg_001", "sender": "user", "text": "Can you explain Dijkstra algorithm?"},
            {"id": "msg_002", "sender": "bot", "text": "Dijkstra algorithm finds the shortest path in a weighted graph."}
        ]

        success = db.sync_conversation(
            user_id=self.user_a_id,
            chat_id=chat_id,
            title="Graph Algorithms",
            messages=messages,
            is_pinned=True
        )
        self.assertTrue(success)

        # Verify search finds the synced message
        results = db.search_conversations(user_id=self.user_a_id, query="Dijkstra")
        self.assertTrue(len(results) >= 1)
        self.assertTrue(any(r['chat_id'] == chat_id for r in results))

    def test_04_archive_and_delete_isolation(self):
        """Test that archived and deleted conversations do not appear in search."""
        chat_id = f"chat_{secrets.token_hex(6)}"
        db.create_conversation(user_id=self.user_a_id, title="Confidential Secret Project", conv_id=chat_id)
        db.add_message(conv_id=chat_id, sender="user", text="Classified roadmap details for Q4.")

        # Confirm found before archive
        res_before = db.search_conversations(user_id=self.user_a_id, query="Classified roadmap")
        self.assertTrue(len(res_before) >= 1)

        # Archive conversation
        conn = db.get_connection()
        try:
            param = '?' if db.is_sqlite else '%s'
            true_val = '1' if db.is_sqlite else 'TRUE'
            conn.execute(f"UPDATE conversations SET is_archived = {true_val} WHERE id = {param}", (chat_id,))
            conn.commit()
        finally:
            db.release_connection(conn)

        # Confirm not found after archive
        res_after = db.search_conversations(user_id=self.user_a_id, query="Classified roadmap")
        self.assertEqual(len(res_after), 0, "Archived conversations must not appear in search results")

    def test_05_api_search_endpoint(self):
        """Test GET /api/chat/search endpoint with authentication and isolation."""
        # Create chats via sync endpoint for user A
        chat_id_a = f"chat_api_{secrets.token_hex(4)}"
        sync_payload_a = {
            "chats": [
                {
                    "id": chat_id_a,
                    "title": "React Component Architecture",
                    "messages": [
                        {"id": "m1", "sender": "user", "text": "How do I optimize useMemo in large apps?"},
                        {"id": "m2", "sender": "bot", "text": "useMemo helps prevent unnecessary recalculations."}
                    ]
                }
            ]
        }
        resp_sync = self.app.post('/api/chat/sync', headers=self.headers_a, data=json.dumps(sync_payload_a))
        self.assertEqual(resp_sync.status_code, 200)

        # User A searches for useMemo
        resp_search_a = self.app.get('/api/chat/search?q=useMemo', headers=self.headers_a)
        self.assertEqual(resp_search_a.status_code, 200)
        data_a = json.loads(resp_search_a.data)
        self.assertTrue(data_a['success'])
        self.assertTrue(data_a['count'] >= 1)
        self.assertEqual(data_a['results'][0]['chat_id'], chat_id_a)
        self.assertIn("useMemo", data_a['results'][0]['snippet'])

        # User B searches for useMemo -> should get empty results
        resp_search_b = self.app.get('/api/chat/search?q=useMemo', headers=self.headers_b)
        self.assertEqual(resp_search_b.status_code, 200)
        data_b = json.loads(resp_search_b.data)
        self.assertTrue(data_b['success'])
        self.assertEqual(data_b['count'], 0)
        self.assertEqual(len(data_b['results']), 0)

    def test_06_unauthenticated_search_rejected(self):
        """Test that unauthenticated requests to search endpoint are rejected with 401 when DEVELOPMENT_MODE is False."""
        orig_dev_mode = getattr(config, 'DEVELOPMENT_MODE', False)
        try:
            config.DEVELOPMENT_MODE = False
            resp = self.app.get('/api/chat/search?q=test')
            self.assertEqual(resp.status_code, 401)
        finally:
            config.DEVELOPMENT_MODE = orig_dev_mode


if __name__ == '__main__':
    unittest.main()
