import type { Consent, AnalyticsClient } from "./posthog";
import { createConsentGatedAnalytics } from "./posthog";
export function posthogWithConsent(consent: Consent, client?: AnalyticsClient) {
  return createConsentGatedAnalytics(consent, client);
}
