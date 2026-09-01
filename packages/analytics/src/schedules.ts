export function validateSchedule(
  timezone: string,
  logicalDate: string
): { timezone: string; logicalDate: string } {
  if (!timezone.includes("/")) throw new Error("IANA_TIMEZONE_REQUIRED");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(logicalDate)) throw new Error("LOGICAL_DATE_REQUIRED");
  return { timezone, logicalDate };
}
