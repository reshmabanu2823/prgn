#!/usr/bin/env python3
"""Direct test of demo responses to debug mode formatting."""

import logging
import sys

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Set up DEBUG logging
logging.basicConfig(level=logging.DEBUG, format='%(name)s - %(levelname)s - %(message)s')

from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

print("=" * 80)
print("TEST 1: Direct demo_responses test")
print("=" * 80)

from services.demo_responses import get_demo_response, _format_response_for_mode

# Test the formatting function directly
print("\n🧪 Testing _format_response_for_mode() directly:")
test_content = "Key features of blockchain..."
formatted = _format_response_for_mode(test_content, "explain_concepts", "en")
print(f"Input: {test_content}")
print(f"Output: {formatted[:100]}...")
print(f"Prefix present: {'📚' in formatted}")

# Test get_demo_response
print("\n🧪 Testing get_demo_response for blockchain:")
response = get_demo_response("blockchain", language="en", chat_mode="explain_concepts")
print(f"Response: {response[:150]}...")
print(f"Prefix present: {'📚' in response}")

print("\n" + "=" * 80)
