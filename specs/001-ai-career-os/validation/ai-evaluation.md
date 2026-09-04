# AI evaluation

Evaluation cases are versioned in `tests/evals/public-intelligence/cases.jsonl`. Every public answer
must use public evidence handles, abstain for unsupported/private requests, and treat retrieved text
as untrusted data. Provider fakes cover refusal, timeout, and downgrade behavior.

## Measured run — 2026-09-04

The deterministic evaluation suite passed 6 evaluation tests. The adversarial public-intelligence
suite passed 5 additional tests, including 100/100 unsupported hostile questions abstained (100%),
private chunks excluded before hybrid retrieval, and bounded request enforcement; the AI package unit
suite passed 4 safety/orchestrator tests. Grounded citation, JD rationale, and reproducible scoring all
passed. Production-provider and full document-corpus gates remain release-environment checks.
