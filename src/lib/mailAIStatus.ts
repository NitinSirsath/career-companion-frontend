import { format } from 'date-fns';
import type { AIFailure, AIModelPause } from '../contracts/ai';
import type { EmailAIReason, EmailAIStatus } from '../contracts/email';
import type { EmailMessage } from '../contracts/gmail';
import {
  clock,
  failureCode,
  modelName,
  providerCompany,
  providerName,
  seconds,
  startCase,
  waitedTime,
} from './aiLabels';

/** The (i) next to a row badge: what happened, in plain words, and what happens next. */
export interface MailAIInfo {
  title: string;
  text: string;
  /** The AI step the mail is at. */
  step: string | null;
  next: { label: 'Next try:' | 'Next:'; text: string };
}

export interface MailAIView {
  badge: string;
  tone: 'neutral' | 'warning' | 'error';
  /** The (i); null when there is nothing to explain. */
  info: MailAIInfo | null;
  /** The (i) button's name. */
  question: string;
  /** A line under the badge that shows without opening the (i). */
  note: string | null;
  /** Manual Retry is offered. */
  retry: boolean;
}

type Words = Pick<MailAIInfo, 'title' | 'text'>;

/** What the (i) is worded from: the mail's own status, and the names it uses. */
interface Facts {
  status: EmailAIStatus;
  stopped: boolean;
  /** The model, or the provider when the model is not known: "Gemini 3.8 Flash". */
  name: string;
  /** "Google Gemini". */
  provider: string;
  /** "Google", as in "Google answered 503 UNAVAILABLE". */
  company: string;
  notCounted: string;
  /** The failure behind the pause of the mail's model, when the mail met none itself. */
  pauseFailure: AIFailure | null;
  /** What the test mail of "Read waiting mails now" met, when this mail is it. */
  test: string | undefined;
}

/** The AI step's name, as the (i) and the retry dialog say it. */
export const STEP: Record<NonNullable<EmailAIStatus['step']>, string> = {
  classification: 'Sorting the mail',
  extraction: 'Reading the details',
};

/** What a test mail of "Read waiting mails now" met, after "This was the test mail: ". */
const TEST_RESULT: Partial<Record<EmailAIReason, string>> = {
  PROVIDER_BUSY: 'still busy',
  NO_ANSWER_IN_TIME: 'no answer in time',
  RATE_LIMITED: 'too many requests',
};

const network = (code: string | null) => (code ? ` (${code})` : '');
const testTitle = ({ test }: Facts, title: string) =>
  test ? `This was the test mail: ${test}` : title;
/** "Google answered 401 API_KEY_INVALID at 11:36 AM. ", when the mail met the problem itself. */
const answered = ({ status: { failure }, company }: Facts) =>
  failure ? `${company} answered ${failureCode(failure)} at ${clock(failure.at)}. ` : '';

/**
 * "11:37, 11:40 and 11:44 AM": the times of the tries, AM or PM once when they share it. Tries in
 * the same minute show it once.
 */
export function clockList(isos: string[]): string {
  const times = [...new Set(isos.map(clock))];
  const half = ` ${format(new Date(isos[0]), 'a')}`;
  const sameHalf = times.every((time) => time.endsWith(half));
  const shown = times.map((time, i) =>
    sameHalf && i < times.length - 1 ? time.slice(0, -half.length) : time,
  );
  const last = shown[shown.length - 1];
  return shown.length > 1 ? `${shown.slice(0, -1).join(', ')} and ${last}` : last;
}

/** Busy: the mail's own answer, or the one that paused its model when the mail met none itself. */
function busy(facts: Facts): Words {
  const { status, name, company, notCounted } = facts;
  const own = status.failure;
  const f = own ?? facts.pauseFailure;
  if (!f) return { title: `${name} is busy right now`, text: notCounted };
  if (f.cause === 'NETWORK')
    return {
      title: testTitle(facts, `Could not reach ${facts.provider}`),
      text: `No connection at ${clock(f.at)}${network(f.networkCode)}. ${notCounted}`,
    };
  if (facts.test) {
    const sentAt = new Date(new Date(f.at).getTime() - f.waitedMs).toISOString();
    const waited = waitedTime(f.waitedMs);
    return {
      title: `This was the test mail: ${facts.test}`,
      text: `Sent at ${clock(sentAt)}. ${company} answered ${failureCode(f)}${waited ? ` after ${waited}` : ''}. ${notCounted}`,
    };
  }
  // "after 3 seconds", only when the mail met the answer itself.
  const waited = own && waitedTime(own.waitedMs);
  const after = waited ? `, after ${waited}` : '';
  return {
    title: `${name} was busy`,
    text: `${company} answered ${failureCode(f)} at ${clock(f.at)}${after}. ${notCounted}`,
  };
}

/**
 * No answer in time, and the mail is tried again by itself: the try it used, or the no answer
 * that paused its model when the mail met none itself (then it used no try).
 */
function noAnswerWait(facts: Facts): Words {
  const { status, name, notCounted } = facts;
  const own = status.failure;
  const f = own ?? facts.pauseFailure;
  if (!f) return { title: `${name} did not answer in time`, text: notCounted };
  const used = own
    ? `That used try ${f.attempt ?? status.attempts} of ${f.maxAttempts ?? status.maxAttempts}.`
    : notCounted;
  if (f.cause === 'NETWORK_AFTER_SEND')
    return {
      title: testTitle(facts, `Could not reach ${facts.provider}`),
      text: `The line dropped at ${clock(f.at)}${network(f.networkCode)} after sending. ${used}`,
    };
  const code = failureCode(f);
  const withCode = code ? ` (${code})` : '';
  const waited = own && waitedTime(f.waitedMs);
  const noAnswer = own ? 'No answer' : `No answer within ${seconds(f.timeoutMs)}`;
  return {
    title: testTitle(facts, `${name} did not answer in time`),
    text: waited
      ? `We waited ${waited} at ${clock(f.at)} and got no answer${withCode}. ${used}`
      : `${noAnswer} at ${clock(f.at)}${withCode}. ${used}`,
  };
}

/** No answer in time on the last automatic try: every try, and the possible charge. */
function noAnswerTimes({ status, name, company }: Facts): Words {
  const f = status.failure;
  const tries = Math.max(status.triedAt.length, status.attempts);
  const times = status.triedAt.length || !f ? status.triedAt : [f.at];
  const within = f ? ` within ${seconds(f.timeoutMs)}` : ' in time';
  const charged = `${startCase(company)} may have charged for ${tries > 1 ? 'these tries' : 'this try'}.`;
  return {
    title: tries > 1 ? `${name} did not answer ${tries} times` : `${name} did not answer in time`,
    text: `No answer${within}${times.length ? ` at ${clockList(times)}` : ''}. ${charged}`,
  };
}

/** A 429: the mail's own, or the one that paused its model when the mail met none itself. */
function rateLimited(facts: Facts): Words {
  const { status, name, company, notCounted } = facts;
  const own = status.failure;
  const f = own ?? facts.pauseFailure;
  if (!f) return { title: 'Too many requests', text: notCounted };
  // "Google answered 429 at 3:10 PM: ", only when the mail met the limit itself.
  const answer = own ? `${company} answered ${own.httpStatus ?? 429} at ${clock(own.at)}: ` : '';
  if (f.quotaScope === 'PER_DAY')
    return {
      title: testTitle(facts, 'Daily limit used up'),
      text: `${startCase(`${answer}the ${f.freeTier ? 'free-tier ' : ''}daily limit`)} for ${name}. ${notCounted}`,
    };
  const limit = f.quotaScope === 'PER_MINUTE' ? 'the per-minute limit' : 'too many requests';
  return {
    title: testTitle(facts, 'Too many requests'),
    text: `${startCase(`${answer}${limit}`)} for ${name}. ${notCounted}`,
  };
}

/** Why the mail waits or stopped, by its kind: the title and the sentence of the (i). */
const WORDS: Record<EmailAIReason, (facts: Facts) => Words> = {
  PROVIDER_BUSY: busy,
  NO_ANSWER_IN_TIME: (facts) => (facts.stopped ? noAnswerTimes(facts) : noAnswerWait(facts)),
  RATE_LIMITED: rateLimited,
  PROVIDER_UNAVAILABLE: ({ provider, notCounted }) => ({
    title: `${provider} did not respond`,
    text: notCounted,
  }),
  SAFETY_LIMIT: ({ company, notCounted }) => ({
    title: "Career Companion's daily limit",
    text: `This is our limit, not ${company}'s. ${notCounted}`,
  }),
  KEY_REJECTED: (facts) => ({
    title: `${facts.provider} rejected your API key`,
    text: `${answered(facts)}Waiting for a working API key.`,
  }),
  ACCOUNT_OR_BILLING: (facts) => ({
    title: `${facts.provider} refused requests for your account`,
    text: `${answered(facts)}Waiting for your ${facts.company} account to accept requests.`,
  }),
  MODEL_UNAVAILABLE: (facts) => ({
    title: `Your key cannot use ${facts.name}`,
    text: `${answered(facts)}Waiting for another model to be chosen.`,
  }),
  NOT_SET_UP: () => ({ title: 'AI is not set up', text: 'Waiting for an AI key.' }),
  KEY_UNREADABLE: () => ({
    title: 'Enter your API key again',
    text: 'Career Companion could not read your saved key.',
  }),
  PROVIDER_UNSUPPORTED: ({ provider }) => ({
    title: `${provider} is not offered any more`,
    text: 'Choose another AI provider.',
  }),
  PAUSED: () => ({
    title: 'AI processing is paused',
    text: 'Career Companion has paused AI processing for now.',
  }),
  INVALID_OUTPUT: ({ status, name }) => ({
    title: 'Unusable answer',
    text: `${name} returned an answer Career Companion could not use${status.failure?.stopReason ? ` (stopped early: ${status.failure.stopReason})` : ''}.`,
  }),
  INVALID_REQUEST: ({ status, company }) => {
    const code = status.failure ? failureCode(status.failure) : '';
    return {
      title: 'Request refused',
      text: `Career Companion sent a request ${company} refused${code ? ` (${code})` : ''}. This is our problem, not yours.`,
    };
  },
  GMAIL_FAILED: () => ({
    title: 'Gmail request failed',
    text: 'Career Companion could not read this mail from Gmail.',
  }),
  INTERNAL_ERROR: () => ({
    title: 'An error in Career Companion',
    text: 'Career Companion stopped on an error of its own. This is our problem, not yours.',
  }),
};

function whatHappened(
  status: EmailAIStatus,
  stopped: boolean,
  pauses: readonly AIModelPause[],
): Words {
  const provider = status.failure?.provider ?? status.provider;
  const model = status.failure?.model ?? status.model;
  const name = model ? modelName(provider, model) : providerName(provider);
  if (status.readNowTest === 'TEST_MAIL' && !status.nextTryAt)
    return {
      title: 'This is the test mail',
      text: 'Career Companion is trying it now. The other waiting mails follow only if it works.',
    };
  // The user said OK to a stopped mail; the API keeps no time for the OK.
  if (stopped && status.nextStep === 'AUTOMATIC_RETRY')
    return {
      title: `${name} is tried once more`,
      text: 'You said OK. Career Companion tries it again in a moment.',
    };
  const pause = status.failure
    ? undefined
    : pauses.find((p) => p.model === model && p.failure?.kind === status.reason);
  return WORDS[status.reason]({
    status,
    stopped,
    name,
    provider: providerName(provider),
    company: providerCompany(provider),
    notCounted: `This does not use one of the ${status.maxAttempts} tries.`,
    pauseFailure: pause?.failure ?? null,
    test:
      status.readNowTest === 'TEST_MAIL' && status.failure
        ? status.failure.quotaScope === 'PER_DAY'
          ? 'daily limit used up'
          : TEST_RESULT[status.reason]
        : undefined,
  });
}

/** When the mail is tried again by itself: "about 11:39 AM, by itself (try 2 of 3)". */
function automaticTry(status: EmailAIStatus, stopped: boolean): string {
  // A stopped mail waits for the worker after the user's OK; then it is tried by itself.
  if (stopped) return 'in a moment, by itself';
  if (!status.nextTryAt) return status.readNowTest === 'TEST_MAIL' ? 'now' : 'soon, by itself';
  const tryOf =
    status.reason === 'NO_ANSWER_IN_TIME' && status.attempts > 0
      ? ` (try ${status.attempts + 1} of ${status.maxAttempts})`
      : '';
  return `about ${clock(status.nextTryAt)}, by itself${tryOf}`;
}

/** What happens next, for the (i). */
const NEXT: Record<
  EmailAIStatus['nextStep'],
  (status: EmailAIStatus, stopped: boolean) => MailAIInfo['next']
> = {
  AUTOMATIC_RETRY: (status, stopped) => ({
    label: 'Next try:',
    text: automaticTry(status, stopped),
  }),
  WAITS_FOR_TEST_MAIL: () => ({ label: 'Next:', text: 'waits for the test mail.' }),
  FIX_AI_SETTINGS: () => ({ label: 'Next:', text: 'waits for you in AI provider settings.' }),
  RETRY_WITH_YOUR_OK: () => ({ label: 'Next:', text: 'waits for you. Use Manual Retry.' }),
  MANUAL_RETRY: () => ({ label: 'Next:', text: 'waits for you. Use Manual Retry.' }),
  CAREER_COMPANION: () => ({ label: 'Next:', text: 'waits for Career Companion.' }),
};

/**
 * The (i) of a waiting or stopped mail, from its own AI status: the kind, the code, the model and
 * our own times. Never from the stored error text, so older mails get plain words too. `pauses`
 * word a mail that only waits for its model's pause.
 */
export function mailAIInfo(
  status: EmailAIStatus,
  stopped: boolean,
  pauses: readonly AIModelPause[] = [],
): MailAIInfo {
  return {
    ...whatHappened(status, stopped, pauses),
    step: status.step && STEP[status.step],
    next: NEXT[status.nextStep](status, stopped),
  };
}

/** A stopped mail that got no answer in time on its last automatic try: the user's OK retries it. */
const needsYourOk = (status: EmailAIStatus) =>
  status.reason === 'NO_ANSWER_IN_TIME' && status.nextStep === 'RETRY_WITH_YOUR_OK';

const RETRY_STEPS: readonly EmailAIStatus['nextStep'][] = ['RETRY_WITH_YOUR_OK', 'MANUAL_RETRY'];

/**
 * A stopped mail: "Needs your OK" or "AI could not read it", never the raw FAILED. After the
 * user's OK it waits for AI again, until the worker picks it up.
 */
function stoppedView(view: MailAIView, status: EmailAIStatus | null): MailAIView {
  if (status?.nextStep === 'AUTOMATIC_RETRY')
    return { ...view, badge: 'Waiting for AI', info: mailAIInfo(status, true) };
  const retry = !status || RETRY_STEPS.includes(status.nextStep);
  if (status && needsYourOk(status))
    return {
      ...view,
      badge: 'Needs your OK',
      tone: 'warning',
      info: mailAIInfo(status, true),
      question: 'Why does this mail need my OK?',
      retry,
    };
  return {
    ...view,
    badge: 'AI could not read it',
    tone: 'error',
    info: status && mailAIInfo(status, true),
    question: 'Why could the AI not read this mail?',
    retry,
  };
}

type RowMail = Pick<
  EmailMessage,
  'processingState' | 'processingStuck' | 'processingRetryable' | 'aiStatus'
>;

/** The plain words for where a mail is, when nothing more needs saying. */
const STATE_WORDS: Record<string, string> = {
  PENDING: 'Queued',
  PROCESSING: 'Reading',
  COMPLETED: 'Read',
};

/**
 * The AI Status cell of a Gmail Sync row: the plain badge, its (i), and whether to offer a retry.
 * `pauses` are the running pauses of the models the setup uses (AI settings).
 */
export function mailAIView(message: RowMail, pauses: readonly AIModelPause[] = []): MailAIView {
  const status = message.aiStatus ?? null;
  const state = message.processingState ?? 'PENDING';
  const view: MailAIView = {
    badge: STATE_WORDS[state] ?? state,
    tone: 'neutral',
    info: null,
    question: 'Why is this mail waiting?',
    note: null,
    retry: false,
  };
  if (message.processingStuck) return { ...view, badge: 'Stopped', tone: 'warning', retry: true };
  if (state === 'PROCESSING' && message.processingRetryable)
    return { ...view, badge: 'Retry scheduled' };
  if (state === 'FAILED') return stoppedView(view, status);
  if (state === 'PENDING' && status)
    return {
      ...view,
      badge: 'Waiting for AI',
      info: mailAIInfo(status, false, pauses),
      note:
        status.nextStep === 'WAITS_FOR_TEST_MAIL' ? 'Not sent yet: waits for the test mail.' : null,
    };
  return view;
}

/**
 * A Manual Retry that only Career Companion may do, in the row's own words ("Request refused.
 * Career Companion sent a request Google refused …"); null when the row does not say so.
 */
export function onlyCareerCompanionText(message: RowMail | undefined): string | null {
  const info = message?.aiStatus?.nextStep === 'CAREER_COMPANION' ? mailAIView(message).info : null;
  return info && `${info.title}. ${info.text}`;
}
