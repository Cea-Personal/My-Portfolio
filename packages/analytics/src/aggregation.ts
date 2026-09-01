export interface AnalyticsEvent {
  id: string;
  occurredAt: string;
  name: string;
  ownerId?: string;
}
export function aggregateDaily(events: readonly AnalyticsEvent[], day: string) {
  const selected = events.filter((event) => event.occurredAt.startsWith(day));
  const counts = Object.fromEntries(
    [...new Set(selected.map((event) => event.name))].map((name) => [
      name,
      selected.filter((event) => event.name === name).length
    ])
  );
  return { day, counts, eventCount: selected.length, calculationVersion: "analytics.v1" };
}
