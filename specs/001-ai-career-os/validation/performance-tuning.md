# Performance tuning record

Measured tuning keeps public retrieval bounded, uses exact filtering before ranking, and defers HNSW
until the benchmark in `tests/evals/retrieval/hnsw-benchmark.ts` demonstrates acceptable filtered recall.
