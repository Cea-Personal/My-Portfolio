from __future__ import annotations

import os

import inngest

inngest_client = inngest.Inngest(
    app_id="career-worker",
    is_production=os.getenv("CAREER_WORKER_ENV") == "production",
)
