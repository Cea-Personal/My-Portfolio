export function fakeDriveFile(
  overrides: Partial<{ fileId: string; name: string; mimeType: string; version: string }> = {}
) {
  return {
    fileId: overrides.fileId ?? "file-1",
    name: overrides.name ?? "resume.txt",
    mimeType: overrides.mimeType ?? "text/plain",
    version: overrides.version ?? "1"
  };
}
