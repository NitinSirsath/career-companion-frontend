import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { AIConnection, AISettingsResponse, CheckAIProviderResponse } from '../../contracts/ai';
import { connectionTag, keyLine, spareProvider } from '../../lib/aiConnections';
import { accessCopy, providerName } from '../../lib/aiLabels';
import {
  checkNoteShown,
  notAffected,
  notConfirmedNotice,
  settingsOf,
  waitingText,
} from '../../lib/aiProviderPage';
import { freeAIConnection, freeAIOffered } from '../../lib/freeAI';
import { startProcessingRefresh } from '../../lib/processingRefresh';
import { Button } from '../ui/button';
import { InlineNotification } from '../ui/notification';
import { Tag } from '../ui/tag';
import { Emphasized } from './AIAccessNotice';
import { ModelChoice } from './ModelChoice';

export interface ProviderActions {
  onReplaceKey: (providerId: string) => void;
  onRemove: (providerId: string) => void;
  onActivate: (providerId: string) => void;
  /** Opens the free AI's confirm dialog. */
  onUseFreeAI: () => void;
  /** Opens the free AI's confirm dialog to add it as a backup, without switching. */
  onAddFreeAI: () => void;
  onNote: (note: string) => void;
}

/**
 * What stops or limits AI now, with the one fix, in the provider's own words where it gave any.
 * A key problem also offers "Replace key", and another connected provider that could take over,
 * or else the free AI when the server offers it (owner, 24 Oct 2026). Nothing switches by itself.
 */
function AccessProblem({
  settings,
  actions,
}: {
  settings: AISettingsResponse;
  actions: ProviderActions;
}) {
  const copy = accessCopy(settings, notAffected(settings));
  if (!copy) return null;
  const keyProblem = settings.access.state === 'NEEDS_ATTENTION' && settings.provider;
  const spare = keyProblem ? spareProvider(settings) : null;
  const offerFreeAI =
    keyProblem && !spare && freeAIOffered(settings) && !freeAIConnection(settings);
  return (
    <InlineNotification kind="warning" title={copy.title}>
      <span className="flex flex-col gap-1">
        <span>
          <Emphasized text={copy.detail} strong={copy.strong} />
        </span>
        {copy.hint && <span>{copy.hint}</span>}
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {copy.fix?.href && (
            <a className="text-link" href={copy.fix.href} target="_blank" rel="noopener noreferrer">
              {copy.fix.label}
            </a>
          )}
          {keyProblem && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => actions.onReplaceKey(settings.provider!)}
            >
              Replace key
            </Button>
          )}
          {spare && (
            <Button variant="ghost" size="sm" onClick={() => actions.onActivate(spare.provider)}>
              Use {providerName(spare.provider)} instead
            </Button>
          )}
          {offerFreeAI && (
            <Button variant="ghost" size="sm" onClick={actions.onUseFreeAI}>
              Use NorthList free AI instead
            </Button>
          )}
        </span>
      </span>
    </InlineNotification>
  );
}

/** "Check key" on the active provider, and the note it leaves. */
function useKeyCheck(providerId: string) {
  const queryClient = useQueryClient();
  const [lastCheck, setLastCheck] = useState<CheckAIProviderResponse | null>(null);
  const [failed, setFailed] = useState(false);
  // No key is involved, so an ordinary mutation is fine here.
  const check = useMutation({
    mutationFn: () => api.checkAIProvider(providerId),
    retry: false,
    onSuccess: (response) => {
      const next = settingsOf(response);
      queryClient.setQueryData(['aiSettings'], next);
      if (response.verification === 'VERIFIED' && next.waitingEmails > 0) startProcessingRefresh();
      setFailed(false);
      setLastCheck(response);
    },
    onError: () => {
      setFailed(true);
      queryClient.invalidateQueries({ queryKey: ['aiSettings'] });
    },
  });
  return { check, lastCheck, failed };
}

/** "Check key", "Replace key" and "Remove", always in sight. */
function KeyButtons({
  checking,
  onCheck,
  onReplaceKey,
  onRemove,
}: {
  checking: boolean;
  onCheck: () => void;
  onReplaceKey: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" onClick={onCheck} loading={checking}>
        {checking ? 'Checking…' : 'Check key'}
      </Button>
      <Button variant="secondary" size="sm" onClick={onReplaceKey}>
        Replace key
      </Button>
      <Button variant="danger-ghost" size="sm" onClick={onRemove}>
        Remove
      </Button>
    </div>
  );
}

/**
 * The provider that reads the mail now: its name and state, its key, and its two models, changed
 * in place.
 */
export function ActiveProviderCard({
  settings,
  connection,
  actions,
}: {
  settings: AISettingsResponse;
  connection: AIConnection;
  actions: ProviderActions;
}) {
  const { check, lastCheck, failed } = useKeyCheck(connection.provider);
  const name = providerName(connection.provider);
  const notConfirmed = notConfirmedNotice(settings, lastCheck);
  const tag = connectionTag(connection);
  const checkNote = checkNoteShown(lastCheck, failed, notConfirmed !== null);
  return (
    <section aria-labelledby="ai-active-heading" className="flex flex-col gap-3">
      <h2 id="ai-active-heading" className="text-base leading-[22px] font-semibold">
        Reads your mail now
      </h2>
      <div className="border border-border-subtle bg-surface">
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2.5">
              <span className="text-xl leading-7">{name}</span>
              <Tag color="blue">Active</Tag>
              <Tag color={notConfirmed ? 'yellow' : tag.color}>
                {notConfirmed ? 'Not confirmed' : tag.label}
              </Tag>
            </span>
            {/* The top-level access describes the active provider, as the last check left it. */}
            <span className="text-xs text-text-secondary">{keyLine(settings.access)}</span>
          </div>
          <KeyButtons
            checking={check.isPending}
            onCheck={() => check.mutate()}
            onReplaceKey={() => actions.onReplaceKey(connection.provider)}
            onRemove={() => actions.onRemove(connection.provider)}
          />
        </div>
        {(notConfirmed || accessCopy(settings) || checkNote) && (
          <div className="flex flex-col gap-3 px-6 pb-5">
            {notConfirmed && (
              <InlineNotification kind="warning" title={notConfirmed.title}>
                {notConfirmed.detail}
              </InlineNotification>
            )}
            <AccessProblem settings={settings} actions={actions} />
            {checkNote && (
              <p role="status" className="text-sm">
                {checkNote}
              </p>
            )}
          </div>
        )}
        <ModelChoice settings={settings} role="fast" onSaved={actions.onNote} />
        <ModelChoice settings={settings} role="detailed" onSaved={actions.onNote} />
        {settings.waitingEmails > 0 && (
          <p className="border-t border-border-subtle px-6 py-3 text-sm text-text-secondary">
            {waitingText(settings)}
          </p>
        )}
      </div>
    </section>
  );
}
