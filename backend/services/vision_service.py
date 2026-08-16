"""
Vision Service — Image Content Analysis for Pragna AI
======================================================

Analyzes uploaded images and returns a natural-language description
that can be injected into the LLM prompt as context.

Supported formats
-----------------
* PNG  — BLIP image captioning + Pillow metadata
* JPG / JPEG — same as PNG
* SVG  — XML parsing extracts text elements, titles, shapes, structure

Architecture
------------
The service is CPU-first and uses the same lazy-singleton pattern as
model_service.py.  BLIP (Salesforce/blip-image-captioning-base) is
loaded once on first use and stays in memory.

Model: Salesforce/blip-image-captioning-base
  - ~900 MB download, cached in ~/.cache/huggingface/
  - ~1.5 GB RAM on CPU (float32)
  - Inference: 5–20 s per image on Intel i7 CPU
  - Automatic GPU upgrade: if CUDA is available, uses float16 + .to("cuda")
"""

from __future__ import annotations

import io
import logging
import re
import threading
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ─── Singleton state ──────────────────────────────────────────────────────────
_blip_processor = None
_blip_model = None
_blip_device = None
_blip_loaded: bool = False
_blip_load_error: Optional[str] = None
_blip_lock = threading.Lock()

# SVG XML namespace map (common namespaces used in SVG files)
_SVG_NS = {
    "svg": "http://www.w3.org/2000/svg",
    "xlink": "http://www.w3.org/1999/xlink",
    "dc": "http://purl.org/dc/elements/1.1/",
    "cc": "http://creativecommons.org/ns#",
    "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    "inkscape": "http://www.inkscape.org/namespaces/inkscape",
}

# Shape tags we summarise for SVG
_SVG_SHAPE_TAGS = {"rect", "circle", "ellipse", "line", "polyline", "polygon", "path", "image"}


# ─── BLIP loader ─────────────────────────────────────────────────────────────

def _load_blip() -> None:
    """Load BLIP image-captioning model (thread-safe, called at most once)."""
    global _blip_processor, _blip_model, _blip_device, _blip_loaded, _blip_load_error

    t0 = time.time()
    logger.info("=" * 65)
    logger.info("🖼  Vision Service — loading BLIP image captioning model")
    logger.info("   Model: Salesforce/blip-image-captioning-base")
    logger.info("=" * 65)

    try:
        import torch
        from transformers import BlipForConditionalGeneration, BlipProcessor
    except ImportError as exc:
        _blip_load_error = (
            f"Missing dependency for vision: {exc}\n"
            "Run: pip install transformers torch Pillow"
        )
        logger.error(_blip_load_error)
        return

    if torch.cuda.is_available():
        _blip_device = torch.device("cuda")
        dtype = torch.float16
        logger.info("   Device: CUDA GPU — %s", torch.cuda.get_device_name(0))
    else:
        _blip_device = torch.device("cpu")
        dtype = torch.float32
        logger.info("   Device: CPU (float32)")

    try:
        logger.info("   Downloading / loading BLIP processor…")
        _blip_processor = BlipProcessor.from_pretrained(
            "Salesforce/blip-image-captioning-base"
        )

        logger.info("   Downloading / loading BLIP model weights (~900 MB, cached after first run)…")
        _blip_model = BlipForConditionalGeneration.from_pretrained(
            "Salesforce/blip-image-captioning-base",
            torch_dtype=dtype,
        ).to(_blip_device)
        _blip_model.eval()

    except Exception as exc:
        _blip_load_error = f"BLIP model load failed: {exc}"
        logger.error(_blip_load_error, exc_info=True)
        return

    elapsed = time.time() - t0
    logger.info("✅ BLIP model loaded in %.1f s", elapsed)
    _blip_loaded = True


def _ensure_blip_loaded() -> None:
    """Thread-safe lazy loader."""
    if _blip_loaded or _blip_load_error:
        return
    with _blip_lock:
        if not _blip_loaded and _blip_load_error is None:
            _load_blip()


# ─── PNG / JPG analysis ───────────────────────────────────────────────────────

def _extract_ocr_text(img) -> str:
    """Extract text from image using pytesseract if available."""
    try:
        import pytesseract
        text = pytesseract.image_to_string(img).strip()
        if text:
            return text
    except Exception as exc:
        logger.debug("OCR extraction attempt skipped/failed: %s", exc)
    return ""


def _analyze_image_with_ollama(file_bytes: bytes) -> Optional[str]:
    """Analyze image using Ollama multimodal vision API if available."""
    try:
        import base64
        import requests
        from config import OLLAMA_BASE_URL, OLLAMA_MODEL

        b64_img = base64.b64encode(file_bytes).decode("utf-8")
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": "Analyze this image in full detail. Read all text, chat messages, labels, and visual content inside it.",
            "images": [b64_img],
            "stream": False
        }
        res = requests.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload, timeout=20)
        if res.ok:
            data = res.json()
            resp = data.get("response", "").strip()
            if resp:
                return resp
    except Exception as exc:
        logger.debug("Ollama vision call skipped/failed: %s", exc)
    return None


def _analyze_raster_image(file_bytes: bytes, filename: str) -> str:
    """
    Generate a comprehensive analysis & OCR text extraction of an uploaded image.
    """
    lines: list[str] = []
    stem = Path(filename).stem.replace("_", " ").replace("-", " ")

    # 1. Pillow metadata & image decoding
    try:
        from PIL import Image as PILImage
        img = PILImage.open(io.BytesIO(file_bytes)).convert("RGB")
        w, h = img.size
        lines.append(f"Image file  : {filename}")
        lines.append(f"Dimensions  : {w} × {h} pixels")
    except Exception as exc:
        logger.warning("Pillow metadata extraction failed for %s: %s", filename, exc)
        lines.append(f"Image file  : {filename}")
        img = None

    if img is None:
        lines.append("Visual analysis: could not decode image bytes")
        return "\n".join(lines)

    # 2. OCR Text Extraction (Reads text inside screenshots, chats, documents)
    ocr_text = _extract_ocr_text(img)
    if ocr_text:
        lines.append("\nEXTRACTED TEXT FROM ATTACHED IMAGE (OCR):")
        lines.append("--------------------------------------------------")
        lines.append(ocr_text)
        lines.append("--------------------------------------------------\n")

    # 3. Ollama Vision Analysis
    ollama_desc = _analyze_image_with_ollama(file_bytes)
    if ollama_desc:
        lines.append(f"Visual Analysis: {ollama_desc}")
    else:
        # 4. BLIP Fallback (if torch & transformers available)
        _ensure_blip_loaded()
        if _blip_loaded:
            try:
                import torch
                inputs_uncond = _blip_processor(img, return_tensors="pt").to(_blip_device)
                with torch.no_grad():
                    out_uncond = _blip_model.generate(**inputs_uncond, max_new_tokens=80, num_beams=4)
                caption_uncond = _blip_processor.decode(out_uncond[0], skip_special_tokens=True)
                lines.append(f"Visual Description: {caption_uncond.strip()}")
            except Exception as exc:
                logger.warning("BLIP inference error for %s: %s", filename, exc)
        elif not ocr_text:
            lines.append("Visual analysis: Image loaded (OCR and visual model pending).")

    return "\n".join(lines)



# ─── SVG analysis ─────────────────────────────────────────────────────────────

def _strip_ns(tag: str) -> str:
    """Remove XML namespace prefix from a tag string."""
    return re.sub(r"\{[^}]+\}", "", tag)


def _analyze_svg(file_bytes: bytes, filename: str) -> str:
    """
    Parse an SVG file and return a structured text description.

    Extracts:
    - Title and description elements
    - All visible text content (text, tspan, flowRoot)
    - Structural summary (shape counts, layers/groups)
    - Viewbox / canvas dimensions
    """
    lines: list[str] = [f"SVG file: {filename}"]

    try:
        raw = file_bytes.decode("utf-8", errors="replace")
        root = ET.fromstring(raw)
    except ET.ParseError as exc:
        lines.append(f"SVG parse error: {exc}")
        return "\n".join(lines)

    # ── Dimensions ────────────────────────────────────────────────────────────
    viewbox = root.get("viewBox", "")
    width = root.get("width", "")
    height = root.get("height", "")
    if viewbox:
        lines.append(f"ViewBox     : {viewbox}")
    if width or height:
        lines.append(f"Canvas size : {width} × {height}")

    # ── Title / description ───────────────────────────────────────────────────
    titles: list[str] = []
    descs: list[str] = []
    texts: list[str] = []
    shape_counts: dict[str, int] = {}

    for elem in root.iter():
        tag = _strip_ns(elem.tag).lower()

        if tag == "title":
            if elem.text and elem.text.strip():
                titles.append(elem.text.strip())

        elif tag == "desc":
            if elem.text and elem.text.strip():
                descs.append(elem.text.strip())

        elif tag in ("text", "tspan", "flowroot", "flowpara", "textpath"):
            # Collect all text content (including tail text of children)
            content = "".join(elem.itertext()).strip()
            if content:
                texts.append(content)

        elif tag in _SVG_SHAPE_TAGS:
            shape_counts[tag] = shape_counts.get(tag, 0) + 1

    if titles:
        lines.append(f"Title       : {' / '.join(titles)}")
    if descs:
        lines.append(f"Description : {' / '.join(descs)}")

    # ── Text content ──────────────────────────────────────────────────────────
    if texts:
        # Deduplicate while preserving order
        seen: set[str] = set()
        unique_texts: list[str] = []
        for t in texts:
            key = t.lower().strip()
            if key not in seen:
                seen.add(key)
                unique_texts.append(t)
        combined = " | ".join(unique_texts[:40])   # cap at 40 unique text nodes
        lines.append(f"Text content: {combined}")
    else:
        lines.append("Text content: (no visible text elements found)")

    # ── Shape summary ─────────────────────────────────────────────────────────
    if shape_counts:
        summary = ", ".join(f"{v} {k}(s)" for k, v in sorted(shape_counts.items()))
        lines.append(f"Shapes      : {summary}")

    # ── Layer / group count ───────────────────────────────────────────────────
    groups = sum(1 for e in root.iter() if _strip_ns(e.tag).lower() == "g")
    if groups:
        lines.append(f"Groups/layers: {groups}")

    logger.info("SVG analyzed '%s': %d text nodes, %d shape types", filename, len(texts), len(shape_counts))
    return "\n".join(lines)


# ─── Public API ───────────────────────────────────────────────────────────────

def analyze_image(file_bytes: bytes, filename: str) -> str:
    """
    Analyze an uploaded image file and return a text description.

    Dispatches based on file extension:
      .png, .jpg, .jpeg → BLIP visual captioning + Pillow metadata
      .svg              → XML structure + text extraction

    Args:
        file_bytes: Raw bytes of the uploaded file.
        filename:   Original filename (used to determine type and as caption hint).

    Returns:
        A multi-line text block describing the image content, suitable for
        injection into an LLM prompt as context.
    """
    ext = Path(filename).suffix.lower()

    if ext in (".png", ".jpg", ".jpeg"):
        return _analyze_raster_image(file_bytes, filename)

    elif ext == ".svg":
        return _analyze_svg(file_bytes, filename)

    else:
        return (
            f"File: {filename}\n"
            f"Note: Visual analysis is only supported for .png, .jpg, and .svg files.\n"
            f"Extension '{ext}' is not supported."
        )


def is_supported_image(filename: str) -> bool:
    """Return True if the file extension is supported by this vision service."""
    return Path(filename).suffix.lower() in (".png", ".jpg", ".jpeg", ".svg")
