from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from zipfile import BadZipFile, ZipFile

MAX_FILE_BYTES = 50 * 1024 * 1024
MAX_PDF_PAGES = 500
MAX_UNCOMPRESSED_ZIP_BYTES = 100 * 1024 * 1024
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
}


@dataclass(frozen=True, slots=True)
class FileValidation:
    safe: bool
    reason: str | None = None
    detected_type: str | None = None


def _detect_signature(payload: bytes) -> str | None:
    if payload.startswith(b"%PDF-"):
        return "application/pdf"
    if payload.startswith(b"PK\x03\x04"):
        return "application/zip"
    if b"\x00" not in payload[:4096]:
        return "text/plain"
    return None


def validate_file(payload: bytes, declared_mime: str, filename: str = "upload") -> FileValidation:
    if not payload:
        return FileValidation(False, "EMPTY_FILE")
    if len(payload) > MAX_FILE_BYTES:
        return FileValidation(False, "FILE_TOO_LARGE")
    if declared_mime not in ALLOWED_MIME_TYPES:
        return FileValidation(False, "MIME_NOT_ALLOWED", _detect_signature(payload))
    detected = _detect_signature(payload)
    if declared_mime == "application/pdf" and detected != declared_mime:
        return FileValidation(False, "MIME_MISMATCH", detected)
    if declared_mime.endswith("wordprocessingml.document"):
        if detected != "application/zip":
            return FileValidation(False, "MIME_MISMATCH", detected)
        try:
            with ZipFile(BytesIO(payload)) as archive:
                total = sum(item.file_size for item in archive.infolist())
                if total > MAX_UNCOMPRESSED_ZIP_BYTES:
                    return FileValidation(False, "ZIP_BOMB")
                if any(item.filename.startswith(("/", "..")) for item in archive.infolist()):
                    return FileValidation(False, "ZIP_PATH_TRAVERSAL")
        except BadZipFile:
            return FileValidation(False, "INVALID_DOCX")
    if declared_mime in {"text/plain", "text/markdown"} and detected != "text/plain":
        return FileValidation(False, "MIME_MISMATCH", detected)
    if len(filename) > 255:
        return FileValidation(False, "FILENAME_TOO_LONG")
    return FileValidation(True, detected_type=declared_mime)


def quarantine_reason(validation: FileValidation) -> str | None:
    return None if validation.safe else validation.reason or "UNSAFE_FILE"
