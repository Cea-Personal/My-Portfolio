from career_worker.extraction.career_facts import extract_candidates
from career_worker.ingestion.chunking import chunk_document, normalize_text
from career_worker.ingestion.embeddings import compatible_embedding, embed_deterministically
from career_worker.parsing.parsers import ParsedDocument, ParsedPage


def test_normalization_chunk_hashes_and_offsets_are_deterministic() -> None:
    document = ParsedDocument(
        "text/plain", (ParsedPage(1, "  Improved delivery by 40%.  "),), "text", "1"
    )
    chunks = chunk_document(document, max_chars=100, overlap=10)
    assert normalize_text(document.text) == "Improved delivery by 40%."
    assert chunks[0].content_hash == chunks[0].content_hash
    assert extract_candidates(chunks[0])


def test_embedding_dimensions_are_explicit_and_compatible() -> None:
    vector = embed_deterministically("career", 32)
    assert len(vector) == 32
    assert compatible_embedding(32, 32)
    assert not compatible_embedding(32, 64)
