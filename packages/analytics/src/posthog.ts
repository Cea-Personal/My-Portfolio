export type Consent = "granted" | "denied" | "unknown";

export interface AnalyticsClient {
  capture(event: string, properties?: Record<string, string | number | boolean>): void;
}

const noop: AnalyticsClient = { capture: () => undefined };

export function createConsentGatedAnalytics(
  consent: Consent,
  client: AnalyticsClient = noop
): AnalyticsClient {
  if (consent !== "granted") return noop;
  return {
    capture(event, properties) {
      if (!event || event.length > 128) return;
      client.capture(event, properties);
    }
  };
}
