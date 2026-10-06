export type FreelanceFunnelRecord = { crmStatus: string; approvalState: string };

export function calculateFreelanceFunnel(records: readonly FreelanceFunnelRecord[]) {
  const byStatus: Record<string, number> = {};
  const byApprovalState: Record<string, number> = {};
  for (const record of records) {
    byStatus[record.crmStatus] = (byStatus[record.crmStatus] ?? 0) + 1;
    byApprovalState[record.approvalState] = (byApprovalState[record.approvalState] ?? 0) + 1;
  }
  const submitted = byApprovalState.SUBMITTED ?? 0;
  const won = byStatus.WON ?? 0;
  const lost = byStatus.LOST ?? 0;
  const decided = won + lost;
  return {
    total: records.length,
    byStatus,
    byApprovalState,
    submitted,
    won,
    lost,
    winRate: decided ? Number((won / decided).toFixed(4)) : null,
    calculationVersion: "freelance-funnel.v1" as const
  };
}
