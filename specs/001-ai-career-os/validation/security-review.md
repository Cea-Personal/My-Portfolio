# Security review

Review gates cover Supabase RLS, owner authorization, safe-fetch SSRF boundaries, upload signatures,
prompt-injection resistance, XSS-safe markdown, CSRF/session handling, secret-reference validation,
telemetry redaction, and the automation denylist. No critical findings are open in the checked-in
fixtures; run `pnpm test:security` for the current suite.
