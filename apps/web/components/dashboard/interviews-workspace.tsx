"use client";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

interface Stage {
  id: string;
  name: string;
  stage_type: string;
  status: string;
  confidence?: string;
  display_order: number;
  source?: string;
  scheduled_at?: string | null;
  notes?: string | null;
  preparation_kits?: Array<{
    id: string;
    version: number;
    status: string;
    payload: Record<string, unknown>;
  }>;
  mock_interviews?: Array<{
    id: string;
    mode: string;
    status: string;
    feedback?: Record<string, unknown> | null;
  }>;
  interview_debriefs?: Array<{
    id: string;
    original_notes: string;
    insight_status: string;
    derived_insights: unknown[];
  }>;
}
interface Process {
  id: string;
  application_id: string;
  confidence: string;
  applications?: { jobs?: { canonical_title?: string; canonical_company?: string } | null } | null;
  interview_stages?: Stage[];
}
interface Application {
  id: string;
  status: string;
  jobs?: { canonical_title?: string; canonical_company?: string } | null;
}
async function write(endpoint: string, method: "POST" | "PATCH", body: unknown) {
  const response = await fetch(endpoint, {
    method,
    headers: {
      "content-type": "application/json",
      "idempotency-key": `${method.toLowerCase()}-${crypto.randomUUID()}`,
      ...(method === "PATCH" ? { "if-match": "*" } : {})
    },
    body: JSON.stringify(body)
  });
  const payload = (await response.json().catch(() => ({}))) as { data?: unknown };
  if (!response.ok) {
    const problem = payload.data as { detail?: string; code?: string } | undefined;
    throw new Error(problem?.detail ?? problem?.code ?? "Request failed");
  }
  return payload.data;
}
const comma = (value: FormDataEntryValue | null) =>
  typeof value === "string"
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

export function InterviewsWorkspace() {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const load = useCallback(async () => {
    try {
      const [processResponse, applicationResponse] = await Promise.all([
        fetch("/api/v1/interviews", { cache: "no-store" }),
        fetch("/api/v1/applications", { cache: "no-store" })
      ]);
      if (!processResponse.ok || !applicationResponse.ok) throw new Error();
      const processPayload = (await processResponse.json()) as { data?: { processes?: Process[] } };
      const applicationPayload = (await applicationResponse.json()) as {
        data?: { applications?: Application[] };
      };
      setProcesses(processPayload.data?.processes ?? []);
      setApplications(applicationPayload.data?.applications ?? []);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);
  useEffect(() => void load(), [load]);
  async function createProcess(application: Application) {
    try {
      const process = (await write(
        `/api/v1/applications/${application.id}/interview-process`,
        "POST",
        {
          confidence: "low"
        }
      )) as { id?: string };
      if (process.id) {
        try {
          await write(`/api/v1/interview-processes/${process.id}/auto-prepare`, "POST", {});
          setMessage("Interview process created and the LLM preparation package is ready.");
        } catch (error) {
          setMessage(
            `Interview process created, but its LLM package could not be generated: ${
              error instanceof Error ? error.message : "check the orchestrator configuration"
            }`
          );
        }
      } else {
        setMessage("Interview process created. Generate its LLM package below.");
      }
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create process.");
    }
  }
  async function addStage(event: FormEvent<HTMLFormElement>, processId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await write(`/api/v1/interview-processes/${processId}/stages`, "POST", {
        name: form.get("name"),
        stageType: form.get("stageType"),
        scheduledAt: form.get("scheduledAt"),
        notes: form.get("notes"),
        displayOrder: Number(form.get("displayOrder")),
        source: "manual"
      });
      event.currentTarget.reset();
      setMessage("Interview stage added with history.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add stage.");
    }
  }
  async function transitionStage(stage: Stage, status: string) {
    const reason = window.prompt(`Reason for ${status}?`)?.trim();
    if (!reason) return;
    try {
      await write(`/api/v1/interview-stages/${stage.id}/transitions`, "POST", { status, reason });
      setMessage(`Stage moved to ${status}.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update stage.");
    }
  }
  async function generatePackage(processId: string) {
    try {
      await write(`/api/v1/interview-processes/${processId}/auto-prepare`, "POST", {});
      setMessage("LLM preparation package generated from the selected job and approved evidence.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create kit.");
    }
  }
  async function createMock(stage: Stage, mode: string) {
    try {
      await write(`/api/v1/interview-stages/${stage.id}/mock-interviews`, "POST", {
        mode,
        questions: stage.preparation_kits?.at(-1)?.payload.questions ?? []
      });
      setMessage("Private mock session created. It does not join or assist in live interviews.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create mock.");
    }
  }
  async function completeMock(mockId: string) {
    const notes = window.prompt("Paste your mock responses and notes")?.trim();
    if (!notes) return;
    try {
      await write(`/api/v1/mock-interviews/${mockId}/complete`, "POST", {
        notes,
        responses: [{ text: notes }],
        feedback: { clarity: "owner review required", strengths: [], improvementAreas: [] }
      });
      setMessage("Mock completed with qualitative—not scientific—feedback metadata.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not complete mock.");
    }
  }
  async function addDebrief(event: FormEvent<HTMLFormElement>, stage: Stage) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await write(`/api/v1/interview-stages/${stage.id}/debriefs`, "POST", {
        notes: form.get("notes"),
        questions: comma(form.get("questions")),
        topics: comma(form.get("topics")),
        successes: comma(form.get("successes")),
        difficulties: comma(form.get("difficulties")),
        followUps: comma(form.get("followUps"))
      });
      event.currentTarget.reset();
      setMessage("Original debrief preserved; derived learning awaits review.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save debrief.");
    }
  }
  async function reviewDebrief(id: string, decision: "approved" | "rejected") {
    try {
      await write(`/api/v1/interview-stages/${id}/debriefs`, "PATCH", { decision });
      setMessage(`Derived debrief insights ${decision}.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not review insights.");
    }
  }
  const withoutProcess = applications.filter(
    (application) => !processes.some((process) => process.application_id === application.id)
  );
  return (
    <main className="workspace-page">
      <header className="workspace-heading">
        <p className="eyebrow">Interview intelligence</p>
        <h1>Interview Kit</h1>
        <p>
          Select a job and the AI builds a private preparation package from its description,
          inferred interview stages, approved Career Brain evidence, and prior learning. No live
          meeting assistance is provided.
        </p>
      </header>
      <p>
        Generation uses the interview-coach subagent under the single model configured in{" "}
        <a href="/settings/agents">Settings → Agents</a>. Register that chat model under{" "}
        <a href="/settings/providers">AI Providers</a> with a reasoning capability.
      </p>
      <section>
        <h2>Create a process</h2>
        {withoutProcess.length ? (
          <ul className="workspace-list">
            {withoutProcess.map((application) => (
              <li key={application.id}>
                <strong>{application.jobs?.canonical_title ?? "Application"}</strong> ·{" "}
                {application.jobs?.canonical_company ?? "Company"}
                <button type="button" onClick={() => void createProcess(application)}>
                  Create interview process
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>Every current application already has a process, or no application is ready.</p>
        )}
      </section>
      {state === "loading" ? <p role="status">Loading interview processes…</p> : null}
      {state === "error" ? <p role="alert">Could not load private interview data.</p> : null}
      {processes.map((process) => (
        <section key={process.id}>
          <h2>{process.applications?.jobs?.canonical_title ?? "Interview process"}</h2>
          <p>
            {process.applications?.jobs?.canonical_company ?? "Company"} · process confidence:{" "}
            {process.confidence}
          </p>
          <div className="workspace-actions">
            <button type="button" onClick={() => void generatePackage(process.id)}>
              Generate / refresh LLM interview package
            </button>
          </div>
          {process.interview_stages?.length ? (
            process.interview_stages
              .sort((a, b) => a.display_order - b.display_order)
              .map((stage) => (
                <details key={stage.id}>
                  <summary>
                    {stage.name} · {stage.stage_type} · {stage.status} · source{" "}
                    {stage.source ?? "unknown"} · confidence {stage.confidence ?? "low"}
                  </summary>
                  <p>
                    {stage.scheduled_at
                      ? new Date(stage.scheduled_at).toLocaleString()
                      : "Not scheduled"}
                  </p>
                  <div className="workspace-actions">
                    {["planned", "scheduled", "completed", "cancelled", "skipped"]
                      .filter((status) => status !== stage.status)
                      .map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => void transitionStage(stage, status)}
                        >
                          Mark {status}
                        </button>
                      ))}
                  </div>
                  {stage.preparation_kits?.length ? (
                    <details>
                      <summary>LLM preparation package</summary>
                      {[...stage.preparation_kits]
                        .sort((left, right) => right.version - left.version)
                        .slice(0, 1)
                        .map((kit) => {
                          const payload = kit.payload;
                          const list = (key: string) =>
                            Array.isArray(payload[key])
                              ? payload[key].filter(
                                  (value): value is string => typeof value === "string"
                                )
                              : [];
                          const questions = Array.isArray(payload.questions)
                            ? payload.questions
                            : [];
                          return (
                            <div key={kit.id}>
                              <p>
                                {typeof payload.stagePurpose === "string"
                                  ? payload.stagePurpose
                                  : "Stage preparation"}
                              </p>
                              <h4>Likely topics</h4>
                              <ul>
                                {list("likelyTopics").map((topic) => (
                                  <li key={topic}>{topic}</li>
                                ))}
                              </ul>
                              <h4>Questions and evidence mapping</h4>
                              <ul>
                                {questions.map((value, index) => {
                                  const question =
                                    typeof value === "object" && value !== null
                                      ? (value as Record<string, unknown>)
                                      : {};
                                  const probability =
                                    typeof question.probability === "string"
                                      ? question.probability
                                      : "lower confidence";
                                  const probabilityLabel =
                                    probability === "high"
                                      ? "High probability"
                                      : probability === "medium"
                                        ? "Medium probability"
                                        : "Lower confidence";
                                  const questionText =
                                    typeof question.question === "string"
                                      ? question.question
                                      : "Question";
                                  return (
                                    <li key={`${kit.id}-question-${String(index)}`}>
                                      <strong>{probabilityLabel}</strong> — {questionText}
                                      {question.evidence
                                        ? ` · mapped to approved evidence`
                                        : " · no matching evidence yet"}
                                    </li>
                                  );
                                })}
                              </ul>
                              <h4>CV alignment</h4>
                              {Array.isArray(payload.cvAlignment) && payload.cvAlignment.length ? (
                                <ul>
                                  {payload.cvAlignment.map((value, index) => {
                                    const alignment =
                                      typeof value === "object" && value !== null
                                        ? (value as Record<string, unknown>)
                                        : {};
                                    const documentName =
                                      typeof alignment.documentName === "string"
                                        ? alignment.documentName
                                        : "Private CV excerpt";
                                    const matches = Array.isArray(alignment.matchedRequirements)
                                      ? alignment.matchedRequirements.filter(
                                          (item): item is string => typeof item === "string"
                                        )
                                      : [];
                                    return (
                                      <li key={`${kit.id}-cv-${String(index)}`}>
                                        {documentName}: {matches.join(" · ")}
                                      </li>
                                    );
                                  })}
                                </ul>
                              ) : (
                                <p>No indexed CV excerpt was available for alignment.</p>
                              )}
                              <h4>Preparation focus</h4>
                              <ul>
                                {list("weakAreas").map((gap) => (
                                  <li key={gap}>Evidence gap: {gap}</li>
                                ))}
                              </ul>
                              {Array.isArray(payload.storyDrafts) && payload.storyDrafts.length ? (
                                <>
                                  <h4>AI-prepared answer stories</h4>
                                  {payload.storyDrafts.map((value, index) => {
                                    const story =
                                      typeof value === "object" && value !== null
                                        ? (value as Record<string, unknown>)
                                        : {};
                                    const field = (name: string) =>
                                      typeof story[name] === "string" ? story[name] : "";
                                    return (
                                      <details key={`${kit.id}-story-${String(index)}`}>
                                        <summary>
                                          {field("title") || `Story ${String(index + 1)}`}
                                        </summary>
                                        <p>
                                          <strong>Situation:</strong> {field("situation")}
                                        </p>
                                        <p>
                                          <strong>Task:</strong> {field("task")}
                                        </p>
                                        <p>
                                          <strong>Action:</strong> {field("action")}
                                        </p>
                                        <p>
                                          <strong>Result:</strong> {field("result")}
                                        </p>
                                      </details>
                                    );
                                  })}
                                </>
                              ) : (
                                <p>
                                  No grounded answer story could be generated from the available
                                  evidence.
                                </p>
                              )}
                              {(["strongestExperiences", "projects", "achievements"] as const).map(
                                (key) => {
                                  const labels = {
                                    strongestExperiences: "Strongest mapped experiences",
                                    projects: "Relevant projects",
                                    achievements: "Relevant impact / achievements"
                                  } as const;
                                  const values = list(key);
                                  return values.length ? (
                                    <div key={key}>
                                      <h4>{labels[key]}</h4>
                                      <ul>
                                        {values.map((value) => (
                                          <li key={value}>{value}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  ) : null;
                                }
                              )}
                              <h4>Revision topics</h4>
                              <ul>
                                {list("revisionTopics").map((topic) => (
                                  <li key={topic}>{topic}</li>
                                ))}
                              </ul>
                              <p>
                                {typeof payload.behavioralPreparation === "string"
                                  ? payload.behavioralPreparation
                                  : "Use evidence-backed examples."}
                              </p>
                              {Array.isArray(payload.interviewerQuestions) &&
                              payload.interviewerQuestions.length ? (
                                <>
                                  <h4>Questions to ask the interviewer</h4>
                                  <ul>
                                    {list("interviewerQuestions").map((question) => (
                                      <li key={question}>{question}</li>
                                    ))}
                                  </ul>
                                </>
                              ) : null}
                              <p>
                                {typeof payload.companyResearch === "string"
                                  ? payload.companyResearch
                                  : "Company research unavailable."}
                              </p>
                              {typeof payload.compensationPreparation === "string" ? (
                                <p>{payload.compensationPreparation}</p>
                              ) : null}
                              <p>
                                <small>{list("limitations").join(" ")}</small>
                              </p>
                            </div>
                          );
                        })}
                    </details>
                  ) : (
                    <p>No preparation kit yet.</p>
                  )}
                  <h3>Private mock interview</h3>
                  <div className="workspace-actions">
                    {[
                      "recruiter",
                      "technical",
                      "system_design",
                      "behavioral",
                      "hiring_manager",
                      "leadership"
                    ].map((mode) => (
                      <button type="button" key={mode} onClick={() => void createMock(stage, mode)}>
                        {mode}
                      </button>
                    ))}
                  </div>
                  {stage.mock_interviews?.map((mock) => (
                    <p key={mock.id}>
                      {mock.mode} · {mock.status}
                      {mock.status !== "completed" ? (
                        <button type="button" onClick={() => void completeMock(mock.id)}>
                          Complete and reflect
                        </button>
                      ) : null}
                    </p>
                  ))}
                  <form
                    className="knowledge-entry-form"
                    onSubmit={(event) => void addDebrief(event, stage)}
                  >
                    <h3>Post-interview debrief</h3>
                    <label>
                      Original notes
                      <textarea name="notes" required rows={6} />
                    </label>
                    <label>
                      Questions asked
                      <input name="questions" />
                    </label>
                    <label>
                      Topics
                      <input name="topics" />
                    </label>
                    <label>
                      Successes
                      <input name="successes" />
                    </label>
                    <label>
                      Difficulties
                      <input name="difficulties" />
                    </label>
                    <label>
                      Follow-ups
                      <input name="followUps" />
                    </label>
                    <button type="submit">Preserve debrief</button>
                  </form>
                  {stage.interview_debriefs?.map((debrief) => (
                    <div key={debrief.id}>
                      <p>{debrief.original_notes}</p>
                      <p>Derived insights: {debrief.insight_status}</p>
                      {debrief.insight_status === "candidate" ? (
                        <div className="workspace-actions">
                          <button
                            type="button"
                            onClick={() => void reviewDebrief(debrief.id, "approved")}
                          >
                            Approve insights
                          </button>
                          <button
                            type="button"
                            onClick={() => void reviewDebrief(debrief.id, "rejected")}
                          >
                            Reject insights
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </details>
              ))
          ) : (
            <p>
              Interview Process Unknown. Add arbitrary stages as recruiter information becomes
              available.
            </p>
          )}
          <form
            className="knowledge-entry-form"
            onSubmit={(event) => void addStage(event, process.id)}
          >
            <h3>Add stage</h3>
            <label>
              Name
              <input name="name" required />
            </label>
            <label>
              Type
              <select name="stageType">
                <option value="recruiter">Recruiter</option>
                <option value="technical">Technical</option>
                <option value="system_design">System design</option>
                <option value="behavioral">Behavioral</option>
                <option value="hiring_manager">Hiring manager</option>
                <option value="leadership">Leadership</option>
                <option value="unknown">Unknown</option>
              </select>
            </label>
            <label>
              Order
              <input
                name="displayOrder"
                type="number"
                min="0"
                defaultValue={process.interview_stages?.length ?? 0}
              />
            </label>
            <label>
              Scheduled time
              <input name="scheduledAt" type="datetime-local" />
            </label>
            <label>
              Notes
              <textarea name="notes" />
            </label>
            <button type="submit">Add stage</button>
          </form>
        </section>
      ))}
      {message ? <p role="status">{message}</p> : null}
    </main>
  );
}
