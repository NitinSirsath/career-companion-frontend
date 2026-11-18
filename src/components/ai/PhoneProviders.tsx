import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckIcon } from 'lucide-react';
import { api } from '../../api/client';
import type { AIConnection, AISettingsResponse } from '../../contracts/ai';
import { AI_ROLES } from '../../contracts/aiCatalog';
import {
  activeConnection,
  canActivate,
  canConnectMore,
  connectionTag,
  inactiveCheckNote,
  inactiveConnections,
  keyLine,
  ROLE_LABELS,
} from '../../lib/aiConnections';
import { modelName, providerName } from '../../lib/aiLabels';
import {
  checkNoteShown,
  notConfirmedNotice,
  settingsOf,
  waitingText,
} from '../../lib/aiProviderPage';
import {
  FREE_AI,
  FREE_AI_BANNER,
  FREE_AI_LIMIT_NOTE,
  FREE_AI_NOTE,
  freeAIBackupOffered,
  freeAIOffered,
  isFreeAI,
} from '../../lib/freeAI';
import { cn } from '../../lib/utils';
import { PlainRow, PlainSection } from '../phone/PlainList';
import { InlineNotification } from '../ui/notification';
import { Sheet, SheetAction, SheetGroup } from '../ui/sheet';
import { AccessProblem, type ProviderActions } from './ActiveProviderCard';
import { useKeyCheck } from './useKeyCheck';
import { FreeAIWait } from './FreeAICard';
import { ModelChoice } from './ModelChoice';
import { FirstProvider, ProvidersBody } from './ProvidersPageParts';
import { SampleTestPanel } from './SampleTestPanel';

/** The grey line under a provider: the free AI's note, or its key's state and the tag's words. */
function connectionLine(connection: AIConnection) {
  const tag = connectionTag(connection).label;
  if (isFreeAI(connection.provider)) return `${FREE_AI_NOTE} · ${tag}`;
  return `${keyLine(connection)} · ${tag}`;
}

/** A connected provider that does not read the mail: its actions in a sheet. */
function OtherSheet({
  connection,
  actions,
  onClose,
}: {
  connection: AIConnection;
  actions: ProviderActions;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const name = providerName(connection.provider);
  const free = isFreeAI(connection.provider);
  const check = useMutation({
    mutationFn: () => api.checkAIProvider(connection.provider),
    retry: false,
    onSuccess: (response) => {
      queryClient.setQueryData(['aiSettings'], settingsOf(response));
      actions.onNote(inactiveCheckNote(response, connection.provider));
      onClose();
    },
    onError: () => {
      actions.onNote(`The check of ${name} could not be completed.`);
      queryClient.invalidateQueries({ queryKey: ['aiSettings'] });
      onClose();
    },
  });
  const then = (run: () => void) => () => {
    onClose();
    run();
  };
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()} title={name}>
      <SheetGroup label={`Actions for ${name}`}>
        <SheetAction
          disabled={!canActivate(connection)}
          onClick={then(() => actions.onActivate(connection.provider))}
        >
          Make active
        </SheetAction>
        {!free && (
          <SheetAction disabled={check.isPending} onClick={() => check.mutate()}>
            {check.isPending ? 'Checking the key…' : 'Check key'}
          </SheetAction>
        )}
        {!free && (
          <SheetAction onClick={then(() => actions.onReplaceKey(connection.provider))}>
            Replace key
          </SheetAction>
        )}
        <SheetAction danger onClick={then(() => actions.onRemove(connection.provider))}>
          Remove…
        </SheetAction>
      </SheetGroup>
    </Sheet>
  );
}

/** The providers: the one that reads the mail with a check, the others, the backup, Connect. */
function Providers({
  settings,
  actions,
  onConnect,
}: {
  settings: AISettingsResponse;
  actions: ProviderActions;
  onConnect: () => void;
}) {
  const [open, setOpen] = useState<AIConnection | null>(null);
  const active = activeConnection(settings);
  const others = inactiveConnections(settings);
  return (
    <PlainSection
      label="Reads your mails"
      className="mt-0"
      note="Connected and checked. One reads your mail; make another active to switch at once."
    >
      {active && (
        <PlainRow
          detail={isFreeAI(active.provider) ? connectionLine(active) : keyLine(settings.access)}
          end={<CheckIcon size={20} aria-label="Reads your mail" className="text-accent" />}
        >
          {providerName(active.provider)}
        </PlainRow>
      )}
      {others.map((connection) => (
        <PlainRow
          key={connection.provider}
          detail={connectionLine(connection)}
          onClick={() => setOpen(connection)}
          chevron
        >
          {providerName(connection.provider)}
        </PlainRow>
      ))}
      {freeAIBackupOffered(settings) && (
        <PlainRow
          detail={FREE_AI_NOTE}
          end={
            <button
              type="button"
              onClick={actions.onAddFreeAI}
              className="cursor-pointer text-[14.5px] font-semibold text-link"
            >
              Add as backup
            </button>
          }
        >
          {providerName(FREE_AI)}
        </PlainRow>
      )}
      {canConnectMore(settings) && (
        <PlainRow onClick={onConnect} tone="blue">
          Connect a provider
        </PlainRow>
      )}
      {open && <OtherSheet connection={open} actions={actions} onClose={() => setOpen(null)} />}
    </PlainSection>
  );
}

/** What stops or limits the provider that reads the mail, with its one fix. */
function Notices({
  settings,
  actions,
  onConnect,
  notConfirmed,
  checkNote,
}: {
  settings: AISettingsResponse;
  actions: ProviderActions;
  onConnect: () => void;
  notConfirmed: ReturnType<typeof notConfirmedNotice>;
  checkNote: string | null | false;
}) {
  const active = activeConnection(settings);
  if (!active)
    return (
      <InlineNotification kind="error" title="No provider reads your mail.">
        New mails wait. Make a connected provider active, or connect a new one.
      </InlineNotification>
    );
  if (isFreeAI(active.provider))
    return settings.access.state === 'READY' ? null : (
      <FreeAIWait settings={settings} onConnectOwn={onConnect} />
    );
  return (
    <>
      {notConfirmed && (
        <InlineNotification kind="warning" title={notConfirmed.title}>
          {notConfirmed.detail}
        </InlineNotification>
      )}
      <AccessProblem settings={settings} actions={actions} />
      {checkNote && (
        <p role="status" className="px-0.5 text-[15px]">
          {checkNote}
        </p>
      )}
    </>
  );
}

/** The two models: changed in place for an own key, fixed on the free AI. */
function Models({
  settings,
  connection,
  onNote,
}: {
  settings: AISettingsResponse;
  connection: AIConnection;
  onNote: (note: string) => void;
}) {
  const free = isFreeAI(connection.provider);
  return (
    <PlainSection
      label="Models"
      note={
        settings.waitingEmails > 0
          ? waitingText(settings)
          : free && <>The free AI is shared by everyone, {FREE_AI_BANNER}</>
      }
    >
      {free
        ? AI_ROLES.map((role) => (
            <PlainRow
              key={role}
              detail="Fixed on the free AI"
              value={modelName(FREE_AI, connection.models?.[role].id ?? null)}
            >
              {ROLE_LABELS[role]}
            </PlainRow>
          ))
        : AI_ROLES.map((role) => (
            <ModelChoice key={role} settings={settings} role={role} onSaved={onNote} phone />
          ))}
    </PlainSection>
  );
}

/** Today's AI calls against NorthList's own daily limit. */
function Today({ settings }: { settings: AISettingsResponse }) {
  const { usageToday: usage } = settings;
  const free = isFreeAI(settings.provider);
  return (
    <PlainSection
      label="Today"
      note={
        free
          ? FREE_AI_LIMIT_NOTE
          : `${usage.inputTokens.toLocaleString()} input / ${usage.outputTokens.toLocaleString()} output tokens. NorthList's own count and daily safety limit, for all providers together. Not your ${providerName(settings.provider)} bill or quota.`
      }
    >
      <PlainRow value={`${usage.calls} of ${settings.safetyLimit.callsPerDay}`}>AI calls</PlainRow>
    </PlainSection>
  );
}

/** The free AI's own wording when nothing is connected yet: two ways to read the mail. */
function ChooseHowToRead({
  gmailConnected,
  onConnectOwn,
  onUseFreeAI,
}: {
  gmailConnected: boolean;
  onConnectOwn: () => void;
  onUseFreeAI: () => void;
}) {
  return (
    <>
      {gmailConnected && (
        <InlineNotification kind="success">
          Gmail is connected. One more step: choose how your mails are read.
        </InlineNotification>
      )}
      <PlainSection
        label="Choose how your mails are read"
        className="mt-0"
        note="New mails wait until one of these reads them. You can change this any time."
      >
        <PlainRow
          onClick={onConnectOwn}
          chevron
          detail="Recommended. Fastest: your mails go to your own OpenRouter account, and nobody else shares its limits. About 5 minutes to set up; about $0.10 for 1,000 mails with GPT-6 Luna. You can choose the models."
        >
          Use your own AI key
        </PlainRow>
        <PlainRow
          onClick={onUseFreeAI}
          chevron
          detail="Free, runs on OpenRouter, ready in one click. Shared by everyone, so it can be slow sometimes: about 200 mails a day, and it can pause for a few minutes. Mails wait and are never lost."
        >
          NorthList free AI
        </PlainRow>
      </PlainSection>
    </>
  );
}

/**
 * AI providers on phones (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` screen 10): the same layout
 * as Gmail sync. The provider in use has a check; a tap on another opens its actions. Then the
 * models, the key, today's use and the sample test; Remove comes last, in red.
 */
export function PhoneProvidersBody({
  settings,
  actions,
  gmailConnected,
  onConnect,
  onConnectFirst,
}: {
  settings: AISettingsResponse;
  actions: ProviderActions;
  gmailConnected: boolean;
  onConnect: () => void;
  onConnectFirst: (providerId: string) => void;
}) {
  const active = activeConnection(settings);
  const keyCheck = useKeyCheck(active?.provider ?? '');
  if (!settings.connections.length)
    return freeAIOffered(settings) ? (
      <ChooseHowToRead
        gmailConnected={gmailConnected}
        onConnectOwn={onConnect}
        onUseFreeAI={actions.onUseFreeAI}
      />
    ) : (
      <FirstProvider settings={settings} onChoose={onConnectFirst} />
    );
  const free = !!active && isFreeAI(active.provider);
  const notConfirmed = free ? null : notConfirmedNotice(settings, keyCheck.lastCheck);
  const checkNote = checkNoteShown(keyCheck.lastCheck, keyCheck.failed, notConfirmed !== null);
  return (
    <div className="flex flex-col gap-3">
      <Notices
        settings={settings}
        actions={actions}
        onConnect={onConnect}
        notConfirmed={notConfirmed}
        checkNote={checkNote}
      />
      <Providers settings={settings} actions={actions} onConnect={onConnect} />
      {active && <Models settings={settings} connection={active} onNote={actions.onNote} />}
      {active && !free && (
        <PlainSection label="Key">
          <PlainRow
            onClick={() => keyCheck.check.mutate()}
            className={cn('text-link', keyCheck.check.isPending && 'opacity-60')}
          >
            {keyCheck.check.isPending ? 'Checking…' : 'Check key'}
          </PlainRow>
          <PlainRow onClick={() => actions.onReplaceKey(active.provider)}>Replace key</PlainRow>
        </PlainSection>
      )}
      {active && <Today settings={settings} />}
      {settings.provider && (
        <PlainSection label="Try it">
          <SampleTestPanel
            providerId={settings.provider}
            providerName={providerName(settings.provider)}
          />
        </PlainSection>
      )}
      {active && (
        <PlainSection>
          <PlainRow onClick={() => actions.onRemove(active.provider)} tone="red" center>
            Remove {providerName(active.provider)}
          </PlainRow>
        </PlainSection>
      )}
    </div>
  );
}

/** The page's body: plain rows on phones (mock `PHONE-LINEAR-mock/` screen 10), cards on laptops. */
export function ProvidersBodyFor({
  phone,
  ...props
}: Parameters<typeof ProvidersBody>[0] & { phone: boolean }) {
  return phone ? <PhoneProvidersBody {...props} /> : <ProvidersBody {...props} />;
}
