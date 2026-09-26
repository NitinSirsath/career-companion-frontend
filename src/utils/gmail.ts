/**
 * Generates a direct URL to a Gmail conversation/thread.
 *
 * @param threadId The stable Gmail thread ID.
 * @returns The Gmail web interface URL.
 */
export function getGmailConversationUrl(threadId: string): string {
  // Format: https://mail.google.com/mail/u/0/#all/<gmailThreadId>
  return `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(threadId)}`;
}
