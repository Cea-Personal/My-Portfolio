import { ResourceList } from "@/components/dashboard/resource-list";

export default function DataSettingsPage() {
  return (
    <ResourceList
      endpoint="/api/v1/exports"
      collectionKey="exports"
      title="Your data"
      description="Request an authenticated export or manage retention preferences."
      emptyText="No export requests yet."
    />
  );
}
