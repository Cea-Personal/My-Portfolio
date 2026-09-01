import { apiResponse } from "@/lib/api/response";

const attempts = new Map<string, number[]>();

function safeText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[
      character
    ] as string;
  });
}

function rateLimited(request: Request): boolean {
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((timestamp) => now - timestamp < 60 * 60 * 1000);
  recent.push(now);
  attempts.set(key, recent);
  return recent.length > 5;
}

export async function POST(request: Request) {
  if (rateLimited(request))
    return apiResponse({ code: "RATE_LIMITED", detail: "Please try again later." }, request, 429);

  const body = await request.json().catch(() => ({}));
  const name = safeText(body.name, 120);
  const email = safeText(body.email, 254);
  const company = safeText(body.company, 160);
  const project = safeText(body.project, 4000);
  const website = safeText(body.website, 200);
  if (website) return apiResponse({ delivered: true }, request, 202);
  if (!name || !project || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return apiResponse({ code: "INVALID_CONTACT_REQUEST" }, request, 400);

  const apiKey = process.env.RESEND_API_KEY;
  const recipient = process.env.CONTACT_EMAIL || process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !recipient || !from)
    return apiResponse({ code: "CONTACT_NOT_CONFIGURED" }, request, 503);

  const html = [
    `<p><strong>From:</strong> ${escapeHtml(name)} (${escapeHtml(email)})</p>`,
    company ? `<p><strong>Company:</strong> ${escapeHtml(company)}</p>` : "",
    `<p><strong>Project enquiry:</strong></p><p>${escapeHtml(project).replace(/\n/g, "<br />")}</p>`
  ].join("");
  const provider = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      to: [recipient],
      reply_to: email,
      subject: `Portfolio enquiry from ${name}`,
      html
    })
  });
  if (!provider.ok) return apiResponse({ code: "DELIVERY_FAILED" }, request, 502);
  return apiResponse({ delivered: true }, request, 201);
}
