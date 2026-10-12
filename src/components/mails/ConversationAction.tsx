import { useSetRequestState } from '../../api/conversations';
import type { Conversation } from '../../contracts/conversation';
import {
  REQUEST_STATE_LABEL,
  REQUEST_STATE_VARIANT,
  requestControls,
  requestDetail,
  requestTitle,
  scheduleLine,
} from '../../lib/mails';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

interface ConversationActionProps {
  conversation: Conversation;
  /** The details page: also lets a request the user replied to be marked done. */
  detailed?: boolean;
  /** False where the action is only shown, such as on the application page. */
  controls?: boolean;
}

/** What a conversation needs from the user, where that stands, and the buttons to change it. */
export function ConversationAction({
  conversation,
  detailed = false,
  controls = true,
}: ConversationActionProps) {
  const change = useSetRequestState(conversation.key);
  const asked = conversation.request;
  if (!asked) {
    const schedule = scheduleLine(conversation);
    return schedule ? (
      <p className="text-sm font-semibold break-words">{schedule}</p>
    ) : (
      <p className="text-sm text-text-secondary">Nothing needed</p>
    );
  }
  const title = requestTitle(asked);
  const detail = requestDetail(asked);
  return (
    <div className="space-y-2">
      <p
        className={cn(
          'text-sm font-semibold break-words',
          asked.state === 'DONE' && 'text-text-secondary',
        )}
      >
        {title}
      </p>
      <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
        <Badge variant={REQUEST_STATE_VARIANT[asked.state]}>
          {REQUEST_STATE_LABEL[asked.state]}
        </Badge>
        {detail && <span>{detail}</span>}
      </div>
      {controls && (
        <div className="flex flex-wrap gap-2">
          {requestControls(asked.state, detailed).map((control) => (
            <Button
              key={control.label}
              variant="tertiary"
              size="sm"
              aria-label={`${control.label}: ${title}`}
              disabled={change.isPending}
              onClick={() => change.mutate({ emailId: asked.emailId, state: control.state })}
            >
              {control.label}
            </Button>
          ))}
        </div>
      )}
      {detailed && asked.state === 'REPLIED' && (
        <p className="text-xs text-text-secondary">
          We saw that you replied. We do not read what you wrote.
        </p>
      )}
      {change.isError && (
        <p role="alert" className="text-xs text-status-error">
          Could not update: {change.error.message}
        </p>
      )}
    </div>
  );
}
