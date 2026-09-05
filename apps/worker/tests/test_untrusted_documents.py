from career_worker.security.file_validation import validate_file
from career_worker.workflows.serve import parse_transport_payload


def test_pdf_magic_mismatch_is_quarantined() -> None:
    result = validate_file(b"not a pdf", "application/pdf")
    assert result.safe is False
    assert result.reason == "MIME_MISMATCH"


def test_text_is_bounded_and_accepted() -> None:
    result = validate_file(b"A trusted-looking document.", "text/plain")
    assert result.safe is True


def test_oversized_payload_is_rejected() -> None:
    result = validate_file(b"x" * (50 * 1024 * 1024 + 1), "text/plain")
    assert result.reason == "FILE_TOO_LARGE"


def test_parser_transport_returns_bounded_chunks_for_provider_embedding() -> None:
    payload = b"Improved data delivery by 40%. Built reliable software systems."
    status, result = parse_transport_payload(payload, "text/plain")
    assert status == 200
    assert isinstance(result, dict)
    assert result["status"] == "completed"
    assert result["chunks"][0]["content"] == payload.decode()
    assert "embedding" not in result["chunks"][0]
    assert result["candidates"]
