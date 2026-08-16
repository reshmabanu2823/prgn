"""Modular Web Search Service for Pragna Chatbot.

Provides external real-time web search capabilities without requiring an LLM API key
or paid search API keys. Keeps Qwen3-VL:8B as the final response generator.
"""
from __future__ import annotations

import html
import logging
import re
import time
from typing import Any, Dict, List, Optional
import urllib.parse

import requests

import config

logger = logging.getLogger(__name__)

# Control characters / prompt injection patterns to sanitize
_INJECTION_PATTERNS = [
    re.compile(r"ignore (all )?previous instructions", re.IGNORECASE),
    re.compile(r"you are now a", re.IGNORECASE),
    re.compile(r"system prompt:", re.IGNORECASE),
    re.compile(r"<\|im_start\|>", re.IGNORECASE),
    re.compile(r"<\|im_end\|>", re.IGNORECASE),
    re.compile(r"\[INST\]", re.IGNORECASE),
    re.compile(r"\[/INST\]", re.IGNORECASE),
]

_SCRIPT_STYLE_PATTERN = re.compile(r"<(script|style)[^>]*>.*?</\1>", re.DOTALL | re.IGNORECASE)
_HTML_TAG_PATTERN = re.compile(r"<[^>]+>")


def sanitize_web_text(text: str) -> str:
    """
    Sanitize untrusted text retrieved from external web pages.
    - Strips script and style code blocks entirely
    - Strips HTML tags
    - Unescapes HTML entities
    - Filters out prompt injection control sequences
    - Collapses excessive whitespace
    """
    if not text:
        return ""

    # Strip script and style blocks entirely
    clean = _SCRIPT_STYLE_PATTERN.sub(" ", text)

    # Strip HTML tags
    clean = _HTML_TAG_PATTERN.sub(" ", clean)

    # Unescape HTML entities (e.g. &amp; -> &)
    clean = html.unescape(clean)

    # Remove prompt injection vectors
    for pattern in _INJECTION_PATTERNS:
        clean = pattern.sub("[filtered]", clean)

    # Collapse multiple whitespaces/newlines
    clean = re.sub(r"\s+", " ", clean).strip()
    # Clean up spaces before punctuation (e.g. "World !" -> "World!")
    clean = re.sub(r"\s+([,.!?])", r"\1", clean)
    return clean



class WebSearchProvider:
    """Base interface for web search providers."""

    def search(self, query: str, max_results: int = 4, timeout: int = 5) -> List[Dict[str, str]]:
        """
        Execute search and return list of result dicts:
        [{"title": "...", "url": "...", "snippet": "..."}]
        """
        raise NotImplementedError


class DuckDuckGoSearchProvider(WebSearchProvider):
    """
    Free DuckDuckGo web search provider.
    Tries duckduckgo_search python library if installed;
    falls back to direct HTTP request to DDG HTML/Lite endpoint.
    Requires ZERO API keys.
    """

    def search(self, query: str, max_results: int = 4, timeout: int = 5) -> List[Dict[str, str]]:
        # Strategy 1: Try duckduckgo_search package if available
        try:
            from duckduckgo_search import DDGS
            with DDGS(timeout=timeout) as ddgs:
                results = list(ddgs.text(query, max_results=max_results))
                cleaned = []
                for item in results:
                    title = sanitize_web_text(item.get("title", ""))
                    url = item.get("href", "") or item.get("link", "")
                    snippet = sanitize_web_text(item.get("body", "") or item.get("snippet", ""))
                    if title and snippet:
                        cleaned.append({"title": title, "url": url, "snippet": snippet})
                if cleaned:
                    return cleaned[:max_results]
        except Exception as exc:
            logger.debug(f"DuckDuckGo package search failed/unavailable: {exc}. Trying HTTP fallback...")

        # Strategy 2: Direct HTTP request to DDG HTML endpoint
        return self._search_http_fallback(query, max_results=max_results, timeout=timeout)

    def _search_http_fallback(self, query: str, max_results: int = 4, timeout: int = 5) -> List[Dict[str, str]]:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "en-US,en;q=0.9",
        }
        url = "https://html.duckduckgo.com/html/"
        data = {"q": query, "b": ""}

        try:
            resp = requests.post(url, data=data, headers=headers, timeout=timeout)
            resp.raise_for_status()
            return self._parse_ddg_html(resp.text, max_results=max_results)
        except Exception as exc:
            logger.warning(f"DuckDuckGo HTTP fallback search failed for '{query}': {exc}")
            return []

    @staticmethod
    def _parse_ddg_html(html_text: str, max_results: int = 4) -> List[Dict[str, str]]:
        results: List[Dict[str, str]] = []
        
        # Regex extraction for DDG html structure
        result_blocks = re.findall(
            r'<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>.*?'
            r'<(?:a|div)[^>]+class="result__snippet"[^>]*>(.*?)</(?:a|div)>',
            html_text,
            re.DOTALL | re.IGNORECASE,
        )

        for raw_url, raw_title, raw_snippet in result_blocks:
            if len(results) >= max_results:
                break

            # Unquote DDG redirect link if needed
            final_url = raw_url
            if "uddg=" in raw_url:
                parsed = urllib.parse.parse_qs(urllib.parse.urlparse(raw_url).query)
                if "uddg" in parsed:
                    final_url = parsed["uddg"][0]

            title = sanitize_web_text(raw_title)
            snippet = sanitize_web_text(raw_snippet)

            if title and snippet:
                results.append({
                    "title": title,
                    "url": final_url,
                    "snippet": snippet,
                })

        return results


class WikipediaSearchProvider(WebSearchProvider):
    """
    Free Wikipedia Search provider for general knowledge/factual updates.
    Requires ZERO API keys.
    """

    def search(self, query: str, max_results: int = 3, timeout: int = 5) -> List[Dict[str, str]]:
        url = "https://en.wikipedia.org/w/api.php"
        params = {
            "action": "query",
            "list": "search",
            "srsearch": query,
            "format": "json",
            "srlimit": max_results,
        }
        headers = {"User-Agent": "PragnaChatbot/1.0 (Enterprise AI Assistant)"}

        try:
            resp = requests.get(url, params=params, headers=headers, timeout=timeout)
            resp.raise_for_status()
            data = resp.json()
            search_items = data.get("query", {}).get("search", [])

            results = []
            for item in search_items:
                title = sanitize_web_text(item.get("title", ""))
                snippet = sanitize_web_text(item.get("snippet", ""))
                page_id = item.get("pageid")
                page_url = f"https://en.wikipedia.org/?curid={page_id}" if page_id else "https://en.wikipedia.org"
                if title and snippet:
                    results.append({
                        "title": title,
                        "url": page_url,
                        "snippet": snippet,
                    })
            return results
        except Exception as exc:
            logger.warning(f"Wikipedia search failed for '{query}': {exc}")
            return []


class SerperSearchProvider(WebSearchProvider):
    """Optional Serper.dev Google search provider if SERPER_API_KEY is present."""

    def search(self, query: str, max_results: int = 4, timeout: int = 5) -> List[Dict[str, str]]:
        api_key = getattr(config, "SERPER_API_KEY", "")
        if not api_key:
            return []

        url = "https://google.serper.dev/search"
        headers = {
            "X-API-KEY": api_key,
            "Content-Type": "application/json",
        }
        payload = {"q": query, "num": max_results}

        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=timeout)
            resp.raise_for_status()
            data = resp.json()

            results = []
            for item in data.get("organic", []):
                title = sanitize_web_text(item.get("title", ""))
                url_str = item.get("link", "")
                snippet = sanitize_web_text(item.get("snippet", ""))
                if title and snippet:
                    results.append({
                        "title": title,
                        "url": url_str,
                        "snippet": snippet,
                    })
            return results[:max_results]
        except Exception as exc:
            logger.warning(f"Serper search provider failed: {exc}")
            return []


class WebSearchService:
    """
    Central Web Search Service orchestrating providers, caching, timing,
    and structured context delivery.
    """

    def __init__(self, provider_type: str = "auto"):
        self.provider_type = provider_type
        self.ddg_provider = DuckDuckGoSearchProvider()
        self.wiki_provider = WikipediaSearchProvider()
        self.serper_provider = SerperSearchProvider()

    def search(
        self,
        query: str,
        max_results: Optional[int] = None,
        timeout: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Execute web search and return structured result dictionary.

        Returns:
            {
                "context": str or None,
                "sources": list of dicts [{"title", "link", "snippet"}],
                "query": str,
                "results_count": int,
                "latency_ms": float,
                "error": str or None
            }
        """
        start_time = time.time()
        max_res = max_results or getattr(config, "WEB_SEARCH_MAX_RESULTS", 4)
        to_sec = timeout or getattr(config, "WEB_SEARCH_TIMEOUT", 5)

        logger.info(f"🌐 WEB SEARCH TRIGGERED: '{query}' (max_results={max_res}, timeout={to_sec}s)")

        results: List[Dict[str, str]] = []
        error_msg: Optional[str] = None

        try:
            # 1. Try Serper if explicitly configured and key available
            if getattr(config, "SERPER_ENABLED", False) and getattr(config, "SERPER_API_KEY", ""):
                results = self.serper_provider.search(query, max_results=max_res, timeout=to_sec)

            # 2. Default free search: DuckDuckGo
            if not results:
                results = self.ddg_provider.search(query, max_results=max_res, timeout=to_sec)

            # 3. Fallback: Wikipedia for knowledge queries if DDG yielded nothing
            if not results:
                logger.info(f"DDG returned no results for '{query}'. Trying Wikipedia fallback...")
                results = self.wiki_provider.search(query, max_results=max_res, timeout=to_sec)

        except Exception as exc:
            error_msg = str(exc)
            logger.error(f"❌ Web search service error for '{query}': {exc}", exc_info=True)

        latency = round((time.time() - start_time) * 1000, 2)
        logger.info(f"📊 WEB SEARCH COMPLETED: {len(results)} results in {latency}ms (error={error_msg})")

        if not results:
            return {
                "context": None,
                "sources": [],
                "query": query,
                "results_count": 0,
                "latency_ms": latency,
                "error": error_msg or "No search results found.",
            }

        # Build context block and source objects
        formatted_snippets = []
        sources = []
        for idx, item in enumerate(results, 1):
            title = item["title"]
            url = item["url"]
            snippet = item["snippet"]

            formatted_snippets.append(
                f"[{idx}] Title: {title}\n"
                f"    URL: {url}\n"
                f"    Snippet: {snippet}"
            )
            sources.append({
                "title": title,
                "link": url,
                "snippet": snippet[:200],
            })

        context_text = (
            "Extracted Real-Time Web Search Results:\n\n"
            + "\n\n".join(formatted_snippets)
        )

        return {
            "context": context_text,
            "sources": sources,
            "query": query,
            "results_count": len(results),
            "latency_ms": latency,
            "error": None,
        }


# Singleton instance helper
_search_service_instance: Optional[WebSearchService] = None


def get_web_search_service() -> WebSearchService:
    global _search_service_instance
    if _search_service_instance is None:
        _search_service_instance = WebSearchService()
    return _search_service_instance
