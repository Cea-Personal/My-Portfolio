const ALLOWED_ATTRIBUTES = new Set([
  "service.name",
  "service.version",
  "deployment.environment",
  "workflow.name",
  "workflow.run_id",
  "workflow.step",
  "workflow.status",
  "ai.provider",
  "ai.model",
  "ai.operation",
  "ai.input_hash",
  "ai.output_schema_version",
  "correlation_id",
  "owner.pseudonym"
]);

export type SpanAttributes = Record<string, string | number | boolean>;

export function allowlistedAttributes(input: SpanAttributes): SpanAttributes {
  return Object.fromEntries(Object.entries(input).filter(([key]) => ALLOWED_ATTRIBUTES.has(key)));
}

export function pseudonymizeOwner(
  ownerId: string,
  salt = process.env.OTEL_OWNER_SALT ?? "local-only"
): string {
  let hash = 2166136261;
  for (const char of `${salt}:${ownerId}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `owner_${(hash >>> 0).toString(16)}`;
}

export function createMetadataOnlyAiSpan(attributes: SpanAttributes): SpanAttributes {
  const safe = allowlistedAttributes(attributes);
  delete safe.prompt;
  delete safe.input;
  delete safe.output;
  delete safe.content;
  return safe;
}
