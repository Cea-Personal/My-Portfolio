const HOSTILE_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions/i,
  /reveal\s+(?:the\s+)?(?:system prompt|hidden prompt|secret|private data)/i,
  /\breveal\b.{0,80}\b(?:private|secret|credential|token|home address|salary)\b/i,
  /(?:print|dump|exfiltrate)\s+(?:all\s+)?(?:credentials|tokens|private|database)/i,
  /act\s+as\s+(?:an?\s+)?(?:admin|owner).*bypass/i
];

export function hostilePublicInput(value: string): boolean {
  return HOSTILE_PATTERNS.some((pattern) => pattern.test(value));
}
