import { createHash, randomUUID } from "node:crypto";
import type { CareerFact } from "./facts";

export interface ProjectionRule {
  sourceType: string;
  sourceId: string;
  publicEligible: boolean;
  featured?: boolean;
  displayOrder?: number;
  publicSummary?: string;
}
export interface PublicItem {
  publicId: string;
  sourceEntityType: string;
  sourceEntityId: string;
  title: string;
  publicSummary: string;
  displayOrder: number;
}
export interface Publication {
  id: string;
  ownerId: string;
  version: number;
  status: "staged" | "published" | "withdrawn";
  contentHash: string;
  items: PublicItem[];
  createdAt: string;
  publishedAt?: string;
  withdrawnAt?: string;
}

export function previewProjection(
  ownerId: string,
  version: number,
  facts: readonly CareerFact[],
  rules: readonly ProjectionRule[]
): Publication {
  const eligible = new Map(
    rules
      .filter((rule) => rule.publicEligible)
      .map((rule) => [`${rule.sourceType}:${rule.sourceId}`, rule])
  );
  const items = facts
    .filter(
      (fact) =>
        fact.ownerId === ownerId &&
        fact.visibility === "public" &&
        fact.verifiedByOwner &&
        eligible.has(`${fact.subjectType}:${fact.subjectId}`)
    )
    .map((fact, index) => {
      const rule = eligible.get(`${fact.subjectType}:${fact.subjectId}`)!;
      const current = fact.versions.find((item) => item.id === fact.currentVersionId)!;
      return {
        publicId: `${fact.id}:${fact.currentVersionId}`,
        sourceEntityType: fact.subjectType,
        sourceEntityId: fact.subjectId,
        title: fact.factType,
        publicSummary: rule.publicSummary ?? current.statement,
        displayOrder: rule.displayOrder ?? index
      };
    })
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const contentHash = createHash("sha256").update(JSON.stringify(items)).digest("hex");
  return {
    id: randomUUID(),
    ownerId,
    version,
    status: "staged",
    contentHash,
    items,
    createdAt: new Date().toISOString()
  };
}

export function publishProjection(publication: Publication, confirmation: boolean): Publication {
  if (!confirmation) throw new Error("Publication confirmation is required");
  if (
    publication.status !== "staged" ||
    publication.items.some((item) => !item.publicSummary.trim())
  )
    throw new Error("Publication is not valid");
  return { ...publication, status: "published", publishedAt: new Date().toISOString() };
}

export function withdrawPublication(publication: Publication, confirmation: boolean): Publication {
  if (!confirmation) throw new Error("Withdrawal confirmation is required");
  if (publication.status !== "published")
    throw new Error("Only an active publication can be withdrawn");
  return { ...publication, status: "withdrawn", withdrawnAt: new Date().toISOString() };
}
