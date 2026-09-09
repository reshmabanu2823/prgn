"""Unit and integration tests for real-time time and date by location."""
import json
import unittest
from unittest.mock import patch

from services import time_service, agent_tools
from services.prompt_builder import build_prompt
import app as app_module


class TimeServiceUnitTests(unittest.TestCase):
    def test_timezone_resolution_major_cities(self):
        # Tokyo
        tz, name, label = time_service.resolve_location_to_timezone("Tokyo")
        self.assertEqual(name, "Asia/Tokyo")
        self.assertIn("Tokyo", label)

        # London
        tz, name, label = time_service.resolve_location_to_timezone("London")
        self.assertEqual(name, "Europe/London")
        self.assertIn("London", label)

        # New York
        tz, name, label = time_service.resolve_location_to_timezone("New York")
        self.assertEqual(name, "America/New_York")
        self.assertIn("New York", label)

        # India / Delhi
        tz, name, label = time_service.resolve_location_to_timezone("Delhi")
        self.assertEqual(name, "Asia/Kolkata")
        tz_ind, name_ind, _ = time_service.resolve_location_to_timezone("India")
        self.assertEqual(name_ind, "Asia/Kolkata")

        # Sydney
        tz, name, label = time_service.resolve_location_to_timezone("Sydney")
        self.assertEqual(name, "Australia/Sydney")

        # Paris
        tz, name, label = time_service.resolve_location_to_timezone("Paris")
        self.assertEqual(name, "Europe/Paris")

    def test_timezone_abbreviations(self):
        tz, name, _ = time_service.resolve_location_to_timezone("IST")
        self.assertEqual(name, "Asia/Kolkata")

        tz, name, _ = time_service.resolve_location_to_timezone("UTC")
        self.assertEqual(name, "UTC")

        tz, name, _ = time_service.resolve_location_to_timezone("EST")
        self.assertEqual(name, "America/New_York")

        tz, name, _ = time_service.resolve_location_to_timezone("PST")
        self.assertEqual(name, "America/Los_Angeles")

        tz, name, _ = time_service.resolve_location_to_timezone("JST")
        self.assertEqual(name, "Asia/Tokyo")

    def test_extract_location_from_query(self):
        self.assertEqual(
            time_service.extract_location_from_query("what time is it in Tokyo?"),
            "Tokyo",
        )
        self.assertEqual(
            time_service.extract_location_from_query("what is the date in New York"),
            "New York",
        )
        self.assertEqual(
            time_service.extract_location_from_query("current time for London"),
            "London",
        )
        self.assertEqual(
            time_service.extract_location_from_query("what is today's date in Paris"),
            "Paris",
        )
        self.assertEqual(
            time_service.extract_location_from_query("Sydney time"),
            "Sydney",
        )
        self.assertIsNone(time_service.extract_location_from_query("what is the current time?"))
        self.assertIsNone(time_service.extract_location_from_query("what's today's date?"))
        self.assertIsNone(time_service.extract_location_from_query("what's the time?"))
        self.assertIsNone(time_service.extract_location_from_query("what is the time"))
        self.assertIsNone(time_service.extract_location_from_query("whats the time"))
        self.assertIsNone(time_service.extract_location_from_query("tell me the time"))
        self.assertIsNone(time_service.extract_location_from_query("the time"))

    def test_is_time_date_query(self):
        self.assertTrue(time_service.is_time_date_query("what time is it?"))
        self.assertTrue(time_service.is_time_date_query("what is the current time in Tokyo"))
        self.assertTrue(time_service.is_time_date_query("today's date"))
        self.assertTrue(time_service.is_time_date_query("what day of the week is it?"))
        self.assertTrue(time_service.is_time_date_query("time and date in New York"))
        self.assertFalse(time_service.is_time_date_query("tell me a story about time travel"))
        self.assertFalse(time_service.is_time_date_query("how do I configure a database"))

    def test_get_time_and_date_payload(self):
        res = time_service.get_time_and_date("Tokyo")
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["timezone"], "Asia/Tokyo")
        self.assertIn("Tokyo", res["resolved_location"])
        self.assertEqual(res["utc_offset"], "+09:00")
        self.assertTrue(len(res["time_12h"]) > 0)
        self.assertTrue(len(res["date"]) > 0)
        self.assertTrue(len(res["day_of_week"]) > 0)
        self.assertTrue(res["year"] >= 2024)
        self.assertIn("Tokyo", res["formatted_summary"])

    def test_agent_tools_integration(self):
        time_str = agent_tools.get_current_time("London")
        self.assertIn("London", time_str)
        data = agent_tools.get_time_and_date("New York")
        self.assertEqual(data["timezone"], "America/New_York")


class OrchestratorTimeIntegrationTests(unittest.TestCase):
    def setUp(self):
        app_module.app.config["TESTING"] = True
        self.client = app_module.app.test_client()

    def test_orchestrator_routes_location_time_query(self):
        res = app_module.orchestrator.handle_query(
            "what time is it in Tokyo?",
            language="en",
            user_timezone="Asia/Kolkata",
        )
        self.assertEqual(res["route"], "agent")
        self.assertEqual(res["action"], "time")
        self.assertIn("Tokyo", res["response"])
        self.assertTrue(len(res["actions"]) > 0)
        action_data = res["actions"][0]["data"]
        self.assertEqual(action_data["timezone"], "Asia/Tokyo")

    def test_orchestrator_routes_general_date_query_with_timezone(self):
        res = app_module.orchestrator.handle_query(
            "what's today's date?",
            language="en",
            user_timezone="America/New_York",
        )
        self.assertEqual(res["route"], "agent")
        self.assertEqual(res["action"], "time")
        self.assertTrue(len(res["response"]) > 0)
        action_data = res["actions"][0]["data"]
        self.assertEqual(action_data["timezone"], "America/New_York")

    def test_api_time_endpoint(self):
        # Query with location
        resp = self.client.get("/api/time?location=London")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["timezone"], "Europe/London")
        self.assertIn("London", data["resolved_location"])

        # Query with timezone
        resp2 = self.client.get("/api/time?timezone=Asia/Kolkata")
        self.assertEqual(resp2.status_code, 200)
        data2 = resp2.get_json()
        self.assertEqual(data2["timezone"], "Asia/Kolkata")
        self.assertEqual(data2["utc_offset"], "+05:30")

        # Query with X-Timezone header
        resp3 = self.client.get("/api/time", headers={"X-Timezone": "Asia/Tokyo"})
        self.assertEqual(resp3.status_code, 200)
        data3 = resp3.get_json()
        self.assertEqual(data3["timezone"], "Asia/Tokyo")

    def test_prompt_builder_includes_temporal_grounding(self):
        msgs = build_prompt(
            query="Hello, what can you do?",
            history=[],
            language="en",
            context_text=None,
            user_timezone="Asia/Tokyo",
            user_location="Tokyo",
        )
        sys_msg = msgs[0]["content"]
        self.assertIn("REAL-TIME TEMPORAL GROUNDING:", sys_msg)
        self.assertIn("Asia/Tokyo", sys_msg)
        self.assertIn("Tokyo", sys_msg)


if __name__ == "__main__":
    unittest.main()
