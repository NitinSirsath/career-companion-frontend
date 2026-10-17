import type { ApplicationActionListItem } from '../contracts/application';
import { repliedLine } from './mails';

export interface ActionState {
  label: string;
  /** `open` needs the user, `replied` waits for the user to mark it done, `closed` is finished. */
  tone: 'open' | 'replied' | 'closed';
  /** "You replied Today, 1:04 AM", for a replied action. */
  note: string | null;
}

/**
 * How an application's action stands. An action whose mail the user replied to shows "Replied",
 * as the mail does; the reply never finishes it.
 */
export function actionState(
  action: Pick<ApplicationActionListItem, 'status' | 'repliedAt'>,
): ActionState {
  if (action.status !== 'PENDING') return { label: action.status, tone: 'closed', note: null };
  if (action.repliedAt)
    return { label: 'Replied', tone: 'replied', note: repliedLine(action.repliedAt) };
  return { label: 'Needs action', tone: 'open', note: null };
}
