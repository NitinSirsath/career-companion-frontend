import { CheckIcon, ReplyIcon } from 'lucide-react';
import type { RequestState } from '../../contracts/conversation';
import { REQUEST_STATE_LABEL } from '../../lib/mails';
import { MISSED } from '../../lib/missed';
import { Tag } from '../ui/tag';
import { FakeOfferTag } from './FakeOffer';

/**
 * Where the user's to-do stands. Only "Needs action" gets colour, because only it asks for
 * attention; replied and done read as an icon and a word. An open step of a fake offer shows
 * "Probably fake" instead, since the step is the app's own advice. A missed one is a grey word.
 */
export function TodoState({
  state,
  fakeOffer = false,
  missed = false,
}: {
  state: RequestState;
  fakeOffer?: boolean;
  missed?: boolean;
}) {
  if (state === 'OPEN' && fakeOffer) return <FakeOfferTag />;
  if (state === 'OPEN' && missed)
    return <span className="text-xs text-text-tertiary">{MISSED.label}</span>;
  if (state === 'OPEN') return <Tag color="yellow">{REQUEST_STATE_LABEL.OPEN}</Tag>;
  const Icon = state === 'REPLIED' ? ReplyIcon : CheckIcon;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-text-primary">
      <Icon size={16} aria-hidden="true" />
      {REQUEST_STATE_LABEL[state]}
    </span>
  );
}
