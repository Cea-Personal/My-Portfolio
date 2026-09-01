from __future__ import annotations

import base64
import hashlib
import hmac
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from career_worker.contracts.events import EventEnvelope


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

    def do_POST(self) -> None:
        length = int(self.headers.get("content-length", "0"))
        body = self.rfile.read(min(length, 1_000_000))
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
    host: str = "127.0.0.1", port: int = 8288, signing_key: str | None = None
) -> None:
    InngestHandler.signing_key = signing_key
    ThreadingHTTPServer((host, port), InngestHandler).serve_forever()
