import { withPrivateApi } from "@/lib/api/private";
import { apiResponse } from "@/lib/api/response";
import {
  isPortfolioEvent,
  type AnalyticsEventRow,
  visitDetails
} from "@/lib/server/portfolio-analytics";

type LogCategory = "page_view" | "system_error" | "failure" | "success" | "system" | "ai_run";
type LogStatus = "success" | "failure" | "info";

interface LogEntry {
  id: string;
  kind: "portfolio_visit" | "ai_run" | "system";
  category: LogCategory;
  status: LogStatus;
  occurredAt: string;
  title: string;
  summary: string;
  source: string;
  details: Record<string, unknown>;
}

function classifyAudit(
  action: string,
  reason: string | null,
  metadata: unknown
): { category: LogCategory; status: LogStatus } {
  const value = `${action} ${reason ?? ""} ${JSON.stringify(metadata ?? {})}`.toLowerCase();
  if (/fail|error|denied|quarantin|revok|unauthoriz|\b[45]\d{2}\b/.test(value)) {
    return { category: value.includes("error") ? "system_error" : "failure", status: "failure" };
  }
  if (/complete|success|created|updated|published|approved|indexed|synced|generated/.test(value)) {
    return { category: "success", status: "success" };
  }
  return { category: "system", status: "info" };
}

function classifyAi(
  status: string,
  errorCode: string | null
): { category: LogCategory; status: LogStatus } {
  const value = `${status} ${errorCode ?? ""}`.toLowerCase();
  if (/fail|error|cancel/.test(value)) {
    return { category: value.includes("error") ? "system_error" : "failure", status: "failure" };
  }
  if (/complete|success|succeed/.test(value)) return { category: "success", status: "success" };
  return { category: "ai_run", status: "info" };
}

function requestedCategory(request: Request): string {
  return new URL(request.url).searchParams.get("type")?.trim() || "all";
}

function matchesCategory(entry: LogEntry, filter: string): boolean {
  return (
    filter === "all" ||
    entry.category === filter ||
    (filter === "page_view" && entry.kind === "portfolio_visit")
  );
}

function safeMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.slice(0, 50).map(safeMetadata);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 50)
      .map(([key, entry]) => [
        key,
        /secret|token|password|credential|api[_-]?key/i.test(key)
          ? "[redacted]"
          : safeMetadata(entry)
      ])
  );
}

export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const url = new URL(request.url);
    const filter = requestedCategory(request);
    const limitRaw = Number(url.searchParams.get("limit") ?? "150");
    const limit = Number.isFinite(limitRaw)
      ? Math.min(200, Math.max(1, Math.round(limitRaw)))
      : 150;
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    let analyticsQuery = client
      .schema("app")
      .from("analytics_events")
      .select("session_id,event_name,occurred_at,properties")
      .eq("owner_id", ownerId)
      .order("occurred_at", { ascending: false })
      .limit(5000);
    if (from) analyticsQuery = analyticsQuery.gte("occurred_at", from);
    if (to) analyticsQuery = analyticsQuery.lte("occurred_at", to);

    const [audit, runs, workflows, analytics] = await Promise.all([
      client
        .schema("app")
        .from("audit_events")
        .select(
          "id,action,target_type,target_id,correlation_id,occurred_at,before_metadata,after_metadata,reason"
        )
        .eq("owner_id", ownerId)
        .order("occurred_at", { ascending: false })
        .limit(300),
      client
        .schema("app")
        .from("ai_runs")
        .select(
          "id,task,status,usage,elapsed_ms,related_type,related_id,error_code,sanitized_error,created_at,finished_at"
        )
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false })
        .limit(300),
      client
        .schema("app")
        .from("automation_runs")
        .select(
          "id,workflow_name,status,error_code,error_detail,created_at,finished_at,context_metadata"
        )
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false })
        .limit(300),
      analyticsQuery
    ]);
    if (audit.error) throw audit.error;
    if (runs.error) throw runs.error;
    if (workflows.error) throw workflows.error;
    if (analytics.error) throw analytics.error;

    const entries: LogEntry[] = [];
    for (const row of (audit.data ?? []) as Array<Record<string, unknown>>) {
      const action = typeof row.action === "string" ? row.action : "System action";
      const reason = typeof row.reason === "string" ? row.reason : null;
      const classification = classifyAudit(action, reason, row.after_metadata);
      const metadata = safeMetadata(row.after_metadata) as Record<string, unknown> | null;
      const metadataDiagnostic =
        metadata && typeof metadata === "object"
          ? [metadata.detail, metadata.error, metadata.message, metadata.code].find(
              (value): value is string => typeof value === "string" && value.trim().length > 0
            )
          : undefined;
      const auditSummary = reason
        ? reason
        : metadataDiagnostic
          ? metadataDiagnostic
          : classification.status === "failure"
            ? `Error recorded while running ${action}.`
            : typeof row.target_type === "string"
              ? `Target: ${row.target_type}`
              : "Workspace action recorded.";
      entries.push({
        id: String(row.id),
        kind: "system",
        ...classification,
        occurredAt: String(row.occurred_at),
        title: action,
        summary: auditSummary,
        source: "system audit",
        details: {
          targetType: row.target_type,
          targetId: row.target_id,
          correlationId: row.correlation_id,
          reason,
          before: safeMetadata(row.before_metadata),
          after: safeMetadata(row.after_metadata)
        }
      });
    }
    for (const row of (workflows.data ?? []) as Array<Record<string, unknown>>) {
      const workflow = typeof row.workflow_name === "string" ? row.workflow_name : "Workflow";
      const status = typeof row.status === "string" ? row.status : "unknown";
      const errorCode = typeof row.error_code === "string" ? row.error_code : "";
      const errorDetail = typeof row.error_detail === "string" ? row.error_detail.trim() : "";
      const failed = /fail|error|cancel/.test(`${status} ${errorCode}`.toLowerCase());
      entries.push({
        id: `workflow-${String(row.id)}`,
        kind: "system",
        category: failed
          ? errorCode.toLowerCase().includes("error")
            ? "system_error"
            : "failure"
          : status === "completed"
            ? "success"
            : "system",
        status: failed ? "failure" : status === "completed" ? "success" : "info",
        occurredAt: String(row.finished_at ?? row.created_at),
        title: `${workflow} workflow`,
        summary:
          errorDetail ||
          (errorCode ? `Error ${errorCode} while running ${workflow}.` : `Status: ${status}`),
        source: "workflow runtime",
        details: {
          workflow,
          status,
          errorCode: errorCode || null,
          errorMessage: errorDetail || null,
          context: safeMetadata(row.context_metadata)
        }
      });
    }
    for (const row of (runs.data ?? []) as Array<Record<string, unknown>>) {
      const task = typeof row.task === "string" ? row.task : "AI task";
      const status = typeof row.status === "string" ? row.status : "unknown";
      const errorCode = typeof row.error_code === "string" ? row.error_code : null;
      const sanitizedError =
        typeof row.sanitized_error === "string" ? row.sanitized_error.trim() : "";
      const aiSummary = sanitizedError
        ? sanitizedError
        : errorCode
          ? `Error ${errorCode} while running ${task}.`
          : `Status: ${status}`;
      entries.push({
        id: String(row.id),
        kind: "ai_run",
        ...classifyAi(status, errorCode),
        occurredAt: String(row.finished_at ?? row.created_at),
        title: `${task} run`,
        summary: aiSummary,
        source: "AI runtime",
        details: {
          task,
          status,
          usage: row.usage,
          elapsedMs: row.elapsed_ms,
          relatedType: row.related_type,
          relatedId: row.related_id,
          errorCode,
          errorMessage: sanitizedError || null
        }
      });
    }

    const portfolio = visitDetails(
      ((analytics.data ?? []) as AnalyticsEventRow[]).filter(isPortfolioEvent)
    );
    portfolio.forEach((visit, index) => {
      entries.push({
        id: `portfolio-visit-${visit.startedAt}-${String(index)}`,
        kind: "portfolio_visit",
        category: "page_view",
        status: "success",
        occurredAt: visit.startedAt,
        title: "Someone visited your portfolio page.",
        summary: `Stayed for ${formatDuration(Math.max(visit.durationSeconds, visit.measuredEngagementSeconds))}.`,
        source: "public portfolio",
        details: { ...visit }
      });
    });

    const filtered = entries
      .filter((entry) => matchesCategory(entry, filter))
      .filter((entry) => !from || entry.occurredAt >= from)
      .filter((entry) => !to || entry.occurredAt <= to)
      .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
      .slice(0, limit);
    return apiResponse(
      {
        entries: filtered,
        filters: { type: filter, from, to, limit },
        privacy: {
          message:
            "Portfolio entries contain grouped page and section timing only; visitor identity, location, referral source, and session identifiers are never shown. AI entries exclude prompts, outputs, and credentials."
        }
      },
      request
    );
  });
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${String(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${String(minutes)}m ${String(remainder)}s` : `${String(minutes)}m`;
}
