# ADR 0001: implementation deviations

The initial scaffold uses in-memory domain ports and deterministic provider fakes while Supabase and
external providers are configured. The ports mirror the production contracts so replacing a fake does
not change authorization, evidence, or workflow semantics.
