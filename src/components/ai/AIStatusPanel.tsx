import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { api } from '../../api/client';
import type { AISettingsResponse, CheckAISettingsResponse } from '../../contracts/ai';
import { accessCopy, modelName, providerName } from '../../lib/aiLabels';
import {
  checkNoteShown,
  modelState,
  notAffected,
  notConfirmedNotice,
  waitingText,
} from '../../lib/aiProviderPage';
import { startProcessingRefresh } from '../../lib/processingRefresh';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Emphasized } from './AIAccessNotice';
import { SampleTestPanel } from './SampleTestPanel';

const STATE_BADGE = {
  READY: { label: 'Ready', variant: 'success' },
  NEEDS_ATTENTION: { label: 'Needs attention', variant: 'destructive' },
  LIMITED: { label: 'Limited', variant: 'warning' },
  NOT_SET_UP: { label: 'Not set up', variant: 'secondary' },
} as const;
const NOT_CONFIRMED_BADGE = { label: 'Not confirmed', variant: 'warning' } as const;

const SOURCE_NOTE = {
  RECOMMENDED: ' (recommended)',
  SELECTED: '',
  REPLACED_RETIRED: ' (your chosen model was retired; using the recommended one)',
} as const;

type ModelInUse = NonNullable<AISettingsResponse['models']>['fast'];

/** One model of the setup: its name, and whether it works or is paused, why and until when. */
function ModelRow({ settings, model }: { settings: AISettingsResponse; model: ModelInUse }) {
  const state = modelState(settings, model.id);
  return (
    <dd className="flex flex-col gap-0.5">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span>
          {modelName(settings.provider, model.id)}
          {SOURCE_NOTE[model.source]}
        </span>
        {state && <Badge variant={state.tone}>{state.label}</Badge>}
      </div>
      {state?.why && <span className="text-xs text-text-secondary">{state.why}</span>}
    </dd>
  );
}

/** A key the provider has not confirmed yet, while AI can be used. */
function NotConfirmedNotice({ title, detail }: { title: string; detail: string }) {
  return (
    <div
      role="status"
      className="border border-status-warning bg-status-warning-subtle p-3 text-sm space-y-1"
    >
      <p className="font-medium">{title}</p>
      <p>{detail}</p>
    </div>
  );
}

/** The configured AI provider: status with one fix, models, our own counts, and actions. */
export function AIStatusPanel({
  settings,
  onUpdate,
  onSwitch,
}: {
  settings: AISettingsResponse;
  onUpdate: () => void;
  onSwitch?: () => void;
}) {
  const queryClient = useQueryClient();
  const [lastCheck, setLastCheck] = useState<CheckAISettingsResponse | null>(null);
  const [checkFailed, setCheckFailed] = useState(false);
  const [removing, setRemoving] = useState(false);
  const name = providerName(settings.provider);
  const copy = accessCopy(settings, notAffected(settings));
  const notConfirmed = notConfirmedNotice(settings, lastCheck);
  const badge = notConfirmed ? NOT_CONFIRMED_BADGE : STATE_BADGE[settings.access.state];
  const checkNote = checkNoteShown(lastCheck, checkFailed, notConfirmed !== null);

  // No key is involved, so ordinary mutations are fine here.
  const check = useMutation({
    mutationFn: () => api.checkAISettings(),
    retry: false,
    onSuccess: (response) => {
      const { verification, ...next } = response;
      queryClient.setQueryData(['aiSettings'], next);
      if (verification === 'VERIFIED' && next.waitingEmails > 0) startProcessingRefresh();
      setCheckFailed(false);
      setLastCheck(response);
    },
    onError: () => {
      setCheckFailed(true);
      queryClient.invalidateQueries({ queryKey: ['aiSettings'] });
    },
  });
  const remove = useMutation({
    mutationFn: () => api.removeAISettings(),
    retry: false,
    onSuccess: () => setRemoving(false),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['aiSettings'] }),
  });

  const { usageToday: usage, models } = settings;
  return (
    <section
      aria-label="AI provider status"
      className="border border-border-default bg-surface p-6 space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{name}</h3>
          <p className="text-sm text-text-secondary">
            {settings.access.verified ? 'Key verified' : 'Key saved'}
            {settings.access.lastCheckedAt &&
              ` · last checked ${format(new Date(settings.access.lastCheckedAt), 'MMM d, h:mm a')}`}
          </p>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      {notConfirmed && <NotConfirmedNotice {...notConfirmed} />}

      {copy && (
        <div
          role="status"
          className="border border-status-warning bg-status-warning-subtle p-3 text-sm space-y-1"
        >
          <p className="font-medium">{copy.title}</p>
          <p>
            <Emphasized text={copy.detail} strong={copy.strong} />
          </p>
          {copy.hint && <p>{copy.hint}</p>}
          {copy.fix?.href && (
            <a className="underline" href={copy.fix.href} target="_blank" rel="noopener noreferrer">
              {copy.fix.label}
            </a>
          )}
        </div>
      )}

      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-text-secondary">API key</dt>
        <dd>Saved (hidden)</dd>
        {models && (
          <>
            <dt className="text-text-secondary">Fast screening</dt>
            <ModelRow settings={settings} model={models.fast} />
            <dt className="text-text-secondary">Detailed analysis</dt>
            <ModelRow settings={settings} model={models.detailed} />
          </>
        )}
        <dt className="text-text-secondary">Today</dt>
        <dd>
          Career Companion sent {usage.calls} AI {usage.calls === 1 ? 'call' : 'calls'} (
          {usage.inputTokens.toLocaleString()} input / {usage.outputTokens.toLocaleString()} output
          tokens). Our own count, not your {name} bill.
        </dd>
        <dt className="text-text-secondary">Safety limit</dt>
        <dd>
          {settings.safetyLimit.callsPerDay} AI calls a day: Career Companion&apos;s safeguard, not{' '}
          {name}&apos;s quota.
        </dd>
        {settings.waitingEmails > 0 && (
          <>
            <dt className="text-text-secondary">Waiting</dt>
            <dd>{waitingText(settings)}</dd>
          </>
        )}
      </dl>

      {checkNote && (
        <p role="status" className="text-sm">
          {checkNote}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={() => check.mutate()} disabled={check.isPending}>
          {check.isPending ? 'Checking…' : 'Check again'}
        </Button>
        <Button variant="tertiary" onClick={onUpdate}>
          Change models or key
        </Button>
        {onSwitch && (
          <Button variant="tertiary" onClick={onSwitch}>
            Switch provider
          </Button>
        )}
        <Button variant="danger" onClick={() => setRemoving(true)}>
          Remove
        </Button>
      </div>

      {settings.provider && <SampleTestPanel providerId={settings.provider} providerName={name} />}

      <Dialog open={removing} onOpenChange={setRemoving}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove your {name} key?</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            New emails will wait until you set up AI again. Emails and applications already
            processed stay. You can also revoke the key with {name}.
          </p>
          {remove.isError && (
            <p role="alert" className="text-sm text-status-error">
              Removing could not be confirmed. The status shows what is saved now.
            </p>
          )}
          <DialogFooter>
            <Button
              variant="tertiary"
              onClick={() => setRemoving(false)}
              disabled={remove.isPending}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={() => remove.mutate()} disabled={remove.isPending}>
              {remove.isPending ? 'Removing…' : 'Remove key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
