const denied = new Set([
  "publish",
  "submit",
  "send",
  "approve",
  "change_evidence",
  "join_meeting",
  "live_transcription",
  "live_answer"
]);
export function assertAutomationActionAllowed(action: string): void {
  if (denied.has(action)) throw new Error("CONSEQUENTIAL_AUTOMATION_DENIED");
}
