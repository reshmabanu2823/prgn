import unittest
from unittest.mock import patch, MagicMock
from services import oauth_service
import config


class TestOAuthService(unittest.TestCase):
    def test_state_creation_and_verification(self):
        state = oauth_service.make_state()
        self.assertTrue(bool(state))
        self.assertTrue(oauth_service.verify_state(state))
        self.assertFalse(oauth_service.verify_state("tampered_invalid_state"))
        self.assertFalse(oauth_service.verify_state(""))

    def test_sanitize_username(self):
        self.assertEqual(oauth_service.sanitize_username("Reshma Banu"), "reshma_banu")
        self.assertEqual(oauth_service.sanitize_username("User@123!#"), "user123")
        self.assertEqual(oauth_service.sanitize_username(""), "user")

    def test_google_authorize_url(self):
        state = oauth_service.make_state()
        url = oauth_service.google_authorize_url("http://localhost:5001/api/auth/google/callback", state)
        self.assertIn("accounts.google.com", url)
        self.assertIn("client_id=", url)
        self.assertIn("redirect_uri=", url)
        self.assertIn("state=", url)
        self.assertIn("openid+email+profile", url)

    def test_github_authorize_url(self):
        state = oauth_service.make_state()
        url = oauth_service.github_authorize_url("http://localhost:5001/api/auth/github/callback", state)
        self.assertIn("github.com/login/oauth/authorize", url)
        self.assertIn("client_id=", url)
        self.assertIn("redirect_uri=", url)
        self.assertIn("state=", url)
        self.assertIn("read%3Auser+user%3Aemail", url)

    def test_discord_authorize_url(self):
        state = oauth_service.make_state()
        url = oauth_service.discord_authorize_url("http://localhost:5001/api/auth/discord/callback", state)
        self.assertIn("discord.com/api/oauth2/authorize", url)
        self.assertIn("client_id=", url)
        self.assertIn("redirect_uri=", url)
        self.assertIn("state=", url)
        self.assertIn("identify+email", url)

    @patch("services.oauth_service.requests.post")
    @patch("services.oauth_service.requests.get")
    def test_google_fetch_profile(self, mock_get, mock_post):
        mock_token_res = MagicMock()
        mock_token_res.status_code = 200
        mock_token_res.json.return_value = {"access_token": "mock_google_token"}
        mock_post.return_value = mock_token_res

        mock_user_res = MagicMock()
        mock_user_res.status_code = 200
        mock_user_res.json.return_value = {
            "sub": "google-user-12345",
            "email": "testuser@gmail.com",
            "email_verified": True,
            "name": "Test User",
        }
        mock_get.return_value = mock_user_res

        profile = oauth_service.google_fetch_profile("fake_code", "http://localhost:5001/api/auth/google/callback")
        self.assertEqual(profile["email"], "testuser@gmail.com")
        self.assertEqual(profile["oauth_id"], "google-user-12345")
        self.assertEqual(profile["username_hint"], "testuser")

    @patch("services.oauth_service.requests.post")
    @patch("services.oauth_service.requests.get")
    def test_github_fetch_profile(self, mock_get, mock_post):
        mock_token_res = MagicMock()
        mock_token_res.status_code = 200
        mock_token_res.json.return_value = {"access_token": "mock_github_token"}
        mock_post.return_value = mock_token_res

        mock_user_res = MagicMock()
        mock_user_res.status_code = 200
        mock_user_res.json.return_value = {
            "id": 987654,
            "login": "githubcoder",
            "email": "coder@github.com",
        }
        mock_get.return_value = mock_user_res

        profile = oauth_service.github_fetch_profile("fake_code", "http://localhost:5001/api/auth/github/callback")
        self.assertEqual(profile["email"], "coder@github.com")
        self.assertEqual(profile["oauth_id"], "987654")
        self.assertEqual(profile["username_hint"], "githubcoder")

    @patch("services.oauth_service.requests.post")
    @patch("services.oauth_service.requests.get")
    def test_discord_fetch_profile(self, mock_get, mock_post):
        mock_token_res = MagicMock()
        mock_token_res.status_code = 200
        mock_token_res.json.return_value = {"access_token": "mock_discord_token"}
        mock_post.return_value = mock_token_res

        mock_user_res = MagicMock()
        mock_user_res.status_code = 200
        mock_user_res.json.return_value = {
            "id": "1548002088389185606",
            "username": "discorduser",
            "global_name": "Discord Master",
            "email": "discorduser@example.com",
            "verified": True,
        }
        mock_get.return_value = mock_user_res

        profile = oauth_service.discord_fetch_profile("fake_code", "http://localhost:5001/api/auth/discord/callback")
        self.assertEqual(profile["email"], "discorduser@example.com")
        self.assertEqual(profile["oauth_id"], "1548002088389185606")
        self.assertEqual(profile["username_hint"], "discord_master")


if __name__ == "__main__":
    unittest.main()
