import type { AIReadingJobMail, AIReadingStatusResponse, AIReadingStep } from '../contracts/ai';
import { clock, modelName, providerName } from './aiLabels';
import { CATEGORY_LABEL } from './mails';

/**
 * "AI is reading your mails" (owner, 24 Oct 2026): the words of the status at the bottom of the
 * side menu and in the phone top bar, and of its live feed. The time is always "about".
 */

/** The status's look: a ring while reading (the bar shows the rest), else a filled icon. */
export type ReadingIcon = 'reading' | 'paused' | 'problem' | 'setup' | 'done';

export interface ReadingWords {
  icon: ReadingIcon;
  /** Also what a screen reader hears, once, when it changes. */
  title: string;
  line: string | null;
  /** `live`: blue and moving. `held`: grey, while a pause or the daily limit holds it. */
  bar: 'live' | 'held' | null;
  /** A link to the AI providers page. */
  link: string | null;
}

/** "about 4 min left": under 15 minutes by the minute, then by 5 minutes, then by the hour. */
export function timeLeftText(seconds: number): string {
  if (seconds < 60) return 'less than a minute left';
  const minutes = Math.ceil(seconds / 60);
  if (minutes <= 15) return `about ${minutes} min left`;
  const rounded = Math.round(minutes / 5) * 5;
  if (rounded < 60) return `about ${rounded} min left`;
  const hours = Math.round(minutes / 60);
  return `about ${hours} ${hours === 1 ? 'hour' : 'hours'} left`;
}

const waits = (count: number) => `${count} ${count === 1 ? 'mail waits' : 'mails wait'}`;
const progress = (status: AIReadingStatusResponse) => `${status.done} of ${status.total} done`;

function readingWords(status: AIReadingStatusResponse): ReadingWords {
  const time = status.secondsLeft === null ? '' : ` · ${timeLeftText(status.secondsLeft)}`;
  return {
    icon: 'reading',
    title: status.inLine ? 'Waiting in line' : 'Reading your new mails',
    line: `${progress(status)}${time}`,
    bar: 'live',
    link: null,
  };
}

/** Who is busy: the free AI, the user's provider limiting the key, or the paused model. */
function pausedTitle(status: AIReadingStatusResponse): string {
  if (status.reason === 'SAFETY_LIMIT') return 'Daily AI limit reached';
  if (status.reason === 'FREE_AI_BUSY') return 'Free AI is busy';
  if (status.reason === 'RATE_LIMITED')
    return `${providerName(status.provider)} is limiting your key`;
  return `${modelName(status.provider, status.model)} is busy`;
}

function pausedWords(status: AIReadingStatusResponse): ReadingWords {
  // The daily limit ends at an exact time; a pause only about then.
  const when = status.reason === 'SAFETY_LIMIT' ? 'at' : 'about';
  const goesOn = status.resumesAt ? ` · continues ${when} ${clock(status.resumesAt)}` : '';
  return {
    icon: 'paused',
    title: pausedTitle(status),
    line: `${progress(status)}${goesOn}`,
    bar: 'held',
    link: null,
  };
}

function stoppedWords(status: AIReadingStatusResponse): ReadingWords {
  const paused = status.reason === 'PAUSED';
  return {
    icon: 'paused',
    title: paused ? 'AI reading is paused' : 'Free AI is paused',
    line: waits(status.notDone),
    bar: null,
    link: paused ? null : 'Connect your own key',
  };
}

/** The user's own problem, as short as the AI notice's title. */
function problemTitle(status: AIReadingStatusResponse): string {
  const name = providerName(status.provider);
  switch (status.reason) {
    case 'KEY_REJECTED':
      return `${name} rejected your key`;
    case 'ACCOUNT_OR_BILLING':
      return `${name} refused your account`;
    case 'MODEL_UNAVAILABLE':
      return `Your key cannot use ${modelName(status.provider, status.model)}`;
    case 'PROVIDER_UNSUPPORTED':
      return `${name} is not offered any more`;
    case 'KEY_UNREADABLE':
      return 'Enter your API key again';
    default:
      return "AI can't read your mails";
  }
}

function needsYouWords(status: AIReadingStatusResponse): ReadingWords {
  if (status.reason === 'NOT_SET_UP')
    return {
      icon: 'setup',
      title: `${status.notDone} new ${status.notDone === 1 ? 'mail waits' : 'mails wait'} for AI`,
      line: null,
      bar: null,
      link: "Choose how they're read",
    };
  return {
    icon: 'problem',
    title: problemTitle(status),
    line: waits(status.notDone),
    bar: null,
    link: 'Fix it on AI providers',
  };
}

export const DONE_WORDS: ReadingWords = {
  icon: 'done',
  title: 'Done reading your new mails',
  line: null,
  bar: null,
  link: null,
};

/** What the status says; null when nothing waits. */
export function statusWords(status: AIReadingStatusResponse): ReadingWords | null {
  switch (status.state) {
    case 'READING':
      return readingWords(status);
    case 'PAUSED':
      return pausedWords(status);
    case 'STOPPED':
      return stoppedWords(status);
    case 'NEEDS_YOU':
      return needsYouWords(status);
    default:
      return null;
  }
}

/** "Interview · Northwind, Frontend Engineer": the type, then who and what when the AI found it. */
export function jobLabel(job: Pick<AIReadingJobMail, 'category' | 'companyName' | 'jobTitle'>) {
  const type = job.category ? CATEGORY_LABEL[job.category] : 'Job mail';
  const what = [job.companyName, job.jobTitle].filter(Boolean).join(', ');
  return what ? `${type} · ${what}` : type;
}

export interface StepView {
  /** One per mail and step: a step is shown once. */
  key: string;
  /** The model that runs the step, while it runs. */
  model: string | null;
  action: string;
  /** The AI runs this step now: its words shimmer. */
  working: boolean;
  /** A job mail's answer: in the job colour. */
  job: boolean;
  subject: string;
}

/** One line of the live feed: what the AI does with a mail now, or what it found. */
export function stepView(step: AIReadingStep): StepView {
  const working = step.step === 'SORTING' || step.step === 'READING_DETAILS';
  const actions: Record<AIReadingStep['step'], string> = {
    SORTING: 'Is it a job mail?',
    READING_DETAILS: 'Job mail · reading details…',
    NOT_JOB: 'Not a job mail',
    JOB: jobLabel(step),
    STOPPED: 'Could not be read · waits for your OK',
  };
  return {
    key: `${step.emailId}:${step.step}`,
    model: working && step.model ? modelName(step.provider, step.model) : null,
    action: actions[step.step],
    working,
    job: step.step === 'JOB',
    // A mail that is not about a job keeps no subject.
    subject: step.subject || (step.step === 'NOT_JOB' ? '(subject not kept)' : '(no subject)'),
  };
}

/** The steps of an answer not shown yet, oldest first. */
export const unseenSteps = (steps: readonly AIReadingStep[], seen: ReadonlySet<string>) =>
  steps.map(stepView).filter((view) => !seen.has(view.key));

/** The live feed's playback: the answer it last took in, the steps shown or waiting, and now. */
export interface Playback {
  answer: AIReadingStatusResponse | undefined;
  seen: ReadonlySet<string>;
  queue: readonly StepView[];
  current: StepView | null;
}

export const NO_PLAYBACK: Playback = {
  answer: undefined,
  seen: new Set(),
  queue: [],
  current: null,
};

/**
 * Takes in a new answer: its new steps wait in line to be shown one after another, so the feed
 * looks live while the status asks only every 5 seconds. The first answer shows only its newest
 * step. Nothing waits: the feed starts again.
 */
export function takeAnswer(play: Playback, answer: AIReadingStatusResponse | undefined): Playback {
  if (!answer || answer.state === 'NONE') return { ...NO_PLAYBACK, answer };
  const fresh = unseenSteps(answer.steps, play.seen);
  if (!fresh.length) return { ...play, answer };
  const seen = new Set([...play.seen, ...fresh.map((view) => view.key)]);
  if (!play.seen.size) return { answer, seen, queue: [], current: fresh[fresh.length - 1] };
  return { ...play, answer, seen, queue: [...play.queue, ...fresh] };
}

/** Shows the next waiting step. */
export const showNext = (play: Playback): Playback =>
  play.queue.length ? { ...play, current: play.queue[0], queue: play.queue.slice(1) } : play;
