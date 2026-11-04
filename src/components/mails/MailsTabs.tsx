import { Tabs } from '../ui/tabs';
import { useMailsLists, useOpenMailsList, type MailsTab } from './mailsLists';

/** The lists of the Mails page as underlined tabs (laptops; phones switch in the top bar). */
export function MailsTabs({ tab }: { tab: MailsTab }) {
  const lists = useMailsLists();
  const open = useOpenMailsList();
  return (
    <Tabs<MailsTab>
      label="Mail lists"
      look="underline"
      value={tab}
      onValueChange={open}
      items={lists}
    />
  );
}
