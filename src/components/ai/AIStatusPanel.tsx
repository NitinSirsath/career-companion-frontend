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
import { SettingsSection } from '../layout/SettingsSection';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { OverflowMenu, type MenuAction } from '../ui/menu';
import { InlineNotification } from '../ui/notification';
import { Tag } from '../ui/tag';
import { Emphasized } from './AIAccessNotice';
import { SampleTestPanel } from './SampleTestPanel';

const STATE_BADGE = {
  READY: { label: 'Ready', color: 'green' },
  NEEDS_ATTENTION: { label: 'Needs attention', color: 'red' },
  LIMITED: { label: 'Limited', color: 'yellow' },
  NOT_SET_UP: { label: 'Not set up', color: 'gray' },
} as const;
const NOT_CONFIRMED_BADGE = { label: 'Not confirmed', color: 'yellow' } as const;

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
        {state && <Tag color={state.tone === 'success' ? 'green' : 'yellow'}>{state.label}</Tag>}
      </div>
      {state?.why && <span className="text-xs text-text-secondary">{state.why}</span>}
    </dd>
  );
}

/** A key the provider has not confirmed yet, while AI can be used. */
function NotConfirmedNotice({ title, detail }: { title: string; detail: string }) {
  return (
    <InlineNotification kind="warning" title={title}>
      {detail}
    </InlineNotification>
  );
}

/** What stops or limits AI now, with the one fix, in the provider's own words where it gave any. */
function AccessNotice({ copy }: { copy: NonNullable<ReturnType<typeof accessCopy>> }) {
  return (
    <InlineNotification kind="warning" title={copy.title}>
      <span className="flex flex-col gap-1">
        <span>
          <Emphasized text={copy.detail} strong={copy.strong} />
        </span>
        {copy.hint && <span>{copy.hint}</span>}
        {copy.fix?.href && (
          <a className="text-link" href={copy.fix.href} target="_blank" rel="noopener noreferrer">
            {copy.fix.label}
          </a>
        )}
      </span>
    </InlineNotification>
  );
}

/** Asks before the key is removed: new mail then waits until AI is set up again. */
function RemoveDialog({
  name,
  open,
  onOpenChange,
}: {
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => api.removeAISettings(),
    retry: false,
    onSuccess: () => onOpenChange(false),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['aiSettings'] }),
  });
  return (
    <Dialog open={open} onOpenChange={(value) => !remove.isPending && onOpenChange(value)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove your {name} key?</DialogTitle>
        </DialogHeader>
        <p className="text-sm">
          New emails will wait until you set up AI again. Emails and applications already processed
          stay. You can also revoke the key with {name}.
        </p>
        {remove.isError && (
          <InlineNotification kind="error" className="mt-4">
            Removing could not be confirmed. The status shows what is saved now.
          </InlineNotification>
        )}
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={remove.isPending}
          >
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

/** The provider row: who reads the mail, whether it works, and what the user can do about it. */
function ProviderSection({
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
  const more: MenuAction[] = [
    ...(onSwitch ? [{ label: 'Switch provider', onSelect: onSwitch }] : []),
    { label: 'Remove provider…', danger: true, onSelect: () => setRemoving(true) },
  ];
  return (
    <SettingsSection title="Provider" help="Who reads your job mails.">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-3">
            <span className="text-xl leading-7">{name}</span>
            <Tag color={badge.color}>{badge.label}</Tag>
          </span>
          <span className="text-xs tracking-[0.32px] text-text-secondary">
            {settings.access.verified ? 'Key verified' : 'Key saved'}
            {settings.access.lastCheckedAt &&
              ` · last checked ${format(new Date(settings.access.lastCheckedAt), 'MMM d, h:mm a')}`}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="tertiary" onClick={() => check.mutate()} loading={check.isPending}>
            {check.isPending ? 'Checking…' : 'Check again'}
          </Button>
          <Button variant="secondary" onClick={onUpdate}>
            Change models or key
          </Button>
          <OverflowMenu label="More provider actions" size="icon" actions={more} />
        </div>
      </div>
      {notConfirmed && <NotConfirmedNotice {...notConfirmed} />}
      {copy && <AccessNotice copy={copy} />}
      {checkNote && (
        <p role="status" className="text-sm">
          {checkNote}
        </p>
      )}
      <RemoveDialog name={name} open={removing} onOpenChange={setRemoving} />
    </SettingsSection>
  );
}

/** How much Career Companion used today, against its own daily safeguard. */
function UsageSection({ settings }: { settings: AISettingsResponse }) {
  const name = providerName(settings.provider);
  const { usageToday: usage } = settings;
  const limit = settings.safetyLimit.callsPerDay;
  const share = limit > 0 ? Math.min(100, (usage.calls / limit) * 100) : 0;
  return (
    <SettingsSection
      title="Use today"
      help={`Career Companion's own daily limit keeps a mistake from using up your credit. It is not ${name}'s limit.`}
    >
      <div
        role="meter"
        aria-label="AI calls used today"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={usage.calls}
        className="h-1 max-w-100 bg-layer-accent"
      >
        <div
          className="h-full bg-link transition-[width] duration-240"
          style={{ width: `${share}%` }}
        />
      </div>
      <dl className="grid grid-cols-[112px_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        <dt className="text-text-secondary">Today</dt>
        <dd>
          Career Companion sent {usage.calls} AI {usage.calls === 1 ? 'call' : 'calls'} (
          {usage.inputTokens.toLocaleString()} input / {usage.outputTokens.toLocaleString()} output
          tokens). Our own count, not your {name} bill.
        </dd>
        <dt className="text-text-secondary">Safety limit</dt>
        <dd>
          {limit} AI calls a day: Career Companion&apos;s safeguard, not {name}&apos;s quota.
        </dd>
      </dl>
    </SettingsSection>
  );
}

/** The configured AI provider: status with one fix, models, our own counts, and a sample test. */
export function AIStatusPanel({
  settings,
  onUpdate,
  onSwitch,
}: {
  settings: AISettingsResponse;
  onUpdate: () => void;
  onSwitch?: () => void;
}) {
  const { models } = settings;
  const name = providerName(settings.provider);
  return (
    <div aria-label="AI provider status" role="group" className="flex flex-col">
      <ProviderSection settings={settings} onUpdate={onUpdate} onSwitch={onSwitch} />
      <SettingsSection
        title="Models"
        help="A fast model sorts new mail; a detailed model reads each job mail."
      >
        <dl className="grid grid-cols-[136px_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
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
          {settings.waitingEmails > 0 && (
            <>
              <dt className="text-text-secondary">Waiting</dt>
              <dd>{waitingText(settings)}</dd>
            </>
          )}
        </dl>
      </SettingsSection>
      <UsageSection settings={settings} />
      {settings.provider && (
        <SettingsSection title="Try it" help="Check the whole setup on a sample mail.">
          <SampleTestPanel providerId={settings.provider} providerName={name} />
        </SettingsSection>
      )}
    </div>
  );
}
