import type { ConversationDetail, ConversationRequest } from '../contracts/conversation';
import { askingMessageId } from './mailThread';
import { mailDateTime, parseSender, repliedLine } from './mails';

/** Scrolls to a mail of the conversation and flashes it, so the user sees which mail asks. */
export function showMail(gmailMessageId: string) {
  const mail = document.getElementById(`mail-${gmailMessageId}`);
  if (!mail) return;
  mail.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  mail.classList.remove('animate-flash');
  void mail.offsetWidth;
  mail.classList.add('animate-flash');
}

/**
 * What closes an open request, or what became of the user's reply (owner, 24 Oct 2026). On phones
 * "I did this" is right under the note, in the step's sheet, not in a "⋯".
 */
export function stepNote(
  asked: ConversationRequest,
  pastDue: boolean,
  phone = false,
): string | null {
  if (asked.state === 'REPLIED')
    return asked.replyRead === 'NOT_READ'
      ? "The AI could not read your reply, so it can't tell if this is done."
      : null;
  if (asked.state !== 'OPEN') return null;
  if (asked.replyRead === 'NOT_ANSWERED' && asked.repliedAt)
    return `${repliedLine(asked.repliedAt)}, but your reply does not answer this yet.`;
  if (asked.askKind === 'REPLY_BY_MAIL')
    return pastDue
      ? 'Closes when your reply answers it, or when you set the application to Rejected or Closed.'
      : 'Closes by itself when your reply answers it.';
  if (asked.askKind === 'OUTSIDE_MAIL' && asked.canReply)
    return 'Closes by itself when you reply that you did it, or when they confirm it.';
  const where = phone ? '' : ' in "⋯"';
  return asked.canReply
    ? `When you have done it, choose "I did this"${where}.`
    : `This sender can't get a reply. When you've done it, choose "I did this"${where}.`;
}

/** The mail a step's sheet can show: the one that closed it, or the one that asks. */
export function stepSource(
  detail: ConversationDetail,
): { label: string; messageId: string } | null {
  const asked = detail.conversation.request!;
  if (asked.state === 'DONE')
    return asked.closedByMessageId
      ? {
          label: asked.closedReason === 'YOUR_REPLY' ? 'Show your reply' : 'Show that mail',
          messageId: asked.closedByMessageId,
        }
      : null;
  const source = detail.mails.find((mail) => mail.id === asked.emailId);
  const messageId = askingMessageId(detail);
  if (!source || !messageId) return null;
  const who = source.sender ? `${parseSender(source.sender).name}'s` : 'this';
  return { label: `Show ${who} mail, ${mailDateTime(source.receivedAt)}`, messageId };
}

/**
 * Under a closed step on a phone (owner, 13 Nov 2026): why it closed, and what Reopen does. The
 * closing reason itself shows beside the step's state.
 */
export function reopenNote(asked: ConversationRequest): string | null {
  if (asked.state === 'REPLIED')
    return 'Your reply closed this step by itself. Reopen puts it back on your list.';
  if (asked.state === 'DONE') return 'Reopen puts it back on your list.';
  return null;
}
