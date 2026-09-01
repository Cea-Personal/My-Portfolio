import { ResourceList } from "@/components/dashboard/resource-list";

export default function SearchProfilesPage() {
  return (
    <ResourceList
      endpoint="/api/v1/search-profiles"
      collectionKey="profiles"
      title="Search profiles"
      description="Define criteria, schedules, and scoring weights."
      emptyText="No search profiles yet."
    />
  );
}
