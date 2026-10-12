import { Link } from '@tanstack/react-router';
import { useConversations } from '../../api/conversations';
import { pageCount, type MailsSearch } from '../../lib/mails';
import { Badge } from '../ui/badge';

const tabClass =
  'flex items-center gap-2 min-h-11 border-b-2 border-transparent text-sm font-medium text-text-secondary hover:text-text-primary [&.active]:border-border-focus [&.active]:font-semibold [&.active]:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus';

/** The two lists of the Mails page. Changing tab keeps the Job mails filters in the URL. */
export function MailsTabs() {
  // The unfiltered list, so the number says how many job mails there are, not how many match.
  const { data } = useConversations({}, 0);
  return (
    <nav aria-label="Mail lists" className="flex gap-6 border-b border-border-default">
      <Link
        from="/mails/"
        to="/mails"
        search={(current: MailsSearch) => ({ ...current, tab: undefined })}
        activeOptions={{ exact: true }}
        className={tabClass}
      >
        Job mails
        {data && <Badge variant="secondary">{pageCount(data)}</Badge>}
      </Link>
      <Link
        from="/mails/"
        to="/mails"
        search={(current: MailsSearch) => ({ ...current, tab: 'gmail' as const })}
        className={tabClass}
      >
        Gmail
      </Link>
    </nav>
  );
}
