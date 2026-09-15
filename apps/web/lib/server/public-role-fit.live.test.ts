import { expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { loadPublicPortfolio } from "@/lib/api/public-data";
import { resolveReasoningProviders, generateReasoningJson } from "@/lib/server/reasoning-provider";
import {
  publicRoleFitContext,
  parsePublicRoleFit,
  publicRoleFitRequest,
  PUBLIC_ROLE_FIT_INSTRUCTION
} from "@/lib/server/public-role-fit";

// Explicitly opt in: this reads published Supabase data and invokes the configured LLM.
it.skipIf(process.env.RUN_LIVE_ROLE_FIT !== "1")(
  "compares a data role using the configured live analyst",
  async () => {
    process.loadEnvFile(".env.local");
    const snapshot = await loadPublicPortfolio();
    expect(snapshot.source).toBe("live");
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const context = publicRoleFitContext(snapshot);
    expect(context.length).toBeGreaterThan(0);
    const providers = await resolveReasoningProviders(
      client,
      String(snapshot.publication?.owner_id),
      "role_fit"
    );
    const description =
      "Data Engineer. Build data pipelines using Python and SQL. Design reliable data platforms and improve data quality. Collaborate with software engineers to deliver production systems.";
    const generated = await generateReasoningJson(
      providers.map((provider) => ({ ...provider, timeoutMs: 90_000, retryLimit: 0 })),
      PUBLIC_ROLE_FIT_INSTRUCTION,
      publicRoleFitRequest(description, context),
      { task: "role_fit" }
    );
    console.info("role_fit_live_diagnostics", {
      sourceCount: context.length,
      outputKeys: Object.keys(generated.output),
      elapsedMs: generated.elapsedMs
    });
    const result = parsePublicRoleFit(generated.output, description, context);
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.abstained).toBe(false);
  },
  115_000
);
