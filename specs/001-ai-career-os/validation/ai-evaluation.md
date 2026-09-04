# AI evaluation

Evaluation cases are versioned in `tests/evals/public-intelligence/cases.jsonl`. Every public answer
must use public evidence handles, abstain for unsupported/private requests, and treat retrieved text
as untrusted data. Provider fakes cover refusal, timeout, and downgrade behavior.

## Measured run — 2026-09-04

The deterministic evaluation suite passed 6 evaluation tests. The adversarial public-intelligence
suite passed 5 additional tests, including 100/100 unsupported hostile questions abstained (100%),
private chunks excluded before hybrid retrieval, and bounded request enforcement. Targeted AI,
retrieval, JD, artifact, and interview unit tests passed 17/17; related AI/provider/chat/JD/application/
interview contracts, artifact integration, and no-live-assistance security tests passed 12/12; worker
document parsing, chunking, embedding, and untrusted-file tests passed 14/14. Grounded citation, JD
rationale, reproducible scoring, and deterministic interview preparation all passed. Production-provider
models/credentials, larger document-corpus, artifact-quality, and interview-quality thresholds remain
release-environment checks, so T319 is not marked complete.
