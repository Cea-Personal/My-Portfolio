from __future__ import annotations

import httpx

from career_worker.repositories.ingestion import SupabaseIngestionStore


def test_supabase_store_scopes_source_version_lookup_to_owner() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.path.endswith("/evidence_sources"):
            return httpx.Response(200, json=[{"id": "source"}])
        return httpx.Response(200, json=[{"id": "version"}])

    client = httpx.Client(transport=httpx.MockTransport(handler))
    store = SupabaseIngestionStore("https://example.supabase.co", "service-key", client=client)
    try:
        assert store.find_source_version("owner", "source", "hash")
    finally:
        store.close()

    assert len(requests) == 2
    assert requests[0].headers["accept-profile"] == "app"
    assert requests[0].headers["content-profile"] == "app"
    assert "owner_id=eq.owner" in str(requests[0].url)
    assert "normalized_text_sha256=eq.hash" in str(requests[1].url)


def test_supabase_store_marks_removed_documents_without_deleting_history() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json=[])

    client = httpx.Client(transport=httpx.MockTransport(handler))
    store = SupabaseIngestionStore("https://example.supabase.co", "service-key", client=client)
    try:
        store.mark_document_unavailable("owner", "document", permission_lost=True)
    finally:
        store.close()

    assert requests[0].method == "PATCH"
    assert "owner_id=eq.owner" in str(requests[0].url)
    payload = requests[0].content.decode()
    assert '"availability":"unavailable"' in payload
    assert '"permission_lost_at"' in payload
