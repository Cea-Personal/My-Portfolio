export interface ProviderHealth {
  provider: string;
  status: "healthy" | "degraded" | "down";
  consecutiveFailures: number;
  circuitOpen: boolean;
}
export function updateProviderHealth(previous: ProviderHealth, success: boolean): ProviderHealth {
  const failures = success ? 0 : previous.consecutiveFailures + 1;
  return {
    ...previous,
    status: success ? "healthy" : failures >= 3 ? "down" : "degraded",
    consecutiveFailures: failures,
    circuitOpen: failures >= 5
  };
}
