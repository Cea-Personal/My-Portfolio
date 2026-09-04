"use client";
import { useEffect, useState } from "react";
type Consent = "unknown" | "granted" | "denied";
const consentKey = "basil-portfolio-analytics-consent";
const sessionKey = "basil-portfolio-analytics-session";
function pseudonym() {
  const current = sessionStorage.getItem(sessionKey);
  if (current) return current;
  const created = `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().slice(0, 8)}`;
  sessionStorage.setItem(sessionKey, created);
  return created;
}
async function capture(name: string, properties: Record<string, string | number | boolean> = {}) {
  await fetch("/api/v1/public/analytics/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, properties, pseudonym: pseudonym(), consent: "granted" }),
    keepalive: true
  });
}
export function PublicEvents({
  name = "page_view",
  properties = {},
  sections = []
}: {
  name?: string;
  properties?: Record<string, string | number | boolean>;
  sections?: string[];
}) {
  const [consent, setConsent] = useState<Consent>("unknown");
  useEffect(() => {
    const saved = localStorage.getItem(consentKey);
    if (saved === "granted" || saved === "denied") setConsent(saved);
  }, []);
  useEffect(() => {
    if (consent !== "granted") return;
    void capture(name, properties);
    const observed = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).id;
          if (entry.isIntersecting && id && !observed.has(id)) {
            observed.add(id);
            void capture("section_view", { section: id });
          }
        }
      },
      { threshold: 0.5 }
    );
    sections
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => Boolean(element))
      .forEach((element) => {
        observer.observe(element);
      });
    return () => {
      observer.disconnect();
    };
  }, [consent, name, properties, sections]);
  if (consent !== "unknown") return null;
  return (
    <aside className="analytics-consent" aria-label="Privacy preference">
      <p>
        Allow anonymous, low-volume-suppressed page and section counts? No URLs, queries, prompts,
        or free text are collected.
      </p>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(consentKey, "granted");
          setConsent("granted");
        }}
      >
        Allow
      </button>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(consentKey, "denied");
          setConsent("denied");
        }}
      >
        Decline
      </button>
    </aside>
  );
}
