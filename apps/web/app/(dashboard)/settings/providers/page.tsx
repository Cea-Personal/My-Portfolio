import { ResourceList } from "@/components/dashboard/resource-list";

export default function ProvidersSettingsPage() {
  return (
    <ResourceList
      endpoint="/api/v1/settings/ai-capabilities"
      title="AI providers"
      description="Configure per-task capabilities without exposing provider secrets."
      emptyText="No AI capabilities are configured."
    />
  );
}
