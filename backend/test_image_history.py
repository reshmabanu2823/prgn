import unittest
import json
import uuid
from database import db
from app import app

class TestImageHistory(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        self.user_id = f"test_user_{uuid.uuid4().hex[:8]}"

    def test_save_and_retrieve_history(self):
        # Save two items
        id1 = db.save_image_generation(
            user_id=self.user_id,
            prompt="Cyberpunk street in the rain",
            effective_prompt="A hyper-detailed cyberpunk street in rain, neon reflection 8k",
            style="cinematic",
            quality="hd",
            size="1024x1024",
            provider="pollinations",
            model="flux",
            image_url="https://image.pollinations.ai/prompt/cyberpunk",
        )
        self.assertIsNotNone(id1)

        id2 = db.save_image_generation(
            user_id=self.user_id,
            prompt="A golden royal tiger portrait",
            effective_prompt="Studio shot of majestic golden tiger",
            style="photo",
            quality="hd",
            size="1536x1024",
            provider="openai",
            model="dall-e-3",
            image_url="https://example.com/tiger.png",
        )
        self.assertIsNotNone(id2)

        # Retrieve through DB function
        history = db.get_user_image_history(user_id=self.user_id, limit=10)
        self.assertEqual(len(history), 2)
        self.assertEqual(history[0]['id'], id2) # most recent first
        self.assertEqual(history[1]['id'], id1)

        # Retrieve through HTTP API
        response = self.client.get(f'/api/images/history?user_id={self.user_id}')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['status'], 'success')
        self.assertEqual(data['count'], 2)
        self.assertEqual(len(data['history']), 2)

        # Delete single item
        del_resp = self.client.delete(f'/api/images/history/{id1}?user_id={self.user_id}')
        self.assertEqual(del_resp.status_code, 200)
        
        # Verify only 1 left
        history_after_del = db.get_user_image_history(user_id=self.user_id)
        self.assertEqual(len(history_after_del), 1)
        self.assertEqual(history_after_del[0]['id'], id2)

        # Clear all
        clear_resp = self.client.delete(f'/api/images/history?user_id={self.user_id}')
        self.assertEqual(clear_resp.status_code, 200)
        
        # Verify 0 left
        history_empty = db.get_user_image_history(user_id=self.user_id)
        self.assertEqual(len(history_empty), 0)

if __name__ == '__main__':
    unittest.main()
