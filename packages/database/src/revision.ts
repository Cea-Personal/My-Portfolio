export function assertRevision(currentRevision: number, expectedRevision: number): void {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0)
    throw new Error("Invalid revision");
  if (currentRevision !== expectedRevision) {
    const error = new Error("The record changed since it was loaded");
    error.name = "RevisionConflict";
    throw error;
  }
}

export function nextRevision(currentRevision: number): number {
  if (!Number.isInteger(currentRevision) || currentRevision < 0)
    throw new Error("Invalid revision");
  return currentRevision + 1;
}
