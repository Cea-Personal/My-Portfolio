from __future__ import annotations

import re
from dataclasses import dataclass

from career_worker.ingestion.chunking import Chunk


@dataclass(frozen=True, slots=True)
class ExtractedFactCandidate:
    fact_type: str
    statement: str
    confidence: float
    source_start: int
    source_end: int
    review_status: str = "candidate"


def extract_candidates(
    chunk: Chunk, extractor_version: str = "career-facts.v1"
) -> tuple[ExtractedFactCandidate, ...]:
    del extractor_version
    candidates: list[ExtractedFactCandidate] = []
    for match in re.finditer(r"(?P<statement>[^.!?]{20,240}[.!?])", chunk.content):
        statement = match.group("statement").strip()
        lowered = statement.lower()
        fact_type = (
            "achievement"
            if any(word in lowered for word in ("increased", "reduced", "improved", "%"))
            else "responsibility"
        )
        candidates.append(
            ExtractedFactCandidate(
                fact_type,
                statement,
                0.5,
                chunk.char_start + match.start(),
                chunk.char_start + match.end(),
            )
        )
    return tuple(candidates)
