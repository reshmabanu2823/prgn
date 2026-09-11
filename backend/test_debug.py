#!/usr/bin/env python3
"""Direct test of demo responses to debug mode formatting."""

import logging
import sys
from pathlib import Path

# Set up DEBUG logging
logging.basicConfig(level=logging.DEBUG, format='%(name)s - %(levelname)s - %(message)s')

# Add backend services to path
sys.path.insert(0, str(Path(__file__).parent))

from services.demo_responses import get_demo_response, _format_response_for_mode

if __name__ == "__main__":
    print("=" * 80)
    print("TEST 1: Direct demo_responses test")
    print("=" * 80)

    # Test the formatting function directly
    print("\nTesting _format_response_for_mode() directly:")
    test_content = "Key features of blockchain..."
    formatted = _format_response_for_mode(test_content, "explain_concepts", "en")
    print(f"Input: {test_content}")
    print(f"Output: {formatted[:100]}...")
    print(f"Prefix present: {'📚' in formatted}")

    # Test get_demo_response
    print("\nTesting get_demo_response for blockchain:")
    response = get_demo_response("blockchain", language="en", chat_mode="explain_concepts")
    print(f"Response: {response[:150]}...")
    print(f"Prefix present: {'📚' in response}")

    print("\n" + "=" * 80)
