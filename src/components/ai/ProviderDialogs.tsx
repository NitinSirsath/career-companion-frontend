import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, isApiError } from '../../api/client';
import type { AISettingsResponse } from '../../contracts/ai';
import { getCatalogProvider, type CatalogProvider } from '../../contracts/aiCatalog';
import {
  activatedNote,
  activeConnection,
  modelsLine,
  removeChoices,
  removedNote,
} from '../../lib/aiConnections';
import { providerName } from '../../lib/aiLabels';
import { keyReplacedNote } from '../../lib/aiProviderPage';
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
import { ApiKeyField, DataUseConsent, SaveProblemAlert } from './ProviderKeyFields';
import { useKeySave } from './useKeySave';

interface ProviderDialogProps {
  settings: AISettingsResponse;
  providerId: string;
  onClose: () => void;
  onDone: (note: string) => void;
}

/** What went wrong with an action that has no key: a refusal in the server's words, or unknown. */
function actionProblem(err: unknown): string {
  if (isApiError(err) && !err.outcomeUncertain) return err.message;
  return 'This could not be confirmed. The page shows what is saved now.';
}

/** The replace-key form of one provider. */
function ReplaceKeyForm({
  provider,
  needsConsent,
  onClose,
  onDone,
}: {
  provider: CatalogProvider;
  needsConsent: boolean;
  onClose: () => void;
  onDone: (note: string) => void;
}) {
  const [consent, setConsent] = useState(false);
  const name = provider.displayName;
  const { keyRef, pending, problem, submit } = useKeySave({
    provider,
    consentNeeded: needsConsent,
    consent,
    missingKey: `Paste your new ${name} API key.`,
    body: (apiKey) => ({
      apiKey,
      ...(needsConsent ? { consentDisclosure: provider.disclosure.version } : {}),
    }),
    note: (response) => keyReplacedNote(response, provider.id),
    onDone,
  });
  return (
    <form onSubmit={submit} aria-label={`Replace the ${name} key`} className="flex flex-col gap-5">
      <ApiKeyField
        id="ai-new-key"
        label="New API key"
        placeholder={`Paste your new ${name} API key`}
        inputRef={keyRef}
      />
      {needsConsent && (
        <DataUseConsent provider={provider} checked={consent} onCheckedChange={setConsent} />
      )}
      {problem && <SaveProblemAlert problem={problem} />}
      <DialogFooter className="mt-1">
        <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {pending ? 'Verifying…' : 'Save and verify'}
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * Only the key: "The saved key keeps working until the new one is verified." It asks again for
 * consent when the provider's data-use summary changed since the user agreed.
 */
export function ReplaceKeyDialog({ settings, providerId, onClose, onDone }: ProviderDialogProps) {
  const provider = getCatalogProvider(providerId);
  const connection = settings.connections.find((c) => c.provider === providerId);
  if (!provider) return null;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replace the {provider.displayName} key</DialogTitle>
          <DialogDescription>
            The saved key keeps working until the new one is verified.
          </DialogDescription>
        </DialogHeader>
        <ReplaceKeyForm
          provider={provider}
          needsConsent={connection?.consentCurrent === false}
          onClose={onClose}
          onDone={onDone}
        />
      </DialogContent>
    </Dialog>
  );
}

/** "Use Google Gemini for new mails?": what changes, and that the old provider stays connected. */
export function MakeActiveDialog({ settings, providerId, onClose, onDone }: ProviderDialogProps) {
  const queryClient = useQueryClient();
  const activate = useMutation({
    mutationFn: () => api.activateAIProvider(providerId),
    retry: false,
    onSuccess: (next) => {
      queryClient.setQueryData(['aiSettings'], next);
      if (next.waitingEmails > 0) startProcessingRefresh();
      onDone(activatedNote(next, providerId));
    },
    onError: () => queryClient.invalidateQueries({ queryKey: ['aiSettings'] }),
  });
  const name = providerName(providerId);
  const connection = settings.connections.find((c) => c.provider === providerId);
  const previous = activeConnection(settings);
  const waiting = settings.waitingEmails;
  const waitingNote = waiting
    ? ` ${waiting} waiting ${waiting === 1 ? 'mail goes' : 'mails go'} to ${name}.`
    : '';
  return (
    <Dialog open onOpenChange={(open) => !open && !activate.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Use {name} for new mails?</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2 text-sm">
          <p>
            From now on {name} reads new job mails
            {connection?.models ? ` with ${modelsLine(connection, ' and ')}` : ''}.
          </p>
          <p className="text-text-secondary">
            Mails already read stay as they are.{waitingNote}
            {previous &&
              ` ${providerName(previous.provider)} stays connected, so you can switch back at any time.`}
          </p>
        </div>
        {activate.isError && (
          <InlineNotification kind="error" className="mt-4">
            {actionProblem(activate.error)}
          </InlineNotification>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={activate.isPending}>
            Cancel
          </Button>
          <Button onClick={() => activate.mutate()} loading={activate.isPending}>
            Make {name} active
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * "Remove your OpenAI key?" For the active provider it asks which provider reads new mail next,
 * or none.
 */
export function RemoveProviderDialog({
  settings,
  providerId,
  onClose,
  onDone,
}: ProviderDialogProps) {
  const queryClient = useQueryClient();
  const choices = removeChoices(settings, providerId);
  const [then, setThen] = useState(choices[0]?.value ?? 'none');
  const isActive = activeConnection(settings)?.provider === providerId;
  const remove = useMutation({
    mutationFn: () => api.removeAIProvider(providerId, isActive ? then : undefined),
    retry: false,
    onSuccess: (next) => {
      queryClient.setQueryData(['aiSettings'], next);
      onDone(removedNote(next, providerId));
    },
    onError: () => queryClient.invalidateQueries({ queryKey: ['aiSettings'] }),
  });
  const name = providerName(providerId);
  return (
    <Dialog open onOpenChange={(open) => !open && !remove.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove your {name} key?</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm">
          <p>
            The key is deleted from Career Companion. You can also revoke it with {name}. Mails and
            applications already read stay.
          </p>
          {isActive && choices.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2">{name} reads your mail now. After removing it:</legend>
              {choices.map((choice) => (
                <label key={choice.value} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="ai-remove-then"
                    value={choice.value}
                    checked={then === choice.value}
                    onChange={() => setThen(choice.value)}
                    className="h-4 w-4 cursor-pointer"
                  />
                  {choice.label}
                </label>
              ))}
            </fieldset>
          )}
          {isActive && choices.length === 0 && (
            <p className="text-text-secondary">
              New emails will wait until you connect a provider again.
            </p>
          )}
        </div>
        {remove.isError && (
          <InlineNotification kind="error" className="mt-4">
            {actionProblem(remove.error)}
          </InlineNotification>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={remove.isPending}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => remove.mutate()} loading={remove.isPending}>
            {remove.isPending ? 'Removing…' : 'Remove key'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
