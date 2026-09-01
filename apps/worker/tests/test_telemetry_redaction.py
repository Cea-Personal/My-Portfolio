from career_worker.observability import pseudonymize_owner, redact_telemetry


def test_redacts_sensitive_fields_recursively() -> None:
    value = redact_telemetry(
        {"prompt": "secret", "nested": {"signed_url": "private", "status": "ok"}}
    )
    assert value == {"prompt": "[REDACTED]", "nested": {"signed_url": "[REDACTED]", "status": "ok"}}


def test_owner_pseudonym_is_stable_and_salted() -> None:
    assert pseudonymize_owner("owner", "salt") == pseudonymize_owner("owner", "salt")
    assert pseudonymize_owner("owner", "salt") != pseudonymize_owner("owner", "other")
