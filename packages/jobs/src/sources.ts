import { assertSecretReference } from "@career-os/config";
export interface JobSourceConfig {
  sourceId: string;
  adapterType: string;
  secretRef?: string;
  enabled: boolean;
  rateLimitPerMinute: number;
}
export function validateSourceConfig(config: JobSourceConfig): JobSourceConfig {
  if (config.secretRef) assertSecretReference(config.secretRef);
  if (!Number.isInteger(config.rateLimitPerMinute) || config.rateLimitPerMinute < 1)
    throw new Error("Invalid source rate limit");
  return { ...config };
}
