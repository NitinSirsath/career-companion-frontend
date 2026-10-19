import { Checkmark, Reply } from '@carbon/icons-react';
import type { RequestState } from '../../contracts/conversation';
import { REQUEST_STATE_LABEL } from '../../lib/mails';
import { Tag } from '../ui/tag';

/**
 * Where the user's to-do stands. Only "Needs action" gets colour, because only it asks for
 * attention; replied and done read as an icon and a word.
 */
export function TodoState({ state }: { state: RequestState }) {
  if (state === 'OPEN') return <Tag color="yellow">{REQUEST_STATE_LABEL.OPEN}</Tag>;
  const Icon = state === 'REPLIED' ? Reply : Checkmark;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs tracking-[0.32px] text-text-primary">
      <Icon size={16} aria-hidden="true" />
      {REQUEST_STATE_LABEL[state]}
    </span>
  );
}
