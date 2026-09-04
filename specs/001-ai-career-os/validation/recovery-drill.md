# Recovery drill

Restore is designed around Supabase database/object backups with owner identity mapping preserved.
After restore, verify RLS, active publication, evidence handles, and submitted artifact hashes before
re-enabling workers. The drill is intentionally manual and requires a human release approval.

No backup/restore drill is claimed in this environment. T321 remains open until an isolated Supabase
backup is restored and the owner/RLS, publication, provenance, and private-object hash checks are
recorded without using production data.
