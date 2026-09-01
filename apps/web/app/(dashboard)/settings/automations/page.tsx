import { ResourceList } from "@/components/dashboard/resource-list";

export default function AutomationsSettingsPage() {
  return (
    <ResourceList
      endpoint="/api/v1/automations"
      title="Automations"
      description="Enable bounded, informational workflows and inspect their next run."
      emptyText="No automation schedules yet."
    />
  );
}
