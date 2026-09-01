"use client";

import { useEffect, useState } from "react";

export function PageIntro({ name = "Basil Ogbonna" }: { name?: string }) {
  const [phase, setPhase] = useState<"visible" | "leaving" | "hidden">("visible");

  useEffect(() => {
    const leaveTimer = window.setTimeout(() => {
      setPhase("leaving");
    }, 850);
    const hideTimer = window.setTimeout(() => {
      setPhase("hidden");
    }, 1450);
    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div className={`page-intro page-intro-${phase}`} aria-hidden="true">
      <div className="page-intro-name">
        <span>{name}</span>
        <span>Portfolio · {new Date().getFullYear()}</span>
      </div>
      <div className="page-intro-line" />
    </div>
  );
}
