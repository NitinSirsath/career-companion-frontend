import type { MailCategory } from '../../contracts/conversation';
import { CATEGORY_LABEL } from '../../lib/mails';
import { MAIL_TYPE_ICON } from './mailTypeIcons';

/** A mail's type as an icon and a word, never a tag, so it does not look like a status. */
export function MailType({ category }: { category: MailCategory }) {
  const Icon = MAIL_TYPE_ICON[category];
  return (
    <span className="inline-flex items-center gap-1.5 text-text-secondary">
      <Icon size={16} aria-hidden="true" />
      {CATEGORY_LABEL[category]}
    </span>
  );
}
