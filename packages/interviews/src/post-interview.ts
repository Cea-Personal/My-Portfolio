export function extractTopics(
  note: string
): { topic: string; kind: "strength" | "gap" | "theme" }[] {
  return note
    .split(/[.!?]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((topic) => ({
      topic,
      kind: /strong|good|confident/i.test(topic)
        ? "strength"
        : /weak|gap|unclear/i.test(topic)
          ? "gap"
          : "theme"
    }));
}
