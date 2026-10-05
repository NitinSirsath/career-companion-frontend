import type {
  GmailStatusResponse,
  AISettingsResponse,
  WorkspaceActionsResponse,
} from "../contracts";

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  } catch {
    return "Asia/Kolkata";
  }
}

export function transitionDelay(
  data: Pick<WorkspaceActionsResponse, "generatedAt" | "nextTransitionAt">,
  ageMs = 0,
) {
  if (!data.nextTransitionAt) return null;
  return Math.min(
    2_147_483_647,
    Math.max(
      60_000,
      Date.parse(data.nextTransitionAt) - Date.parse(data.generatedAt) - ageMs,
    ),
  );
}

/** These are observations, never a proof that every message produced all of its effects. */
export function coverageMessages(
  gmail?: GmailStatusResponse,
  ai?: AISettingsResponse,
): string[] {
  const messages: string[] = [];
  if (!gmail) messages.push("Gmail coverage is unknown.");
  else {
    if (!gmail.connected)
      messages.push("Gmail is disconnected. Stored work remains available.");
    if (!gmail.lastSyncedAt)
      messages.push("No successful Gmail sync is recorded.");
    else
      messages.push(
        `Last successful Gmail sync: ${new Date(gmail.lastSyncedAt).toLocaleString()}.`,
      );
    if (gmail.syncStatus === "SYNCING")
      messages.push("Gmail sync is in progress.");
    if (gmail.syncStatus === "FAILED")
      messages.push("The latest Gmail sync could not finish.");
    if (gmail.unscannedGap)
      messages.push(
        `Some mail was not scanned between ${new Date(gmail.unscannedGap.from).toLocaleString()} and ${new Date(gmail.unscannedGap.until).toLocaleString()}.`,
      );
  }
  if (!ai) messages.push("AI access and waiting-mail count are unknown.");
  else {
    messages.push(
      ai.access.state === "READY"
        ? "AI access is ready."
        : "AI access needs attention; check AI settings.",
    );
    messages.push(`${ai.waitingEmails} emails waiting to start processing.`);
  }
  messages.push(
    "Processing completeness is unknown here. Waiting counts exclude emails already processing or failed; check Gmail for details.",
  );
  return messages;
}
