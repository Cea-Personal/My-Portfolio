# Release checklist

- [x] Lint, typecheck, unit, worker, and production build pass.
- [x] Supabase Cloud migration dry run is up to date through migration 0118; application schema lint
  errors are cleared.
- [x] Public responses use approved publication data and safe AI degradation.
- [x] Automation denylist blocks consequential actions and live interview assistance.
- [x] Release preflight fails closed when hosted credentials, fixtures, browsers, mutation permission,
  or required evidence are missing.
- [x] Inngest trigger registration is split within the ten-trigger platform limit.
- [ ] Human production approval (required at deployment time).
- [ ] Hosted pgTAP/RLS suite (`pnpm test:db:hosted`) and cross-engine browser matrix.
- [ ] k6 performance budget and isolated backup/restore drill.
