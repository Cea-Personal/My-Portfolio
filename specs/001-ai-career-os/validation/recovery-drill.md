# Recovery drill

Restore is designed around Supabase database/object backups with owner identity mapping preserved.
After restore, verify RLS, active publication, evidence handles, and submitted artifact hashes before
re-enabling workers. The drill is intentionally manual and requires a human release approval.
