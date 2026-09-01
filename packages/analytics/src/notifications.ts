const sent = new Set<string>();
export function notifyOnce(key: string): boolean {
  if (sent.has(key)) return false;
  sent.add(key);
  return true;
}
