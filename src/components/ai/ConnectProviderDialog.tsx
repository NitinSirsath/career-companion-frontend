import { useState } from 'react';
import type { AISettingsResponse } from '../../contracts/ai';
import {
  AI_SUBSCRIPTION_NOTE,
  getCatalogProvider,
  recommendedModel,
  type CatalogProvider,
} from '../../contracts/aiCatalog';
import { ROLE_LABELS, activeConnection } from '../../lib/aiConnections';
import { providerName } from '../../lib/aiLabels';
import { connectNote } from '../../lib/aiProviderPage';
import { ownKeyProviders } from '../../lib/freeAI';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Tag } from '../ui/tag';
import { CostTag } from './ProviderPicker';
import { ApiKeyField, CheckRow, DataUseConsent, SaveProblemAlert } from './ProviderKeyFields';
import { useKeySave } from './useKeySave';

/** Step 1: the offered providers, the connected ones marked. */
function ProviderList({
  settings,
  onChoose,
}: {
  settings: AISettingsResponse;
  onChoose: (providerId: string) => void;
}) {
  const connected = (id: string) => settings.connections.some((c) => c.provider === id);
  return (
    <div className="flex flex-col">
      <ul className="flex flex-col">
        {ownKeyProviders(settings).map((id) => {
          const provider = getCatalogProvider(id);
          if (!provider) return null;
          return (
            <li
              key={id}
              className="flex items-center justify-between gap-4 border-t border-border-subtle py-3.5 first:border-t-0"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] leading-[22px]">{provider.displayName}</span>
                  <CostTag provider={provider} />
                </span>
                <span className="text-xs text-text-secondary">{provider.recommendedNote}</span>
              </div>
              {connected(id) ? (
                <Tag>Connected</Tag>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => onChoose(id)}>
                  Choose
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-text-secondary">{AI_SUBSCRIPTION_NOTE}</p>
    </div>
  );
}

/** Where to get a key, and the links to the provider's key and billing pages. */
function KeySteps({ provider }: { provider: CatalogProvider }) {
  const name = provider.displayName;
  return (
    <section aria-label="Get an API key" className="space-y-2">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-text-secondary">
        {provider.setupSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="flex flex-wrap gap-4 text-sm">
        {provider.links.apiKeys && (
          <a
            className="underline text-action-primary"
            href={provider.links.apiKeys}
            target="_blank"
            rel="noopener noreferrer"
          >
            Get a {name} API key
          </a>
        )}
        {provider.links.billing && (
          <a
            className="underline text-action-primary"
            href={provider.links.billing}
            target="_blank"
            rel="noopener noreferrer"
          >
            {name} billing
          </a>
        )}
      </p>
    </section>
  );
}

/** "Fast screening Gemini 3.5 Flash-Lite, Detailed analysis Gemini 3.8 Flash". */
const recommendedLine = (provider: CatalogProvider) =>
  (['fast', 'detailed'] as const)
    .map((role) => `${ROLE_LABELS[role]} ${recommendedModel(provider, role).displayName}`)
    .join(', ');

/**
 * Who reads new mail after connecting: with another provider active, a box to make this one
 * active now (unticked); with none, this one, by itself.
 */
export function WhoReads({
  name,
  activeName,
  makeActive,
  onMakeActiveChange,
}: {
  name: string;
  activeName: string | null;
  makeActive: boolean;
  onMakeActiveChange: (makeActive: boolean) => void;
}) {
  if (!activeName)
    return (
      <p className="text-sm text-text-secondary">
        No provider reads your mail now, so {name} becomes active and starts reading your waiting
        mails.
      </p>
    );
  return (
    <CheckRow id="ai-make-active" checked={makeActive} onCheckedChange={onMakeActiveChange}>
      Make {name} active now. It then reads new mails instead of {activeName}.
    </CheckRow>
  );
}

/** Step 2: the key, data use and consent, and whether the provider becomes active. */
function ConnectForm({
  provider,
  settings,
  onBack,
  onCancel,
  onDone,
}: {
  provider: CatalogProvider;
  settings: AISettingsResponse;
  onBack?: () => void;
  onCancel: () => void;
  onDone: (note: string) => void;
}) {
  const [consent, setConsent] = useState(false);
  const [makeActive, setMakeActive] = useState(false);
  const name = provider.displayName;
  const active = activeConnection(settings);
  const { keyRef, pending, problem, submit } = useKeySave({
    provider,
    consentNeeded: true,
    consent,
    missingKey: `Paste your ${name} API key.`,
    body: (apiKey) => ({
      apiKey,
      consentDisclosure: provider.disclosure.version,
      ...(active ? { makeActive } : {}),
    }),
    note: (response) => connectNote(response, provider.id),
    onDone,
  });

  return (
    <form onSubmit={submit} aria-label={`Connect ${name}`} className="flex flex-col gap-5">
      {provider.costModel === 'PAID_ONLY' && (
        <p className="text-sm text-text-secondary">
          {name} needs paid API billing. Set it up before you create a key.
        </p>
      )}
      <KeySteps provider={provider} />
      <ApiKeyField
        id="ai-api-key"
        label="API key"
        placeholder={`Paste your ${name} API key`}
        inputRef={keyRef}
      />
      <p className="text-sm text-text-secondary">
        Models: {recommendedLine(provider)}. You can change them on this page after connecting.
      </p>
      <DataUseConsent provider={provider} checked={consent} onCheckedChange={setConsent} />
      <WhoReads
        name={name}
        activeName={active ? providerName(active.provider) : null}
        makeActive={makeActive}
        onMakeActiveChange={setMakeActive}
      />
      {problem && <SaveProblemAlert problem={problem} />}
      <DialogFooter className="mt-1">
        {onBack && (
          <Button
            type="button"
            variant="ghost"
            className="mr-auto"
            onClick={onBack}
            disabled={pending}
          >
            Back
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {pending ? 'Verifying…' : 'Connect and verify'}
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * Connects another provider: pick one (unless `start` names it), then paste its key and agree to
 * what is sent. Rendered only while open, so a typed key goes away with it.
 */
export function ConnectProviderDialog({
  settings,
  start,
  onClose,
  onDone,
}: {
  settings: AISettingsResponse;
  start: string | null;
  onClose: () => void;
  onDone: (note: string) => void;
}) {
  const [chosen, setChosen] = useState<string | null>(start);
  const provider = chosen ? getCatalogProvider(chosen) : undefined;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {provider ? `Connect ${provider.displayName}` : 'Connect a provider'}
          </DialogTitle>
          {!provider && <DialogDescription>Pick who you have an API key with.</DialogDescription>}
        </DialogHeader>
        {provider ? (
          <ConnectForm
            provider={provider}
            settings={settings}
            onBack={start ? undefined : () => setChosen(null)}
            onCancel={onClose}
            onDone={onDone}
          />
        ) : (
          <>
            <ProviderList settings={settings} onChoose={setChosen} />
            <DialogFooter>
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
