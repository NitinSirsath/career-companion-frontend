import {
  Certificate,
  Chat,
  Code,
  Email,
  Misuse,
  User,
  Video,
  type CarbonIconType,
} from '@carbon/icons-react';
import type { MailCategory } from '../../contracts/conversation';
import { CATEGORY_LABEL } from '../../lib/mails';

const ICON: Record<MailCategory, CarbonIconType> = {
  RECRUITER: User,
  INTERVIEW: Video,
  ASSESSMENT: Code,
  OFFER: Certificate,
  REJECTION: Misuse,
  FOLLOW_UP: Chat,
  NEWSLETTER: Email,
  SPAM: Email,
};

/** A mail's type as an icon and a word, never a tag, so it does not look like a status. */
export function MailType({ category }: { category: MailCategory }) {
  const Icon = ICON[category];
  return (
    <span className="inline-flex items-center gap-1.5 text-text-secondary">
      <Icon size={16} aria-hidden="true" />
      {CATEGORY_LABEL[category]}
    </span>
  );
}
