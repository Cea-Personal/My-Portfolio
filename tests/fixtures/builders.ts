import { randomUUID } from "node:crypto";

export function ownerFixture(overrides: Partial<{ id: string; displayName: string }> = {}) {
  return {
    id: overrides.id ?? randomUUID(),
    displayName: overrides.displayName ?? "Acceptance Owner",
    timezone: "Africa/Kigali"
  };
}

export function publicationFixture(ownerId = randomUUID()) {
  return {
    id: randomUUID(),
    ownerId,
    version: 1,
    status: "staged" as const,
    contentHash: "sha256:acceptance",
    items: []
  };
}

export function evidenceFixture(ownerId = randomUUID()) {
  return {
    id: randomUUID(),
    ownerId,
    sourceType: "manual_fact" as const,
    title: "Acceptance evidence",
    trustLevel: "owner_verified" as const
  };
}

export function jobFixture(ownerId = randomUUID()) {
  return {
    id: randomUUID(),
    ownerId,
    title: "Platform Engineer",
    company: "Example Co",
    status: "discovered" as const
  };
}

export function applicationFixture(ownerId = randomUUID()) {
  return { id: randomUUID(), ownerId, status: "draft" as const, revision: 0 };
}
