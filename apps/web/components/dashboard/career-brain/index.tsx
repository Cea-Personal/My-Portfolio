"use client";

import { useEffect, useState } from "react";
import { Link, Status } from "@career-os/ui";

export function CareerBrain({
  facts = []
}: {
  facts?: readonly { id: string; statement: string; visibility: string; reviewStatus: string }[];
}) {
  const [items, setItems] = useState(facts);
  const [state, setState] = useState<"loading" | "ready" | "error">(
    facts.length ? "ready" : "loading"
  );
  useEffect(() => {
    if (facts.length) return;
    let active = true;
    void fetch("/api/v1/career/facts")
      .then(async (response) => {
        if (!response.ok) throw new Error("facts unavailable");
        const payload = (await response.json()) as {
          data?: readonly {
            id: string;
            statement?: string;
            visibility?: string;
            review_status?: string;
          }[];
        };
        if (active) {
          setItems(
            (payload.data ?? []).map((fact) => ({
              id: fact.id,
              statement: fact.statement ?? "Untitled fact",
              visibility: fact.visibility ?? "private",
              reviewStatus: fact.review_status ?? "candidate"
            }))
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
  }, [facts]);

  return (
    <section aria-labelledby="career-brain-title">
      <h1 id="career-brain-title">Career Brain</h1>
      <p>Review canonical facts and their evidence before publication.</p>
      {state === "loading" ? <p role="status">Loading facts…</p> : null}
      {state === "error" ? <p role="alert">Sign in to load private career facts.</p> : null}
      {state !== "loading" && state !== "error" && items.length ? (
        <ul>
          {items.map((fact) => (
            <li key={fact.id}>
              <Link href={`/career-brain/${fact.id}`}>{fact.statement}</Link>{" "}
              <Status>
                {fact.reviewStatus} · {fact.visibility}
              </Status>
            </li>
          ))}
        </ul>
      ) : state === "ready" ? (
        <p>No career facts yet.</p>
      ) : null}
    </section>
  );
}
