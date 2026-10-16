import { isApiError } from '../api/client';
import { AIAccessUnavailableDetailsSchema, type AIModelPause } from '../contracts/ai';
import type { AIRole } from '../contracts/aiCatalog';
import type { AIRetryApprovalDetails, EmailAIStatus } from '../contracts/email';
import { clock, modelName, providerCompany, providerName, seconds } from './aiLabels';
import { STEP, clockList } from './mailAIStatus';

type HeldStep = AIRetryApprovalDetails['operations'][number];

/** What the retry dialog says: each held step, then what a retry does and may cost. */
export interface RetryApprovalCopy {
  steps: string[];
  text: string;
  /** Said when the retry goes to another provider than the earlier tries. */
  switched: string | null;
}

const stepName = (operation: string) =>
  (STEP as Partial<Record<string, string>>)[operation] ?? operation;

/** When the step was sent: each counted try, or the latest one for an older step. */
const sentAt = (op: HeldStep) =>
  op.triedAt.length || !op.attemptedAt ? op.triedAt : [op.attemptedAt];

/** " 3 times, at 11:37, 11:40 and 11:44 AM.", " at 11:44 AM." or ".". */
function when(times: string[]): string {
  if (times.length > 1) return ` ${times.length} times, at ${clockList(times)}.`;
  return times.length ? ` at ${clock(times[0])}.` : '.';
}

/** Why the step stopped, and that the provider may have charged for the tries. */
function whatHappened(op: HeldStep, tries: number): string {
  const f = op.failure;
  const charged = `so ${providerCompany(f?.provider ?? op.provider)} may have charged for ${tries > 1 ? 'these tries' : 'this try'}.`;
  const kind = f?.kind ?? (op.reason === 'INVALID_OUTPUT' ? 'INVALID_OUTPUT' : 'NO_ANSWER_IN_TIME');
  if (kind === 'INVALID_OUTPUT')
    return `It returned an answer Career Companion could not use${f?.stopReason ? ` (stopped early: ${f.stopReason})` : ''}.`;
  if (kind === 'NO_ANSWER_IN_TIME')
    return `${tries > 1 ? 'Each time there' : 'There'} was no answer${f ? ` within ${seconds(f.timeoutMs)}` : ' in time'}, ${charged}`;
  return `Career Companion does not know if it was read, ${charged}`;
}

/** "Reading the details was sent to Google Gemini · Gemini 3.8 Flash 3 times, at … Each time …". */
function stepLine(op: HeldStep): string {
  const to = op.provider
    ? ` to ${providerName(op.provider)} · ${modelName(op.provider, op.model)}`
    : '';
  const times = sentAt(op);
  return `${stepName(op.operation)} was sent${to}${when(times)} ${whatHappened(op, times.length)}`;
}

function alreadyTried(tries: number): string {
  if (tries > 1) return `already tried ${tries} times and `;
  return tries === 1 ? 'already tried once and ' : '';
}

/**
 * The retry dialog: when each held step was tried and why it stopped, from the tries and the last
 * failure the server kept (never stored text), and that the user's OK makes one more call.
 */
export function retryApprovalCopy(details: AIRetryApprovalDetails): RetryApprovalCopy {
  const current = providerName(details.currentProvider);
  const tries = Math.max(0, ...details.operations.map((op) => sentAt(op).length));
  const switched = details.operations.some(
    (op) => op.provider && details.currentProvider && op.provider !== details.currentProvider,
  );
  return {
    steps: details.operations.map(stepLine),
    text: `Career Companion ${alreadyTried(tries)}will not try again on its own. Retrying makes one more AI call on your ${current} account, which may be charged.`,
    switched: switched
      ? `This retry uses ${current}, not the provider used before. The email will be sent to ${current}.`
      : null,
  };
}

const ROLE: Record<NonNullable<EmailAIStatus['step']>, AIRole> = {
  classification: 'fast',
  extraction: 'detailed',
};

/** Manual Retry while it must wait: until when, and what the button says then. */
export interface RetryPause {
  until: string;
  label: string;
}

/**
 * Whether Manual Retry must wait: the running pause of the model the mail's step uses now (the
 * server checks it by the role), or the time a refused retry named. The later one counts; null
 * once both have passed.
 */
export function retryPause(
  status: EmailAIStatus | null | undefined,
  pauses: readonly AIModelPause[],
  refused: string | null | undefined,
  now = Date.now(),
): RetryPause | null {
  const role = status?.step ? ROLE[status.step] : null;
  const times = pauses
    .filter((pause) => role !== null && pause.roles.includes(role))
    .map((pause) => pause.resumesAt);
  if (refused) times.push(refused);
  const until = times
    .filter((at) => Date.parse(at) > now)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  return until ? { until, label: `Paused until about ${clock(until)}` } : null;
}

/** The time a retry refused with 409 AI_ACCESS_UNAVAILABLE names: when AI can be used again. */
export function refusedUntil(error: unknown): string | null {
  if (!isApiError(error) || error.code !== 'AI_ACCESS_UNAVAILABLE') return null;
  const details = AIAccessUnavailableDetailsSchema.safeParse(error.details);
  return details.success ? details.data.resumesAt : null;
}

/** The latest answer to a retry of a mail: whether the server refused it. */
interface RetryAnswer {
  variables: string | undefined;
  error: unknown;
}

/** A retry of this mail refused because AI cannot be used right now: until when. */
export const retryRefusedUntil = (answers: readonly RetryAnswer[], emailId: string) =>
  answers
    .map((answer) => (answer.variables === emailId ? refusedUntil(answer.error) : null))
    .find(Boolean) ?? null;

/**
 * A refused retry the page says in words: not the OK it asks for (the dialog asks), nor a time
 * AI cannot be used until (the row shows it).
 */
export const retryProblem = (error: unknown) =>
  !!error &&
  !refusedUntil(error) &&
  !(isApiError(error) && error.code === 'AI_RETRY_NEEDS_APPROVAL');
