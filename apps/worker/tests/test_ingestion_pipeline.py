from career_worker.extraction.career_facts import extract_candidates
from career_worker.ingestion.chunking import chunk_document, normalize_text
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


def test_cv_sections_produce_complete_typed_facts_without_terminal_punctuation() -> None:
    document = ParsedDocument(
        "text/plain",
        (
            ParsedPage(
                1,
                "EXPERIENCE\nSenior Data Engineer - Example Ltd | 2022-Present\n"
                "• Built a governed data platform used by five teams\n"
                "• Reduced pipeline failures by 42%\n\n"
                "SKILLS\nPython, SQL, dbt, Airflow\n\n"
                "EDUCATION\nMSc Data Science — Example University\n\n"
                "CERTIFICATIONS\nAWS Certified Data Engineer\n\n"
                "SELECTED PROJECTS\nCareer OS — evidence-backed portfolio assistant",
            ),
        ),
        "text",
        "1",
    )
    candidates = extract_candidates(chunk_document(document, max_chars=2000, overlap=0)[0])
    by_type = {candidate.fact_type: candidate for candidate in candidates}

    assert "experience" in by_type
    assert set(by_type).issubset({"experience", "project", "skill", "education", "certification"})
    experience = by_type["experience"]
    assert experience.structured_value["role"] == "Senior Data Engineer"
    assert experience.structured_value["organization"] == "Example Ltd"
    assert experience.structured_value["period"] == "2022-Present"
    assert experience.structured_value["responsibilities"] == [
        "Built a governed data platform used by five teams"
    ]
    assert experience.structured_value["impacts"] == ["Reduced pipeline failures by 42%"]
    assert by_type["skill"].statement.startswith("Skill:")
    assert by_type["education"].statement.startswith("Education:")
    assert by_type["certification"].statement.startswith("Certification:")
    assert by_type["project"].statement.startswith("Project:")
    assert all(candidate.statement.endswith(".") for candidate in candidates)


def test_each_role_is_extracted_as_a_distinct_organisation_bound_experience() -> None:
    document = ParsedDocument(
        "text/plain",
        (
            ParsedPage(
                1,
                "EXPERIENCE\nData Engineer at First Corp | 2020-2022\n"
                "• Built batch pipelines\n"
                "Senior Data Engineer at Second Corp | 2022-Present\n"
                "• Improved platform reliability by 35%",
            ),
        ),
        "text",
        "1",
    )
    candidates = extract_candidates(chunk_document(document, max_chars=2000, overlap=0)[0])
    experiences = [candidate for candidate in candidates if candidate.fact_type == "experience"]

    assert len(experiences) == 2
    assert [item.structured_value["organization"] for item in experiences] == [
        "First Corp",
        "Second Corp",
    ]
    assert experiences[1].structured_value["impacts"] == ["Improved platform reliability by 35%"]
