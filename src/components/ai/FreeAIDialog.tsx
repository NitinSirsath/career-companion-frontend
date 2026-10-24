import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, isApiError } from '../../api/client';
import { FREE_AI, FREE_AI_CONSENT, FREE_AI_FACTS } from '../../lib/freeAI';
import { settingsOf } from '../../lib/aiProviderPage';
import { startProcessingRefresh } from '../../lib/processingRefresh';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { InlineNotification } from '../ui/notification';
import { CheckRow } from './ProviderKeyFields';

/**
 * "Use Career Companion free AI?": what is sent and through whose account, that it is shared, its
 * daily limit and its budget. Nothing is sent before the user ticks "I agree". It becomes the
 * provider that reads the mail; one connected before stays connected.
 */
export function FreeAIDialog({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (note: string) => void;
}) {
  const queryClient = useQueryClient();
  const [agreed, setAgreed] = useState(false);
  const connect = useMutation({
    mutationFn: () =>
      api.saveAIProvider(FREE_AI, { consentDisclosure: FREE_AI_CONSENT, makeActive: true }),
    retry: false,
    onSuccess: (response) => {
      const next = settingsOf(response);
      queryClient.setQueryData(['aiSettings'], next);
      if (next.waitingEmails > 0) startProcessingRefresh();
      onDone('Career Companion free AI reads your mail now.');
    },
    onError: () => queryClient.invalidateQueries({ queryKey: ['aiSettings'] }),
  });
  return (
    <Dialog open onOpenChange={(open) => !open && !connect.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Use Career Companion free AI?</DialogTitle>
          <DialogDescription>Free for you. Career Companion pays for it.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 text-sm">
          <dl className="grid gap-x-4 gap-y-2.5 sm:grid-cols-[110px_1fr]">
            {FREE_AI_FACTS.map((fact) => (
              <div key={fact.term} className="contents">
                <dt className="text-text-secondary">{fact.term}</dt>
                <dd className="mb-2 sm:mb-0">{fact.text}</dd>
              </div>
            ))}
          </dl>
          <CheckRow id="free-ai-agree" checked={agreed} onCheckedChange={setAgreed}>
            I agree that my mails are sent to OpenRouter as described above.
          </CheckRow>
        </div>
        {connect.isError && (
          <InlineNotification kind="error" className="mt-4">
            {isApiError(connect.error) && !connect.error.outcomeUncertain
              ? connect.error.message
              : 'This could not be confirmed. The page shows what is saved now.'}
          </InlineNotification>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={connect.isPending}>
            Cancel
          </Button>
          <Button onClick={() => connect.mutate()} disabled={!agreed} loading={connect.isPending}>
            Use free AI
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
