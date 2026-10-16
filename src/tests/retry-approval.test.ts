import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import type { AIFailure, AIModelPause } from '../contracts/ai';
import type { AIRetryApprovalDetails, EmailAIStatus } from '../contracts/email';
import {
  refusedUntil,
  retryApprovalCopy,
  retryPause,
  retryProblem,
  retryRefusedUntil,
} from '../lib/retryApproval';

// Local times, so the clock reads the same in every time zone. "Now" is Oct 14, 11:45 AM.
const at = (hours: number, minutes: number) => new Date(2026, 9, 14, hours, minutes).toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 14, 11, 45));
});
afterEach(() => vi.useRealTimers());

const noAnswer: AIFailure = {
  kind: 'NO_ANSWER_IN_TIME',
  cause: 'TIMEOUT',
  provider: 'gemini',
  model: 'gemini-3.8-flash',
  httpStatus: null,
  providerCode: null,
  quotaScope: null,
  freeTier: false,
  networkCode: null,
  stopReason: null,
  at: at(11, 45),
  waitedMs: 75_000,
  timeoutMs: 60_000,
  attempt: 3,
  maxAttempts: 3,
};
type HeldStep = AIRetryApprovalDetails['operations'][number];
const held = (overrides: Partial<HeldStep> = {}): AIRetryApprovalDetails => ({
  operations: [
    {
      operation: 'extraction',
      reason: 'ATTEMPTS_EXHAUSTED',
      provider: 'gemini',
      model: 'gemini-3.8-flash',
      attemptedAt: at(11, 44),
      triedAt: [at(11, 37), at(11, 40), at(11, 44)],
      failure: noAnswer,
      ...overrides,
    },
  ],
  currentProvider: 'gemini',
});

describe('the retry dialog says what happened', () => {
  it('after 3 tries with no answer, as on the mock (screen 5)', () => {
    expect(retryApprovalCopy(held())).toEqual({
      steps: [
        'Reading the details was sent to Google Gemini · Gemini 3.8 Flash 3 times, at 11:37, 11:40 and 11:44 AM. Each time there was no answer within 60 seconds, so Google may have charged for these tries.',
      ],
      text: 'Career Companion already tried 3 times and will not try again on its own. Retrying makes one more AI call on your Google Gemini account, which may be charged.',
      switched: null,
    });
  });

  it('names each minute once when tries fall in the same minute', () => {
    const pm = (minutes: number, secs: number) =>
      new Date(2026, 9, 14, 17, minutes, secs).toISOString();
    const sameMinute = retryApprovalCopy(held({ triedAt: [pm(7, 1), pm(7, 20), pm(7, 40)] }));
    expect(sameMinute.steps[0]).toMatch(/ Gemini 3\.8 Flash 3 times, at 5:07 PM\. Each time /);
    const twoMinutes = retryApprovalCopy(held({ triedAt: [pm(7, 1), pm(7, 30), pm(9, 0)] }));
    expect(twoMinutes.steps[0]).toMatch(/ 3 times, at 5:07 and 5:09 PM\. /);
  });

  it('an unusable answer after one try', () => {
    const copy = retryApprovalCopy(
      held({
        operation: 'classification',
        reason: 'INVALID_OUTPUT',
        model: 'gemini-3.5-flash-lite',
        attemptedAt: at(11, 30),
        triedAt: [at(11, 30)],
        failure: {
          ...noAnswer,
          kind: 'INVALID_OUTPUT',
          cause: 'PROVIDER_ANSWER',
          stopReason: 'MAX_TOKENS',
        },
      }),
    );
    expect(copy.steps).toEqual([
      'Sorting the mail was sent to Google Gemini · Gemini 3.5 Flash-Lite at 11:30 AM. It returned an answer Career Companion could not use (stopped early: MAX_TOKENS).',
    ]);
    expect(copy.text).toMatch(/^Career Companion already tried once and will not try again/);
  });

  it('an older step, from before tries and failures were kept, in plain words', () => {
    const copy = retryApprovalCopy(
      held({
        reason: 'OUTCOME_UNKNOWN',
        model: 'gemini-2.5-flash',
        attemptedAt: at(10, 0),
        triedAt: [],
        failure: null,
      }),
    );
    expect(copy.steps).toEqual([
      'Reading the details was sent to Google Gemini · Gemini 2.5 Flash at 10:00 AM. There was no answer in time, so Google may have charged for this try.',
    ]);
    const unknown = retryApprovalCopy(
      held({ provider: null, model: null, attemptedAt: null, triedAt: [], failure: null }),
    );
    expect(unknown.steps).toEqual([
      'Reading the details was sent. There was no answer in time, so the AI provider may have charged for this try.',
    ]);
    expect(unknown.text).toMatch(/^Career Companion will not try again on its own\. /);
    for (const text of [...copy.steps, copy.text])
      expect(text).not.toMatch(/never retries|outcome is unknown|Outcome unknown/);
  });

  it('names the provider the retry uses when the user switched since', () => {
    const copy = retryApprovalCopy({
      ...held({ provider: 'openai', model: 'gpt-x', failure: null }),
      currentProvider: 'gemini',
    });
    expect(copy.switched).toBe(
      'This retry uses Google Gemini, not the provider used before. The email will be sent to Google Gemini.',
    );
  });
});

describe('Manual Retry during a pause', () => {
  const pause = (roles: AIModelPause['roles'], resumesAt: string): AIModelPause => ({
    model: 'gemini-3.8-flash',
    roles,
    reason: 'PROVIDER_BUSY',
    resumesAt,
    failure: null,
    test: null,
  });
  const status = (step: EmailAIStatus['step']) =>
    ({ step, reason: 'NO_ANSWER_IN_TIME', nextStep: 'RETRY_WITH_YOUR_OK' }) as EmailAIStatus;

  it("waits for the pause of the model the mail's step uses, with its time", () => {
    expect(retryPause(status('extraction'), [pause(['detailed'], at(11, 52))], null)).toEqual({
      until: at(11, 52),
      label: 'Paused until about 11:52 AM',
    });
    // The other model's pause does not hold this mail back.
    expect(retryPause(status('extraction'), [pause(['fast'], at(11, 52))], null)).toBeNull();
    expect(retryPause(status('classification'), [pause(['fast'], at(11, 50))], null)?.label).toBe(
      'Paused until about 11:50 AM',
    );
  });

  it('shows the time a refused retry named, and the later time when both are known', () => {
    expect(retryPause(null, [], at(12, 5))?.label).toBe('Paused until about 12:05 PM');
    expect(
      retryPause(status('extraction'), [pause(['detailed'], at(11, 52))], at(11, 50))?.until,
    ).toBe(at(11, 52));
  });

  it('is free again once the time has passed', () => {
    expect(retryPause(status('extraction'), [pause(['detailed'], at(11, 44))], at(11, 40))).toBe(
      null,
    );
  });
});

describe('a retry the server refused because AI cannot be used right now', () => {
  const refusal = (resumesAt: string | null) =>
    new ApiError('no', 'http', 409, 'AI_ACCESS_UNAVAILABLE', {
      state: 'LIMITED',
      reason: 'PROVIDER_BUSY',
      resumesAt,
      modelId: 'gemini-3.8-flash',
      failure: null,
    });

  it('names the time AI can be used again', () => {
    expect(refusedUntil(refusal(at(11, 52)))).toBe(at(11, 52));
  });

  it('names no time for a problem the user must fix, or for other answers', () => {
    expect(refusedUntil(refusal(null))).toBeNull();
    expect(refusedUntil(new ApiError('no', 'http', 409, 'AI_RETRY_NEEDS_APPROVAL', {}))).toBeNull();
    expect(refusedUntil(new Error('offline'))).toBeNull();
  });
});

describe('the latest answers to a retry, per mail', () => {
  const refusal = new ApiError('no', 'http', 409, 'AI_ACCESS_UNAVAILABLE', {
    state: 'LIMITED',
    reason: 'SAFETY_LIMIT',
    resumesAt: at(12, 0),
    modelId: null,
    failure: null,
  });

  it('a refused retry shows its time on that mail only', () => {
    const answers = [
      { variables: 'mail-1', error: refusal },
      { variables: 'mail-2', error: null },
    ];
    expect(retryRefusedUntil(answers, 'mail-1')).toBe(at(12, 0));
    expect(retryRefusedUntil(answers, 'mail-2')).toBeNull();
  });

  it('says in words only what the dialog or the row does not show', () => {
    expect(retryProblem(null)).toBe(false);
    expect(retryProblem(refusal)).toBe(false);
    expect(retryProblem(new ApiError('ok?', 'http', 409, 'AI_RETRY_NEEDS_APPROVAL', {}))).toBe(
      false,
    );
    expect(retryProblem(new ApiError('fix', 'http', 409, 'AI_ACCESS_UNAVAILABLE', {}))).toBe(true);
    expect(retryProblem(new ApiError('later', 'http', 409, 'RETRY_RECENTLY_QUEUED'))).toBe(true);
  });
});
