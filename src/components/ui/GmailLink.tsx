import { getGmailConversationUrl } from '../../utils/gmail';

interface GmailLinkProps {
  threadId?: string | null;
  className?: string;
  subject?: string | null;
}

export function GmailLink({ threadId, className = '', subject }: GmailLinkProps) {
  if (!threadId) return null;

  return (
    <a
      href={getGmailConversationUrl(threadId)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center text-xs font-medium text-primary hover:underline ${className}`}
      aria-label={`Open email "${subject || 'Unknown Subject'}" in Gmail`}
    >
      Open in Gmail ↗
    </a>
  );
}
