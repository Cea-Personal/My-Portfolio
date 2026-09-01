export function sanitizeError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) return { name: error.name, message: error.message.slice(0, 500) };
  return { name: "UnknownError", message: "An unknown error occurred." };
}

export function captureSanitizedError(error: unknown, context: Record<string, unknown> = {}): void {
  if (process.env.NODE_ENV === "test") return;
  const payload = {
    error: sanitizeError(error),
    context: Object.fromEntries(
      Object.entries(context).filter(([key]) => /id|status|code|route/i.test(key))
    )
  };
  console.error("sanitized_error", payload);
}
