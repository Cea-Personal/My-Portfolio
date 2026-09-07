"use client";

import { useEffect, useState } from "react";
import { WorkspaceToast } from "@/components/ui/workspace-toast";

function display(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

export function InterviewDetail({ id }: { id: string }) {
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [generating, setGenerating] = useState(false);
  async function generatePackage() {
    setGenerating(true);
    try {
      const response = await fetch(
        `/api/v1/interview-processes/${encodeURIComponent(id)}/auto-prepare`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": `interview-package-${crypto.randomUUID()}`
          },
          body: "{}"
        }
      );
      if (!response.ok) throw new Error("Interview package could not be generated");
      setMessage("Interview package refreshed from the selected job and private evidence.");
      window.location.reload();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Interview package could not be generated"
      );
    } finally {
      setGenerating(false);
    }
  }
  useEffect(() => {
    let active = true;
    void fetch(`/api/v1/interview-processes/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("interview unavailable");
        const value = (await response.json()) as { data?: unknown };
        if (active) {
          setPayload(
            value.data && typeof value.data === "object"
              ? (value.data as Record<string, unknown>)
              : null
          );
          setState("ready");
        }
      })
      .catch(() => {
        if (active) setState("error");
      });
    return () => {
      active = false;
    };
  }, [id]);
  if (state === "loading")
    return (
      <main>
        <p role="status">Loading interview process…</p>
      </main>
    );
  if (state === "error")
    return (
      <main>
        <p role="alert">Sign in to load this interview process.</p>
      </main>
    );
  if (!payload)
    return (
      <main>
        <p>Interview process not found.</p>
      </main>
    );
  const stages = Array.isArray(payload.stages) ? payload.stages : [];
  return (
    <main>
      <h1>Interview process</h1>
      <p>Confidence: {display(payload.confidence, "low")}</p>
      <button type="button" disabled={generating} onClick={() => void generatePackage()}>
        {generating ? "Generating with the configured LLM…" : "Generate / refresh LLM package"}
      </button>
      <WorkspaceToast
        message={message}
        onDismiss={() => {
          setMessage("");
        }}
      />
      {stages.length ? (
        <ol>
          {stages.map((stage, index) => {
            const row =
              stage && typeof stage === "object" ? (stage as Record<string, unknown>) : {};
            return (
              <li key={display(row.id, String(index))}>
                {display(row.name, "Stage")} · {display(row.status, "proposed")}
                {Array.isArray(row.preparation_kits) && row.preparation_kits.length ? (
                  <details>
                    <summary>Generated preparation package</summary>
                    {row.preparation_kits.slice(-1).map((kit, kitIndex) => {
                      const kitRow =
                        kit && typeof kit === "object" ? (kit as Record<string, unknown>) : {};
                      const kitPayload =
                        kitRow.payload && typeof kitRow.payload === "object"
                          ? (kitRow.payload as Record<string, unknown>)
                          : {};
                      const topics = Array.isArray(kitPayload.likelyTopics)
                        ? kitPayload.likelyTopics.filter(
                            (topic): topic is string => typeof topic === "string"
                          )
                        : [];
                      const questions = Array.isArray(kitPayload.questions)
                        ? kitPayload.questions
                        : [];
                      return (
                        <div key={display(kitRow.id, `${String(index)}-${String(kitIndex)}`)}>
                          <p>{display(kitPayload.stagePurpose, "Stage preparation")}</p>
                          <p>
                            <strong>Topics:</strong> {topics.join(" · ") || "No topics extracted"}
                          </p>
                          <ul>
                            {questions.map((question, questionIndex) => {
                              const questionRow =
                                question && typeof question === "object"
                                  ? (question as Record<string, unknown>)
                                  : {};
                              const probability = display(
                                questionRow.probability,
                                "lower_confidence"
                              );
                              const probabilityLabel =
                                probability === "high"
                                  ? "High probability"
                                  : probability === "medium"
                                    ? "Medium probability"
                                    : "Lower confidence";
                              return (
                                <li
                                  key={`${String(index)}-${String(kitIndex)}-${String(questionIndex)}`}
                                >
                                  <strong>{probabilityLabel}</strong> —{" "}
                                  {display(questionRow.question, "Question")}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })}
                  </details>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <p>Interview Process Unknown — add a manual stage when evidence is insufficient.</p>
      )}
    </main>
  );
}
