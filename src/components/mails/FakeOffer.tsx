import { WarningAlt } from '@carbon/icons-react';
import { FAKE_OFFER } from '../../lib/mails';
import { InlineNotification } from '../ui/notification';
import { Tag } from '../ui/tag';

/** "Probably fake": the AI thinks the mail is a fake job offer that asks for money. */
export function FakeOfferTag() {
  return (
    <Tag color="yellow">
      <WarningAlt size={12} aria-hidden="true" />
      {FAKE_OFFER.tag}
    </Tag>
  );
}

/**
 * The warning above a fake-offer conversation: the AI's reason and what to do. A warning, not an
 * error, and it cannot be hidden: the AI can be wrong, so the mail stays and the user decides.
 */
export function FakeOfferNotice({ reason }: { reason: string }) {
  return (
    <InlineNotification kind="warning" title={FAKE_OFFER.title}>
      <p className="mt-1 break-words">{reason}</p>
      <p className="mt-1">{FAKE_OFFER.advice}</p>
      <p className="mt-2 text-xs text-text-secondary">{FAKE_OFFER.note}</p>
    </InlineNotification>
  );
}
