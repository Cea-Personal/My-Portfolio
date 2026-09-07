"use client";

import { useEffect, useRef, useState } from "react";

interface WorkspaceToastProps {
  message: string | null | undefined;
  /** How long the notification remains visible before it is dismissed. */
  durationMs?: number;
  onDismiss?: () => void;
}

/**
 * Short-lived status notification used by private workspaces.
 *
 * The parent owns the message so existing request/error handling stays intact;
 * this component owns visibility and clears the parent when a dismiss callback
 * is supplied. A new message always starts a fresh timer.
 */
export function WorkspaceToast({ message, durationMs = 5000, onDismiss }: WorkspaceToastProps) {
  const [visible, setVisible] = useState(Boolean(message));
  const dismissRef = useRef(onDismiss);

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    setVisible(Boolean(message));
    if (!message) return;

    const timeout = window.setTimeout(() => {
      setVisible(false);
      dismissRef.current?.();
    }, durationMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [durationMs, message]);

  if (!message || !visible) return null;

  function dismiss() {
    setVisible(false);
    dismissRef.current?.();
  }

  return (
    <div className="workspace-toast" role="status" aria-live="polite">
      <span className="workspace-toast-text">{message}</span>
      <button type="button" aria-label="Dismiss notification" onClick={dismiss}>
        ×
      </button>
    </div>
  );
}
