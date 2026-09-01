from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True, slots=True)
class EventEnvelope:
    name: str
    event_id: str
    timestamp_ms: int
    data: dict[str, Any]

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> EventEnvelope:
        name = payload.get("name")
        event_id = payload.get("id")
        timestamp = payload.get("ts")
        data = payload.get("data")
        if not isinstance(name, str) or ".v" not in name:
            raise ValueError("event name must include a version")
        if not isinstance(event_id, str) or not event_id:
            raise ValueError("event id is required")
        if not isinstance(timestamp, int) or timestamp <= 0:
            raise ValueError("event timestamp is invalid")
        if not isinstance(data, dict) or data.get("schemaVersion") != 1:
            raise ValueError("unsupported event schema")
        return cls(name=name, event_id=event_id, timestamp_ms=timestamp, data=data)
