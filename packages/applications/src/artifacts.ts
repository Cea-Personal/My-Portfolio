export type ArtifactStatus =
  | "draft"
  | "owner_reviewed"
  | "final"
  | "submitted_snapshot"
  | "superseded";
export interface ArtifactVersion {
  id: string;
  artifactId: string;
  version: number;
  status: ArtifactStatus;
  binaryHash: string;
  createdAt: string;
}
export function finalizeArtifact(version: ArtifactVersion, confirmed: boolean): ArtifactVersion {
  if (!confirmed) throw new Error("OWNER_CONFIRMATION_REQUIRED");
  if (version.status !== "owner_reviewed") throw new Error("OWNER_REVIEW_REQUIRED");
  return { ...version, status: "final" };
}
export function snapshotSubmitted(version: ArtifactVersion, confirmed: boolean): ArtifactVersion {
  if (!confirmed) throw new Error("OWNER_CONFIRMATION_REQUIRED");
  if (version.status !== "final") throw new Error("FINAL_ARTIFACT_REQUIRED");
  return { ...version, status: "submitted_snapshot" };
}
