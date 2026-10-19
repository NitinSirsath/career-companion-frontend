import type { SandboxMailState as State } from '../../contracts/sandbox';
import { MAIL_STATE_LABEL, MAIL_STATE_COLOR } from '../../lib/sandbox';
import { Tag } from '../ui/tag';

/** What the app did with a sandbox mail, as a mark. */
export function SandboxMailState({ state }: { state: State }) {
  return <Tag color={MAIL_STATE_COLOR[state]}>{MAIL_STATE_LABEL[state]}</Tag>;
}
