# Requirement traceability

The selected release maps each functional requirement to a user-story task and executable check.
Contracts live under `tests/contract`, deterministic domain checks live beside their package, and
database isolation checks live under `supabase/tests`. The source of truth is `tasks.md`; task IDs
are kept in commit history and CI output.

| Area | Primary artifacts | Verification |
| --- | --- | --- |
| Trusted facts/evidence | `packages/career`, `packages/knowledge`, migrations `0010–0015` | unit, worker, RLS tests |
| Public portfolio/intelligence | `apps/web/app/(public)`, `packages/ai` | contract, a11y, E2E tests |
| Opportunities/applications | `packages/jobs`, `packages/applications` | deterministic domain tests |
| Interviews/writing/analytics | `packages/interviews`, `packages/analytics`, `packages/career` | unit and privacy tests |
| Automation controls | `packages/observability`, `packages/auth` | resilience and denylist tests |
