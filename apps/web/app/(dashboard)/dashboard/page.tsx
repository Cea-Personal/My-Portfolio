import { DashboardSummary } from "@/components/dashboard/dashboard-summary";

export default function DashboardPage() {
  return (
    <main className="workspace-page today-page">
      <header className="workspace-heading">
        <p className="eyebrow">Your next actions</p>
        <h1>Today</h1>
        <p>
          Review opportunities, move applications forward, and prepare for your next conversation.
        </p>
      </header>
      <DashboardSummary />
    </main>
  );
}
