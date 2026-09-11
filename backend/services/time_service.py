"""Real-time Time and Date Service with Global Location & Timezone Resolution.

Provides accurate, real-time date, time, timezone, and calendar data for any location
worldwide, or for the client/server local timezone.
"""
from __future__ import annotations

import datetime
import logging
import re
from typing import Any, Dict, Optional, Tuple
import zoneinfo
from zoneinfo import ZoneInfo

import requests

logger = logging.getLogger(__name__)

# Common timezone abbreviations to IANA canonical names
ABBREVIATION_MAP: Dict[str, str] = {
    "utc": "UTC",
    "gmt": "Etc/GMT",
    "z": "UTC",
    "ist": "Asia/Kolkata",
    "est": "America/New_York",
    "edt": "America/New_York",
    "cst": "America/Chicago",
    "cdt": "America/Chicago",
    "mst": "America/Denver",
    "mdt": "America/Denver",
    "pst": "America/Los_Angeles",
    "pdt": "America/Los_Angeles",
    "akst": "America/Anchorage",
    "akdt": "America/Anchorage",
    "hst": "Pacific/Honolulu",
    "bst": "Europe/London",
    "cet": "Europe/Paris",
    "cest": "Europe/Paris",
    "eet": "Europe/Athens",
    "eest": "Europe/Athens",
    "jst": "Asia/Tokyo",
    "kst": "Asia/Seoul",
    "hkt": "Asia/Hong_Kong",
    "sgt": "Asia/Singapore",
    "aest": "Australia/Sydney",
    "aedt": "Australia/Sydney",
    "acst": "Australia/Darwin",
    "acdt": "Australia/Adelaide",
    "awst": "Australia/Perth",
    "nzst": "Pacific/Auckland",
    "nzdt": "Pacific/Auckland",
    "wet": "Europe/Lisbon",
    "west": "Europe/Lisbon",
    "cat": "Africa/Harare",
    "eat": "Africa/Nairobi",
    "wat": "Africa/Lagos",
    # Windows system timezone display names
    "india standard time": "Asia/Kolkata",
    "india daylight time": "Asia/Kolkata",
    "pacific standard time": "America/Los_Angeles",
    "pacific daylight time": "America/Los_Angeles",
    "eastern standard time": "America/New_York",
    "eastern daylight time": "America/New_York",
    "central standard time": "America/Chicago",
    "central daylight time": "America/Chicago",
    "mountain standard time": "America/Denver",
    "mountain daylight time": "America/Denver",
    "greenwich mean time": "Etc/GMT",
}

# Extensive curated map of world cities, countries, and regions to primary IANA timezone
LOCATION_TIMEZONE_MAP: Dict[str, Tuple[str, str]] = {
    # India & South Asia
    "india": ("Asia/Kolkata", "India"),
    "bharat": ("Asia/Kolkata", "India"),
    "delhi": ("Asia/Kolkata", "Delhi, India"),
    "new delhi": ("Asia/Kolkata", "New Delhi, India"),
    "mumbai": ("Asia/Kolkata", "Mumbai, India"),
    "bangalore": ("Asia/Kolkata", "Bengaluru, India"),
    "bengaluru": ("Asia/Kolkata", "Bengaluru, India"),
    "kolkata": ("Asia/Kolkata", "Kolkata, India"),
    "chennai": ("Asia/Kolkata", "Chennai, India"),
    "hyderabad": ("Asia/Kolkata", "Hyderabad, India"),
    "pune": ("Asia/Kolkata", "Pune, India"),
    "ahmedabad": ("Asia/Kolkata", "Ahmedabad, India"),
    "jaipur": ("Asia/Kolkata", "Jaipur, India"),
    "lucknow": ("Asia/Kolkata", "Lucknow, India"),
    "chandigarh": ("Asia/Kolkata", "Chandigarh, India"),
    "kerala": ("Asia/Kolkata", "Kerala, India"),
    "goa": ("Asia/Kolkata", "Goa, India"),
    "pakistan": ("Asia/Karachi", "Pakistan"),
    "karachi": ("Asia/Karachi", "Karachi, Pakistan"),
    "lahore": ("Asia/Karachi", "Lahore, Pakistan"),
    "islamabad": ("Asia/Karachi", "Islamabad, Pakistan"),
    "bangladesh": ("Asia/Dhaka", "Bangladesh"),
    "dhaka": ("Asia/Dhaka", "Dhaka, Bangladesh"),
    "sri lanka": ("Asia/Colombo", "Sri Lanka"),
    "colombo": ("Asia/Colombo", "Colombo, Sri Lanka"),
    "nepal": ("Asia/Kathmandu", "Nepal"),
    "kathmandu": ("Asia/Kathmandu", "Kathmandu, Nepal"),

    # East Asia
    "japan": ("Asia/Tokyo", "Japan"),
    "tokyo": ("Asia/Tokyo", "Tokyo, Japan"),
    "osaka": ("Asia/Tokyo", "Osaka, Japan"),
    "kyoto": ("Asia/Tokyo", "Kyoto, Japan"),
    "yokohama": ("Asia/Tokyo", "Yokohama, Japan"),
    "south korea": ("Asia/Seoul", "South Korea"),
    "korea": ("Asia/Seoul", "South Korea"),
    "seoul": ("Asia/Seoul", "Seoul, South Korea"),
    "china": ("Asia/Shanghai", "China"),
    "beijing": ("Asia/Shanghai", "Beijing, China"),
    "shanghai": ("Asia/Shanghai", "Shanghai, China"),
    "guangzhou": ("Asia/Shanghai", "Guangzhou, China"),
    "shenzhen": ("Asia/Shanghai", "Shenzhen, China"),
    "hong kong": ("Asia/Hong_Kong", "Hong Kong"),
    "taiwan": ("Asia/Taipei", "Taiwan"),
    "taipei": ("Asia/Taipei", "Taipei, Taiwan"),

    # Southeast Asia
    "singapore": ("Asia/Singapore", "Singapore"),
    "thailand": ("Asia/Bangkok", "Thailand"),
    "bangkok": ("Asia/Bangkok", "Bangkok, Thailand"),
    "malaysia": ("Asia/Kuala_Lumpur", "Malaysia"),
    "kuala lumpur": ("Asia/Kuala_Lumpur", "Kuala Lumpur, Malaysia"),
    "indonesia": ("Asia/Jakarta", "Indonesia"),
    "jakarta": ("Asia/Jakarta", "Jakarta, Indonesia"),
    "bali": ("Asia/Makassar", "Bali, Indonesia"),
    "vietnam": ("Asia/Ho_Chi_Minh", "Vietnam"),
    "hanoi": ("Asia/Ho_Chi_Minh", "Hanoi, Vietnam"),
    "ho chi minh": ("Asia/Ho_Chi_Minh", "Ho Chi Minh City, Vietnam"),
    "philippines": ("Asia/Manila", "Philippines"),
    "manila": ("Asia/Manila", "Manila, Philippines"),

    # Middle East
    "uae": ("Asia/Dubai", "United Arab Emirates"),
    "united arab emirates": ("Asia/Dubai", "United Arab Emirates"),
    "dubai": ("Asia/Dubai", "Dubai, UAE"),
    "abu dhabi": ("Asia/Dubai", "Abu Dhabi, UAE"),
    "qatar": ("Asia/Qatar", "Qatar"),
    "doha": ("Asia/Qatar", "Doha, Qatar"),
    "saudi arabia": ("Asia/Riyadh", "Saudi Arabia"),
    "riyadh": ("Asia/Riyadh", "Riyadh, Saudi Arabia"),
    "jeddah": ("Asia/Riyadh", "Jeddah, Saudi Arabia"),
    "kuwait": ("Asia/Kuwait", "Kuwait"),
    "bahrain": ("Asia/Bahrain", "Bahrain"),
    "oman": ("Asia/Muscat", "Oman"),
    "muscat": ("Asia/Muscat", "Muscat, Oman"),
    "israel": ("Asia/Jerusalem", "Israel"),
    "tel aviv": ("Asia/Jerusalem", "Tel Aviv, Israel"),
    "jerusalem": ("Asia/Jerusalem", "Jerusalem, Israel"),
    "turkey": ("Europe/Istanbul", "Turkey"),
    "istanbul": ("Europe/Istanbul", "Istanbul, Turkey"),
    "ankara": ("Europe/Istanbul", "Ankara, Turkey"),

    # Europe
    "uk": ("Europe/London", "United Kingdom"),
    "united kingdom": ("Europe/London", "United Kingdom"),
    "england": ("Europe/London", "England, UK"),
    "london": ("Europe/London", "London, UK"),
    "scotland": ("Europe/London", "Scotland, UK"),
    "edinburgh": ("Europe/London", "Edinburgh, UK"),
    "manchester": ("Europe/London", "Manchester, UK"),
    "birmingham": ("Europe/London", "Birmingham, UK"),
    "ireland": ("Europe/Dublin", "Ireland"),
    "dublin": ("Europe/Dublin", "Dublin, Ireland"),
    "france": ("Europe/Paris", "France"),
    "paris": ("Europe/Paris", "Paris, France"),
    "lyon": ("Europe/Paris", "Lyon, France"),
    "marseille": ("Europe/Paris", "Marseille, France"),
    "germany": ("Europe/Berlin", "Germany"),
    "berlin": ("Europe/Berlin", "Berlin, Germany"),
    "munich": ("Europe/Berlin", "Munich, Germany"),
    "frankfurt": ("Europe/Berlin", "Frankfurt, Germany"),
    "hamburg": ("Europe/Berlin", "Hamburg, Germany"),
    "italy": ("Europe/Rome", "Italy"),
    "rome": ("Europe/Rome", "Rome, Italy"),
    "milan": ("Europe/Rome", "Milan, Italy"),
    "spain": ("Europe/Madrid", "Spain"),
    "madrid": ("Europe/Madrid", "Madrid, Spain"),
    "barcelona": ("Europe/Madrid", "Barcelona, Spain"),
    "netherlands": ("Europe/Amsterdam", "Netherlands"),
    "amsterdam": ("Europe/Amsterdam", "Amsterdam, Netherlands"),
    "belgium": ("Europe/Brussels", "Belgium"),
    "brussels": ("Europe/Brussels", "Brussels, Belgium"),
    "switzerland": ("Europe/Zurich", "Switzerland"),
    "zurich": ("Europe/Zurich", "Zurich, Switzerland"),
    "geneva": ("Europe/Zurich", "Geneva, Switzerland"),
    "austria": ("Europe/Vienna", "Austria"),
    "vienna": ("Europe/Vienna", "Vienna, Austria"),
    "sweden": ("Europe/Stockholm", "Sweden"),
    "stockholm": ("Europe/Stockholm", "Stockholm, Sweden"),
    "norway": ("Europe/Oslo", "Norway"),
    "oslo": ("Europe/Oslo", "Oslo, Norway"),
    "denmark": ("Europe/Copenhagen", "Denmark"),
    "copenhagen": ("Europe/Copenhagen", "Copenhagen, Denmark"),
    "finland": ("Europe/Helsinki", "Finland"),
    "helsinki": ("Europe/Helsinki", "Helsinki, Finland"),
    "poland": ("Europe/Warsaw", "Poland"),
    "warsaw": ("Europe/Warsaw", "Warsaw, Poland"),
    "czech republic": ("Europe/Prague", "Czech Republic"),
    "prague": ("Europe/Prague", "Prague, Czech Republic"),
    "greece": ("Europe/Athens", "Greece"),
    "athens": ("Europe/Athens", "Athens, Greece"),
    "portugal": ("Europe/Lisbon", "Portugal"),
    "lisbon": ("Europe/Lisbon", "Lisbon, Portugal"),
    "russia": ("Europe/Moscow", "Russia"),
    "moscow": ("Europe/Moscow", "Moscow, Russia"),
    "saint petersburg": ("Europe/Moscow", "Saint Petersburg, Russia"),

    # North America
    "us": ("America/New_York", "United States"),
    "usa": ("America/New_York", "United States"),
    "united states": ("America/New_York", "United States"),
    "new york": ("America/New_York", "New York, USA"),
    "new york city": ("America/New_York", "New York City, USA"),
    "nyc": ("America/New_York", "New York City, USA"),
    "washington": ("America/New_York", "Washington, D.C., USA"),
    "washington dc": ("America/New_York", "Washington, D.C., USA"),
    "dc": ("America/New_York", "Washington, D.C., USA"),
    "boston": ("America/New_York", "Boston, USA"),
    "philadelphia": ("America/New_York", "Philadelphia, USA"),
    "miami": ("America/New_York", "Miami, USA"),
    "atlanta": ("America/New_York", "Atlanta, USA"),
    "florida": ("America/New_York", "Florida, USA"),
    "chicago": ("America/Chicago", "Chicago, USA"),
    "illinois": ("America/Chicago", "Illinois, USA"),
    "texas": ("America/Chicago", "Texas, USA"),
    "houston": ("America/Chicago", "Houston, USA"),
    "dallas": ("America/Chicago", "Dallas, USA"),
    "austin": ("America/Chicago", "Austin, USA"),
    "san antonio": ("America/Chicago", "San Antonio, USA"),
    "denver": ("America/Denver", "Denver, USA"),
    "colorado": ("America/Denver", "Colorado, USA"),
    "phoenix": ("America/Phoenix", "Phoenix, USA"),
    "arizona": ("America/Phoenix", "Arizona, USA"),
    "salt lake city": ("America/Denver", "Salt Lake City, USA"),
    "utah": ("America/Denver", "Utah, USA"),
    "los angeles": ("America/Los_Angeles", "Los Angeles, USA"),
    "la": ("America/Los_Angeles", "Los Angeles, USA"),
    "california": ("America/Los_Angeles", "California, USA"),
    "san francisco": ("America/Los_Angeles", "San Francisco, USA"),
    "sf": ("America/Los_Angeles", "San Francisco, USA"),
    "bay area": ("America/Los_Angeles", "San Francisco Bay Area, USA"),
    "san jose": ("America/Los_Angeles", "San Jose, USA"),
    "san diego": ("America/Los_Angeles", "San Diego, USA"),
    "seattle": ("America/Los_Angeles", "Seattle, USA"),
    "portland": ("America/Los_Angeles", "Portland, USA"),
    "las vegas": ("America/Los_Angeles", "Las Vegas, USA"),
    "anchorage": ("America/Anchorage", "Anchorage, Alaska, USA"),
    "alaska": ("America/Anchorage", "Alaska, USA"),
    "honolulu": ("Pacific/Honolulu", "Honolulu, Hawaii, USA"),
    "hawaii": ("Pacific/Honolulu", "Hawaii, USA"),

    "canada": ("America/Toronto", "Canada"),
    "toronto": ("America/Toronto", "Toronto, Canada"),
    "montreal": ("America/Toronto", "Montreal, Canada"),
    "ottawa": ("America/Toronto", "Ottawa, Canada"),
    "vancouver": ("America/Vancouver", "Vancouver, Canada"),
    "calgary": ("America/Edmonton", "Calgary, Canada"),
    "edmonton": ("America/Edmonton", "Edmonton, Canada"),
    "mexico": ("America/Mexico_City", "Mexico"),
    "mexico city": ("America/Mexico_City", "Mexico City, Mexico"),

    # South America
    "brazil": ("America/Sao_Paulo", "Brazil"),
    "sao paulo": ("America/Sao_Paulo", "São Paulo, Brazil"),
    "são paulo": ("America/Sao_Paulo", "São Paulo, Brazil"),
    "rio": ("America/Sao_Paulo", "Rio de Janeiro, Brazil"),
    "rio de janeiro": ("America/Sao_Paulo", "Rio de Janeiro, Brazil"),
    "argentina": ("America/Argentina/Buenos_Aires", "Argentina"),
    "buenos aires": ("America/Argentina/Buenos_Aires", "Buenos Aires, Argentina"),
    "chile": ("America/Santiago", "Chile"),
    "santiago": ("America/Santiago", "Santiago, Chile"),
    "colombia": ("America/Bogota", "Colombia"),
    "bogota": ("America/Bogota", "Bogota, Colombia"),
    "peru": ("America/Lima", "Peru"),
    "lima": ("America/Lima", "Lima, Peru"),

    # Oceania
    "australia": ("Australia/Sydney", "Australia"),
    "sydney": ("Australia/Sydney", "Sydney, Australia"),
    "melbourne": ("Australia/Melbourne", "Melbourne, Australia"),
    "brisbane": ("Australia/Brisbane", "Brisbane, Australia"),
    "perth": ("Australia/Perth", "Perth, Australia"),
    "adelaide": ("Australia/Adelaide", "Adelaide, Australia"),
    "canberra": ("Australia/Sydney", "Canberra, Australia"),
    "new zealand": ("Pacific/Auckland", "New Zealand"),
    "auckland": ("Pacific/Auckland", "Auckland, New Zealand"),
    "wellington": ("Pacific/Auckland", "Wellington, New Zealand"),

    # Africa
    "egypt": ("Africa/Cairo", "Egypt"),
    "cairo": ("Africa/Cairo", "Cairo, Egypt"),
    "south africa": ("Africa/Johannesburg", "South Africa"),
    "johannesburg": ("Africa/Johannesburg", "Johannesburg, South Africa"),
    "cape town": ("Africa/Johannesburg", "Cape Town, South Africa"),
    "kenya": ("Africa/Nairobi", "Kenya"),
    "nairobi": ("Africa/Nairobi", "Nairobi, Kenya"),
    "nigeria": ("Africa/Lagos", "Nigeria"),
    "lagos": ("Africa/Lagos", "Lagos, Nigeria"),
    "morocco": ("Africa/Casablanca", "Morocco"),
    "casablanca": ("Africa/Casablanca", "Casablanca, Morocco"),
    "ghana": ("Africa/Accra", "Ghana"),
    "accra": ("Africa/Accra", "Accra, Ghana"),
}

# Auto-index all 598 standard IANA timezones by their city component
_IANA_CITY_INDEX: Dict[str, str] = {}
try:
    for tz_name in zoneinfo.available_timezones():
        parts = tz_name.split("/")
        if len(parts) >= 2:
            city_part = parts[-1].replace("_", " ").lower()
            _IANA_CITY_INDEX[city_part] = tz_name
except Exception as e:
    logger.debug("Failed to index available timezones: %s", e)

# Memory cache for external geocoding lookups
_GEOCODE_CACHE: Dict[str, Tuple[str, str]] = {}


def resolve_location_to_timezone(
    location_query: Optional[str] = None,
    default_timezone: Optional[str] = None,
) -> Tuple[ZoneInfo, str, str]:
    """
    Resolve any location query string to a valid ZoneInfo, canonical timezone name, and human label.

    Returns:
        Tuple of (ZoneInfo object, timezone_str, display_location_name)
    """
    cleaned = (location_query or "").strip()

    # 1. If location specified, check abbreviations
    if cleaned:
        lower_cleaned = cleaned.lower()

        # Direct abbreviation match (e.g. "IST", "PST", "UTC")
        if lower_cleaned in ABBREVIATION_MAP:
            tz_str = ABBREVIATION_MAP[lower_cleaned]
            label = cleaned.upper()
            try:
                return zoneinfo.ZoneInfo(tz_str), tz_str, label
            except Exception:
                pass

        # Direct check against curated location map
        if lower_cleaned in LOCATION_TIMEZONE_MAP:
            tz_str, label = LOCATION_TIMEZONE_MAP[lower_cleaned]
            try:
                return zoneinfo.ZoneInfo(tz_str), tz_str, label
            except Exception:
                pass

        # Check against IANA standard name (case-insensitive or exact)
        # e.g. "Asia/Kolkata", "America/New_York"
        try:
            matched_tz = zoneinfo.ZoneInfo(cleaned)
            label = cleaned.split("/")[-1].replace("_", " ")
            return matched_tz, cleaned, label
        except Exception:
            pass

        # Check IANA city index (e.g. "amsterdam", "denver", "kolkata")
        if lower_cleaned in _IANA_CITY_INDEX:
            tz_str = _IANA_CITY_INDEX[lower_cleaned]
            label = cleaned.title()
            try:
                return zoneinfo.ZoneInfo(tz_str), tz_str, label
            except Exception:
                pass

        # Check geocoding cache
        if lower_cleaned in _GEOCODE_CACHE:
            tz_str, label = _GEOCODE_CACHE[lower_cleaned]
            try:
                return zoneinfo.ZoneInfo(tz_str), tz_str, label
            except Exception:
                pass

        # Online geocoding fallback for arbitrary global cities/towns
        online_res = _lookup_online_timezone(cleaned)
        if online_res:
            tz_str, label = online_res
            _GEOCODE_CACHE[lower_cleaned] = (tz_str, label)
            try:
                return zoneinfo.ZoneInfo(tz_str), tz_str, label
            except Exception:
                pass

    # 2. Fallback to default_timezone (from client or server config)
    if default_timezone:
        def_clean = default_timezone.strip()
        lower_def = def_clean.lower()
        if lower_def in ABBREVIATION_MAP:
            def_clean = ABBREVIATION_MAP[lower_def]
        try:
            return zoneinfo.ZoneInfo(def_clean), def_clean, "Local"
        except Exception:
            pass

    # 3. Ultimate fallback: System local timezone or UTC
    try:
        # Detect local timezone name
        local_now = datetime.datetime.now().astimezone()
        tz_name = local_now.tzname() or "Local"
        lower_tz = tz_name.lower()
        if lower_tz in ABBREVIATION_MAP:
            try:
                return ZoneInfo(ABBREVIATION_MAP[lower_tz]), tz_name, "Local"
            except Exception:
                pass
        try:
            return ZoneInfo(tz_name), tz_name, "Local"
        except Exception:
            pass
        return ZoneInfo("UTC"), tz_name, "Local"
    except Exception:
        return ZoneInfo("UTC"), "UTC", "UTC"


COMMON_NON_LOCATIONS = {
    "the", "a", "an", "this", "that", "it", "its", "me", "us", "my", "your", "our",
    "here", "there", "now", "right now", "today", "yesterday", "tomorrow",
    "current", "real", "standard", "server", "local", "exact", "present",
    "this location", "my location", "the world", "world", "day", "the day",
    "morning", "afternoon", "evening", "night", "the morning", "the afternoon",
    "the evening", "the night",
    "what", "whats", "what's", "tell", "tell me", "show", "show me", "give", "give me",
    "please", "just", "clock", "time", "date", "current time", "whats the", "what's the",
    "tell me the", "show me the", "give me the",
}

GENERIC_TIME_QUERIES = {
    "time", "the time", "what time", "what time is it", "what's the time", "whats the time",
    "what is the time", "what is time", "what's time", "whats time",
    "tell me the time", "tell me time", "tell the time", "tell time",
    "show me the time", "show the time", "give me the time",
    "current time", "what is current time", "what's current time", "whats current time",
    "what is the current time", "what's the current time", "whats the current time",
    "time now", "what is time now", "what's the time now", "whats the time now",
    "local time", "what is local time", "what's local time", "whats local time",
    "what is the local time", "what's the local time",
    "date", "the date", "what date", "today's date", "todays date", "what is the date",
    "what's the date", "whats the date", "what's today's date", "what is today's date",
    "whats todays date", "tell me the date", "show me the date", "current date",
    "what day is today", "what day is it", "day of the week", "what is the day",
    "time and date", "date and time", "time please", "date please",
}


def _lookup_online_timezone(location_name: str) -> Optional[Tuple[str, str]]:
    """Query Open-Meteo free geocoding API to resolve arbitrary location names to IANA timezone."""
    cleaned = (location_name or "").strip()
    if len(cleaned) < 3 or cleaned.lower() in COMMON_NON_LOCATIONS:
        return None
    try:
        url = "https://geocoding-api.open-meteo.com/v1/search"
        resp = requests.get(
            url,
            params={"name": cleaned, "count": 1, "language": "en", "format": "json"},
            timeout=3.0,
            headers={"User-Agent": "Pragna-TimeService/1.0"},
        )
        if resp.status_code == 200:
            data = resp.json()
            results = data.get("results")
            if results and len(results) > 0:
                item = results[0]
                city = item.get("name", "")
                country = item.get("country", "")
                lower_q = cleaned.lower()
                lower_city = city.lower()
                lower_country = country.lower()
                if lower_q not in lower_city and lower_city not in lower_q and lower_q not in lower_country:
                    return None
                tz_name = item.get("timezone")
                label = f"{city}, {country}".strip(", ") if city else cleaned.title()
                if tz_name:
                    return tz_name, label
    except Exception as exc:
        logger.debug("Online geocoding lookup failed for '%s': %s", cleaned, exc)
    return None


def extract_location_from_query(query: str) -> Optional[str]:
    """
    Extract a target location from natural language time or date queries.

    Examples:
        "what time is it in Tokyo?" -> "Tokyo"
        "what is the date in New York" -> "New York"
        "current time in London" -> "London"
        "time and date for San Francisco" -> "San Francisco"
        "Tokyo time" -> "Tokyo"
    """
    text = (query or "").strip()
    if not text:
        return None

    # Remove trailing question marks or punctuation
    clean_text = re.sub(r"[?!.,]+$", "", text).strip()
    lower_clean = clean_text.lower()

    if lower_clean in GENERIC_TIME_QUERIES:
        return None

    # Pattern 1: "... in <location>" or "... at <location>" or "... for <location>"
    # e.g., "what time is it in New York", "time in Tokyo", "date for Paris"
    m = re.search(
        r"\b(?:time|date|day|hour|clock)\s+(?:is\s+it\s+|now\s+)?(?:in|at|for|of)\s+([A-Za-z0-9\s,.'-]+)$",
        clean_text,
        re.IGNORECASE,
    )
    if m:
        loc = m.group(1).strip()
        loc_lower = loc.lower().rstrip("'s").strip()
        if loc_lower not in COMMON_NON_LOCATIONS and len(loc_lower) >= 2:
            return loc

    # Pattern 2: "[what's the] <location> time" or "<location> date"
    m2 = re.match(
        r"^(?:what(?:'s|\s+is|\s*s)\s+(?:the\s+)?|tell\s+me\s+(?:the\s+)?|show\s+me\s+(?:the\s+)?|give\s+me\s+(?:the\s+)?)?([A-Za-z\s.'-]+?)\s+(?:time|date|current\s+time)$",
        clean_text,
        re.IGNORECASE,
    )
    if m2:
        loc = m2.group(1).strip()
        loc_lower = loc.lower().rstrip("'s").strip()
        if loc_lower.startswith("the ") and len(loc_lower) > 4:
            sub = loc_lower[4:].strip()
            if sub in COMMON_NON_LOCATIONS:
                loc_lower = ""
        if loc_lower and loc_lower not in COMMON_NON_LOCATIONS and len(loc_lower) >= 2:
            return loc

    # Pattern 3: "in <location>, what is the time"
    m3 = re.search(
        r"^in\s+([A-Za-z0-9\s,.'-]+?)(?:,|\s+what|\s+tell|\s+is|\s+how)",
        clean_text,
        re.IGNORECASE,
    )
    if m3:
        loc = m3.group(1).strip()
        loc_lower = loc.lower().rstrip("'s").strip()
        if loc_lower not in COMMON_NON_LOCATIONS and len(loc_lower) >= 2:
            return loc

    return None


def is_time_date_query(query: str) -> bool:
    """Check if the user's message is asking about time, date, day of week, or calendar."""
    text = (query or "").strip().lower()
    if not text:
        return False

    # Exclude questions about time travel, movies, books, or idioms
    idiom_exclusions = [
        "time travel", "time machine", "waste of time", "have a good time",
        "first time", "long time", "once upon a time", "in time", "on time",
        "part time", "full time", "save time", "spending time", "story about time",
    ]
    if any(ex in text for ex in idiom_exclusions):
        return False

    # Common time/date patterns
    time_keywords = [
        "what time",
        "current time",
        "time now",
        "time is it",
        "tell me the time",
        "what is the time",
        "what's the time",
        "whats the time",
        "clock time",
        "today's date",
        "todays date",
        "what is the date",
        "what's the date",
        "whats the date",
        "current date",
        "what day is today",
        "what day is it",
        "day of the week",
        "time and date",
        "date and time",
        "time in ",
        "date in ",
        "time for ",
        "date for ",
    ]

    for kw in time_keywords:
        if kw in text:
            return True

    # Check for "<location> time" pattern e.g. "tokyo time", "london time", "new york time"
    m = re.search(r"\b([a-z\s]{3,30})\s+(?:time|date)\b", text)
    if m:
        candidate = m.group(1).strip()
        if candidate in LOCATION_TIMEZONE_MAP or candidate in _IANA_CITY_INDEX or candidate in ABBREVIATION_MAP:
            return True

    return False


def get_time_and_date(
    location: Optional[str] = None,
    default_timezone: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Get complete real-time time and date information for a location or timezone.

    Returns structured dictionary with:
    - location queried and resolved
    - timezone name and abbreviation
    - UTC offset
    - ISO datetime
    - 12-hour and 24-hour time strings
    - Full date string and day of week
    - Formatted conversational summary
    """
    tz_obj, tz_canonical, display_name = resolve_location_to_timezone(
        location_query=location,
        default_timezone=default_timezone,
    )

    now = datetime.datetime.now(tz_obj)

    # Timezone abbreviation & offset
    tz_abbr = now.strftime("%Z") or tz_canonical
    offset_td = now.utcoffset()
    if offset_td is not None:
        total_seconds = int(offset_td.total_seconds())
        sign = "+" if total_seconds >= 0 else "-"
        abs_seconds = abs(total_seconds)
        hours = abs_seconds // 3600
        minutes = (abs_seconds % 3600) // 60
        utc_offset = f"{sign}{hours:02d}:{minutes:02d}"
    else:
        utc_offset = "+00:00"

    # Formatting components
    time_12h = now.strftime("%I:%M:%S %p").lstrip("0")
    time_12h_short = now.strftime("%I:%M %p").lstrip("0")
    time_24h = now.strftime("%H:%M:%S")
    date_full = now.strftime("%A, %B %d, %Y")
    date_short = now.strftime("%b %d, %Y")
    iso_date = now.strftime("%Y-%m-%d")
    day_of_week = now.strftime("%A")
    is_dst = bool(now.dst())

    # Build human-readable response
    if location and display_name.lower() != "local":
        summary = (
            f"The current time in **{display_name}** is **{time_12h_short}** ({tz_abbr}, UTC{utc_offset}). "
            f"Today is **{date_full}**."
        )
    else:
        summary = (
            f"The current time is **{time_12h_short}** ({tz_abbr}, UTC{utc_offset}). "
            f"Today's date is **{date_full}**."
        )

    return {
        "status": "success",
        "location_queried": location,
        "resolved_location": display_name,
        "timezone": tz_canonical,
        "timezone_abbr": tz_abbr,
        "utc_offset": utc_offset,
        "iso_datetime": now.isoformat(),
        "date": date_full,
        "short_date": date_short,
        "iso_date": iso_date,
        "time_12h": time_12h,
        "time_12h_short": time_12h_short,
        "time_24h": time_24h,
        "day_of_week": day_of_week,
        "year": now.year,
        "month": now.month,
        "month_name": now.strftime("%B"),
        "day": now.day,
        "is_dst": is_dst,
        "formatted_summary": summary,
    }
