import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, isApiError } from '../../api/client';
import {
  AI_DATA_SENT_SUMMARY,
  modelsForRole,
  recommendedModel,
  type AIRole,
  type CatalogProvider,
} from '../../contracts/aiCatalog';
import type { AISettingsResponse } from '../../contracts/ai';
import { modelName } from '../../lib/aiLabels';
import { startProcessingRefresh } from '../../lib/processingRefresh';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { NativeSelect } from '../ui/native-select';

type Problem = { text: string; link?: { label: string; href: string } };

const ROLE_LABELS: Record<AIRole, string> = {
  fast: 'Fast screening',
  detailed: 'Detailed analysis',
};

function saveProblem(err: unknown, provider: CatalogProvider): Problem {
  const name = provider.displayName;
  if (!isApiError(err)) return { text: 'Saving failed. Try again.' };
  if (err.outcomeUncertain)
    return {
      text: 'We could not confirm whether this was saved. The status shows what is saved now.',
    };
  if (err.code === 'AI_ACCESS_REJECTED') {
    const details = err.details as { reason?: string; modelId?: string | null } | undefined;
    if (details?.reason === 'KEY_REJECTED')
      return {
        text: `${name} rejected this key. Check that you copied the whole key, or create a new one. Nothing was saved.`,
        link: { label: `Get a ${name} API key`, href: provider.links.apiKeys },
      };
    if (details?.reason === 'ACCOUNT_OR_BILLING')
      return {
        text: `${name} refused this key for your account: billing, credit or permissions. Nothing was saved.`,
        link: { label: `Open ${name} billing`, href: provider.links.billing },
      };
    if (details?.reason === 'MODEL_UNAVAILABLE')
      return {
        text: `This key cannot use ${modelName(provider.id, details.modelId)}. Choose another model under Advanced. Nothing was saved.`,
      };
  }
  if (err.code === 'AI_VERIFY_RATE_LIMITED')
    return { text: 'Too many key checks today. Try again tomorrow.' };
  return { text: err.message };
}

/**
 * Guided setup for one provider: get a key, paste it, models, data use and consent, save and verify.
 *
 * The key lives only in this uncontrolled password field and in one local variable while the save
 * request is sent: never in React state, the query or mutation cache, the URL or browser storage.
 * The field is cleared as soon as the key is read, and on unmount.
 */
export function ProviderSetupForm({
  provider,
  settings,
  onDone,
  onCancel,
}: {
  provider: CatalogProvider;
  settings: AISettingsResponse;
  onDone: (verification: 'VERIFIED' | 'INCONCLUSIVE', waitingEmails: number) => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const keyRef = useRef<HTMLInputElement>(null);
  const sameProvider = settings.configured && settings.provider === provider.id;
  const needsConsent = !sameProvider || settings.consent?.current === false;
  const selected = (role: AIRole) =>
    sameProvider && settings.models?.[role].source === 'SELECTED' ? settings.models[role].id : '';
  const [models, setModels] = useState<Record<AIRole, string>>({
    fast: selected('fast'),
    detailed: selected('detailed'),
  });
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const name = provider.displayName;

  useEffect(() => {
    const input = keyRef.current;
    return () => {
      if (input) input.value = '';
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (needsConsent && !consent) {
      setProblem({ text: `Confirm that you understand what is sent to ${name}.` });
      return;
    }
    const input = keyRef.current;
    const apiKey = input?.value.trim() ?? '';
    if (input) input.value = '';
    if (!sameProvider && !apiKey) {
      setProblem({ text: `Paste your ${name} API key.` });
      return;
    }
    setPending(true);
    setProblem(null);
    try {
      const { verification, ...saved } = await api.saveAISettings({
        provider: provider.id,
        ...(apiKey ? { apiKey } : {}),
        models: { fast: models.fast || null, detailed: models.detailed || null },
        ...(needsConsent ? { consentDisclosure: provider.disclosure.version } : {}),
      });
      queryClient.setQueryData(['aiSettings'], saved);
      if (saved.waitingEmails > 0) startProcessingRefresh(); // waiting emails resume
      onDone(verification, saved.waitingEmails);
    } catch (err) {
      setProblem(saveProblem(err, provider));
      if (isApiError(err) && err.outcomeUncertain)
        queryClient.invalidateQueries({ queryKey: ['aiSettings'] });
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      aria-label={`Set up ${name}`}
      className="border border-border-default bg-surface p-6 space-y-6"
    >
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">
          {sameProvider ? `Update ${name}` : `Set up ${name}`}
        </h3>
        {provider.costModel === 'PAID_ONLY' && (
          <p className="text-sm text-status-warning">
            {name} requires paid API billing. Set up billing before you create a key.
          </p>
        )}
      </div>

      {!sameProvider && (
        <section aria-label="Get an API key" className="space-y-2">
          <ol className="list-decimal pl-5 space-y-1 text-sm text-text-secondary">
            {provider.setupSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="flex flex-wrap gap-4 text-sm">
            <a
              className="underline text-action-primary"
              href={provider.links.apiKeys}
              target="_blank"
              rel="noopener noreferrer"
            >
              Get a {name} API key
            </a>
            <a
              className="underline text-action-primary"
              href={provider.links.billing}
              target="_blank"
              rel="noopener noreferrer"
            >
              {name} billing
            </a>
          </p>
        </section>
      )}

      <div className="space-y-2">
        <Label htmlFor="ai-api-key">API key</Label>
        <Input
          id="ai-api-key"
          ref={keyRef}
          type="password"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          data-1p-ignore
          data-lpignore="true"
          placeholder={
            sameProvider ? 'Leave blank to keep the saved key' : `Paste your ${name} API key`
          }
        />
        <p className="text-xs text-text-secondary">
          Stored encrypted. Career Companion never shows it again.
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Models</legend>
        <ul className="text-sm text-text-secondary space-y-1">
          {(['fast', 'detailed'] as const).map((role) => (
            <li key={role}>
              {ROLE_LABELS[role]}:{' '}
              {modelName(provider.id, models[role] || recommendedModel(provider, role).id)}
              {!models[role] && ' (recommended)'}
            </li>
          ))}
        </ul>
        <details>
          <summary className="cursor-pointer text-sm">Advanced: choose tested models</summary>
          <div className="grid gap-3 md:grid-cols-2 mt-3">
            {(['fast', 'detailed'] as const).map((role) => (
              <div key={role} className="space-y-1">
                <Label htmlFor={`ai-model-${role}`}>{ROLE_LABELS[role]}</Label>
                <NativeSelect
                  id={`ai-model-${role}`}
                  value={models[role]}
                  onChange={(e) => setModels((current) => ({ ...current, [role]: e.target.value }))}
                >
                  <option value="">
                    Recommended ({recommendedModel(provider, role).displayName})
                  </option>
                  {modelsForRole(provider, role).map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.displayName}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            ))}
          </div>
        </details>
      </fieldset>

      <p className="text-sm text-text-secondary">
        Career Companion makes at most {settings.safetyLimit.callsPerDay} AI calls a day for you.
        This is Career Companion&apos;s own safeguard, not {name}&apos;s quota or your bill.
      </p>

      {needsConsent && (
        <section
          aria-labelledby="ai-data-use"
          className="space-y-2 border-t border-border-subtle pt-4"
        >
          <h4 id="ai-data-use" className="text-sm font-semibold">
            What is sent to {name}
          </h4>
          <p className="text-sm">{AI_DATA_SENT_SUMMARY}</p>
          <p className="text-sm text-text-secondary">{provider.disclosure.summary}</p>
          <p className="text-sm text-text-secondary">{provider.disclosure.training}</p>
          <p className="text-sm text-text-secondary">{provider.disclosure.residency}</p>
          <a
            className="text-sm underline text-action-primary"
            href={provider.links.dataUse}
            target="_blank"
            rel="noopener noreferrer"
          >
            Read {name}&apos;s terms
          </a>
          <div className="flex items-start gap-2">
            <input
              id="ai-consent"
              type="checkbox"
              className="mt-1 h-4 w-4 cursor-pointer focus-visible:ring-2 focus-visible:ring-border-focus"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <Label htmlFor="ai-consent" className="leading-snug">
              I understand that these details of my emails are sent to {name} under my own account
              and its terms. Saving starts processing my waiting emails.
            </Label>
          </div>
        </section>
      )}

      {problem && (
        <div
          role="alert"
          className="border border-status-error bg-status-error-subtle p-3 text-sm space-y-1"
        >
          <p>{problem.text}</p>
          {problem.link && (
            <a
              className="underline"
              href={problem.link.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {problem.link.label}
            </a>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Verifying…' : 'Save and verify'}
        </Button>
        <Button type="button" variant="tertiary" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
