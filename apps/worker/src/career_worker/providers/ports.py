from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol, TypeVar

T = TypeVar("T")


@dataclass(frozen=True, slots=True)
class GenerationRequest:
    model: str
    prompt_hash: str
    input: Any
    output_schema_version: str
    max_tokens: int | None = None


@dataclass(frozen=True, slots=True)
class GenerationResult:
    output: Any
    provider: str
    model: str
    model_version: str
    input_hash: str
    schema_version: str


class GenerationPort(Protocol):
    async def generate(self, request: GenerationRequest) -> GenerationResult: ...


class EmbeddingPort(Protocol):
    async def embed(self, text: str, model: str) -> tuple[list[float], int, str, str]: ...


class RerankerPort(Protocol):
    async def rerank(self, query: str, candidates: list[str]) -> list[tuple[int, float]]: ...
