import { z } from "zod";

export const problemDetailsSchema = z.object({
  type: z.string().url().default("https://career-os.dev/problems/unknown"),
  title: z.string().min(1),
  status: z.number().int().min(400).max(599),
  detail: z.string().min(1),
  instance: z.string().optional(),
  code: z.string().regex(/^[A-Z][A-Z0-9_]+$/),
  correlationId: z.string().min(8).max(128),
  retryable: z.boolean().default(false)
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;

export class ProblemError extends Error {
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail);
    this.name = "ProblemError";
    this.problem = problem;
  }
}

export function problem(
  code: string,
  detail: string,
  status: number,
  correlationId: string,
  options: Partial<Pick<ProblemDetails, "title" | "type" | "retryable" | "instance">> = {}
): ProblemDetails {
  return problemDetailsSchema.parse({
    type: options.type ?? `https://career-os.dev/problems/${code.toLowerCase()}`,
    title: options.title ?? "Request failed",
    status,
    detail,
    code,
    correlationId,
    retryable: options.retryable ?? false,
    instance: options.instance
  });
}

export function safeErrorMessage(error: unknown): string {
  if (error instanceof ProblemError) return error.problem.detail;
  return "The request could not be completed.";
}
