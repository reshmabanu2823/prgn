"""Intent classification service relying on Groq."""
from __future__ import annotations

import json
import logging
import re
from typing import Dict, Optional

import config
from services.llm import generate_completion

logger = logging.getLogger(__name__)

_ALLOWED_INTENTS = {"general", "realtime", "news", "tool"}
_CLASSIFIER_PROMPT = (
    "You are an intent classifier for a multilingual enterprise assistant. "
    "Decide if the user request is general, realtime, news, or tool. "
    "Realtime covers questions about current facts, recent events, elections, finance, scores, "
    "newly released products, AI models (such as GPT-6, Astra, DeepSeek, Claude, Gemini), "
    "software versions, specs, tech announcements, or factual entity lookups. "
    "News covers headline or industry update requests. "
    "Tool covers arithmetic or calculator-like expressions. "
    "General covers broad conceptual knowledge, creative writing, coding advice, greetings, or conversational questions. "
    "Respond ONLY with JSON like {\"intent\": \"realtime\", \"confidence\": 0.9, \"reason\": \"...\"}."
)

_FALLBACK_KEYWORDS = {
    "tool": ["calculate", "times", "multiply", "divided", "sum", "product", "calculator"],
    "news": [
        "news", "headlines", "breaking", "press release", "recent events",
        "today's news", "latest news", "world news"
    ],
    "realtime": [
        "current", "today", "now", "right now", "cm of", "price", "score", "live", "won",
        "latest", "latest version", "current version", "latest development", "latest developments",
        "recent research", "current technology", "current technologies", "latest ai",
        "newest version", "recent update", "recent updates", "what is the latest", "what are the latest",
        "release date", "released", "launch", "launched", "announced", "features", "specifications", "specs",
        "benchmark", "benchmarks", "pricing", "cost of", "founder of", "ceo of",
        "gpt", "gpt-4", "gpt-5", "gpt-6", "gpt 4", "gpt 5", "gpt 6", "gpt astra", "astra",
        "openai", "deepseek", "gemini", "claude", "mistral", "llama", "grok", "sora", "qwen",
        "chatgpt astra", "project astra",
    ],
}

_CHITCHAT_EXACT = {
    "hi", "hello", "hey", "hola", "namaste", "sup", "yo",
    "good morning", "good afternoon", "good evening", "good night",
    "how are you", "how are you doing", "what's up", "whats up",
    "who are you", "what are you", "what can you do", "help",
    "thanks", "thank you", "ok", "okay", "cool", "nice", "great",
    "bye", "goodbye", "see you", "tell me a joke", "make me laugh",
    "test", "testing", "ping"
}

_MATH_SYMBOL_PATTERN = re.compile(r"[+\-*/=]")
_MATH_EXPRESSION_PATTERN = re.compile(r"\d+\s*([+\-*/]\s*\d+)+")
_MODEL_VERSION_PATTERN = re.compile(
    r"\b(gpt|claude|gemini|deepseek|llama|grok|qwen|mistral|sora|astra|iphone|pixel|rtx|react|python|angular|vue|vuejs|node)\s*[-_]?\s*(\d+(\.\d+)*|[a-z]+)\b",
    re.IGNORECASE
)

def classify_query(query: str, model_override: Optional[str] = None) -> Dict[str, object]:
    """Return the detected intent for a user query."""
    cleaned = (query or "").strip()
    if not cleaned:
        return {"intent": "general", "confidence": 0.0}

    lowered = cleaned.lower().strip(".,!?- ")

    # Pure chitchat fast path
    if lowered in _CHITCHAT_EXACT:
        return {"intent": "general", "confidence": 0.95}

    # Fast-path heuristics for obvious intents
    heuristic_intent = _fallback_intent(cleaned)
    if heuristic_intent != "general":
        return {"intent": heuristic_intent, "confidence": 0.92}

    # Model / version / tech lookup pattern matching
    if _MODEL_VERSION_PATTERN.search(cleaned):
        return {"intent": "realtime", "confidence": 0.90}

    messages = [
        {"role": "system", "content": _CLASSIFIER_PROMPT},
        {"role": "user", "content": cleaned},
    ]

    try:
        selected_model = model_override or config.CLASSIFIER_MODEL_KEY
        content = generate_completion(
            messages,
            model_override=selected_model,
            fallback_models=config.CLASSIFIER_FALLBACKS,
        )
        parsed = _parse_classifier_json(content)
        intent = parsed.get("intent", "general").lower()
        confidence = float(parsed.get("confidence", 0.0))
        if intent not in _ALLOWED_INTENTS:
            intent = _fallback_intent(cleaned)
        # Guardrail: do not classify as tool unless it really looks arithmetic.
        if intent == "tool" and not _looks_like_math_query(cleaned):
            intent = "general"
        return {"intent": intent, "confidence": confidence}
    except Exception as exc:
        logger.error("Intent classification failed: %s", exc)
        fallback = _fallback_intent(cleaned)
        return {"intent": fallback, "confidence": 0.0}


def _parse_classifier_json(content: str) -> Dict[str, object]:
    snippet = content.strip()
    if snippet.startswith("```"):
        snippet = snippet.split("\n", 1)[1]
        snippet = snippet.rsplit("```", 1)[0]
    try:
        return json.loads(snippet)
    except json.JSONDecodeError:
        return {}


def _contains_keyword(lowered: str, keyword: str) -> bool:
    """Match keyword as a whole word/phrase, not a bare substring.

    Plain `keyword in lowered` false-positives on e.g. "know" containing
    "now", or "wonder" containing "won" - misrouting ordinary chat into
    the realtime/news intent paths.
    """
    return re.search(r"(?<!\w)" + re.escape(keyword) + r"(?!\w)", lowered) is not None


def _fallback_intent(query: str) -> str:
    lowered = query.lower()
    if _looks_like_math_query(lowered):
        return "tool"
    if any(_contains_keyword(lowered, keyword) for keyword in _FALLBACK_KEYWORDS["tool"]):
        return "tool"
    if any(_contains_keyword(lowered, keyword) for keyword in _FALLBACK_KEYWORDS["news"]):
        return "news"
    if any(_contains_keyword(lowered, keyword) for keyword in _FALLBACK_KEYWORDS["realtime"]):
        return "realtime"
    return "general"


def _looks_like_math_query(text: str) -> bool:
    """Return True only for calculator-like inputs, not generic alphanumeric tokens."""
    normalized = (text or "").strip().lower()
    if not normalized:
        return False

    if _MATH_EXPRESSION_PATTERN.search(normalized):
        return True

    has_symbol = bool(_MATH_SYMBOL_PATTERN.search(normalized))
    has_digit = any(ch.isdigit() for ch in normalized)
    if has_symbol and has_digit:
        return True

    math_phrases = ["calculate", "sum of", "difference", "product", "divide", "multiply"]
    return any(phrase in normalized for phrase in math_phrases)
