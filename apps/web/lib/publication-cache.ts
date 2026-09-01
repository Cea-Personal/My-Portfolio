export function publicationTag(ownerId: string, version: number): string {
  return `publication:${ownerId}:${version}`;
}
export function publicationPath(ownerId: string): string {
  return `/portfolio/${encodeURIComponent(ownerId)}`;
}
