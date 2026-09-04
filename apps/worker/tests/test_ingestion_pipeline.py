from career_worker.extraction.career_facts import extract_candidates
from career_worker.ingestion.chunking import chunk_document, normalize_text
from career_worker.ingestion.embeddings import (
    EMBEDDING_DIMENSIONS,
    compatible_embedding,
    embed_deterministically,
)
from career_worker.parsing.parsers import ParsedDocument, ParsedPage


def test_normalization_chunk_hashes_and_offsets_are_deterministic() -> None:
    document = ParsedDocument(
        "text/plain", (ParsedPage(1, "  Improved delivery by 40%.  "),), "text", "1"
    )
    chunks = chunk_document(document, max_chars=100, overlap=10)
    assert normalize_text(document.text) == "Improved delivery by 40%."
    assert chunks[0].content_hash == chunks[0].content_hash
    assert extract_candidates(chunks[0])


def test_chunking_preserves_page_sections_and_canonical_offsets() -> None:
    document = ParsedDocument(
        "text/plain",
        (
            ParsedPage(
                1,
                "  Alpha paragraph one.\n\nBeta paragraph two.  ",
                ("Experience", "Web developer"),
            ),
            ParsedPage(
                2,
                "Gamma paragraph three.\n\nDelta paragraph four.",
                ("Experience", "Software engineer"),
            ),
        ),
        "text",
        "1",
    )
    canonical = (
        "Alpha paragraph one.\n\nBeta paragraph two.\n\n"
        "Gamma paragraph three.\n\nDelta paragraph four."
    )
    chunks = chunk_document(document, max_chars=45, overlap=8)

    assert chunks
    assert normalize_text(document.text) == canonical
    assert all(chunk.char_end - chunk.char_start == len(chunk.content) for chunk in chunks)
    assert all(canonical[chunk.char_start : chunk.char_end] == chunk.content for chunk in chunks)
    assert all(len(chunk.content) <= 45 for chunk in chunks)
    assert all(chunk.content == chunk.content.strip() for chunk in chunks)
    assert chunks[0].page_start == chunks[0].page_end == 1
    assert chunks[0].section_path == ("Experience", "Web developer")
    assert any(chunk.page_start == 1 and chunk.page_end == 2 for chunk in chunks)
    assert any(chunk.section_path == ("Experience",) for chunk in chunks)


def test_embedding_dimensions_are_explicit_and_compatible() -> None:
    vector = embed_deterministically("career", 32)
    assert len(vector) == 32
    assert len(embed_deterministically("career")) == EMBEDDING_DIMENSIONS
    assert compatible_embedding(32, 32)
    assert not compatible_embedding(32, 64)
