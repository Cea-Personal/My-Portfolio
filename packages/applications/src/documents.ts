import { createPrivateObjectKey } from "@career-os/documents";
export function applicationDocumentKey(
  ownerId: string,
  applicationId: string,
  version: number
): string {
  return createPrivateObjectKey(ownerId, `application-${applicationId}`, version);
}
