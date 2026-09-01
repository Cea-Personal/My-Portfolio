from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime


@dataclass(slots=True)
class Run:
    id: str
    owner_id: str
    status: str = "pending"
    steps: dict[str, str] = field(default_factory=dict)
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    def transition(self, status: str) -> None:
        allowed = {
            "pending": {"running", "cancelled"},
            "running": {"completed", "partial", "failed", "cancelled"},
        }
        if status not in allowed.get(self.status, set()):
            raise ValueError(f"invalid run transition: {self.status} -> {status}")
        self.status = status
        self.updated_at = datetime.now(UTC)
