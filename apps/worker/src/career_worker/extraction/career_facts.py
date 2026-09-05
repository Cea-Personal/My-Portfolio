from __future__ import annotations

import re
from dataclasses import dataclass, field

from career_worker.ingestion.chunking import Chunk


@dataclass(frozen=True, slots=True)
class ExtractedFactCandidate:
    fact_type: str
    statement: str
    confidence: float
    source_start: int
    source_end: int
    section: str | None = None
    structured_value: dict[str, object] = field(default_factory=dict)
    review_status: str = "available_private"


SECTION_TYPES = {
    "experience": "experience",
    "work experience": "experience",
    "professional experience": "experience",
    "employment history": "experience",
    "career history": "experience",
    "skills": "skill",
    "technical skills": "skill",
    "core skills": "skill",
    "technologies": "skill",
    "education": "education",
    "academic background": "education",
    "certifications": "certification",
    "certificates": "certification",
    "professional certifications": "certification",
    "projects": "project",
    "selected projects": "project",
    "personal projects": "project",
}

IMPACT_WORDS = (
    "increased",
    "reduced",
    "improved",
    "saved",
    "grew",
    "accelerated",
    "decreased",
    "cut ",
    "lowered",
)
ACTION_WORDS = (
    "built",
    "created",
    "designed",
    "developed",
    "delivered",
    "implemented",
    "led",
    "managed",
    "migrated",
    "owned",
    "architected",
    "automated",
    "maintained",
    "collaborated",
    "deployed",
    "engineered",
    "established",
    "integrated",
    "mentored",
    "optimized",
    "supported",
)


def _clean_line(value: str) -> str:
    value = re.sub(r"^[\s\u2022\u25cf\u25aa\u25e6\-*\u2013\u2014\u25aa\u25e6]+", "", value)
    return re.sub(r"\s+", " ", value).strip()


def _heading_type(value: str) -> str | None:
    normalized = re.sub(r"[^a-z ]", "", value.lower()).strip()
    return SECTION_TYPES.get(normalized)


def _complete_statement(value: str, fact_type: str) -> str:
    value = value.strip().rstrip(";,. ")
    if fact_type in {"skill", "education", "certification", "project", "experience"}:
        label = fact_type.capitalize()
        if not value.lower().startswith(f"{fact_type}:"):
            value = f"{label}: {value}"
    if value and value[-1] not in ".!?":
        value += "."
    return value


def _classify(value: str, section_type: str | None) -> tuple[str, float]:
    lowered = value.lower()
    if section_type in {"skill", "education", "certification", "project"}:
        return section_type, 0.91
    if section_type == "experience":
        return "experience", 0.84
    if (
        "%" in value
        or re.search(r"\b\d+(?:\.\d+)?x\b", lowered)
        or any(word in lowered for word in IMPACT_WORDS)
    ):
        return "experience", 0.76
    if lowered.startswith(ACTION_WORDS):
        return "experience", 0.72
    return "project", 0.60


def _is_bullet(raw: str) -> bool:
    return bool(re.match(r"^\s*[\u2022\u25cf\u25aa\u25e6\-*\u2013\u2014]", raw))


def _experience_header(value: str) -> dict[str, object]:
    period_match = re.search(
        r"\b(?:19|20)\d{2}\b\s*(?:[-\u2013\u2014]|to)\s*"
        r"(?:\b(?:19|20)\d{2}\b|present|current)|\b(?:19|20)\d{2}\b",
        value,
        re.IGNORECASE,
    )
    period = period_match.group(0).strip() if period_match else ""
    identity = value
    if period_match:
        identity = f"{value[: period_match.start()]} {value[period_match.end() :]}"
    identity = re.sub(r"[|,;\-\u2013\u2014]+\s*$", "", identity).strip()
    parts = [part.strip() for part in re.split(r"\s+(?:at|@)\s+", identity, maxsplit=1, flags=re.I)]
    if len(parts) == 2:
        role, organization = parts
    else:
        separated = [
            part.strip()
            for part in re.split(r"\s+[|\-\u2013\u2014]\s+", identity, maxsplit=1)
            if part.strip()
        ]
        role = separated[0] if separated else identity
        organization = separated[1] if len(separated) > 1 else ""
    return {
        "organization": organization,
        "role": role,
        "period": period,
        "responsibilities": [],
        "achievements": [],
        "impacts": [],
        "projects": [],
        "skills": [],
        "tools": [],
    }


def _experience_statement(value: dict[str, object], fallback: str) -> str:
    role = str(value.get("role") or "").strip()
    organization = str(value.get("organization") or "").strip()
    period = str(value.get("period") or "").strip()
    identity = (
        f"{role} at {organization}"
        if role and organization
        else role or organization or fallback
    )
    return f"{identity}{f' ({period})' if period else ''}."


def extract_candidates(
    chunk: Chunk, extractor_version: str = "career-facts.v2"
) -> tuple[ExtractedFactCandidate, ...]:
    del extractor_version
    section_type = next(
        (
            _heading_type(section)
            for section in reversed(chunk.section_path)
            if _heading_type(section)
        ),
        None,
    )
    active_section = section_type
    candidates: list[ExtractedFactCandidate] = []
    seen: set[tuple[str, str]] = set()
    experience: dict[str, object] | None = None
    experience_start = chunk.char_start
    experience_end = chunk.char_start

    def flush_experience() -> None:
        nonlocal experience
        if not experience:
            return
        statement = _experience_statement(experience, "Experience details")
        key = ("experience", statement.casefold())
        if key not in seen:
            seen.add(key)
            candidates.append(
                ExtractedFactCandidate(
                    fact_type="experience",
                    statement=statement,
                    confidence=0.88 if experience.get("organization") else 0.72,
                    source_start=experience_start,
                    source_end=experience_end,
                    section="experience",
                    structured_value=experience,
                )
            )
        experience = None

    # CVs are structured by headings and bullets, so punctuation is not a safe
    # record boundary. Preserve each visual line and turn it into a full claim.
    for match in re.finditer(r"[^\r\n]+", chunk.content):
        raw = match.group(0)
        line = _clean_line(raw)
        if not line:
            continue
        heading = _heading_type(line.rstrip(":"))
        if heading:
            if active_section == "experience" and heading != "experience":
                flush_experience()
            active_section = heading
            continue
        if len(line) < 3 or len(line) > 500:
            continue
        if "@" in line and len(line.split()) <= 6:
            continue
        if re.fullmatch(r"(?:https?://|www\.)\S+", line, re.IGNORECASE):
            continue
        leading = len(raw) - len(raw.lstrip())
        source_start = chunk.char_start + match.start() + leading
        source_end = chunk.char_start + match.end()
        if active_section == "experience":
            header_signal = not _is_bullet(raw) and (
                bool(re.search(r"\b(?:19|20)\d{2}\b|\b(?:present|current)\b", line, re.I))
                or not line.lower().startswith(ACTION_WORDS)
            )
            if header_signal:
                flush_experience()
                experience = _experience_header(line)
                experience_start = source_start
                experience_end = source_end
                continue
            if experience is None:
                inherited_role = next(
                    (
                        section
                        for section in reversed(chunk.section_path)
                        if _heading_type(section) is None
                    ),
                    "",
                )
                experience = _experience_header(inherited_role or "Experience details")
                experience_start = source_start
            experience_end = source_end
            lowered = line.lower()
            bucket = (
                "impacts"
                if "%" in line
                or re.search(r"\b\d+(?:\.\d+)?x\b", lowered)
                or any(word in lowered for word in IMPACT_WORDS)
                else "responsibilities"
            )
            values = experience[bucket]
            if isinstance(values, list):
                values.append(line)
            continue
        fact_type, confidence = _classify(line, active_section)
        statement = _complete_statement(line, fact_type)
        key = (fact_type, statement.casefold())
        if key in seen:
            continue
        seen.add(key)
        candidates.append(
            ExtractedFactCandidate(
                fact_type=fact_type,
                statement=statement,
                confidence=confidence,
                source_start=source_start,
                source_end=source_end,
                section=active_section,
                structured_value={"section": active_section or fact_type},
            )
        )
    flush_experience()
    return tuple(candidates)
