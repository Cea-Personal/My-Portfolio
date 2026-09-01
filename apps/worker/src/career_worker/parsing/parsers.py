from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from zipfile import ZipFile

from pypdf import PdfReader

from career_worker.security.file_validation import MAX_PDF_PAGES, validate_file


@dataclass(frozen=True, slots=True)
class ParsedPage:
    page_number: int
    text: str
    section_path: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class ParsedDocument:
    media_type: str
    pages: tuple[ParsedPage, ...]
    parser: str
    parser_version: str

    @property
    def text(self) -> str:
        return "\n\n".join(page.text for page in self.pages)


def _parse_docx(payload: bytes) -> ParsedDocument:
    with ZipFile(BytesIO(payload)) as archive:
        xml = archive.read("word/document.xml").decode("utf-8", "replace")
    text = xml.replace("</w:p>", "\n").replace("</w:tr>", "\n")
    import re

    text = re.sub(r"<[^>]+>", "", text)
    return ParsedDocument(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        (ParsedPage(1, text.strip()),),
        "docx-xml",
        "1",
    )


def parse_document(payload: bytes, media_type: str) -> ParsedDocument:
    validation = validate_file(payload, media_type)
    if not validation.safe:
        raise ValueError(validation.reason or "UNSAFE_FILE")
    if media_type == "application/pdf":
        reader = PdfReader(BytesIO(payload), strict=False)
        if len(reader.pages) > MAX_PDF_PAGES:
            raise ValueError("PDF_PAGE_LIMIT")
        pages = tuple(
            ParsedPage(index + 1, (page.extract_text() or "").strip())
            for index, page in enumerate(reader.pages)
        )
        return ParsedDocument(media_type, pages, "pypdf", "6")
    if media_type.endswith("wordprocessingml.document"):
        return _parse_docx(payload)
    return ParsedDocument(
        media_type, (ParsedPage(1, payload.decode("utf-8", "replace")),), "plain-text", "1"
    )
