"""Structured Gemini calls for admin assistance. Callers validate evidence references."""

from __future__ import annotations

import hashlib
import json
import time
from typing import Any

from pydantic import BaseModel

from attacksurface.config import settings


def structured_call(
    system: str, payload: dict[str, Any], schema: type[BaseModel],
) -> tuple[str, int | None, int | None]:
    from google import genai
    from google.genai import types

    response = genai.Client(api_key=settings.gemini_api_key, http_options=types.HttpOptions(timeout=15000)).models.generate_content(
        model=settings.gemini_model,
        contents=json.dumps(payload, ensure_ascii=True),
        config=types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            response_schema=schema,
            temperature=0.1,
        ),
    )
    usage = response.usage_metadata
    return response.text or "", getattr(usage, "prompt_token_count", None), getattr(usage, "candidates_token_count", None)


def fingerprint(payload: object) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=True).encode()).hexdigest()


def run_metadata(payload: object, version: str, started: float, category: str | None, tokens: tuple[int | None, int | None]) -> dict[str, Any]:
    return {
        "model_name": settings.gemini_model if settings.gemini_api_key else None,
        "prompt_version": version,
        "input_hash": fingerprint(payload),
        "output_validation_status": "valid" if category is None else "fallback",
        "fallback_used": category is not None,
        "error_category": category,
        "input_tokens": tokens[0],
        "output_tokens": tokens[1],
        "latency_ms": int((time.monotonic() - started) * 1000),
    }
