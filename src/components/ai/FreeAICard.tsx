import type { AIConnection, AISettingsResponse } from '../../contracts/ai';
import { AI_ROLES } from '../../contracts/aiCatalog';
import { ROLE_HELP, ROLE_LABELS, connectionTag } from '../../lib/aiConnections';
import { accessCopy, modelName } from '../../lib/aiLabels';
import { waitingText } from '../../lib/aiProviderPage';
import { FREE_AI, FREE_AI_BANNER, freeAICopy } from '../../lib/freeAI';
import { Button } from '../ui/button';
import { InlineNotification } from '../ui/notification';
import { Tag } from '../ui/tag';
import type { ProviderActions } from './ActiveProviderCard';

/**
 * Why the free AI does not read now: its pause shared by everyone, the free AI switched off, or
 * NorthList's daily limit. Every one ends by itself; the user's own key reads at once.
 */
function FreeAIWait({
  settings,
  onConnectOwn,
}: {
  settings: AISettingsResponse;
  onConnectOwn: () => void;
}) {
  const copy = freeAICopy(settings) ?? accessCopy(settings);
  if (!copy) return null;
  const busy = settings.access.reason === 'FREE_AI_BUSY';
  return (
    <InlineNotification kind="warning" title={copy.title}>
      <span className="flex flex-col gap-1">
        <span>{copy.detail}</span>
        <span>
          <Button variant={busy ? 'ghost' : 'primary'} size="sm" onClick={onConnectOwn}>
            Connect your own key
          </Button>
        </span>
      </span>
    </InlineNotification>
  );
}

/**
 * The free AI as the provider that reads the mail: free, on NorthList's account, with GPT-6
 * Luna for both steps. No key and no model to change, so only "Remove"; the banner says it is
 * shared, and its pauses say they end by themselves.
 */
export function FreeAICard({
  settings,
  connection,
  actions,
  onConnectOwn,
}: {
  settings: AISettingsResponse;
  connection: AIConnection;
  actions: ProviderActions;
  onConnectOwn: () => void;
}) {
  const tag = connectionTag(connection);
  const ready = settings.access.state === 'READY';
  return (
    <section aria-labelledby="ai-active-heading" className="flex flex-col gap-3">
      <h2 id="ai-active-heading" className="text-base leading-[22px] font-semibold">
        Reads your mail now
      </h2>
      <div className="border border-border-subtle bg-surface">
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2.5">
              <span className="text-xl leading-7">NorthList free AI</span>
              <Tag color="blue">Active</Tag>
              <Tag>Free</Tag>
              <Tag color={tag.color}>{tag.label}</Tag>
            </span>
            <span className="text-xs text-text-secondary">
              Runs on OpenRouter, on NorthList&apos;s account. No key needed.
            </span>
          </div>
          <Button variant="danger-ghost" size="sm" onClick={() => actions.onRemove(FREE_AI)}>
            Remove
          </Button>
        </div>
        <div className="flex flex-col gap-3 px-6 pb-5">
          {ready ? (
            <InlineNotification kind="info">
              <span className="flex flex-col gap-1">
                <span>
                  <strong>The free AI is shared by everyone,</strong> {FREE_AI_BANNER}
                </span>
                <span>
                  <Button variant="ghost" size="sm" onClick={onConnectOwn}>
                    Connect your own key
                  </Button>
                </span>
              </span>
            </InlineNotification>
          ) : (
            <FreeAIWait settings={settings} onConnectOwn={onConnectOwn} />
          )}
        </div>
        {AI_ROLES.map((role) => (
          <div
            key={role}
            className="grid items-center gap-x-6 gap-y-2 border-t border-border-subtle px-6 py-4 md:grid-cols-[minmax(160px,1fr)_minmax(240px,320px)_minmax(140px,1fr)]"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm">{ROLE_LABELS[role]}</span>
              <span className="text-xs text-text-secondary">{ROLE_HELP[role]}</span>
            </div>
            <span className="text-sm">
              {modelName(FREE_AI, connection.models?.[role].id ?? null)}
            </span>
            <span className="text-xs text-text-secondary">Fixed on the free AI</span>
          </div>
        ))}
        {settings.waitingEmails > 0 && (
          <p className="border-t border-border-subtle px-6 py-3 text-sm text-text-secondary">
            {waitingText(settings)}
          </p>
        )}
      </div>
    </section>
  );
}
