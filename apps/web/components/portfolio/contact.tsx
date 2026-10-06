export function Contact({ email, href }: { email: string; href: string }) {
  return (
    <section id="contact" className="contact-section" aria-labelledby="contact-title">
      <div className="contact-intro">
        <p className="eyebrow">Start a conversation</p>
        <h2 id="contact-title">Let&apos;s build something useful.</h2>
        <p>Have a data platform, engineering, or AI challenge worth solving?</p>
      </div>
      <div className="contact-email-block">
        <p>Send me a note directly at</p>
        <a className="contact-email" href={href}>
          {email}
        </a>
      </div>
    </section>
  );
}
