import { z } from "zod";

const url = z.string().url();
const base = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  INNGEST_EVENT_KEY: z.string().min(1).optional(),
  INNGEST_SIGNING_KEY: z.string().min(1).optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: url.optional(),
  SENTRY_DSN: url.optional(),
  POSTHOG_KEY: z.string().min(1).optional(),
  POSTHOG_HOST: url.optional()
});

export type AppEnv = z.infer<typeof base>;
export type PublicEnv = Pick<
  AppEnv,
  "NODE_ENV" | "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
>;

export function parseEnv(input: NodeJS.ProcessEnv = process.env): AppEnv {
  return base.parse(input);
}

export function parsePublicEnv(input: NodeJS.ProcessEnv = process.env): PublicEnv {
  return base
    .pick({ NODE_ENV: true, NEXT_PUBLIC_SUPABASE_URL: true, NEXT_PUBLIC_SUPABASE_ANON_KEY: true })
    .parse(input);
}

export function requireServerEnv(input: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = parseEnv(input);
  if (parsed.NODE_ENV === "production" && !parsed.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required on the server in production");
  }
  return parsed;
}
