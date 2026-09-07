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
    const page =
      typeof properties.page === "string"
        ? properties.page
        : window.location.pathname === "/"
          ? "home"
          : window.location.pathname.startsWith("/blog")
            ? "blog"
            : "project";
    void capture(name, name === "page_view" ? { ...properties, page } : properties);
    const observed = new Set<string>();
    const enteredAt = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).id;
          if (entry.isIntersecting && id && !observed.has(id)) {
            observed.add(id);
            enteredAt.set(id, performance.now());
            void capture("section_view", { section: id });
          } else if (!entry.isIntersecting && id && enteredAt.has(id)) {
            const started = enteredAt.get(id);
            enteredAt.delete(id);
            if (started === undefined) continue;
            const duration = Math.min(1800, Math.round((performance.now() - started) / 1000));
            if (duration >= 1)
              void capture("section_engagement", { section: id, duration_seconds: duration });
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
    const pageStarted = performance.now();
    const recordPageEngagement = () => {
      const duration = Math.min(1800, Math.round((performance.now() - pageStarted) / 1000));
      if (duration >= 1) void capture("page_engagement", { page, duration_seconds: duration });
    };
    window.addEventListener("pagehide", recordPageEngagement, { once: true });
    return () => {
      for (const [section, started] of enteredAt) {
        const duration = Math.min(1800, Math.round((performance.now() - started) / 1000));
        if (duration >= 1)
          void capture("section_engagement", { section, duration_seconds: duration });
      }
      window.removeEventListener("pagehide", recordPageEngagement);
      observer.disconnect();
    };
  }, [consent, name, properties, sections]);
  if (consent !== "unknown") return null;
  return (
    <aside className="analytics-consent" aria-label="Privacy preference">
      <p>
        Allow cookies
      </p>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(consentKey, "granted");
          setConsent("granted");
        }}
      >
        Allow cookies
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
