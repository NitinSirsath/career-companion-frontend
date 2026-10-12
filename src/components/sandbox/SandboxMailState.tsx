import type { SandboxMailState as State } from '../../contracts/sandbox';
import { MAIL_STATE_LABEL, MAIL_STATE_VARIANT } from '../../lib/sandbox';
import { Badge } from '../ui/badge';

/** What the app did with a sandbox mail, as a mark. */
export function SandboxMailState({ state }: { state: State }) {
  return <Badge variant={MAIL_STATE_VARIANT[state]}>{MAIL_STATE_LABEL[state]}</Badge>;
}
