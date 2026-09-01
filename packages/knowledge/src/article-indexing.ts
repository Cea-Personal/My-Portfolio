export function indexTechnicalArticle(input: { id: string; title: string; content: string }) {
  return { ...input, evidenceType: "technical_knowledge" as const, supportsEmploymentClaim: false };
}
