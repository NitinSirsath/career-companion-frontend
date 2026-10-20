import { useSandboxMailbox } from '../../api/appMode';
import { getGmailConversationUrl } from '../../utils/gmail';

interface GmailLinkProps {
  threadId?: string | null;
  className?: string;
  subject?: string | null;
  /** The link invites a reply: Gmail opens the same conversation, where the user replies. */
  reply?: boolean;
}

export function GmailLink({ threadId, className = '', subject, reply = false }: GmailLinkProps) {
  // Dev-mode mail lives in the mail sandbox: there is no Gmail conversation to open.
  const sandbox = useSandboxMailbox();
  if (!threadId || sandbox) return null;

  return (
    <a
      href={getGmailConversationUrl(threadId)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center text-xs font-medium text-primary hover:underline ${className}`}
      aria-label={`${reply ? 'Reply to' : 'Open'} email "${subject || 'Unknown Subject'}" in Gmail`}
    >
      {reply ? 'Reply in Gmail ↗' : 'Open in Gmail ↗'}
    </a>
  );
}
