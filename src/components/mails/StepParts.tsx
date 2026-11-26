import { CalendarIcon } from 'lucide-react';
import type { ConversationDetail, ConversationRequest } from '../../contracts/conversation';
import { modelName } from '../../lib/aiLabels';
import { dueIn } from '../../lib/mailThread';
import { CLOSED_REASON_LABEL, mailDateTime, requestDetail, requestPastDue } from '../../lib/mails';
import { missedLine } from '../../lib/missed';
import { cn } from '../../lib/utils';
import { TodoState } from './TodoState';

/** When an open request is due, in red once it is past due. A missed one says so in its state. */
export function StepDue({ asked }: { asked: ConversationRequest }) {
  if (asked.state !== 'OPEN' || asked.missed || !asked.deadline) return null;
  const pastDue = requestPastDue(asked);
  return (
    <p className={cn('flex items-center gap-2 text-sm', pastDue && 'text-danger-text')}>
      <CalendarIcon size={16} aria-hidden="true" />
      {requestDetail(asked)}
      <span className={cn('text-xs', !pastDue && 'text-text-secondary')}>
        {dueIn(asked.deadline, new Date())}
      </span>
    </p>
  );
}

/**
 * Where the request stands: its state, with when the user replied or why it closed. A missed one
 * is one grey line: "Missed · was due Nov 17, 2026 11:00 AM".
 */
export function StepState({ asked, fake }: { asked: ConversationRequest; fake: boolean }) {
  if (asked.missed)
    return <p className="text-[13px] leading-[18px] text-text-secondary">{missedLine(asked)}</p>;
  const replied = asked.state === 'REPLIED' && requestDetail(asked);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <TodoState state={asked.state} fakeOffer={fake} />
      {replied && <span className="text-xs text-text-secondary">{replied}</span>}
      {asked.state === 'DONE' && asked.closedReason && (
        <span className="text-xs text-text-secondary">
          {CLOSED_REASON_LABEL[asked.closedReason]}
          {asked.closedAt && ` · ${mailDateTime(asked.closedAt)}`}
        </span>
      )}
    </div>
  );
}

/** "GPT-6 Luna · Reading your reply", in the app's grey AI look, while the AI reads the reply. */
export function ReadingReply({ detail }: { detail: ConversationDetail }) {
  const { analyzedBy, request } = detail.conversation;
  if (request?.state !== 'REPLIED' || request.replyRead !== 'WAITING') return null;
  return (
    <p className="flex items-center gap-1.5 text-xs">
      <span className="text-text-secondary">
        {analyzedBy ? modelName(analyzedBy.provider, analyzedBy.model) : 'AI'} ·
      </span>
      <span className="ai-shimmer">Reading your reply</span>
    </p>
  );
}
