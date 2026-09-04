export interface AnalyticsFilters {
  role?: string;
  country?: string;
  source?: string;
  workModel?: string;
  event?: string;
  from?: string;
  to?: string;
  minMatch?: number;
  minOpportunity?: number;
  minComp?: number;
  maxComp?: number;
}
const strings = new Set(["role", "country", "source", "workModel", "event"]);
const dates = new Set(["from", "to"]);
const numbers = new Set(["minMatch", "minOpportunity", "minComp", "maxComp"]);
export function parseAnalyticsFilters(
  request: Request,
  allowed: readonly (keyof AnalyticsFilters)[]
) {
  const result: AnalyticsFilters = {};
  const allowlist = new Set<string>(allowed);
  for (const [key, rawValue] of new URL(request.url).searchParams) {
    if (!allowlist.has(key)) throw new Error(`FILTER_NOT_ALLOWED:${key}`);
    const value = rawValue.trim();
    if (!value || value.length > 160) throw new Error(`INVALID_FILTER:${key}`);
    if (strings.has(key)) Object.assign(result, { [key]: value });
    else if (dates.has(key)) {
      if (!Number.isFinite(Date.parse(value))) throw new Error(`INVALID_FILTER:${key}`);
      Object.assign(result, { [key]: value });
    } else if (numbers.has(key)) {
      const number = Number(value);
      if (!Number.isFinite(number)) throw new Error(`INVALID_FILTER:${key}`);
      Object.assign(result, { [key]: number });
    }
  }
  return result;
}
export function countBy(values: readonly string[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}
export function suppressSmallCounts(counts: Record<string, number>, threshold = 5) {
  return Object.fromEntries(
    Object.entries(counts).map(([name, count]) => [
      name,
      { count: count < threshold ? null : count, lowVolume: count < threshold }
    ])
  );
}
