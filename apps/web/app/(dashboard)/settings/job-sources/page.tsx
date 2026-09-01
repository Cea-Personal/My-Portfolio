import { ResourceList } from "@/components/dashboard/resource-list";

export default function JobSourcesSettingsPage() {
  return (
    <ResourceList
      endpoint="/api/v1/job-sources"
      collectionKey="sources"
      title="Job sources"
      description="Configure lawful, rate-limited sources without exposing secrets."
      emptyText="No job sources configured."
    />
  );
}
