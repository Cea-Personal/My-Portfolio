import type { PublicItem, Publication } from "./publication";

export interface PublicSection {
  id: string;
  title: string;
  items: PublicItem[];
}

const order = ["hero", "about", "career", "projects", "impact", "skills", "writing", "contact"];

export function toPublicSections(
  publication: Pick<Publication, "status" | "items">
): PublicSection[] {
  if (publication.status !== "published") return [];
  const sections = new Map<string, PublicSection>();
  for (const item of publication.items) {
    const key =
      item.sourceEntityType === "achievement"
        ? "impact"
        : item.sourceEntityType === "project"
          ? "projects"
          : item.sourceEntityType;
    const section = sections.get(key) ?? {
      id: key,
      title: key[0]?.toUpperCase() + key.slice(1),
      items: []
    };
    section.items.push({ ...item });
    sections.set(key, section);
  }
  return [...sections.values()].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}
