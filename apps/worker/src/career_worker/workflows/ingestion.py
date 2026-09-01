from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from hashlib import sha256
from typing import Protocol

from career_worker.extraction.career_facts import ExtractedFactCandidate, extract_candidates
from career_worker.ingestion.chunking import Chunk, chunk_document
from career_worker.parsing.parsers import ParsedDocument, parse_document


@dataclass(frozen=True, slots=True)
class IngestionResult:
    status: str
    chunks: tuple[Chunk, ...]
    candidates: tuple[ExtractedFactCandidate, ...]
    error_code: str | None = None
    run_id: str | None = None
    source_version_hash: str | None = None
    quarantined: bool = False


class IngestionStore(Protocol):
    def find_source_version(self, owner_id: str, source_id: str, content_hash: str) -> bool: ...

    def start_run(
        self,
        run_id: str,
        owner_id: str,
        source_id: str,
        content_hash: str,
        *,
        media_type: str = "text/plain",
        byte_size: int = 0,
    ) -> None: ...

    def complete_run(
        self,
        run_id: str,
        *,
        status: str,
        chunks: tuple[Chunk, ...],
        candidates: tuple[ExtractedFactCandidate, ...],
        error_code: str | None = None,
    ) -> None: ...


@dataclass(slots=True)
class InMemoryIngestionStore:
    """Deterministic repository adapter used by local runs and contract tests.

    Production workers can provide the same protocol backed by Supabase; the
    idempotency and durable state semantics stay identical at this boundary.
    """

    source_versions: set[tuple[str, str, str]] = field(default_factory=set)
    runs: dict[str, dict[str, object]] = field(default_factory=dict)

    def find_source_version(self, owner_id: str, source_id: str, content_hash: str) -> bool:
        return (owner_id, source_id, content_hash) in self.source_versions

    def start_run(
        self,
        run_id: str,
        owner_id: str,
        source_id: str,
        content_hash: str,
        *,
        media_type: str = "text/plain",
        byte_size: int = 0,
    ) -> None:
        self.runs[run_id] = {
            "owner_id": owner_id,
            "source_id": source_id,
            "hash": content_hash,
            "media_type": media_type,
            "byte_size": byte_size,
            "status": "running",
        }

    def complete_run(
        self,
        run_id: str,
        *,
        status: str,
        chunks: tuple[Chunk, ...],
        candidates: tuple[ExtractedFactCandidate, ...],
        error_code: str | None = None,
    ) -> None:
        record = self.runs.setdefault(run_id, {})
        record.update(
            {"status": status, "chunks": chunks, "candidates": candidates, "error_code": error_code}
        )
        if status == "completed":
            owner_id = str(record.get("owner_id", ""))
            source_id = str(record.get("source_id", ""))
            content_hash = str(record.get("hash", ""))
            self.source_versions.add((owner_id, source_id, content_hash))


DEFAULT_INGESTION_STORE = InMemoryIngestionStore()


def ingest_document(
    payload: bytes,
    media_type: str,
    *,
    owner_id: str = "local",
    source_id: str = "upload",
    run_id: str = "local-run",
    store: IngestionStore | None = None,
    is_cancelled: Callable[[], bool] | None = None,
) -> IngestionResult:
    repository = store or DEFAULT_INGESTION_STORE
    source_version_hash = sha256(payload).hexdigest()
    if repository.find_source_version(owner_id, source_id, source_version_hash):
        return IngestionResult(
            "unchanged", (), (), run_id=run_id, source_version_hash=source_version_hash
        )
    repository.start_run(
        run_id,
        owner_id,
        source_id,
        source_version_hash,
        media_type=media_type,
        byte_size=len(payload),
    )
    try:
        if is_cancelled and is_cancelled():
            repository.complete_run(run_id, status="cancelled", chunks=(), candidates=())
            return IngestionResult(
                "cancelled", (), (), run_id=run_id, source_version_hash=source_version_hash
            )
        document: ParsedDocument = parse_document(payload, media_type)
        chunks = chunk_document(document)
        candidates = tuple(candidate for chunk in chunks for candidate in extract_candidates(chunk))
        repository.complete_run(run_id, status="completed", chunks=chunks, candidates=candidates)
        return IngestionResult(
            "completed", chunks, candidates, run_id=run_id, source_version_hash=source_version_hash
        )
    except ValueError as error:
        code = str(error)[:120]
        repository.complete_run(run_id, status="failed", chunks=(), candidates=(), error_code=code)
        return IngestionResult(
            "failed", (), (), code, run_id, source_version_hash, quarantined=True
        )
