"""Serper-based search helper with cleaned context and caching."""
from __future__ import annotations

import logging
import re
from typing import Dict, List

import requests

import config
from services.cache_service import get_cache_service

logger = logging.getLogger(__name__)

_SEARCH_URL = "https://google.serper.dev/search"
_MAX_RESULTS = 3
_MIN_SNIPPET_LEN = 25
_SEARCH_CACHE_TTL = 300  # 5 minutes for search results
_LIVE_SEARCH_CACHE_TTL = 45

_SPORTS_LIVE_KEYWORDS = {
    "ipl", "cricket", "live score", "score", "match", "t20", "odi", "test",
    "csk", "rcb", "mi", "kkr", "srh", "dc", "rr", "pbks", "lsg", "gt",
}


def fetch_search_context(query: str) -> Dict[str, object]:
    """
    Return formatted context and sources for realtime queries.
    
    Uses WebSearchService (DuckDuckGo keyless search default, Serper fallback if configured)
    and caches results for 5 minutes to avoid repeated external network requests.
    """
    if not getattr(config, "WEB_SEARCH_ENABLED", True):
        return {"context": None, "sources": []}

    # ==================== CACHING LOGIC ====================
    cache = get_cache_service()
    prepared_query = _prepare_live_query(query)
    live_mode = _is_live_query(query)
    cache_key = cache.generate_cache_key(prepared_query, language="en", cache_type="search")
    
    # Check cache first
    cached_result = cache.get_cache(cache_key)
    if cached_result is not None:
        logger.info(f"🔥 Search Cache HIT for: {query[:50]}...")
        return cached_result
    # =====================================================

    from services.web_search_service import get_web_search_service

    search_service = get_web_search_service()
    search_res = search_service.search(prepared_query)

    context = search_res.get("context")
    sources = search_res.get("sources", [])

    if not context or not sources:
        return {"context": None, "sources": []}

    result = {
        "context": context,
        "sources": sources,
        "live_mode": live_mode,
        "resolved_query": prepared_query,
    }
    
    # ==================== CACHE STORAGE ====================
    ttl = _LIVE_SEARCH_CACHE_TTL if live_mode else _SEARCH_CACHE_TTL
    cache.set_cache(cache_key, result, ttl)
    logger.info(f"💾 Search result cached (ttl: {ttl}s)")
    # =====================================================
    
    return result



def _clean_snippet(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def _is_live_query(query: str) -> bool:
    lowered = (query or "").lower()
    return any(token in lowered for token in _SPORTS_LIVE_KEYWORDS) or "live" in lowered


def _prepare_live_query(query: str) -> str:
    raw = (query or "").strip()
    lowered = raw.lower()
    if not raw:
        return raw

    # Bias cricket/ipl requests toward trusted scoreboard providers.
    if any(token in lowered for token in ("ipl", "cricket", "live score", "score")):
        return (
            f"{raw} latest live score from Cricbuzz OR ESPNcricinfo OR IPL official"
        )
    return raw
