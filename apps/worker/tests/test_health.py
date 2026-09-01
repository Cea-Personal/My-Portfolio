from __future__ import annotations

from career_worker.__main__ import build_parser
from career_worker.health import health_payload


def test_health_payload_is_bounded_and_public() -> None:
    assert health_payload() == {"status": "ok", "service": "career-worker"}


def test_serve_command_defaults_to_loopback() -> None:
    args = build_parser().parse_args(["serve"])
    assert args.host == "127.0.0.1"
    assert args.port == 8080
