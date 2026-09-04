const FIELD_RANGES = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 7]
] as const;

function valuesForField(field: string, minimum: number, maximum: number): Set<number> | null {
  const values = new Set<number>();
  for (const part of field.split(",")) {
    const [rangePart, stepPart] = part.split("/");
    const step = stepPart === undefined ? 1 : Number(stepPart);
    if (!Number.isInteger(step) || step < 1) return null;
    let start = minimum;
    let end = maximum;
    if (rangePart !== "*") {
      const bounds = rangePart?.split("-").map(Number) ?? [];
      if (bounds.length === 1) start = end = bounds[0] ?? Number.NaN;
      else if (bounds.length === 2) [start, end] = bounds as [number, number];
      else return null;
    }
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < minimum ||
      end > maximum ||
      start > end
    )
      return null;
    for (let value = start; value <= end; value += step) values.add(value === 7 ? 0 : value);
  }
  return values;
}

export function parseCronExpression(expression: string) {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const parsed = fields.map((field, index) => {
    const range = FIELD_RANGES[index];
    return range ? valuesForField(field, range[0], range[1]) : null;
  });
  if (parsed.some((field) => !field)) return null;
  const [minute, hour, day, month, weekday] = parsed;
  if (!minute || !hour || !day || !month || !weekday) return null;
  return {
    fields,
    minute,
    hour,
    day,
    month,
    weekday
  };
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hourCycle: "h23"
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const weekdayName = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  return {
    minute: value("minute"),
    hour: value("hour"),
    day: value("day"),
    month: value("month"),
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekdayName)
  };
}

export function nextCronOccurrence(expression: string, timeZone: string, after = new Date()) {
  const cron = parseCronExpression(expression);
  if (!cron || !isValidTimeZone(timeZone)) return null;
  const candidate = new Date(after);
  candidate.setUTCSeconds(0, 0);
  candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  const maximumMinutes = 370 * 24 * 60;
  for (let offset = 0; offset < maximumMinutes; offset += 1) {
    const parts = zonedParts(candidate, timeZone);
    const dayMatches = cron.day.has(parts.day);
    const weekdayMatches = cron.weekday.has(parts.weekday);
    const dayWildcard = cron.fields[2] === "*";
    const weekdayWildcard = cron.fields[4] === "*";
    const calendarDayMatches =
      dayWildcard && weekdayWildcard
        ? true
        : dayWildcard
          ? weekdayMatches
          : weekdayWildcard
            ? dayMatches
            : dayMatches || weekdayMatches;
    if (
      cron.minute.has(parts.minute) &&
      cron.hour.has(parts.hour) &&
      cron.month.has(parts.month) &&
      calendarDayMatches
    )
      return new Date(candidate);
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  }
  return null;
}
