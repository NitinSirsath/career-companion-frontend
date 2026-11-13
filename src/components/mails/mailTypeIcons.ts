import {
  AwardIcon,
  CircleXIcon,
  CodeIcon,
  MailIcon,
  MessageCircleIcon,
  UserIcon,
  VideoIcon,
  type LucideIcon,
} from 'lucide-react';
import type { MailCategory } from '../../contracts/conversation';

/** Each mail type's icon: in the Mails list, and where the AI reading status lists job mails. */
export const MAIL_TYPE_ICON: Record<MailCategory, LucideIcon> = {
  RECRUITER: UserIcon,
  INTERVIEW: VideoIcon,
  ASSESSMENT: CodeIcon,
  OFFER: AwardIcon,
  REJECTION: CircleXIcon,
  FOLLOW_UP: MessageCircleIcon,
  NEWSLETTER: MailIcon,
  SPAM: MailIcon,
};
