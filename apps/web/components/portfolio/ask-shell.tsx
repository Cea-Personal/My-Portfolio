"use client";

import { useState } from "react";
import { RoleFit } from "./match-shell";

const suggestions = [
  "What data systems has Basil built?",
  "How does Basil approach AI engineering?",
  "Which experience best matches a senior data role?",
  "What makes this portfolio a working product?"
] as const;

type ConversationTurn = {
  id: string;
  question: string;
  answer?: string;
  citations: string[];
  citationLabels: string[];
  unavailable: boolean;
  status: "loading" | "complete" | "error";
};

export function AskShell() {
  const [mode, setMode] = useState<"question" | "fit">("question");
  const [question, setQuestion] = useState("");
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const latestTurn = conversation[conversation.length - 1];
  const status = latestTurn?.status ?? "idle";

  async function ask(nextQuestion = question) {
    const normalizedQuestion = nextQuestion.trim();
    if (!normalizedQuestion) return;
    const turnId = `${String(Date.now())}-${Math.random().toString(36).slice(2)}`;
    setQuestion("");
    setConversation((current) => [
      ...current,
      {
        id: turnId,
        question: normalizedQuestion,
        citations: [],
        citationLabels: [],
        unavailable: false,
        status: "loading"
      }
    ]);
    try {
      const response = await fetch("/api/v1/public/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: normalizedQuestion })
      });
      const payload = (await response.json()) as {
        data?: {
          answer?: string;
          citations?: string[];
          citationLabels?: string[];
          unavailable?: boolean;
        };
      };
      if (!response.ok) throw new Error("request failed");
      setConversation((current) =>
        current.map((turn) =>
          turn.id === turnId
            ? {
                ...turn,
                answer:
                  payload.data?.answer ?? "I couldn't find enough information to answer that yet.",
                citations: payload.data?.citations ?? [],
                citationLabels: payload.data?.citationLabels ?? [],
                unavailable: payload.data?.unavailable === true,
                status: "complete"
              }
            : turn
        )
      );
    } catch {
      setConversation((current) =>
        current.map((turn) => (turn.id === turnId ? { ...turn, status: "error" } : turn))
      );
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
          <i aria-hidden="true" /> portfolio facts ready
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
            answer from the facts shared in this portfolio.
          </p>
        </div>

        <details className="assistant-trace">
          <summary>
            Tool trace{" "}
            <span>
              {status === "loading"
                ? "running"
                : latestTurn?.answer
                  ? "complete"
                  : latestTurn?.status === "error"
                    ? "failed"
                    : "waiting"}
            </span>
          </summary>
          <ol>
            <li data-state={latestTurn ? "complete" : "waiting"}>
              <code>classify_question</code>
              <small>{latestTurn ? "intent resolved" : "awaiting question"}</small>
            </li>
            <li
              data-state={
                status === "loading" ? "running" : latestTurn?.answer ? "complete" : "waiting"
              }
            >
              <code>retrieve_portfolio_facts</code>
              <small>
                {status === "loading"
                  ? "searching"
                  : latestTurn?.answer
                    ? "context returned"
                    : "idle"}
              </small>
            </li>
            <li data-state={latestTurn?.answer ? "complete" : "waiting"}>
              <code>compose_grounded_answer</code>
              <small>{latestTurn?.answer ? "facts checked" : "idle"}</small>
            </li>
          </ol>
        </details>

        {conversation.length ? (
          <div className="assistant-conversation" aria-label="Ask Basil conversation">
            {conversation.map((turn) => (
              <article className="assistant-turn" key={turn.id}>
                <p className="assistant-user-message">{turn.question}</p>
                {turn.status === "loading" ? (
                  <p className="assistant-thinking">Retrieving portfolio facts…</p>
                ) : null}
                {turn.status === "error" ? (
                  <p role="alert">The public assistant is unavailable. Try again.</p>
                ) : null}
                {turn.unavailable ? (
                  <p className="assistant-unavailable" role="status">
                    Portfolio facts are reconnecting. Ask Basil will resume when the published
                    portfolio data is available.
                  </p>
                ) : null}
                {turn.answer ? (
                  <div className="assistant-answer">
                    <p>{turn.answer}</p>
                    {turn.citations.length ? (
                      <ul aria-label="Supporting facts">
                        {turn.citations.map((citation, citationIndex) => (
                          <li key={`${turn.id}-${citation}`}>
                            {turn.citationLabels[citationIndex] ?? "Published portfolio"}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <small>No supporting facts were returned.</small>
                    )}
                  </div>
                ) : null}
              </article>
            ))}
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
