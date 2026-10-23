import { isApiError } from '../api/client';
import {
  AIAccessUnavailableDetailsSchema,
  AISampleFailedDetailsSchema,
  AISettingsResponseSchema,
  type AIFailure,
  type AIModelPause,
  type AISettingsResponse,
  type CheckAIProviderResponse,
  type SaveAIProviderResponse,
} from '../contracts/ai';
import type { CatalogProvider } from '../contracts/aiCatalog';
import {
  clock,
  failureCode,
  isPauseReason,
  modelName,
  providerCompany,
  providerName,
  seconds,
  waitedTime,
  type PauseReason,
} from './aiLabels';
import { waitingPause } from './aiWaiting';

/** Which quota a 429 hit, after its code: "429 RESOURCE_EXHAUSTED (per-minute limit)". */
function quotaOf({ quotaScope, freeTier }: AIFailure): string {
  if (quotaScope === 'PER_MINUTE') return ' (per-minute limit)';
  if (quotaScope === 'PER_DAY') return ` (daily limit${freeTier ? ', free tier' : ''})`;
  return '';
}

/**
 * One failed AI call in plain words: what the provider answered (the status and short code) or
 * that no answer came, when, and how long Career Companion waited. `named` also names the model.
 * Never the provider's message text.
 */
export function failureSaid(failure: AIFailure, named: boolean): string {
  const model = modelName(failure.provider, failure.model);
  const at = clock(failure.at);
  // ", after 2 seconds"; nothing under 1 second.
  const waited = waitedTime(failure.waitedMs);
  const after = waited ? `, after ${waited}` : '';
  const code = failureCode(failure);
  const network = failure.networkCode ? ` (${failure.networkCode})` : '';
  if (failure.cause === 'NETWORK')
    return `Career Companion could not reach ${providerName(failure.provider)} at ${at}${network}`;
  if (failure.cause === 'NETWORK_AFTER_SEND') {
    const dropped = `the line dropped at ${at}${network}${after}`;
    return named ? `${model} did not answer: ${dropped}` : dropped;
  }
  if (failure.kind === 'NO_ANSWER_IN_TIME') {
    const limit = seconds(failure.timeoutMs);
    const withCode = code ? ` (${code})` : '';
    return named
      ? `${model} did not answer within ${limit}${withCode}`
      : `no answer within ${limit} at ${at}${withCode}`;
  }
  if (failure.kind === 'INVALID_OUTPUT')
    return `${model} returned an answer Career Companion could not use${failure.stopReason ? ` (stopped early: ${failure.stopReason})` : ''}`;
  if (failure.kind === 'INTERNAL_ERROR') return 'Career Companion stopped on an error of its own';
  const company = providerCompany(failure.provider);
  const said = code
    ? `${company} answered ${code}${quotaOf(failure)}`
    : `${company} answered with an error`;
  return `${said}${named ? ` for ${model}` : ''} at ${at}${after}`;
}

/** A paused model's short reason, before what it answered: "Busy: Google answered …". */
const PAUSE_LABEL: Record<PauseReason, string> = {
  PROVIDER_BUSY: 'Busy',
  RATE_LIMITED: 'Too many requests',
  PROVIDER_UNAVAILABLE: 'Did not respond',
};

function pauseLabel({ reason, failure }: AIModelPause): string {
  if (failure?.quotaScope === 'PER_DAY') return 'Daily limit used up';
  // No answer in time pauses as busy; the failure says what really happened.
  if (failure?.kind === 'NO_ANSWER_IN_TIME') return 'No answer in time';
  if (failure?.cause === 'NETWORK') return 'No connection';
  return isPauseReason(reason) ? PAUSE_LABEL[reason] : 'Paused';
}

/**
 * True unless something holds every model: a key, account or setup problem, or Career
 * Companion's own daily limit (a model's pause shows first while both apply).
 */
function modelsCanWork({ access, usageToday, safetyLimit }: AISettingsResponse): boolean {
  if (access.state !== 'READY' && !isPauseReason(access.reason)) return false;
  return usageToday.calls < safetyLimit.callsPerDay;
}

/** A model's state on the AI provider page. */
export interface ModelState {
  label: string;
  tone: 'success' | 'warning';
  /** Why it is paused, with the code: "Busy: Google answered 503 UNAVAILABLE at 11:44 AM, …". */
  why: string | null;
}

/**
 * "Working", or "Paused until about 11:52 AM" with the reason and the code. Null when a problem
 * that holds every model is shown instead.
 */
export function modelState(settings: AISettingsResponse, modelId: string): ModelState | null {
  const pause = settings.access.pauses.find((p) => p.model === modelId);
  if (pause)
    return {
      label: `Paused until about ${clock(pause.resumesAt)}`,
      tone: 'warning',
      why: `${pauseLabel(pause)}${pause.failure ? `: ${failureSaid(pause.failure, false)}` : ''}.`,
    };
  return modelsCanWork(settings) ? { label: 'Working', tone: 'success', why: null } : null;
}

/**
 * " Gemini 3.5 Flash-Lite is not affected.": the setup's other model, while the problem shown is
 * one model's pause and nothing holds the other model too. Empty otherwise.
 */
export function notAffected(settings: AISettingsResponse): string {
  const { access, models, provider } = settings;
  if (!models || !isPauseReason(access.reason) || !modelsCanWork(settings)) return '';
  const paused = [access.modelId, ...access.pauses.map((pause) => pause.model)];
  const other = [models.fast.id, models.detailed.id].find((id) => !paused.includes(id));
  return other ? ` ${modelName(provider, other)} is not affected.` : '';
}

/** "1 email waiting for AI. It is read by itself when the pause ends." */
export function waitingText(settings: AISettingsResponse): string {
  const one = settings.waitingEmails === 1;
  const count = `${settings.waitingEmails} ${one ? 'email' : 'emails'} waiting for AI.`;
  if (!waitingPause(settings)) return count;
  return `${count} ${one ? 'It is read by itself' : 'They are read by themselves'} when the pause ends.`;
}

/** ": Gemini 3.8 Flash did not answer within 10 seconds", when the check kept why. */
const notConfirmedBecause = (failure: AIFailure | null) =>
  failure ? `: ${failureSaid(failure, true)}` : '';

/**
 * A key the provider has not confirmed yet while AI can be used: one notice instead of a green
 * "Ready". It says why the last check did not finish, when this page ran it.
 */
export function notConfirmedNotice(
  settings: AISettingsResponse,
  lastCheck: CheckAIProviderResponse | null,
): { title: string; detail: string } | null {
  if (settings.access.verified || settings.access.state !== 'READY') return null;
  const because =
    lastCheck?.verification === 'INCONCLUSIVE'
      ? `The last check did not finish${notConfirmedBecause(lastCheck.verificationFailure)}. `
      : '';
  return {
    title: `${providerName(settings.provider)} has not confirmed your key yet`,
    detail: `${because}Mails are still read, and the first AI call that works confirms the key.`,
  };
}

/**
 * The note shown after "Check again": a failed request, or what the check found. Nothing while the
 * not-confirmed notice shows, since it already says how the last check went.
 */
export function checkNoteShown(
  lastCheck: CheckAIProviderResponse | null,
  failed: boolean,
  notConfirmedShown: boolean,
): string | null {
  if (failed) return 'The check could not be completed.';
  if (notConfirmedShown || !lastCheck) return null;
  return keyCheckNote(lastCheck);
}

/**
 * The note after "Check again"; null when the status says it all. While a model is paused, the
 * header's "Key verified" says the key works: "confirmed" would read as if AI works too.
 */
export function keyCheckNote(response: CheckAIProviderResponse): string | null {
  const name = providerName(response.provider);
  if (response.verification === 'VERIFIED')
    return response.access.pauses.length ? null : `${name} confirmed your key and models.`;
  if (response.verification === 'INCONCLUSIVE')
    return `${name} did not confirm right now${notConfirmedBecause(response.verificationFailure)}. Try again later.`;
  return null;
}

/** The settings in a save or check answer, without that check's own result: what the page caches. */
export const settingsOf = (
  response: SaveAIProviderResponse | CheckAIProviderResponse,
): AISettingsResponse => AISettingsResponseSchema.parse(response);

/** ": Google Gemini did not confirm right now: … did not answer within 10 seconds." */
function unconfirmedTail(response: SaveAIProviderResponse, providerId: string): string {
  if (!response.verificationFailure)
    return ' The provider did not confirm right now; Career Companion will use it and show any problem here.';
  return ` ${providerName(providerId)} did not confirm right now${notConfirmedBecause(response.verificationFailure)}. Career Companion will use it and show any problem here.`;
}

/**
 * The note after "Connect and verify": whether the provider now reads new mail. Waiting emails are
 * processed only while AI can be used.
 */
export function connectNote(response: SaveAIProviderResponse, providerId: string): string {
  const name = providerName(providerId);
  const active = response.provider === providerId;
  const note = active
    ? `${name} is connected and reads new mails now.`
    : `${name} is connected. Make it active when you want it to read new mails.`;
  if (response.verification !== 'VERIFIED')
    return `${note}${unconfirmedTail(response, providerId)}`;
  const reading = active && response.access.state === 'READY' && response.waitingEmails > 0;
  return reading ? `${note} Waiting emails are being processed.` : note;
}

/** The note after a key is replaced. */
export function keyReplacedNote(response: SaveAIProviderResponse, providerId: string): string {
  const note = `New ${providerName(providerId)} key saved.`;
  if (response.verification !== 'VERIFIED')
    return `${note}${unconfirmedTail(response, providerId)}`;
  return `New ${providerName(providerId)} key saved and verified.`;
}

/** What went wrong when a key or model was saved; nothing was saved unless it says otherwise. */
export interface SaveProblem {
  text: string;
  link?: { label: string; href: string };
}

export function saveProblem(err: unknown, provider: CatalogProvider): SaveProblem {
  const name = provider.displayName;
  if (!isApiError(err)) return { text: 'Saving failed. Try again.' };
  if (err.outcomeUncertain)
    return {
      text: 'We could not confirm whether this was saved. The page shows what is saved now.',
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
        text: `This key cannot use ${modelName(provider.id, details.modelId)}. Choose another model. Nothing was saved.`,
      };
  }
  if (err.code === 'AI_VERIFY_RATE_LIMITED')
    return { text: 'Too many key checks today. Try again tomorrow.' };
  return { text: err.message };
}

/** A sample test refused because AI cannot be used now: the paused model, or the status above. */
function sampleUnavailable(details: unknown, providerId: string): string {
  const parsed = AIAccessUnavailableDetailsSchema.safeParse(details);
  if (parsed.success && parsed.data.modelId && parsed.data.resumesAt)
    return `${modelName(providerId, parsed.data.modelId)} is paused until about ${clock(parsed.data.resumesAt)}. See the status above.`;
  return 'AI access cannot be used right now. See the status above.';
}

/**
 * Why the sample test did not work: which model did not answer and how long Career Companion
 * waited, or what the provider answered.
 */
export function sampleTestProblem(err: unknown, providerId: string): string {
  if (!isApiError(err)) return 'The sample test failed.';
  const sampleFailed =
    err.code === 'AI_SAMPLE_FAILED' && AISampleFailedDetailsSchema.safeParse(err.details);
  if (sampleFailed && sampleFailed.success) {
    const { failure } = sampleFailed.data;
    const tokens =
      failure.kind === 'NO_ANSWER_IN_TIME' ? ' It may still have used a few tokens.' : '';
    return `The sample test did not finish: ${failureSaid(failure, true)}.${tokens}`;
  }
  if (err.outcomeUncertain)
    return 'The sample test did not finish. It may still have used a few tokens.';
  if (err.code === 'AI_ACCESS_REJECTED')
    return `${providerName(providerId)} refused the request. See the status above for the fix.`;
  if (err.code === 'AI_ACCESS_UNAVAILABLE') return sampleUnavailable(err.details, providerId);
  return err.message;
}
