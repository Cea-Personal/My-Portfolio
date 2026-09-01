export function failureProvider(
  code: "TIMEOUT" | "PROVIDER_429" | "PROVIDER_5XX" | "MALFORMED_OUTPUT" | "WORKER_LOST"
) {
  return {
    code,
    async run() {
      throw new Error(code);
    }
  };
}
