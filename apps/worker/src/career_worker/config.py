from __future__ import annotations

import os
from dataclasses import dataclass
from urllib.parse import urlparse


@dataclass(frozen=True, slots=True)
class WorkerConfig:
    environment: str
    inngest_event_key: str | None
    inngest_signing_key: str | None
    otel_endpoint: str | None


def load_config(environ: dict[str, str] | None = None) -> WorkerConfig:
    values = os.environ if environ is None else environ
    environment = values.get("CAREER_WORKER_ENV", "development")
    if environment not in {"development", "test", "production"}:
        raise ValueError("CAREER_WORKER_ENV must be development, test, or production")
    endpoint = values.get("OTEL_EXPORTER_OTLP_ENDPOINT")
    if endpoint and urlparse(endpoint).scheme not in {"http", "https"}:
        raise ValueError("OTEL_EXPORTER_OTLP_ENDPOINT must be an HTTP(S) URL")
    if environment == "production" and not values.get("INNGEST_SIGNING_KEY"):
        raise ValueError("INNGEST_SIGNING_KEY is required in production")
    return WorkerConfig(
        environment=environment,
        inngest_event_key=values.get("INNGEST_EVENT_KEY"),
        inngest_signing_key=values.get("INNGEST_SIGNING_KEY"),
        otel_endpoint=endpoint,
    )
