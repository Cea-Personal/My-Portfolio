"use client";

import { useState } from "react";
import { RoleFit } from "./match-shell";

const suggestions = [
  "What data systems has Basil built?",
  "How does Basil approach AI engineering?",
  "Which experience best matches a senior data role?",
  "What makes this portfolio a working product?"
] as const;

export function AskShell() {
  const [mode, setMode] = useState<"question" | "fit">("question");
  const [question, setQuestion] = useState("");
  const [submittedQuestion, setSubmittedQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<string[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function ask(nextQuestion = question) {
    const normalizedQuestion = nextQuestion.trim();
    if (!normalizedQuestion) return;
    setQuestion(normalizedQuestion);
    setSubmittedQuestion(normalizedQuestion);
    setStatus("loading");
    setAnswer(null);
    setCitations([]);
    setUnavailable(false);
    try {
      const response = await fetch("/api/v1/public/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: normalizedQuestion })
      });
      const payload = (await response.json()) as {
        data?: { answer?: string; citations?: string[]; unavailable?: boolean };
      };
      if (!response.ok) throw new Error("request failed");
      setAnswer(
        payload.data?.answer ?? "I don't have enough approved public evidence to answer that."
      );
      setCitations(payload.data?.citations ?? []);
      setUnavailable(payload.data?.unavailable === true);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section
      id="ask"
      className="intelligence-card ask-card assistant-console"
      aria-labelledby="ask-title"
      aria-live="polite"
    >
      <header className="assistant-header">
        <div>
          <p className="eyebrow">Interactive proof</p>
          <h2 id="ask-title">Ask Basil</h2>
        </div>
        <span className="assistant-ready">
          <i aria-hidden="true" /> evidence tool ready
        </span>
      </header>

      <div className="assistant-modes" role="tablist" aria-label="Ask Basil modes">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "question"}
          aria-controls="portfolio-question-panel"
          onClick={() => {
            setMode("question");
          }}
        >
          Ask the portfolio
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "fit"}
          aria-controls="role-fit-panel"
          onClick={() => {
            setMode("fit");
          }}
        >
          How do I fit?
        </button>
      </div>

      <div
        className="assistant-window"
        id="portfolio-question-panel"
        role="tabpanel"
        hidden={mode !== "question"}
      >
        <div className="assistant-intro">
          <span aria-hidden="true">BO</span>
          <p>
            Ask about my engineering background, career journey, projects, outcomes, or role fit. I
            answer only from approved public evidence.
          </p>
        </div>

        <details className="assistant-trace">
          <summary>
            Tool trace{" "}
            <span>{status === "loading" ? "running" : answer ? "complete" : "waiting"}</span>
          </summary>
          <ol>
            <li data-state={submittedQuestion ? "complete" : "waiting"}>
              <span>01</span>
              <code>classify_question</code>
              <small>{submittedQuestion ? "intent resolved" : "awaiting question"}</small>
            </li>
            <li data-state={status === "loading" ? "running" : answer ? "complete" : "waiting"}>
              <span>02</span>
              <code>retrieve_public_evidence</code>
              <small>
                {status === "loading" ? "searching" : answer ? "context returned" : "idle"}
              </small>
            </li>
            <li data-state={answer ? "complete" : "waiting"}>
              <span>03</span>
              <code>compose_grounded_answer</code>
              <small>{answer ? "citations checked" : "idle"}</small>
            </li>
          </ol>
        </details>

        {submittedQuestion ? (
          <div className="assistant-conversation">
            <p className="assistant-user-message">{submittedQuestion}</p>
            {status === "loading" ? (
              <p className="assistant-thinking">Retrieving evidence…</p>
            ) : null}
            {status === "error" ? (
              <p role="alert">The public assistant is unavailable. Try again.</p>
            ) : null}
            {unavailable ? (
              <p className="assistant-unavailable" role="status">
                Live evidence is reconnecting. Ask Basil will resume when the approved public source
                is available.
              </p>
            ) : null}
            {answer ? (
              <div className="assistant-answer">
                <p>{answer}</p>
                {citations.length ? (
                  <ul aria-label="Answer evidence">
                    {citations.map((citation) => (
                      <li key={citation}>{citation}</li>
                    ))}
                  </ul>
                ) : (
                  <small>No public evidence handles were returned.</small>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="assistant-suggestions" aria-label="Suggested questions">
          {suggestions.map((suggestion) => (
            <button
              type="button"
              key={suggestion}
              onClick={() => {
                void ask(suggestion);
              }}
              disabled={status === "loading"}
            >
              {suggestion}
            </button>
          ))}
        </div>

        <form
          className="assistant-form"
          onSubmit={(event) => {
            event.preventDefault();
            void ask();
          }}
        >
          <label className="skip-link" htmlFor="portfolio-question">
            Question
          </label>
          <input
            id="portfolio-question"
            value={question}
            maxLength={2000}
            onChange={(event) => {
              setQuestion(event.target.value);
            }}
            placeholder="Ask something about Basil…"
          />
          <button type="submit" disabled={status === "loading"} aria-label="Send question">
            {status === "loading" ? "…" : "↑"}
          </button>
        </form>
      </div>
      <div className="assistant-window" id="role-fit-panel" role="tabpanel" hidden={mode !== "fit"}>
        <RoleFit />
      </div>
    </section>
  );
}
