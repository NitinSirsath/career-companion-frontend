/**
 * The guided first run (owner, 22 Nov 2026, approved mock `POSTS-SPACES-mock/northlist.html`):
 * right after the first sign-in, one step per screen: Welcome, Connect Gmail, Install, Alerts, Theme,
 * How it works, Your AI, Done. Every step can be skipped and every setting changed later. The server
 * keeps the step the user reached (`onboarding` on the profile), so leaving halfway continues there.
 * It replaces the 15 Nov "no tour" choice.
 */
import { ONBOARDING_STEPS, type OnboardingStep } from '../contracts/auth';

export type { OnboardingStep };

/** The first run's own page; the rest of the app waits while it is open. */
export const ONBOARDING_PATH = '/welcome';

export const STEP_NAME: Record<OnboardingStep, string> = {
  welcome: 'Welcome',
  gmail: 'Gmail',
  install: 'Install',
  alerts: 'Alerts',
  theme: 'Theme',
  tour: 'How it works',
  ai: 'Your AI',
  done: 'Done',
};

/** What this device can do: some browsers cannot install the app or show alerts. */
export interface DeviceCan {
  install: boolean;
  alerts: boolean;
}

/** The steps to show on this device, in order. */
export function stepsFor(can: DeviceCan): OnboardingStep[] {
  return ONBOARDING_STEPS.filter(
    (step) => (step !== 'install' || can.install) && (step !== 'alerts' || can.alerts),
  );
}

/**
 * The step to show for the one asked: itself, or the next one this device has (a step saved on a
 * phone that this laptop's browser cannot do).
 */
export function shownStep(steps: readonly OnboardingStep[], step: OnboardingStep): OnboardingStep {
  if (steps.includes(step)) return step;
  const later = ONBOARDING_STEPS.slice(ONBOARDING_STEPS.indexOf(step));
  return later.find((next) => steps.includes(next)) ?? 'done';
}

/** The step one forward or back, staying at the first and the last. */
export function nextStep(
  steps: readonly OnboardingStep[],
  step: OnboardingStep,
  by: 1 | -1,
): OnboardingStep {
  const at = steps.indexOf(shownStep(steps, step));
  return steps[Math.min(steps.length - 1, Math.max(0, at + by))];
}

/** "Step 2 of 6": the steps between Welcome and Done; null on those two. */
export const middleSteps = (steps: readonly OnboardingStep[]): OnboardingStep[] =>
  steps.filter((s) => s !== 'welcome' && s !== 'done');

export function stepCount(steps: readonly OnboardingStep[], step: OnboardingStep) {
  const middle = middleSteps(steps);
  const at = middle.indexOf(step);
  return at === -1 ? null : { number: at + 1, of: middle.length, name: STEP_NAME[step] };
}

/**
 * Finished on this page: the profile the app started with still names a step, so the redirect
 * must not send the user back. A new page load asks the server again.
 */
let finishedHere = false;

export function markOnboardingFinished() {
  finishedHere = true;
}

/** True while the signed-in user's first run is open. */
export function onboardingOpen(user: { onboarding?: { step: OnboardingStep } | null } | null) {
  return !!user?.onboarding && !finishedHere;
}

/** For tests: forget a run finished on this page. */
export function resetOnboardingForTests() {
  finishedHere = false;
}

/** "How it works": the four things the user meets every day. */
export const TOUR = [
  {
    key: 'mails',
    title: 'Mails',
    text: 'Only job mails, person first. Who wrote, what they ask, what is due.',
    tint: 'sand',
  },
  {
    key: 'applications',
    title: 'Applications',
    text: 'Made by the AI from your mails. The ring shows where each one stands.',
    tint: 'sage',
  },
  {
    key: 'dashboard',
    title: 'Dashboard',
    text: 'What needs you today, and how your search is going.',
    tint: 'lilac',
  },
  {
    key: 'reply',
    title: 'Reply with AI',
    text: 'Write the answer in the app. The AI drafts it from the mail; you send.',
    tint: 'peach',
  },
] as const;
export type TourKey = (typeof TOUR)[number]['key'];

/** The AI apps NorthList Apply runs in: Antigravity first and recommended (owner, 22 Nov 2026). */
export const AI_APPS = [
  {
    key: 'antigravity',
    short: 'AG',
    name: 'Antigravity',
    note: 'Recommended',
  },
  {
    key: 'claude-code',
    short: 'CC',
    name: 'Claude Code',
    note: 'Opens in a terminal',
  },
  {
    key: 'codex',
    short: 'CX',
    name: 'Codex',
    note: "OpenAI's coding app",
  },
] as const;
export type AIAppKey = (typeof AI_APPS)[number]['key'];

/**
 * The three guided steps of "Your AI", done in order: 0 none, 3 connected. Opening the AI app (or
 * copying the prompt) ticks the first; the user sends it there, then allows NorthList; the new
 * token's first use ticks all three.
 */
export function aiProgress(started: boolean, used: boolean): number {
  if (used) return 3;
  return started ? 1 : 0;
}
