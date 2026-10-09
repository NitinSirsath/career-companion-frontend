import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { api } from '../../api/client';
import type { AISettingsResponse } from '../../contracts/ai';
import { accessCopy, modelName, providerName } from '../../lib/aiLabels';
import { startProcessingRefresh } from '../../lib/processingRefresh';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { SampleTestPanel } from './SampleTestPanel';

const STATE_BADGE = {
  READY: { label: 'Ready', variant: 'success' },
  NEEDS_ATTENTION: { label: 'Needs attention', variant: 'destructive' },
  LIMITED: { label: 'Limited', variant: 'warning' },
  NOT_SET_UP: { label: 'Not set up', variant: 'secondary' },
} as const;

const SOURCE_NOTE = {
  RECOMMENDED: ' (recommended)',
  SELECTED: '',
  REPLACED_RETIRED: ' (your chosen model was retired; using the recommended one)',
} as const;

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
  const [checkNote, setCheckNote] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const name = providerName(settings.provider);
  const copy = accessCopy(settings);
  const badge = STATE_BADGE[settings.access.state];

  // No key is involved, so ordinary mutations are fine here.
  const check = useMutation({
    mutationFn: () => api.checkAISettings(),
    retry: false,
    onSuccess: ({ verification, ...next }) => {
      queryClient.setQueryData(['aiSettings'], next);
      if (verification === 'VERIFIED' && next.waitingEmails > 0) startProcessingRefresh();
      setCheckNote(
        verification === 'VERIFIED'
          ? `${name} confirmed your key and models.`
          : verification === 'INCONCLUSIVE'
            ? `${name} did not confirm right now. Try again later.`
            : null,
      );
    },
    onError: () => {
      setCheckNote('The check could not be completed.');
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
            {settings.access.verified
              ? 'Key verified'
              : 'Key saved, not yet confirmed by the provider'}
            {settings.access.lastCheckedAt &&
              ` · last checked ${format(new Date(settings.access.lastCheckedAt), 'MMM d, h:mm a')}`}
          </p>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      {copy && (
        <div
          role="status"
          className="border border-status-warning bg-status-warning-subtle p-3 text-sm space-y-1"
        >
          <p className="font-medium">{copy.title}</p>
          <p>{copy.detail}</p>
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
            <dd>
              {modelName(settings.provider, models.fast.id)}
              {SOURCE_NOTE[models.fast.source]}
            </dd>
            <dt className="text-text-secondary">Detailed analysis</dt>
            <dd>
              {modelName(settings.provider, models.detailed.id)}
              {SOURCE_NOTE[models.detailed.source]}
            </dd>
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
            <dd>
              {settings.waitingEmails} {settings.waitingEmails === 1 ? 'email' : 'emails'} waiting
              for AI.{' '}
              <Link to="/gmail" className="underline">
                Sync Gmail
              </Link>{' '}
              to continue.
            </dd>
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
