from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass

from career_worker.parsing.parsers import ParsedDocument


@dataclass(frozen=True, slots=True)
class Chunk:
    ordinal: int
    content: str
    content_hash: str
    char_start: int
    char_end: int
    page_start: int | None
    page_end: int | None
    section_path: tuple[str, ...]


def normalize_text(value: str) -> str:
    return re.sub(r"[ \t]+", " ", value.replace("\r\n", "\n")).strip()


def chunk_document(
    document: ParsedDocument, max_chars: int = 1600, overlap: int = 160
) -> tuple[Chunk, ...]:
    if max_chars <= overlap or max_chars > 20_000:
        raise ValueError("invalid chunk bounds")
    text = normalize_text(document.text)
    chunks: list[Chunk] = []
    start = 0
    ordinal = 0
    while start < len(text):
        end = min(start + max_chars, len(text))
        if end < len(text):
            boundary = text.rfind("\n", start, end)
            if boundary > start + max_chars // 2:
                end = boundary
        content = text[start:end].strip()
        if content:
            chunks.append(
                Chunk(
                    ordinal,
                    content,
                    hashlib.sha256(content.encode()).hexdigest(),
                    start,
                    end,
                    None,
                    None,
                    (),
                )
            )
            ordinal += 1
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return tuple(chunks)
