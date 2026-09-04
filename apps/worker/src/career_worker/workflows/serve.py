from __future__ import annotations

import base64
import hashlib
import hmac
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from career_worker.contracts.events import EventEnvelope
from career_worker.extraction.career_facts import extract_candidates
from career_worker.ingestion.chunking import chunk_document
from career_worker.ingestion.embeddings import EMBEDDING_DIMENSIONS, embed_deterministically
from career_worker.parsing.parsers import parse_document


def parse_transport_payload(body: bytes, media_type: str) -> tuple[int, object]:
    try:
        parsed = parse_document(body, media_type)
        chunks = chunk_document(parsed)
        candidates = [candidate for chunk in chunks for candidate in extract_candidates(chunk)]
        return (
            200,
            {
                "status": "completed",
                "parser": parsed.parser,
                "parserVersion": parsed.parser_version,
                "chunks": [
                    {
                        "ordinal": chunk.ordinal,
                        "content": chunk.content,
                        "contentHash": chunk.content_hash,
                        "charStart": chunk.char_start,
                        "charEnd": chunk.char_end,
                        "pageStart": chunk.page_start,
                        "pageEnd": chunk.page_end,
                        "sectionPath": list(chunk.section_path),
                        "embedding": embed_deterministically(
                            chunk.content, EMBEDDING_DIMENSIONS
                        ),
                    }
                    for chunk in chunks
                ],
                "candidates": [
                    {
                        "factType": candidate.fact_type,
                        "statement": candidate.statement,
                        "confidence": candidate.confidence,
                        "sourceStart": candidate.source_start,
                        "sourceEnd": candidate.source_end,
                    }
                    for candidate in candidates
                ],
            },
        )
    except ValueError as error:
        return 422, {"status": "quarantined", "code": str(error)[:120]}


def verify_inngest_signature(body: bytes, signature: str | None, signing_key: str | None) -> bool:
    if not signature or not signing_key:
        return False
    supplied = signature.removeprefix("sha256=")
    expected = hmac.new(signing_key.encode(), body, hashlib.sha256).digest()
    try:
        return hmac.compare_digest(base64.b64decode(supplied), expected) or hmac.compare_digest(
            supplied, expected.hex()
        )
    except (ValueError, TypeError):
        return False


class InngestHandler(BaseHTTPRequestHandler):
    signing_key: str | None = None
    parser_secret: str | None = None

    def _send_json(self, status: int, value: object) -> None:
        encoded = json.dumps(value, separators=(",", ":")).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def _parse_document(self, body: bytes) -> None:
        if not verify_inngest_signature(
            body, self.headers.get("x-career-signature"), self.parser_secret
        ):
            self.send_error(401)
            return
        media_type = self.headers.get("x-document-media-type", "application/octet-stream")
        status, result = parse_transport_payload(body, media_type)
        self._send_json(status, result)

    def do_POST(self) -> None:
        length = int(self.headers.get("content-length", "0"))
        if length <= 0 or length > 50 * 1024 * 1024:
            self.send_error(413)
            return
        body = self.rfile.read(length)
        if self.path == "/parse":
            self._parse_document(body)
            return
        if not verify_inngest_signature(
            body, self.headers.get("x-inngest-signature"), self.signing_key
        ):
            self.send_error(401)
            return
        try:
            EventEnvelope.from_dict(json.loads(body))
        except (ValueError, json.JSONDecodeError):
            self.send_error(400)
            return
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"status":"accepted"}')


def serve_inngest(
    host: str = "127.0.0.1",
    port: int = 8288,
    signing_key: str | None = None,
    parser_secret: str | None = None,
) -> None:
    InngestHandler.signing_key = signing_key
    InngestHandler.parser_secret = parser_secret
    ThreadingHTTPServer((host, port), InngestHandler).serve_forever()
