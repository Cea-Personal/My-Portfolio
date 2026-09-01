import type { EvidenceConnection } from "./artifact-schemas";
export function validateArtifactEvidence(connections: readonly EvidenceConnection[]): void {
  if (!connections.length || connections.some((item) => !item.evidenceId || !item.statement.trim()))
    throw new Error("ARTIFACT_EVIDENCE_REQUIRED");
}
