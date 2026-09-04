"use client";

import { useState, type FormEvent } from "react";

export function Contact({ email }: { email?: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/public/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        company: form.get("company"),
        project: form.get("project"),
        website: form.get("website")
      })
    }).catch(() => null);
    if (response?.ok) {
      event.currentTarget.reset();
      setStatus("sent");
      setMessage("Message sent. I’ll be in touch soon.");
      return;
    }
    setStatus("error");
    setMessage(
      email
        ? "That didn’t send. Please try again or use the email link below."
        : "That didn’t send. Please try again when the contact service is available."
    );
  }

  return (
    <section id="contact" className="contact-section" aria-labelledby="contact-title">
      <div className="contact-intro">
        <p className="eyebrow">Start a conversation</p>
        <h2 id="contact-title">Let&apos;s build something useful.</h2>
        <p>Have a data platform, engineering, or AI challenge worth solving?</p>
        {email ? (
          <a className="contact-email" href={`mailto:${email}`}>
            {email}
          </a>
        ) : null}
      </div>
      <form
        className="contact-form"
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <label>
          Your name
          <input name="name" autoComplete="name" required maxLength={120} />
        </label>
        <label>
          Email address
          <input name="email" type="email" autoComplete="email" required maxLength={254} />
        </label>
        <label>
          Company <span>(optional)</span>
          <input name="company" autoComplete="organization" maxLength={160} />
        </label>
        <label>
          What are you building?
          <textarea name="project" required rows={5} maxLength={4000} />
        </label>
        <input
          className="contact-honeypot"
          name="website"
          aria-label="Website — leave blank"
          tabIndex={-1}
          autoComplete="off"
        />
        <button type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Send project enquiry"}
        </button>
        {message ? (
          <p className={`contact-status is-${status}`} role="status">
            {message}
          </p>
        ) : null}
      </form>
    </section>
  );
}
