import { format, isToday, isTomorrow, isYesterday } from 'date-fns';
import { AI_ROLES, getCatalogProvider } from '../contracts/aiCatalog';
import type { AIAccessReason, AIFailure, AIModelPause, AISettingsResponse } from '../contracts/ai';
import { freeAICopy } from './freeAI';

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

/** The company that answers for a provider, as in "Google answered 503 UNAVAILABLE". */
const COMPANY: Partial<Record<string, string>> = {
  gemini: 'Google',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  'career-companion': 'OpenRouter',
};

export const providerCompany = (id: string | null | undefined) =>
  (id && COMPANY[id]) || 'the AI provider';

/** "503 UNAVAILABLE": the status and the provider's short code we keep, never its message text. */
export const failureCode = (failure: Pick<AIFailure, 'httpStatus' | 'providerCode'>) =>
  [failure.httpStatus, failure.providerCode].filter((part) => part !== null).join(' ');

/** "3 seconds", from a time Career Companion measured. */
export function seconds(ms: number): string {
  const count = Math.round(ms / 1000);
  return `${count} second${count === 1 ? '' : 's'}`;
}

/** "3 seconds" Career Companion waited for an answer; null under 1 second, too short to say. */
export const waitedTime = (ms: number) => (ms < 1000 ? null : seconds(ms));

/** "11:36 AM", "12:30 PM tomorrow", or the date too when it is further away. */
export function clock(iso: string): string {
  const date = new Date(iso);
  const time = format(date, 'h:mm a');
  if (isToday(date)) return time;
  if (isTomorrow(date)) return `${time} tomorrow`;
  if (isYesterday(date)) return `${time} yesterday`;
  return format(date, 'MMM d, h:mm a');
}

/** True when the catalog offers the model for Detailed analysis; false for a fast-only model. */
const offeredForDetails = (providerId: string, modelId: string | null | undefined) =>
  getCatalogProvider(providerId)
    ?.models.find((m) => m.id === modelId)
    ?.roles.includes('detailed') ?? true;

/**
 * Provenance phrase for an AI result; the rule-based filter is not a provider. For a mail's
 * details, a fast-only model means the fast model stood in while the Detailed model was paused.
 */
export function analyzedBy(
  provider: string | null | undefined,
  model: string | null | undefined,
  details = false,
) {
  if (!provider) return null;
  if (provider === 'deterministic') return 'Filtered by rules (no AI)';
  const fallback = details && !offeredForDetails(provider, model) ? ' (fallback)' : '';
  return `Analyzed by ${providerName(provider)} · ${modelName(provider, model)}${fallback}`;
}

/** " 2 emails are waiting.", or nothing when no mail waits. */
export function waitingLine(count: number): string {
  if (!count) return '';
  return ` ${count} ${count === 1 ? 'email is' : 'emails are'} waiting.`;
}

export const startCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The provider's own short name, as in "Your free Gemini limit for today is used up". */
const PRODUCT: Partial<Record<string, string>> = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  anthropic: 'Claude',
};

const productName = (id: string | null) => (id && PRODUCT[id]) || providerName(id);

/** A model's pause as the banner words it: why, until when, the failure behind it, its test mail. */
export interface ShownPause extends Pick<AIModelPause, 'reason' | 'failure' | 'test'> {
  model: string | null;
  resumesAt: string | null;
}

export interface AccessCopy {
  title: string;
  detail: string;
  /** The part of `detail` shown in bold: the status and code, or our time limit. */
  strong?: string;
  /** A line under `detail`: how to read sooner. */
  hint?: string;
  /** One fix: an external provider page or a place in Career Companion. */
  fix?: { label: string; href?: string; to?: '/ai' };
}

/** What a paused model answered, in the banner's words. */
interface Answer {
  title: string;
  /** The title after the test mail of "Read waiting mails now" met the same answer. */
  again: string;
  /** "Google answered 503 UNAVAILABLE", then " at 11:36 AM" when a time is given. */
  said: ((at: string | null) => string) | null;
  strong?: string;
}

const atTime = (at: string | null) => (at ? ` at ${at}` : '');
/** " at about 11:38 AM": when a pause ends, as Career Companion stored it. */
const atAbout = (iso: string | null) => (iso ? ` at about ${clock(iso)}` : ' soon');

type Titles = (name: string, company: string) => Pick<Answer, 'title' | 'again'>;

const BUSY: Titles = (name) => ({
  title: `${name} is busy right now`,
  again: `${name} is still busy`,
});

/**
 * The pauses that end by themselves, and their titles: a model's pause, or an older pause kept as
 * PROVIDER_UNAVAILABLE.
 */
const PAUSE_TITLES = {
  PROVIDER_BUSY: BUSY,
  RATE_LIMITED: (_name, company) => ({
    title: `${company} is limiting requests from your key`,
    again: `${company} is still limiting requests from your key`,
  }),
  PROVIDER_UNAVAILABLE: (name) => ({
    title: `${name} did not respond`,
    again: `${name} still did not respond`,
  }),
} satisfies Record<string, Titles>;

export type PauseReason = keyof typeof PAUSE_TITLES;

export const isPauseReason = (reason: string | null): reason is PauseReason =>
  reason !== null && reason in PAUSE_TITLES;

/** No connection before sending (as busy), or the line dropped after it (as no answer in time). */
function noConnection(provider: string | null, failure: AIFailure): Answer {
  const name = providerName(provider);
  const code = failure.networkCode ? ` (${failure.networkCode})` : '';
  return {
    title: `Career Companion could not reach ${name}`,
    again: `Career Companion still could not reach ${name}`,
    said:
      failure.cause === 'NETWORK_AFTER_SEND'
        ? (at) => `the line dropped${atTime(at)}${code} after sending`
        : (at) => `no connection${atTime(at)}${code}`,
  };
}

/** The answer behind a pause: the status and code, our time limit, or the connection's code. */
function answerOf(provider: string | null, pause: ShownPause): Answer {
  const { failure } = pause;
  if (failure && (failure.cause === 'NETWORK' || failure.cause === 'NETWORK_AFTER_SEND'))
    return noConnection(provider, failure);
  const name = pause.model ? modelName(provider, pause.model) : providerName(provider);
  if (failure?.kind === 'NO_ANSWER_IN_TIME') {
    const limit = seconds(failure.timeoutMs);
    return {
      title: `${name} did not answer in time`,
      again: `${name} still did not answer in time`,
      said: (at) => `no answer within ${limit}${atTime(at)}`,
      strong: limit,
    };
  }
  const company = providerCompany(provider);
  const titles = (isPauseReason(pause.reason) ? PAUSE_TITLES[pause.reason] : BUSY)(name, company);
  const code = failure && failureCode(failure);
  if (!code) return { ...titles, said: null };
  const scope = failure?.quotaScope === 'PER_MINUTE' ? ' (per-minute limit)' : '';
  return {
    ...titles,
    said: (at) => `${company} answered ${code}${scope}${atTime(at)}`,
    strong: code,
  };
}

/** " (try 2 of 3)": the next try of a mail that got no answer in time, while it has tries left. */
function nextTryOf(failure: AIFailure | null): string {
  if (failure?.kind !== 'NO_ANSWER_IN_TIME' || !failure.attempt || !failure.maxAttempts) return '';
  if (failure.attempt >= failure.maxAttempts) return '';
  return ` (try ${failure.attempt + 1} of ${failure.maxAttempts})`;
}

/** A daily quota: when it resets, and for a free tier how to read sooner. No new try can help. */
function dailyLimitCopy(
  settings: AISettingsResponse,
  pause: ShownPause,
  failure: AIFailure,
  unaffected: string,
): AccessCopy {
  const { provider } = settings;
  const code = failureCode(failure);
  const free = failure.freeTier;
  const links = provider ? getCatalogProvider(provider)?.links : undefined;
  const product = productName(provider);
  return {
    title: free
      ? `Your free ${product} limit for today is used up`
      : `Your daily ${product} limit is used up`,
    detail: `${providerCompany(provider)} answered ${code} (daily limit${free ? ', free tier' : ''}) for ${modelName(provider, failure.model)} at ${clock(failure.at)}. It resets${atAbout(pause.resumesAt)}, and reading continues by itself then.${unaffected}${waitingLine(settings.waitingEmails)}`,
    strong: code,
    // Only Google reports a free tier; billing on the key's project lifts it.
    hint: free ? 'To read sooner, turn on billing for your key in Google AI Studio.' : undefined,
    fix:
      free && links?.billing
        ? { label: 'Open Google AI Studio billing', href: links.billing }
        : undefined,
  };
}

/**
 * A model's pause: what it answered and when, and the next try by itself. After the test mail of
 * "Read waiting mails now" met the same answer, the test's result: the pause did not get longer.
 * `unaffected` is a sentence the AI provider page adds: " Gemini 3.5 Flash-Lite is not affected."
 */
export function pauseCopy(
  settings: AISettingsResponse,
  pause: ShownPause,
  unaffected = '',
): AccessCopy {
  const { failure, test } = pause;
  if (failure?.quotaScope === 'PER_DAY')
    return dailyLimitCopy(settings, pause, failure, unaffected);
  const answer = answerOf(settings.provider, pause);
  const retry = `Career Companion tries again by itself${atAbout(pause.resumesAt)}${nextTryOf(failure)}.${unaffected}${waitingLine(settings.waitingEmails)}`;
  if (test?.result && failure) {
    const said = answer.said ? `: ${answer.said(null)}` : '';
    return {
      title: answer.again,
      detail: `Tried 1 test mail at ${clock(test.startedAt ?? failure.at)}${said}. The pause did not get longer. ${retry}`,
      strong: answer.strong,
    };
  }
  const said = answer.said && failure ? `${startCase(answer.said(clock(failure.at)))}. ` : '';
  return { title: answer.title, detail: `${said}${retry}`, strong: answer.strong };
}

/** A pause's own title, before its test mail met any answer: "Gemini 3.8 Flash is busy right now". */
export const pauseTitle = (settings: AISettingsResponse, pause: ShownPause) =>
  pauseCopy(settings, { ...pause, test: null }).title;

/** The pause the user's AI access shows, the one that blocks most, with its test mail. */
export function accessPause(settings: AISettingsResponse): ShownPause | null {
  const { access } = settings;
  if (!isPauseReason(access.reason)) return null;
  return {
    model: access.modelId,
    reason: access.reason,
    resumesAt: access.resumesAt,
    failure: access.failure,
    test: access.pauses.find((pause) => pause.model === access.modelId)?.test ?? null,
  };
}

/** The role a model has in the setup, as in "Choose another detailed model". */
function roleOf(settings: AISettingsResponse, modelId: string | null): string {
  const roles = AI_ROLES.filter((role) => settings.models?.[role].id === modelId);
  return roles.length === 1 ? `${roles[0]} ` : '';
}

type UserProblem = Extract<
  AIAccessReason,
  'KEY_REJECTED' | 'ACCOUNT_OR_BILLING' | 'MODEL_UNAVAILABLE'
>;

/** A key, billing or model problem: what the provider answered, when kept, and the fix. */
function userProblemCopy(settings: AISettingsResponse, reason: UserProblem): AccessCopy {
  const { access, provider } = settings;
  const name = providerName(provider);
  const links = provider ? getCatalogProvider(provider)?.links : undefined;
  const waiting = waitingLine(settings.waitingEmails);
  const code = access.failure ? failureCode(access.failure) : undefined;
  // "Google answered 401 API_KEY_INVALID at 11:36 AM. "
  const answered = access.failure
    ? `${providerCompany(provider)} answered ${code} at ${clock(access.failure.at)}. `
    : '';
  switch (reason) {
    case 'KEY_REJECTED':
      return {
        title: `${name} rejected your API key`,
        detail: `${answered}Create a new key and replace it on the AI providers page.${waiting}`,
        strong: code,
        fix: links?.apiKeys
          ? { label: `Get a ${name} API key`, href: links.apiKeys }
          : { label: 'Replace key', to: '/ai' },
      };
    case 'ACCOUNT_OR_BILLING':
      return {
        title: `${name} refused requests for your account`,
        detail: `${answered}Check billing, and that the ${productName(provider)} API is turned on for this key's project, then choose "Check again".${waiting}`,
        strong: code,
        fix: links?.billing ? { label: `Open ${name} billing`, href: links.billing } : undefined,
      };
    case 'MODEL_UNAVAILABLE':
      return {
        title: `Your key cannot use ${modelName(provider, access.modelId)}`,
        detail: `${answered}Choose another ${roleOf(settings, access.modelId)}model on the AI providers page.${waiting}`,
        strong: code,
        fix: { label: 'Choose another model', to: '/ai' },
      };
  }
}

/**
 * What the user sees for an AI access state: the cause, the exact failure when kept, one fix. A
 * model's pause adds `unaffected` after its next try (see `pauseCopy`).
 */
export function accessCopy(settings: AISettingsResponse, unaffected = ''): AccessCopy | null {
  const { access, provider } = settings;
  if (access.state === 'READY') return null;
  const free = freeAICopy(settings);
  if (free) return free;
  const pause = accessPause(settings);
  if (pause) return pauseCopy(settings, pause, unaffected);
  const name = providerName(provider);
  const waiting = waitingLine(settings.waitingEmails);
  switch (access.reason) {
    case 'KEY_REJECTED':
    case 'ACCOUNT_OR_BILLING':
    case 'MODEL_UNAVAILABLE':
      return userProblemCopy(settings, access.reason);
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
    case 'SAFETY_LIMIT':
      return {
        title: "You reached Career Companion's daily AI limit",
        detail: `Career Companion makes at most ${settings.safetyLimit.callsPerDay} AI calls a day for you. This is our limit, not ${providerCompany(provider)}'s. Reading continues by itself${atAbout(access.resumesAt ?? settings.safetyLimit.resetsAt)}.${waiting}`,
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
