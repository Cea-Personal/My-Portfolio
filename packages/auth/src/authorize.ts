import { ProblemError, problem } from "@career-os/contracts";

export function assertOwner(ownerId: string, resourceOwnerId: string, correlationId: string): void {
  if (!ownerId || ownerId !== resourceOwnerId) {
    throw new ProblemError(
      problem("FORBIDDEN", "You are not authorized to access this resource.", 403, correlationId)
    );
  }
}

export function assertOwnerRoute(
  ownerId: string | null | undefined,
  correlationId: string
): asserts ownerId is string {
  if (!ownerId)
    throw new ProblemError(problem("UNAUTHORIZED", "Authentication required.", 401, correlationId));
}
