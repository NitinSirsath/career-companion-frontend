import { useNavigate } from '@tanstack/react-router';
import { useConversations } from '../../api/conversations';
import { useBlockedSenders } from '../../api/removal';
import { pageCount, type MailsSearch } from '../../lib/mails';

export type MailsTab = 'job' | 'gmail' | 'restricted';

/** The Mails page's lists, their names and the Job mails count. */
export function useMailsLists() {
  // The unfiltered list, so the number says how many job mails there are, not how many match.
  const { data } = useConversations({}, 0);
  const blocked = useBlockedSenders();
  return [
    { value: 'job', label: 'Job mails', count: data ? pageCount(data) : undefined },
    { value: 'gmail', label: 'Whole inbox' },
    { value: 'restricted', label: 'Restricted', count: blocked.data?.items.length || undefined },
  ] as const satisfies readonly { value: MailsTab; label: string; count?: string | number }[];
}

/** Opens another list; the Job mails filters stay in the URL. */
export function useOpenMailsList() {
  const navigate = useNavigate({ from: '/mails/' });
  return (next: MailsTab) =>
    void navigate({
      search: (current: MailsSearch) => ({ ...current, tab: next === 'job' ? undefined : next }),
    });
}
