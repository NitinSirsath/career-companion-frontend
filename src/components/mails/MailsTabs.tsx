import { useNavigate } from '@tanstack/react-router';
import { useConversations } from '../../api/conversations';
import { pageCount, type MailsSearch } from '../../lib/mails';
import { Tabs } from '../ui/tabs';

type MailsTab = 'job' | 'gmail';

/** The two lists of the Mails page. Changing tab keeps the Job mails filters in the URL. */
export function MailsTabs({ tab }: { tab: MailsTab }) {
  // The unfiltered list, so the number says how many job mails there are, not how many match.
  const { data } = useConversations({}, 0);
  const navigate = useNavigate({ from: '/mails/' });
  return (
    <Tabs<MailsTab>
      label="Mail lists"
      value={tab}
      onValueChange={(next) =>
        void navigate({
          search: (current: MailsSearch) => ({
            ...current,
            tab: next === 'gmail' ? ('gmail' as const) : undefined,
          }),
        })
      }
      items={[
        { value: 'job', label: 'Job mails', count: data ? pageCount(data) : undefined },
        { value: 'gmail', label: 'Whole inbox' },
      ]}
    />
  );
}
