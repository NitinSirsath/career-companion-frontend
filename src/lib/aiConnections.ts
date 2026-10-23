import { format } from 'date-fns';
import type { AIConnection, AISettingsResponse, CheckAIProviderResponse } from '../contracts/ai';
import {
  modelsForRole,
  recommendedModel,
  type AIRole,
  type CatalogProvider,
} from '../contracts/aiCatalog';
import type { TagColor } from './statusTags';
import { failureSaid } from './aiProviderPage';
import { modelName, providerName } from './aiLabels';

/**
 * The AI providers page: several providers can be connected, and one is active. The active one
 * reads the mail; the others are saved, with their keys, until the user makes one active.
 */

export const ROLE_LABELS: Record<AIRole, string> = {
  fast: 'Fast screening',
  detailed: 'Detailed analysis',
};

export const ROLE_HELP: Record<AIRole, string> = {
  fast: 'Sorts each new mail: job mail or not.',
  detailed: 'Reads each job mail: company, role, next step and dates.',
};

export const activeConnection = (settings: AISettingsResponse): AIConnection | null =>
  settings.connections.find((connection) => connection.active) ?? null;

export const inactiveConnections = (settings: AISettingsResponse): AIConnection[] =>
  settings.connections.filter((connection) => !connection.active);

/** Offered providers the user has not connected yet. */
export const freeProviders = (settings: AISettingsResponse): string[] =>
  settings.offeredProviders.filter(
    (id) => !settings.connections.some((connection) => connection.provider === id),
  );

/** "Connect a provider" in the header: once one is connected, while another one is free. */
export const canConnectMore = (settings: AISettingsResponse): boolean =>
  settings.connections.length > 0 && freeProviders(settings).length > 0;

/** An inactive provider can become active unless its last check found a key problem. */
export const canActivate = (connection: AIConnection): boolean =>
  connection.state !== 'NEEDS_ATTENTION';

/** A connected provider that can take over at once: "Use OpenAI instead". */
export const spareProvider = (settings: AISettingsResponse): AIConnection | null =>
  inactiveConnections(settings).find(canActivate) ?? null;

/** The tag next to a provider's name. */
export function connectionTag(connection: AIConnection): { label: string; color: TagColor } {
  if (connection.state === 'NEEDS_ATTENTION') return { label: 'Needs attention', color: 'red' };
  if (connection.state === 'LIMITED') return { label: 'Limited', color: 'yellow' };
  if (!connection.verified) return { label: 'Not confirmed', color: 'yellow' };
  return { label: 'Ready', color: 'green' };
}

/** "Key verified · last checked Oct 22, 9:53 AM". */
export function keyLine(connection: Pick<AIConnection, 'verified' | 'lastCheckedAt'>): string {
  const checked = connection.lastCheckedAt
    ? ` · last checked ${format(new Date(connection.lastCheckedAt), 'MMM d, h:mm a')}`
    : '';
  return `${connection.verified ? 'Key verified' : 'Key saved'}${checked}`;
}

/** "Gemini 3.5 Flash-Lite · Gemini 3.8 Flash": the two models a provider uses. */
export function modelsLine(connection: AIConnection, joiner = ' · '): string {
  if (!connection.models) return '';
  const { fast, detailed } = connection.models;
  return [fast.id, detailed.id].map((id) => modelName(connection.provider, id)).join(joiner);
}

/** The empty value stands for the recommended model, which follows the catalog. */
export function modelOptions(
  provider: CatalogProvider,
  role: AIRole,
): { value: string; label: string }[] {
  const recommended = recommendedModel(provider, role);
  const others = modelsForRole(provider, role).filter((model) => model.id !== recommended.id);
  return [
    { value: '', label: `${recommended.displayName} (recommended)` },
    ...others.map((model) => ({ value: model.id, label: model.displayName })),
  ];
}

/** The drop-down value of a model in use: only a model the user chose is more than "recommended". */
export const modelValue = (model: { id: string; source: string }): string =>
  model.source === 'SELECTED' ? model.id : '';

/** "Saved. New mails use Gemini 2.5 Flash for fast screening." */
export function modelSavedNote(providerId: string, modelId: string | null, role: AIRole): string {
  const name = modelId ? modelName(providerId, modelId) : 'the recommended model';
  return `Saved. New mails use ${name} for ${ROLE_LABELS[role].toLowerCase()}.`;
}

/** What happens to new mail when the active provider is removed: another provider, or none. */
export function removeChoices(
  settings: AISettingsResponse,
  providerId: string,
): { value: string; label: string }[] {
  const removing = settings.connections.find((connection) => connection.provider === providerId);
  if (!removing?.active) return [];
  const next = inactiveConnections(settings)
    .filter(canActivate)
    .map((connection) => ({
      value: connection.provider,
      label: `${providerName(connection.provider)} reads new mails`,
    }));
  return next.length ? [...next, { value: 'none', label: 'No provider: new mails wait' }] : [];
}

/** "Google Gemini reads new mails now.", after a provider was made active. */
export function activatedNote(settings: AISettingsResponse, providerId: string): string {
  const name = providerName(providerId);
  const reading = settings.access.state === 'READY' && settings.waitingEmails > 0;
  return `${name} reads new mails now.${reading ? ' Waiting emails are being processed.' : ''}`;
}

/** "Your OpenAI key is removed.", and that new mail waits when no provider is active now. */
export function removedNote(settings: AISettingsResponse, providerId: string): string {
  const note = `Your ${providerName(providerId)} key is removed.`;
  if (activeConnection(settings) || !settings.connections.length) return note;
  return `${note} No provider reads your mail now.`;
}

/** The note after "Check key" on a provider that is not active. */
export function inactiveCheckNote(response: CheckAIProviderResponse, providerId: string): string {
  const name = providerName(providerId);
  if (response.verification === 'VERIFIED') return `${name} confirmed the key and models.`;
  if (response.verification === 'REJECTED')
    return `${name} refused the key. Replace it to use ${name}.`;
  const because = response.verificationFailure
    ? `: ${failureSaid(response.verificationFailure, true)}`
    : '';
  return `${name} did not confirm right now${because}. Try again later.`;
}
