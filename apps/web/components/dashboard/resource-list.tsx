"use client";

import { useEffect, useState } from "react";

interface ResourceListProps {
  endpoint: string;
  title: string;
  description: string;
  emptyText: string;
  collectionKey?: string;
}

function itemsFromPayload(payload: unknown, collectionKey?: string): Record<string, unknown>[] {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as { data?: unknown }).data;
  if (Array.isArray(data))
    return data.filter(
      (item): item is Record<string, unknown> => !!item && typeof item === "object"
    );
  if (!data || typeof data !== "object") return [];
  if (collectionKey) {
    const collection = (data as Record<string, unknown>)[collectionKey];
    if (Array.isArray(collection))
      return collection.filter(
        (item): item is Record<string, unknown> => !!item && typeof item === "object"
      );
  }
  const firstCollection = Object.values(data as Record<string, unknown>).find(Array.isArray);
  return Array.isArray(firstCollection)
    ? firstCollection.filter(
        (item): item is Record<string, unknown> => !!item && typeof item === "object"
      )
    : [];
}

function displayLabel(item: Record<string, unknown>): string {
  for (const key of ["title", "name", "slug", "workflow_name", "purpose", "id"]) {
    if (typeof item[key] === "string" && item[key]) return item[key];
  }
  return "Record";
}

export function ResourceList({
  endpoint,
  title,
  description,
  emptyText,
  collectionKey
}: ResourceListProps) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let active = true;
    void fetch(endpoint, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("resource unavailable");
        const payload = (await response.json()) as unknown;
        if (active) {
          setItems(itemsFromPayload(payload, collectionKey));
          setState("ready");
        }
      })
      .catch(() => {
        if (active) setState("error");
      });
    return () => {
      active = false;
    };
  }, [collectionKey, endpoint]);

  return (
    <section aria-labelledby={`${endpoint.replace(/[^a-z0-9]/gi, "-")}-title`}>
      <h1 id={`${endpoint.replace(/[^a-z0-9]/gi, "-")}-title`}>{title}</h1>
      <p>{description}</p>
      {state === "loading" ? <p role="status">Loading…</p> : null}
      {state === "error" ? <p role="alert">Sign in to load this private workspace.</p> : null}
      {state === "ready" && items.length ? (
        <ul>
          {items.map((item, index) => (
            <li
              key={typeof item.id === "string" ? item.id : `${displayLabel(item)}-${String(index)}`}
            >
              <strong>{displayLabel(item)}</strong>
              {typeof item.status === "string" ? <span> · {item.status}</span> : null}
              {typeof item.enabled === "boolean" ? (
                <span> · {item.enabled ? "enabled" : "disabled"}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : state === "ready" ? (
        <p>{emptyText}</p>
      ) : null}
    </section>
  );
}
