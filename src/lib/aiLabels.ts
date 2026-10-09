import { format } from 'date-fns';
import { getCatalogProvider } from '../contracts/aiCatalog';
import type { AISettingsResponse } from '../contracts/ai';

export const providerName = (id: string | null | undefined) =>
  (id && getCatalogProvider(id)?.displayName) || id || 'Your AI provider';

export const modelName = (
  providerId: string | null | undefined,
  modelId: string | null | undefined,
) =>
  (providerId &&
    modelId &&
    getCatalogProvider(providerId)?.models.find((m) => m.id === modelId)?.displayName) ||
  modelId ||
  'unknown model';

/** Provenance phrase for an AI result; the rule-based filter is not a provider. */
export function analyzedBy(provider: string | null | undefined, model: string | null | undefined) {
  if (!provider) return null;
  if (provider === 'deterministic') return 'Filtered by rules (no AI)';
  return `Analyzed by ${providerName(provider)} · ${modelName(provider, model)}`;
}

const time = (iso: string | null) => (iso ? format(new Date(iso), 'h:mm a') : 'later');

export interface AccessCopy {
  title: string;
  detail: string;
  /** One fix: an external provider page or a place in Career Companion. */
  fix?: { label: string; href?: string; to?: '/ai' };
}

/** What the user sees for an AI access state: the cause and one fix. */
export function accessCopy(settings: AISettingsResponse): AccessCopy | null {
  const { access, provider } = settings;
  if (access.state === 'READY') return null;
  const name = providerName(provider);
  const links = provider ? getCatalogProvider(provider)?.links : undefined;
  const waiting = settings.waitingEmails
    ? ` ${settings.waitingEmails} ${settings.waitingEmails === 1 ? 'email is' : 'emails are'} waiting.`
    : '';
  switch (access.reason) {
    case 'KEY_REJECTED':
      return {
        title: `${name} rejected your API key`,
        detail: `Create a new key and replace it here.${waiting}`,
        fix: links
          ? { label: `Get a ${name} API key`, href: links.apiKeys }
          : { label: 'Replace key', to: '/ai' },
      };
    case 'ACCOUNT_OR_BILLING':
      return {
        title: `${name} refused requests for your account`,
        detail: `Check billing, credit or the key's permissions with ${name}, then choose "Check again".${waiting}`,
        fix: links ? { label: `Open ${name} billing`, href: links.billing } : undefined,
      };
    case 'MODEL_UNAVAILABLE':
      return {
        title: `Your key cannot use ${modelName(provider, access.modelId)}`,
        detail: `Choose another model.${waiting}`,
        fix: { label: 'Choose another model', to: '/ai' },
      };
    case 'PROVIDER_UNSUPPORTED':
      return {
        title: `${name} is not offered any more`,
        detail: `Choose another AI provider.${waiting}`,
        fix: { label: 'Choose a provider', to: '/ai' },
      };
    case 'KEY_UNREADABLE':
      return {
        title: 'Enter your API key again',
        detail: `Career Companion could not read your saved key.${waiting}`,
        fix: { label: 'Replace key', to: '/ai' },
      };
    case 'RATE_LIMITED':
      return {
        title: `${name} is limiting requests from your account`,
        detail: `Paused until about ${time(access.resumesAt)}. Sync after that to continue.${waiting}`,
      };
    case 'PROVIDER_UNAVAILABLE':
      return {
        title: `${name} did not respond`,
        detail: `Paused until about ${time(access.resumesAt)}. Sync after that to continue.${waiting}`,
      };
    case 'SAFETY_LIMIT':
      return {
        title: "Career Companion's daily AI safety limit is reached",
        detail: `Career Companion makes at most ${settings.safetyLimit.callsPerDay} AI calls a day for you. Processing continues after ${time(access.resumesAt)}; sync then to continue.${waiting}`,
      };
    case 'PAUSED':
      return {
        title: 'AI processing is paused',
        detail: `Career Companion has paused AI processing for now.${waiting}`,
      };
    default:
      return {
        title: 'AI is not set up',
        detail: `Choose an AI provider so Career Companion can read your job emails.${waiting}`,
        fix: { label: 'Set up AI', to: '/ai' },
      };
  }
}

/** Plain text for stored processing error categories. */
export const PROCESSING_ERROR_LABELS: Record<string, string> = {
  OutcomeUnknown: 'Outcome unknown',
  SchemaValidationFailure: 'Unusable AI output',
  TerminalAIError: 'AI request failed',
  RetryableAIError: 'Temporary error',
  AIProviderError: 'AI error',
  GmailRequestFailed: 'Gmail request failed',
  ProcessingError: 'Processing failed',
};
