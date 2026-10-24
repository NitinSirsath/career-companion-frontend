import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { AIConnection, AISettingsResponse } from '../../contracts/ai';
import {
  activeConnection,
  canActivate,
  canConnectMore,
  connectionTag,
  inactiveCheckNote,
  inactiveConnections,
  keyLine,
  modelsLine,
} from '../../lib/aiConnections';
import { providerName } from '../../lib/aiLabels';
import {
  FREE_AI,
  FREE_AI_MODEL,
  FREE_AI_NOTE,
  freeAIBackupOffered,
  freeAIModelLine,
  isFreeAI,
} from '../../lib/freeAI';
import { settingsOf } from '../../lib/aiProviderPage';
import { Button } from '../ui/button';
import { OverflowMenu } from '../ui/menu';
import { Tag } from '../ui/tag';
import type { ProviderActions } from './ActiveProviderCard';

/** A row of the list: name, models, state and buttons side by side from laptop width. */
const ROW_CLASS =
  'grid items-center gap-x-6 gap-y-2 border-t border-border-subtle px-6 py-4 first:border-t-0 md:grid-cols-[minmax(180px,1.2fr)_minmax(200px,1.6fr)_auto_auto]';

/** One connected provider that does not read the mail: its state, and "Make active". */
function OtherProviderRow({
  connection,
  actions,
}: {
  connection: AIConnection;
  actions: ProviderActions;
}) {
  const queryClient = useQueryClient();
  const name = providerName(connection.provider);
  const tag = connectionTag(connection);
  // The free AI has no key: nothing to check or replace.
  const free = isFreeAI(connection.provider);
  const check = useMutation({
    mutationFn: () => api.checkAIProvider(connection.provider),
    retry: false,
    onSuccess: (response) => {
      queryClient.setQueryData(['aiSettings'], settingsOf(response));
      actions.onNote(inactiveCheckNote(response, connection.provider));
    },
    onError: () => {
      actions.onNote(`The check of ${name} could not be completed.`);
      queryClient.invalidateQueries({ queryKey: ['aiSettings'] });
    },
  });
  return (
    <li className={ROW_CLASS}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[15px] leading-[22px]">{name}</span>
        <span className="text-xs text-text-secondary">
          {free && FREE_AI_NOTE}
          {!free && (check.isPending ? 'Checking the key…' : keyLine(connection))}
        </span>
      </div>
      <span className="text-xs text-text-secondary">
        {free ? freeAIModelLine(modelsLine(connection)) : modelsLine(connection)}
      </span>
      <span>
        <Tag color={tag.color}>{tag.label}</Tag>
      </span>
      <div className="flex items-center gap-2 md:justify-end">
        <Button
          variant="secondary"
          size="sm"
          disabled={!canActivate(connection)}
          onClick={() => actions.onActivate(connection.provider)}
        >
          Make active
        </Button>
        <OverflowMenu
          label={`More for ${name}`}
          actions={[
            ...(free
              ? []
              : [
                  {
                    label: 'Check key',
                    onSelect: () => check.mutate(),
                    disabled: check.isPending,
                  },
                  {
                    label: 'Replace key',
                    onSelect: () => actions.onReplaceKey(connection.provider),
                  },
                ]),
            {
              label: 'Remove…',
              danger: true,
              onSelect: () => actions.onRemove(connection.provider),
            },
          ]}
        />
      </div>
    </li>
  );
}

/** The free AI, not added yet, offered as a backup next to the provider that reads the mail. */
function FreeAIBackupRow({ onAdd }: { onAdd: () => void }) {
  return (
    <li className={ROW_CLASS}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[15px] leading-[22px]">{providerName(FREE_AI)}</span>
        <span className="text-xs text-text-secondary">{FREE_AI_NOTE}</span>
      </div>
      <span className="text-xs text-text-secondary">{freeAIModelLine(FREE_AI_MODEL)}</span>
      <span />
      <div className="flex items-center gap-2 md:justify-end">
        <Button variant="secondary" size="sm" onClick={onAdd}>
          Add as backup
        </Button>
      </div>
    </li>
  );
}

/**
 * The connected providers that do not read the mail, and the free AI as a backup until it is
 * added. Making one active switches at once; with none, the page says what a second one is for.
 */
export function OtherProviders({
  settings,
  actions,
  onConnect,
}: {
  settings: AISettingsResponse;
  actions: ProviderActions;
  onConnect: () => void;
}) {
  const others = inactiveConnections(settings);
  const active = activeConnection(settings);
  const backup = freeAIBackupOffered(settings);
  return (
    <section aria-labelledby="ai-others-heading" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="ai-others-heading" className="text-base leading-[22px] font-semibold">
          {active ? 'Other connected providers' : 'Connected providers'}
        </h2>
        <p className="text-sm text-text-secondary">
          Connected and checked, but not reading your mail. Make one active to switch at once.
        </p>
      </div>
      <div className="border border-border-subtle bg-surface">
        {others.length > 0 || backup ? (
          <ul aria-label={active ? 'Other connected providers' : 'Connected providers'}>
            {others.map((connection) => (
              <OtherProviderRow
                key={connection.provider}
                connection={connection}
                actions={actions}
              />
            ))}
            {backup && <FreeAIBackupRow onAdd={actions.onAddFreeAI} />}
          </ul>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <p className="text-sm text-text-secondary">
              {active && isFreeAI(active.provider)
                ? 'No other provider yet. Your own key reads mails faster, because nobody else shares it.'
                : 'No other provider yet. A second one lets you switch quickly when this one has a problem.'}
            </p>
            {canConnectMore(settings) && (
              <Button variant="ghost" size="sm" onClick={onConnect}>
                Connect a provider
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
