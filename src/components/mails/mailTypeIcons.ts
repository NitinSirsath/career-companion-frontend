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

/** Each mail type's icon: in the Mails list, and where the AI reading status lists job mails. */
export const MAIL_TYPE_ICON: Record<MailCategory, CarbonIconType> = {
  RECRUITER: User,
  INTERVIEW: Video,
  ASSESSMENT: Code,
  OFFER: Certificate,
  REJECTION: Misuse,
  FOLLOW_UP: Chat,
  NEWSLETTER: Email,
  SPAM: Email,
};
