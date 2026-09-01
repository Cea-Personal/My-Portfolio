from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class EvidenceRecord:
    id: str
    owner_id: str
    source_version_id: str
    content_hash: str
    visibility: str = "private"


class EvidenceRepository:
    """Small repository port; adapters enforce ownership before persistence."""

    def __init__(self) -> None:
        self._records: dict[str, EvidenceRecord] = {}

    def put(self, record: EvidenceRecord, *, owner_id: str) -> EvidenceRecord:
        if record.owner_id != owner_id:
            raise PermissionError("OWNER_MISMATCH")
        self._records[record.id] = record
        return record

    def get(self, record_id: str, *, owner_id: str) -> EvidenceRecord | None:
        record = self._records.get(record_id)
        if record is None:
            return None
        if record.owner_id != owner_id:
            raise PermissionError("OWNER_MISMATCH")
        return record
