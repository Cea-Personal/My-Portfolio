import { createHash } from "node:crypto";
export function renderPdf(
  content: string,
  template: string
): { bytes: Uint8Array; hash: string; rendererVersion: string } {
  const escape = (value: string) =>
    value
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/[^\x20-\x7e]/g, "?");
  const lines = [`Template: ${template}`, ...content.split(/\r?\n/)].slice(0, 52);
  const stream = `BT\n/F1 10 Tf\n50 790 Td\n14 TL\n${lines
    .map((line) => `(${escape(line.slice(0, 105))}) Tj\nT*`)
    .join("\n")}\nET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${String(new TextEncoder().encode(stream).length)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += `${String(index + 1)} 0 obj\n${object}\nendobj\n`;
  });
  const xref = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${String(objects.length + 1)}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n `)
    .join(
      "\n"
    )}\ntrailer\n<< /Size ${String(objects.length + 1)} /Root 1 0 R >>\nstartxref\n${String(xref)}\n%%EOF\n`;
  const bytes = new TextEncoder().encode(pdf);
  return {
    bytes,
    hash: createHash("sha256").update(bytes).digest("hex"),
    rendererVersion: "pdf-renderer.v2"
  };
}
