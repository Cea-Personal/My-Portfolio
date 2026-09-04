from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from typing import NamedTuple

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
    # Strip line-edge noise as well as collapsing runs of spaces.  Doing this
    # per line makes ``normalize_text(document.text)`` identical to the page
    # representation used for provenance offsets.
    lines = [
        re.sub(r"[ \t]+", " ", line).strip()
        for line in value.replace("\r\n", "\n").split("\n")
    ]
    return "\n".join(lines).strip()


class _PageSpan(NamedTuple):
    page_number: int
    start: int
    end: int
    section_path: tuple[str, ...]


def _normalized_pages(document: ParsedDocument) -> tuple[str, tuple[_PageSpan, ...]]:
    """Return the canonical text and the page ranges in that text.

    Chunk offsets are offsets into this canonical representation.  Normalising
    each page before joining it means offsets remain stable while page and
    section provenance is retained instead of being discarded by chunking.
    """

    parts: list[str] = []
    spans: list[_PageSpan] = []
    offset = 0
    for page in document.pages:
        page_text = normalize_text(page.text)
        if not page_text:
            continue
        if parts:
            offset += 2  # the canonical page separator ("\\n\\n")
        start = offset
        parts.append(page_text)
        offset += len(page_text)
        spans.append(_PageSpan(page.page_number, start, offset, page.section_path))
    return "\n\n".join(parts), tuple(spans)


def _preferred_end(text: str, start: int, target: int) -> int:
    """Choose a readable boundary without exceeding ``target``.

    Paragraphs and lines are preferred, followed by sentence and word
    boundaries.  A boundary is only used when it would not create a tiny
    fragment; very long words/URLs are allowed to be split as a last resort.
    """

    if target >= len(text):
        return len(text)
    window = text[start:target]
    minimum = start + max(1, int((target - start) * 0.55))
    candidates: list[int] = []
    for match in re.finditer(r"\n\n+|\n|(?<=[.!?])\s+|\s+", window):
        candidate = start + match.end()
        if candidate <= target and candidate >= minimum:
            candidates.append(candidate)
    return max(candidates, default=target)


def _trim_bounds(text: str, start: int, end: int) -> tuple[int, int]:
    while start < end and text[start].isspace():
        start += 1
    while end > start and text[end - 1].isspace():
        end -= 1
    return start, end


def _word_aligned_start(text: str, start: int, end: int, overlap: int) -> int:
    candidate = max(start + 1, end - overlap)
    if candidate >= len(text) or candidate == 0 or text[candidate - 1].isspace():
        return candidate
    boundary = text.rfind(" ", start + 1, candidate + 1)
    if boundary > start:
        return boundary + 1
    return candidate


def _section_for_range(spans: tuple[_PageSpan, ...], start: int, end: int) -> tuple[str, ...]:
    paths = [span.section_path for span in spans if span.start < end and span.end > start]
    if not paths:
        return ()
    common = list(paths[0])
    for path in paths[1:]:
        common = [value for value, other in zip(common, path, strict=False) if value == other]
    return tuple(common)


def _provenance_for_range(
    spans: tuple[_PageSpan, ...], start: int, end: int
) -> tuple[int | None, int | None, tuple[str, ...]]:
    pages = [span for span in spans if span.start < end and span.end > start]
    if not pages:
        return None, None, ()
    return pages[0].page_number, pages[-1].page_number, _section_for_range(spans, start, end)


def chunk_document(
    document: ParsedDocument, max_chars: int = 1600, overlap: int = 160
) -> tuple[Chunk, ...]:
    if max_chars <= overlap or max_chars > 20_000:
        raise ValueError("invalid chunk bounds")
    text, page_spans = _normalized_pages(document)
    chunks: list[Chunk] = []
    start = 0
    ordinal = 0
    while start < len(text):
        target = min(start + max_chars, len(text))
        end = _preferred_end(text, start, target)
        start, end = _trim_bounds(text, start, end)
        content = text[start:end]
        if content:
            page_start, page_end, section_path = _provenance_for_range(
                page_spans, start, end
            )
            chunks.append(
                Chunk(
                    ordinal,
                    content,
                    hashlib.sha256(content.encode()).hexdigest(),
                    start,
                    end,
                    page_start,
                    page_end,
                    section_path,
                )
            )
            ordinal += 1
        if end >= len(text):
            break
        start = _word_aligned_start(text, start, end, overlap)
    return tuple(chunks)
