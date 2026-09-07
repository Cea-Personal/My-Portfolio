"use client";

import { useState } from "react";

const processes = {
  Software: {
    label: "Software engineering",
    statement: "Translate a real need into software that remains safe to change.",
    steps: ["Specify", "Design", "Build", "Test", "Release"],
    snippet: [
      "contract = specify(problem, constraints)",
      "system = design(contract, failure_modes)",
      "build(system).verify(unit, integration, e2e)",
      "release(observed=True, reversible=True)"
    ]
  },
  Data: {
    label: "Data engineering",
    statement: "Move data from source to trusted product without losing meaning.",
    steps: ["Contract", "Ingest", "Transform", "Validate", "Serve"],
    snippet: [
      "assert source.matches(data_contract)",
      "bronze = ingest(source, idempotency_key)",
      "gold = transform(bronze).test(quality_rules)",
      "publish(gold, lineage=True, observable=True)"
    ]
  },
  Platform: {
    label: "Platform engineering",
    statement: "Provide a reliable foundation for software and data systems.",
    steps: ["Design", "Build", "Test", "Deploy", "Observe"],
    snippet: [
      "platform = design(requirements, constraints)",
      "build(platform).verify(unit, integration, e2e)",
      "deploy(platform).observe(telemetry, alerts, dashboards)"
    ]
  },
  AI: {
    label: "AI engineering",
    statement: "Turn an uncertain question into an evaluated, observable system.",
    steps: ["Frame", "Retrieve", "Generate", "Evaluate", "Observe"],
    snippet: [
      "context = retrieve(question, public_evidence)",
      "answer = model.generate(context, constraints)",
      "score = evaluate(answer, citations, risk)",
      "return answer if score.passes else abstain"
    ]
  }
} as const;

type ProcessName = keyof typeof processes;

export function EngineeringProcesses() {
  const [active, setActive] = useState<ProcessName>("AI");
  const process = processes[active];

  return (
    <section id="process" className="process-section" aria-labelledby="process-title">
      <header className="process-heading">
        <p>Engineering process</p>
        <h2 id="process-title">The work behind the outcome.</h2>
        <span>
          Small, inspectable views into how I approach AI, data, and software systems. These are
          process patterns—not performance claims.
        </span>
      </header>
      <div className="process-switcher-shell">
        <div className="process-switcher" role="tablist" aria-label="Engineering disciplines">
          {(Object.keys(processes) as ProcessName[]).map((name) => (
            <button
              type="button"
              role="tab"
              aria-selected={active === name}
              key={name}
              onClick={() => {
                setActive(name);
              }}
            >
              {processes[name].label}
            </button>
          ))}
        </div>
        <span className="process-scroll-cue" aria-hidden="true">
          Swipe <span>→</span>
        </span>
      </div>
      <article className="process-stage" key={active} role="tabpanel">
        <div className="process-flow">
          <p>{process.statement}</p>
          <ol>
            {process.steps.map((step, index) => (
              <li key={step}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
        <div className="process-code" aria-label={`${process.label} process snippet`}>
          <div>
            <span />
            <span />
            <span />
            <p>{active.toLowerCase()}.pipeline</p>
          </div>
          <pre>
            <code>
              {process.snippet.map((line, index) => (
                <span key={line}>
                  <i>{String(index + 1).padStart(2, "0")}</i>
                  {line}
                </span>
              ))}
            </code>
          </pre>
        </div>
      </article>
    </section>
  );
}
