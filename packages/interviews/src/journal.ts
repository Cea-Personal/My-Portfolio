import { createHash } from "node:crypto";
export interface JournalVersion {
  id: string;
  entryId: string;
  version: number;
  text: string;
  contentHash: string;
  createdAt: string;
}
export interface JournalEntry {
  id: string;
  ownerId: string;
  versions: JournalVersion[];
  tags: string[];
  insights: { id: string; text: string; sourceVersionHash: string }[];
}
export function createJournalEntry(
  ownerId: string,
  text: string,
  tags: string[] = []
): JournalEntry {
  const contentHash = createHash("sha256").update(text).digest("hex");
  const id = crypto.randomUUID();
  return {
    id,
    ownerId,
    tags,
    insights: [],
    versions: [
      {
        id: crypto.randomUUID(),
        entryId: id,
        version: 1,
        text,
        contentHash,
        createdAt: new Date().toISOString()
      }
    ]
  };
}
export function addInsight(entry: JournalEntry, text: string): JournalEntry {
  const current = entry.versions.at(-1)!;
  return {
    ...entry,
    insights: [
      ...entry.insights,
      { id: crypto.randomUUID(), text, sourceVersionHash: current.contentHash }
    ]
  };
}
