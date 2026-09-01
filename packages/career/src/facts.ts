import { createHash, randomUUID } from "node:crypto";
import type { ReviewStatus, TrustLevel, Visibility } from "@career-os/contracts";

export interface CareerFactVersion {
  id: string;
  factId: string;
  version: number;
  statement: string;
  structuredValue: Record<string, unknown>;
  sourceType: "manual" | "document" | "provider";
  extractorVersion?: string;
  confidence?: number;
  editorActor: string;
  editReason?: string;
  contentHash: string;
  createdAt: string;
}

export interface CareerFact {
  id: string;
  ownerId: string;
  factType: string;
  subjectType: string;
  subjectId: string;
  trustLevel: TrustLevel;
  reviewStatus: ReviewStatus;
  visibility: Visibility;
  verifiedByOwner: boolean;
  currentVersionId: string;
  versions: CareerFactVersion[];
  supersededById?: string;
}

function hashStatement(statement: string, value: Record<string, unknown>): string {
  return createHash("sha256")
    .update(`${statement}\n${JSON.stringify(value)}`)
    .digest("hex");
}

export function createManualFact(
  input: Pick<CareerFact, "ownerId" | "factType" | "subjectType" | "subjectId"> & {
    statement: string;
    structuredValue?: Record<string, unknown>;
    editorActor: string;
  }
): CareerFact {
  const id = randomUUID();
  const structuredValue = input.structuredValue ?? {};
  const version: CareerFactVersion = {
    id: randomUUID(),
    factId: id,
    version: 1,
    statement: input.statement.trim(),
    structuredValue,
    sourceType: "manual",
    editorActor: input.editorActor,
    contentHash: hashStatement(input.statement, structuredValue),
    createdAt: new Date().toISOString()
  };
  if (!version.statement) throw new Error("Fact statement is required");
  return {
    id,
    ownerId: input.ownerId,
    factType: input.factType,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    trustLevel: "owner_verified",
    reviewStatus: "approved",
    visibility: "private",
    verifiedByOwner: true,
    currentVersionId: version.id,
    versions: [version]
  };
}

export function correctFact(
  fact: CareerFact,
  input: {
    statement: string;
    structuredValue?: Record<string, unknown>;
    editorActor: string;
    reason: string;
  }
): CareerFact {
  if (!input.reason.trim()) throw new Error("An edit reason is required");
  const structuredValue = input.structuredValue ?? {};
  const version: CareerFactVersion = {
    id: randomUUID(),
    factId: fact.id,
    version: fact.versions.length + 1,
    statement: input.statement.trim(),
    structuredValue,
    sourceType: "manual",
    editorActor: input.editorActor,
    editReason: input.reason,
    contentHash: hashStatement(input.statement, structuredValue),
    createdAt: new Date().toISOString()
  };
  return {
    ...fact,
    reviewStatus: "edited_approved",
    trustLevel: "owner_verified",
    verifiedByOwner: true,
    currentVersionId: version.id,
    versions: [...fact.versions, version]
  };
}

export function archiveFact(fact: CareerFact): CareerFact {
  return { ...fact, visibility: "private", reviewStatus: "rejected" };
}
