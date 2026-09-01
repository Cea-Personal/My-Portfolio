from __future__ import annotations

import hashlib
import re
from typing import Any

_SENSITIVE = re.compile(
    r"prompt|answer|cv|resume|job.?description|journal|secret|token|signed.?url|credential|content",
    re.I,
)


def redact_telemetry(value: Any) -> Any:
    if isinstance(value, list):
        return [redact_telemetry(item) for item in value]
    if not isinstance(value, dict):
        return value
    return {
        key: "[REDACTED]" if _SENSITIVE.search(key) else redact_telemetry(item)
        for key, item in value.items()
    }


def pseudonymize_owner(owner_id: str, salt: str) -> str:
    return "owner_" + hashlib.sha256(f"{salt}:{owner_id}".encode()).hexdigest()[:16]
