# AI evaluation

Evaluation cases are versioned in `tests/evals/public-intelligence/cases.jsonl`. Every public answer
must use public evidence handles, abstain for unsupported/private requests, and treat retrieved text
as untrusted data. Provider fakes cover refusal, timeout, and downgrade behavior.
