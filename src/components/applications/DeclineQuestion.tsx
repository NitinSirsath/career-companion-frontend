import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type {
  DeclineAnswerRequest,
  DeclineQuestion as Question,
} from '../../contracts/application';
import { applyAcknowledgedApplication, applicationKey } from '../../lib/applicationCache';
import { DECLINE_QUESTION, declineNote } from '../../lib/declineQuestion';
import { isOfflineError } from '../../lib/offline';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { InlineNotification } from '../ui/notification';
import { showToast } from '../ui/toast';

function useDeclineAnswer(applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: (body: DeclineAnswerRequest) => api.answerDecline(applicationId, body),
    onSuccess: (result, body) => {
      applyAcknowledgedApplication(queryClient, result);
      for (const queryKey of [
        applicationKey(applicationId),
        ['applications'],
        ['application-actions'],
        ['conversations'],
        ['workspace'],
      ])
        void queryClient.invalidateQueries({ queryKey });
      showToast(body.answer === 'CLOSE' ? 'Application closed' : 'Kept open');
    },
  });
}

/**
 * "Close the application?" after the user's reply said they no longer want the job (owner, 17 Nov
 * 2026): on the mail page's Application card and on the application page.
 */
export function DeclineQuestion({
  applicationId,
  decline,
  divider = true,
}: {
  applicationId: string;
  decline: Question;
  /** A line above it, inside a card; the application page has its own line already. */
  divider?: boolean;
}) {
  const answer = useDeclineAnswer(applicationId);
  const send = (value: DeclineAnswerRequest['answer']) => answer.mutate({ answer: value });
  return (
    <div className={cn('flex flex-col gap-2', divider && 'border-t border-border-subtle pt-3')}>
      <p className="text-sm">{DECLINE_QUESTION}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" loading={answer.isPending} onClick={() => send('CLOSE')}>
          Close it
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={answer.isPending}
          onClick={() => send('KEEP_OPEN')}
        >
          Keep open
        </Button>
      </div>
      <p className="text-xs text-text-secondary">{declineNote(decline)}</p>
      {answer.isError && !isOfflineError(answer.error) && (
        <InlineNotification kind="error">Could not save: {answer.error.message}</InlineNotification>
      )}
    </div>
  );
}
