import { expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { loadPublicPortfolio } from "@/lib/api/public-data";
import { publicRoleFitContext } from "./public-role-fit";
import { generateReasoningJson, resolveReasoningProviders } from "./reasoning-provider";
import {
  PUBLIC_CHAT_ANSWER_INSTRUCTION,
  parsePublicChatAnswer,
  publicChatProviders
} from "./public-chat-answer";

// Opt in only: reads the published snapshot and calls the configured agent.
it.skipIf(process.env.RUN_LIVE_PUBLIC_CHAT !== "1")(
  "synthesizes a conversational answer with the configured public agent",
  async () => {
    process.loadEnvFile(".env.local");
    const snapshot = await loadPublicPortfolio();
    expect(snapshot.source).toBe("live");
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const providers = publicChatProviders(
      await resolveReasoningProviders(client, String(snapshot.publication?.owner_id), "public_qa")
    );
    console.info(
      "public_chat_provider",
      providers.map(({ provider, model, timeoutMs }) => ({ provider, model, timeoutMs }))
    );
    const context = publicRoleFitContext(snapshot)
      .slice(0, 8)
      .map((item, index) => ({
        id: `S${index + 1}`,
        handle: item.id,
        source: item.title,
        text: item.text.slice(0, 2800)
      }));
    const generated = await generateReasoningJson(
      providers,
      PUBLIC_CHAT_ANSWER_INSTRUCTION,
      {
        question:
          "How does Basil’s software engineering background help his data engineering work?",
        mode: "retrieved_context",
        context: context.map(({ handle: _handle, ...item }) => item)
      },
      { task: "public_qa" }
    );
    const answer = parsePublicChatAnswer(generated.output, context);
    console.info("public_chat_live", {
      elapsedMs: generated.elapsedMs,
      answer: answer.answer,
      citationCount: answer.citations.length
    });
    expect(answer.abstained).toBe(false);
    expect(answer.citations.length).toBeGreaterThan(0);
  },
  115_000
);
