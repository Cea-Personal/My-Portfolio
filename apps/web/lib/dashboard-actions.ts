type Row = Record<string, unknown>;

export interface DashboardAction {
  id: string;
  label: string;
  detail: string;
  href: string;
  scheduledAt?: string;
}

export interface DashboardGroup {
  id: string;
  title: string;
  href: string;
  total: number;
  items: DashboardAction[];
}

export interface DashboardSources {
  jobs: Row[];
  applications: Row[];
  processes: Row[];
  opportunities: Row[];
  scores: Row[];
  proposals: Row[];
  facts: Row[];
  publications: Row[];
  debriefs: Row[];
}

const text = (value: unknown, fallback = "") =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;
const rows = (value: unknown): Row[] =>
  Array.isArray(value)
    ? value.filter((row): row is Row => Boolean(row) && typeof row === "object")
    : [];
const relation = (value: unknown): Row =>
  rows(value)[0] ??
  (value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {});
const timestamp = (value: unknown) => Date.parse(text(value)) || 0;
const recent = (values: Row[]) =>
  [...values].sort((a, b) => timestamp(b.created_at) - timestamp(a.created_at));
const roleLabel = (job: Row) =>
  `${text(job.canonical_title, "Opportunity")} · ${text(job.canonical_company, "Company")}`;

export function buildDashboardActions(sources: DashboardSources, now = Date.now()) {
  const jobs = new Map(sources.jobs.map((job) => [text(job.id), job]));
  const opportunities = new Map(sources.opportunities.map((item) => [text(item.id), item]));
  const applicationJobIds = new Set(sources.applications.map((item) => text(item.job_id)));
  const stageProcesses = new Map<string, string>();
  const groups: DashboardGroup[] = [];
  const add = (id: string, title: string, href: string, items: DashboardAction[]) => {
    groups.push({ id, title, href, total: items.length, items: items.slice(0, 5) });
  };

  const interviews: DashboardAction[] = [];
  for (const process of sources.processes) {
    const processId = text(process.id);
    const job = relation(relation(process.applications).jobs);
    for (const stage of rows(process.interview_stages)) {
      stageProcesses.set(text(stage.id), processId);
      if (["completed", "cancelled", "rejected", "withdrawn"].includes(text(stage.status)))
        continue;
      const scheduledAt = text(stage.scheduled_at);
      const past = scheduledAt && timestamp(scheduledAt) < now;
      const prepared = rows(stage.preparation_kits).some((kit) => text(kit.status) === "ready");
      interviews.push({
        id: text(stage.id),
        label: `${past ? "Record the outcome" : prepared ? "Review preparation" : "Prepare"}: ${text(stage.name, "Interview")}`,
        detail: roleLabel(job),
        href: `/interviews/${encodeURIComponent(processId)}`,
        ...(scheduledAt ? { scheduledAt } : {})
      });
    }
  }
  interviews.sort(
    (a, b) => (timestamp(a.scheduledAt) || Infinity) - (timestamp(b.scheduledAt) || Infinity)
  );
  add("interviews", "Interviews and preparation", "/interviews", interviews);

  const applications = sources.applications.filter(
    (item) => text(item.application_kind, "employment") !== "freelance"
  );
  add(
    "applications",
    "Applications to move forward",
    "/applications",
    applications
      .filter((item) =>
        ["draft", "in_progress", "ready", "preparing", "ready_to_apply"].includes(text(item.status))
      )
      .map((item) => ({
        id: text(item.id),
        label: ["ready", "ready_to_apply"].includes(text(item.status))
          ? "Submit your reviewed application manually"
          : "Continue preparing your application",
        detail: roleLabel(relation(item.jobs)),
        href: `/applications/${encodeURIComponent(text(item.id))}`
      }))
  );

  const followUps: DashboardAction[] = applications
    .filter(
      (item) =>
        text(item.status) === "submitted" &&
        timestamp(item.applied_at) > 0 &&
        now - timestamp(item.applied_at) >= 7 * 86_400_000
    )
    .map((item) => ({
      id: `application-${text(item.id)}`,
      label: "Check your submitted application",
      detail: `${roleLabel(relation(item.jobs))} · submitted at least a week ago`,
      href: `/applications/${encodeURIComponent(text(item.id))}`
    }));
  for (const debrief of sources.debriefs) {
    const processId = stageProcesses.get(text(debrief.stage_id));
    const notes = Array.isArray(debrief.follow_ups)
      ? debrief.follow_ups.filter((item) => typeof item === "string" && item.trim())
      : [];
    if (processId && notes.length) {
      // Recorded notes are review prompts, not inferred deadlines.
      followUps.push({
        id: `debrief-${text(debrief.id)}`,
        label: "Review recorded interview follow-ups",
        detail: text(notes[0]),
        href: `/interviews/${encodeURIComponent(processId)}`
      });
    }
  }
  add("follow-ups", "Follow-ups to review", "/applications", followUps);

  const highFitJobs = sources.jobs.filter((job) => {
    if (
      text(job.opportunity_domain, "employment") === "freelance" ||
      applicationJobIds.has(text(job.id))
    )
      return false;
    if (!["discovered", "reviewing", "interested", "shortlisted"].includes(text(job.status)))
      return false;
    const score = recent(
      rows(job.job_scores).filter((item) =>
        ["career_match", "match"].includes(text(item.score_type))
      )
    )[0];
    const value = score ? Number(score.numeric_score) : NaN;
    return Number.isFinite(value) && value >= 0.7 && value <= 1;
  });
  add(
    "jobs",
    "Strong job matches to review",
    "/jobs",
    highFitJobs.map((job) => ({
      id: text(job.id),
      label: roleLabel(job),
      detail: "At least 70% recorded match · review before shortlisting",
      href: `/jobs/${encodeURIComponent(text(job.id))}`
    }))
  );

  const latestScores = new Map<string, Row>();
  for (const score of recent(sources.scores))
    if (!latestScores.has(text(score.opportunity_id)))
      latestScores.set(text(score.opportunity_id), score);
  const proposed = new Set(sources.proposals.map((proposal) => text(proposal.opportunity_id)));
  add(
    "freelance",
    "Freelance opportunities to review",
    "/freelance",
    sources.opportunities
      .filter(
        (item) =>
          !proposed.has(text(item.id)) &&
          ["APPLY_NOW", "APPLY"].includes(text(latestScores.get(text(item.id))?.recommendation))
      )
      .map((item) => ({
        id: text(item.id),
        label: roleLabel(jobs.get(text(item.job_id)) ?? {}),
        detail: "Recommended by your existing opportunity score",
        href: `/freelance/${encodeURIComponent(text(item.id))}`
      }))
  );

  add(
    "proposals",
    "Proposals and client responses",
    "/freelance",
    sources.proposals
      .filter(
        (proposal) =>
          !["WON", "LOST", "WITHDRAWN"].includes(text(proposal.crm_status)) &&
          (["DRAFT", "READY_FOR_REVIEW", "APPROVED"].includes(text(proposal.approval_state)) ||
            ["CLIENT_RESPONDED", "INTERVIEW", "NEGOTIATION"].includes(text(proposal.crm_status)))
      )
      .map((proposal) => {
        const opportunityId = text(proposal.opportunity_id);
        const opportunity = opportunities.get(opportunityId);
        const state = text(proposal.approval_state);
        const response = ["CLIENT_RESPONDED", "INTERVIEW", "NEGOTIATION"].includes(
          text(proposal.crm_status)
        );
        return {
          id: text(proposal.id),
          label: response
            ? "Review the client conversation"
            : state === "APPROVED"
              ? "Submit your approved proposal manually"
              : state === "READY_FOR_REVIEW"
                ? "Review your proposal"
                : "Finish your proposal draft",
          detail: roleLabel(jobs.get(text(opportunity?.job_id)) ?? {}),
          href: `/freelance/${encodeURIComponent(opportunityId)}`
        };
      })
  );

  add(
    "facts",
    "Career evidence to review",
    "/career-brain",
    sources.facts
      .filter((fact) => ["candidate", "in_review", "deferred"].includes(text(fact.review_status)))
      .map((fact) => ({
        id: text(fact.id),
        label: "Review career evidence",
        detail: text(
          relation(fact.currentVersion).statement,
          "Check the source before using this fact."
        ),
        href: "/career-brain"
      }))
  );
  add(
    "publication",
    "Portfolio snapshots awaiting approval",
    "/career-brain#publication",
    sources.publications
      .filter((item) => text(item.status) === "staged")
      .map((item) => ({
        id: text(item.id),
        label: `Review portfolio version ${String(item.version)}`,
        detail: "Staged for your review before activation",
        href: "/career-brain#publication"
      }))
  );

  return {
    groups,
    actions: groups.flatMap((group) => group.items.map((item) => ({ ...item, type: group.id }))),
    counts: Object.fromEntries(groups.map((group) => [group.id, group.total])),
    generatedAt: new Date(now).toISOString()
  };
}
