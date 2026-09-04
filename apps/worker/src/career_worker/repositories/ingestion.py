from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, cast

import httpx

from career_worker.extraction.career_facts import ExtractedFactCandidate
from career_worker.ingestion.chunking import Chunk


def _now() -> str:
    return datetime.now(UTC).isoformat()


@dataclass(slots=True)
class SupabaseIngestionStore:
    """Durable ingestion repository backed by the Supabase REST API.

    The worker receives only opaque owner/source/run identifiers.  Raw source
    bytes never travel through workflow events; only bounded hashes, metadata,
    chunks, and candidate fact payloads are persisted.  A caller may inject an
    ``httpx.Client`` (for tests or a tuned transport) without exposing the
    service-role key outside this repository.
    """

    url: str
    service_role_key: str
    client: httpx.Client | None = None
    timeout: float = 15.0
    _owned_client: bool = field(init=False, default=False)
    _runs: dict[str, dict[str, Any]] = field(init=False, default_factory=dict)

    def __post_init__(self) -> None:
        self.url = self.url.rstrip("/")
        if not self.url or not self.service_role_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
        if self.client is None:
            self.client = httpx.Client(timeout=self.timeout)
            self._owned_client = True

    def close(self) -> None:
        if self._owned_client and self.client is not None:
            self.client.close()

    def _request(
        self,
        method: str,
        table: str,
        *,
        params: dict[str, str] | None = None,
        payload: dict[str, Any] | list[dict[str, Any]] | None = None,
    ) -> list[dict[str, Any]]:
        if self.client is None:  # pragma: no cover - guarded by __post_init__
            raise RuntimeError("Supabase client is not initialized")
        response = self.client.request(
            method,
            f"{self.url}/rest/v1/{table}",
            params=params,
            json=payload,
            headers={
                "apikey": self.service_role_key,
                "authorization": f"Bearer {self.service_role_key}",
                "accept-profile": "app",
                "content-profile": "app",
                "content-type": "application/json",
                "prefer": "return=representation",
            },
        )
        response.raise_for_status()
        if not response.content:
            return []
        value = response.json()
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
        if isinstance(value, dict):
            return [cast(dict[str, Any], value)]
        return []

    def find_source_version(self, owner_id: str, source_id: str, content_hash: str) -> bool:
        sources = self._request(
            "GET",
            "evidence_sources",
            params={
                "select": "id",
                "id": f"eq.{source_id}",
                "owner_id": f"eq.{owner_id}",
                "limit": "1",
            },
        )
        if not sources:
            return False
        versions = self._request(
            "GET",
            "evidence_versions",
            params={
                "select": "id",
                "evidence_source_id": f"eq.{source_id}",
                "normalized_text_sha256": f"eq.{content_hash}",
                "limit": "1",
            },
        )
        return bool(versions)

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
        self._runs[run_id] = {
            "owner_id": owner_id,
            "source_id": source_id,
            "content_hash": content_hash,
            "media_type": media_type,
            "byte_size": byte_size,
        }
        updated = self._request(
            "PATCH",
            "ingestion_runs",
            params={"id": f"eq.{run_id}", "owner_id": f"eq.{owner_id}"},
            payload={"status": "running", "started_at": _now()},
        )
        if not updated:
            self._request(
                "POST",
                "ingestion_runs",
                payload={
                    "id": run_id,
                    "owner_id": owner_id,
                    "trigger": "worker",
                    "correlation_id": run_id,
                    "idempotency_key": content_hash,
                    "status": "running",
                    "started_at": _now(),
                },
            )

    def complete_run(
        self,
        run_id: str,
        *,
        status: str,
        chunks: tuple[Chunk, ...],
        candidates: tuple[ExtractedFactCandidate, ...],
        error_code: str | None = None,
    ) -> None:
        context = self._runs.get(run_id, {})
        owner_id = str(context.get("owner_id", ""))
        source_id = str(context.get("source_id", ""))
        if status == "completed" and source_id and owner_id:
            evidence_version_id = self._persist_evidence_version(context)
            self._persist_chunks(evidence_version_id, chunks)
            self._persist_candidates(run_id, candidates)
        self._request(
            "PATCH",
            "ingestion_runs",
            params={"id": f"eq.{run_id}", "owner_id": f"eq.{owner_id}"},
            payload={
                "status": status,
                "finished_at": _now(),
                "error_summary": error_code,
                "document_count": 1 if status in {"completed", "partial"} else 0,
            },
        )
        self._runs.pop(run_id, None)

    def mark_document_unavailable(
        self, owner_id: str, document_id: str, *, permission_lost: bool = False
    ) -> None:
        payload: dict[str, Any] = {"availability": "unavailable"}
        if permission_lost:
            payload["permission_lost_at"] = _now()
        else:
            payload["removed_at"] = _now()
        self._request(
            "PATCH",
            "documents",
            params={"id": f"eq.{document_id}", "owner_id": f"eq.{owner_id}"},
            payload=payload,
        )

    def _persist_evidence_version(self, context: dict[str, Any]) -> str:
        source_id = str(context["source_id"])
        content_hash = str(context["content_hash"])
        existing = self._request(
            "GET",
            "evidence_versions",
            params={
                "select": "id",
                "evidence_source_id": f"eq.{source_id}",
                "normalized_text_sha256": f"eq.{content_hash}",
                "limit": "1",
            },
        )
        if existing and isinstance(existing[0].get("id"), str):
            return str(existing[0]["id"])
        latest = self._request(
            "GET",
            "evidence_versions",
            params={
                "select": "id,ordinal",
                "evidence_source_id": f"eq.{source_id}",
                "order": "ordinal.desc",
                "limit": "1",
            },
        )
        previous_id = latest[0].get("id") if latest else None
        previous_ordinal = latest[0].get("ordinal") if latest else 0
        ordinal = int(previous_ordinal) + 1 if isinstance(previous_ordinal, int) else 1
        rows = self._request(
            "POST",
            "evidence_versions",
            payload={
                "evidence_source_id": source_id,
                "ordinal": ordinal,
                "normalized_text_sha256": content_hash,
                "media_type": str(context.get("media_type", "text/plain")),
                "byte_size": max(0, int(context.get("byte_size", 0))),
                "parser_name": "career-worker",
                "parser_version": "1",
                "processed_at": _now(),
                "quarantine_status": "pending",
                "prior_version_id": previous_id,
            },
        )
        if not rows or not isinstance(rows[0].get("id"), str):
            raise RuntimeError("EVIDENCE_VERSION_PERSIST_FAILED")
        return str(rows[0]["id"])

    def _persist_chunks(self, evidence_version_id: str, chunks: tuple[Chunk, ...]) -> None:
        if not chunks:
            return
        existing = self._request(
            "GET",
            "evidence_chunks",
            params={"select": "ordinal", "evidence_version_id": f"eq.{evidence_version_id}"},
        )
        existing_ordinals = {item.get("ordinal") for item in existing}
        payload = [
            {
                "evidence_version_id": evidence_version_id,
                "ordinal": chunk.ordinal,
                "page_start": chunk.page_start,
                "page_end": chunk.page_end,
                "section_path": list(chunk.section_path),
                "char_start": chunk.char_start,
                "char_end": chunk.char_end,
                "content": chunk.content,
                "content_hash": chunk.content_hash,
                "visibility": "private",
                "trust_level": "ai_extracted",
            }
            for chunk in chunks
            if chunk.ordinal not in existing_ordinals
        ]
        if payload:
            self._request("POST", "evidence_chunks", payload=payload)

    def _persist_candidates(
        self, run_id: str, candidates: tuple[ExtractedFactCandidate, ...]
    ) -> None:
        if not candidates:
            return
        items = self._request(
            "GET",
            "ingestion_items",
            params={"select": "id", "run_id": f"eq.{run_id}", "limit": "1"},
        )
        if not items or not isinstance(items[0].get("id"), str):
            return
        item_id = str(items[0]["id"])
        payload = [
            {
                "ingestion_item_id": item_id,
                "original_extraction": {
                    "fact_type": candidate.fact_type,
                    "statement": candidate.statement,
                    "confidence": candidate.confidence,
                },
                "statement": candidate.statement,
                "confidence": candidate.confidence,
                "trust_level": "ai_extracted",
                "schema_version": "career-fact-candidate.v1",
                "source_offsets": {"start": candidate.source_start, "end": candidate.source_end},
                "review_status": candidate.review_status,
            }
            for candidate in candidates
        ]
        self._request("POST", "extracted_facts", payload=payload)
