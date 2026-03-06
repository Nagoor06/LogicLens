import json
import re


def normalize_result(payload: dict):
    bugs = payload.get("bugs")
    if bugs is None:
        bugs = payload.get("issues", [])

    improvements = payload.get("improvements")
    if improvements is None:
        improvements = payload.get("suggestions", [])

    corrected_code = payload.get("corrected_code") or ""

    return {
        "summary": payload.get("summary", "Model returned an empty response."),
        "bugs": bugs if isinstance(bugs, list) else [],
        "improvements": improvements if isinstance(improvements, list) else [],
        "corrected_code": corrected_code if isinstance(corrected_code, str) else "",
    }


def parse_llm_response(raw_output: str):
    try:
        return normalize_result(json.loads(raw_output))
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", raw_output, re.DOTALL)
        if match:
            try:
                return normalize_result(json.loads(match.group()))
            except json.JSONDecodeError:
                pass

    return {
        "summary": "Model returned non-JSON or malformed response.",
        "bugs": [],
        "improvements": [],
        "corrected_code": "",
    }
