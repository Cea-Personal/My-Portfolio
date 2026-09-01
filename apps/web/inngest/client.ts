import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "ai-career-os",
  env: process.env.VERCEL_ENV ?? process.env.NODE_ENV
});
