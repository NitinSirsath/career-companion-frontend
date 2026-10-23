import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import type {
  AIFailure,
  AIModelPause,
  AISettingsResponse,
  CheckAIProviderResponse,
  SaveAIProviderResponse,
} from '../contracts/ai';
import { accessCopy, analyzedBy } from '../lib/aiLabels';
import {
  checkNoteShown,
  failureSaid,
  keyCheckNote,
  modelState,
  notAffected,
  notConfirmedNotice,
  connectNote,
  keyReplacedNote,
  sampleTestProblem,
  waitingText,
} from '../lib/aiProviderPage';

// Local times, so the clock reads the same in every time zone. "Now" is Oct 14, 11:46 AM.
const at = (hours: number, minutes: number, secs = 0) =>
  new Date(2026, 9, 14, hours, minutes, secs).toISOString();
const UNTIL = at(11, 52);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 14, 11, 46));
});
afterEach(() => vi.useRealTimers());

const FLASH = 'gemini-3.8-flash';
const LITE = 'gemini-3.5-flash-lite';

const failure = (overrides: Partial<AIFailure> = {}): AIFailure => ({
  kind: 'PROVIDER_BUSY',
  cause: 'PROVIDER_ANSWER',
  provider: 'gemini',
  model: FLASH,
  httpStatus: 503,
  providerCode: 'UNAVAILABLE',
  quotaScope: null,
  freeTier: false,
  networkCode: null,
  stopReason: null,
  at: at(11, 44, 2),
  waitedMs: 2_000,
  timeoutMs: 60_000,
  attempt: null,
  maxAttempts: null,
  ...overrides,
});
const noAnswer = (overrides: Partial<AIFailure> = {}) =>
  failure({
    kind: 'NO_ANSWER_IN_TIME',
    cause: 'TIMEOUT',
    httpStatus: null,
    providerCode: null,
    waitedMs: 75_000,
    ...overrides,
  });
const pause = (overrides: Partial<AIModelPause> = {}): AIModelPause => ({
  model: FLASH,
  roles: ['detailed'],
  reason: 'PROVIDER_BUSY',
  resumesAt: UNTIL,
  failure: failure(),
  test: null,
  ...overrides,
});
const settings = (
  access: Partial<AISettingsResponse['access']> = {},
  extra: Partial<AISettingsResponse> = {},
): AISettingsResponse => ({
  configured: true,
  provider: 'gemini',
  offeredProviders: ['gemini'],
  models: {
    fast: { id: LITE, source: 'RECOMMENDED' },
    detailed: { id: FLASH, source: 'RECOMMENDED' },
  },
  access: {
    state: 'READY',
    reason: null,
    modelId: null,
    resumesAt: null,
    failure: null,
    pauses: [],
    verified: true,
    lastCheckedAt: at(11, 46),
    ...access,
  },
  lastFailure: null,
  usageToday: { day: '2026-10-14', calls: 14, inputTokens: 6120, outputTokens: 1480 },
  safetyLimit: { callsPerDay: 500, resetsAt: '2026-10-15T00:00:00.000Z' },
  waitingEmails: 1,
  needsYourOk: { emails: 0, model: null, lastTriedAt: null, tries: 0 },
  consent: null,
  connections: [],
  ...extra,
});
/** The AI access while one model's pause blocks, as the server shows it. */
const paused = (
  shown: AIModelPause = pause(),
  others: AIModelPause[] = [],
  extra: Partial<AISettingsResponse> = {},
) =>
  settings(
    {
      state: 'LIMITED',
      reason: shown.reason,
      modelId: shown.model,
      resumesAt: shown.resumesAt,
      failure: shown.failure,
      pauses: [shown, ...others],
    },
    extra,
  );

describe("each model's state (mock screen 7)", () => {
  it('a busy model is paused until about its next try, with the reason and the code', () => {
    expect(modelState(paused(), FLASH)).toEqual({
      label: 'Paused until about 11:52 AM',
      tone: 'warning',
      why: 'Busy: Google answered 503 UNAVAILABLE at 11:44 AM, after 2 seconds.',
    });
  });

  it('the other model is working', () => {
    expect(modelState(paused(), LITE)).toEqual({ label: 'Working', tone: 'success', why: null });
    expect(modelState(settings(), FLASH)).toEqual({ label: 'Working', tone: 'success', why: null });
  });

  it.each([
    [noAnswer(), 'No answer in time: no answer within 60 seconds at 11:44 AM.'],
    [
      noAnswer({ cause: 'PROVIDER_DEADLINE', httpStatus: 504, providerCode: 'DEADLINE_EXCEEDED' }),
      'No answer in time: no answer within 60 seconds at 11:44 AM (504 DEADLINE_EXCEEDED).',
    ],
    [
      noAnswer({ cause: 'NETWORK_AFTER_SEND', networkCode: 'ECONNRESET', waitedMs: 12_000 }),
      'No answer in time: the line dropped at 11:44 AM (ECONNRESET), after 12 seconds.',
    ],
    [
      failure({ cause: 'NETWORK', httpStatus: null, providerCode: null, networkCode: 'ENOTFOUND' }),
      'No connection: Career Companion could not reach Google Gemini at 11:44 AM (ENOTFOUND).',
    ],
  ])('words a paused model by what really happened: %#', (shown, why) => {
    expect(modelState(paused(pause({ failure: shown })), FLASH)?.why).toBe(why);
  });

  it('leaves out a wait under 1 second', () => {
    expect(modelState(paused(pause({ failure: failure({ waitedMs: 300 }) })), FLASH)?.why).toBe(
      'Busy: Google answered 503 UNAVAILABLE at 11:44 AM.',
    );
    const dropped = noAnswer({
      cause: 'NETWORK_AFTER_SEND',
      networkCode: 'ECONNRESET',
      waitedMs: 0,
    });
    expect(modelState(paused(pause({ failure: dropped })), FLASH)?.why).toBe(
      'No answer in time: the line dropped at 11:44 AM (ECONNRESET).',
    );
    const refused = failure({
      kind: 'INVALID_REQUEST',
      httpStatus: 400,
      providerCode: 'INVALID_ARGUMENT',
      waitedMs: 0,
    });
    expect(
      sampleTestProblem(
        new ApiError('failed', 'http', 502, 'AI_SAMPLE_FAILED', { failure: refused }),
        'gemini',
      ),
    ).toBe(
      'The sample test did not finish: Google answered 400 INVALID_ARGUMENT for Gemini 3.8 Flash at 11:44 AM.',
    );
  });

  it('words a rate limit with its quota', () => {
    const limit = (quotaScope: AIFailure['quotaScope'], freeTier = false) =>
      paused(
        pause({
          reason: 'RATE_LIMITED',
          failure: failure({
            kind: 'RATE_LIMITED',
            httpStatus: 429,
            providerCode: 'RESOURCE_EXHAUSTED',
            quotaScope,
            freeTier,
            waitedMs: 1_000,
          }),
        }),
      );
    expect(modelState(limit('PER_MINUTE'), FLASH)?.why).toBe(
      'Too many requests: Google answered 429 RESOURCE_EXHAUSTED (per-minute limit) at 11:44 AM, after 1 second.',
    );
    expect(modelState(limit('PER_DAY', true), FLASH)?.why).toBe(
      'Daily limit used up: Google answered 429 RESOURCE_EXHAUSTED (daily limit, free tier) at 11:44 AM, after 1 second.',
    );
  });

  it('an older pause without a kept failure gives its reason only', () => {
    expect(modelState(paused(pause({ failure: null })), FLASH)?.why).toBe('Busy.');
    const older = pause({ reason: 'PROVIDER_UNAVAILABLE', failure: null });
    expect(modelState(paused(older), FLASH)?.why).toBe('Did not respond.');
  });

  it('a paused model shows even while a test mail of "Read waiting mails now" runs', () => {
    const testing = pause({
      test: { emailId: '00000000-0000-4000-8000-000000000001', startedAt: null, result: null },
    });
    expect(modelState(settings({ pauses: [testing] }), FLASH)?.label).toBe(
      'Paused until about 11:52 AM',
    );
  });

  it('never says "Working" while a problem holds every model', () => {
    const keyRejected = settings({ state: 'NEEDS_ATTENTION', reason: 'KEY_REJECTED' });
    expect(modelState(keyRejected, LITE)).toBeNull();
    const safetyLimit = settings({ state: 'LIMITED', reason: 'SAFETY_LIMIT' });
    expect(modelState(safetyLimit, LITE)).toBeNull();
    // A model's pause shows first while Career Companion's own daily limit holds every model.
    const usedUp = paused(pause(), [], {
      usageToday: { day: '2026-10-14', calls: 500, inputTokens: 0, outputTokens: 0 },
    });
    expect(modelState(usedUp, LITE)).toBeNull();
    expect(modelState(usedUp, FLASH)?.label).toBe('Paused until about 11:52 AM');
  });
});

describe('the problem box names the model and the one not affected', () => {
  it('matches the mock (screen 7)', () => {
    const shown = paused();
    const copy = accessCopy(shown, notAffected(shown));
    expect(copy).toMatchObject({
      title: 'Gemini 3.8 Flash is busy right now',
      detail:
        'Google answered 503 UNAVAILABLE at 11:44 AM. Career Companion tries again by itself at about 11:52 AM. Gemini 3.5 Flash-Lite is not affected. 1 email is waiting.',
      strong: '503 UNAVAILABLE',
    });
  });

  it('a daily limit of one model names the other too', () => {
    const daily = failure({
      kind: 'RATE_LIMITED',
      httpStatus: 429,
      providerCode: 'RESOURCE_EXHAUSTED',
      quotaScope: 'PER_DAY',
      freeTier: true,
    });
    const shown = paused(pause({ reason: 'RATE_LIMITED', failure: daily }));
    expect(accessCopy(shown, notAffected(shown))?.detail).toContain(
      'reading continues by itself then. Gemini 3.5 Flash-Lite is not affected. 1 email is waiting.',
    );
  });

  it('says nothing about another model when there is none, or it is held too', () => {
    const lite = pause({ model: LITE, roles: ['fast'] });
    expect(notAffected(paused(pause(), [lite]))).toBe('');
    const oneModel = paused(pause({ roles: ['fast', 'detailed'] }), [], {
      models: {
        fast: { id: FLASH, source: 'SELECTED' },
        detailed: { id: FLASH, source: 'RECOMMENDED' },
      },
    });
    expect(notAffected(oneModel)).toBe('');
    expect(notAffected(settings({ state: 'NEEDS_ATTENTION', reason: 'KEY_REJECTED' }))).toBe('');
    const usedUp = paused(pause(), [], {
      usageToday: { day: '2026-10-14', calls: 500, inputTokens: 0, outputTokens: 0 },
    });
    expect(notAffected(usedUp)).toBe('');
  });

  it('the banner on the other pages is unchanged', () => {
    expect(accessCopy(paused())?.detail).not.toContain('not affected');
  });
});

describe('waiting mail', () => {
  it('is read by itself when the pause ends, with no sync', () => {
    expect(waitingText(paused())).toBe(
      '1 email waiting for AI. It is read by itself when the pause ends.',
    );
    expect(waitingText(paused(pause(), [], { waitingEmails: 3 }))).toBe(
      '3 emails waiting for AI. They are read by themselves when the pause ends.',
    );
  });

  it('gives only the count without a pause', () => {
    expect(waitingText(settings({}, { waitingEmails: 2 }))).toBe('2 emails waiting for AI.');
    const keyRejected = settings({ state: 'NEEDS_ATTENTION', reason: 'KEY_REJECTED' });
    expect(waitingText(keyRejected)).toBe('1 email waiting for AI.');
  });
});

describe('the key check says which model did not answer, and how long we waited', () => {
  const checked = (
    verification: CheckAIProviderResponse['verification'],
    verificationFailure: AIFailure | null = null,
    shown: AISettingsResponse = settings(),
  ): CheckAIProviderResponse => ({ ...shown, verification, verificationFailure });

  it('says "confirmed" only while no model is paused', () => {
    expect(keyCheckNote(checked('VERIFIED'))).toBe('Google Gemini confirmed your key and models.');
    expect(keyCheckNote(checked('VERIFIED', null, paused()))).toBeNull();
  });

  it.each([
    [
      noAnswer({ timeoutMs: 10_000, waitedMs: 10_000 }),
      'Google Gemini did not confirm right now: Gemini 3.8 Flash did not answer within 10 seconds. Try again later.',
    ],
    [
      failure(),
      'Google Gemini did not confirm right now: Google answered 503 UNAVAILABLE for Gemini 3.8 Flash at 11:44 AM, after 2 seconds. Try again later.',
    ],
    [null, 'Google Gemini did not confirm right now. Try again later.'],
  ])('an inconclusive check: %#', (why, note) => {
    expect(keyCheckNote(checked('INCONCLUSIVE', why))).toBe(note);
  });

  it('a rejected key is shown by the status, not a note', () => {
    expect(keyCheckNote(checked('REJECTED'))).toBeNull();
  });

  it('the check on save says it too', () => {
    const saved = (
      verification: SaveAIProviderResponse['verification'],
      verificationFailure: AIFailure | null = null,
      shown: AISettingsResponse = settings(),
    ): SaveAIProviderResponse => ({ ...shown, verification, verificationFailure });
    expect(connectNote(saved('VERIFIED'), 'gemini')).toBe(
      'Google Gemini is connected and reads new mails now. Waiting emails are being processed.',
    );
    expect(connectNote(saved('VERIFIED', null, settings({}, { waitingEmails: 0 })), 'gemini')).toBe(
      'Google Gemini is connected and reads new mails now.',
    );
    // A paused model the save keeps stays paused: its waiting mail is not processed yet.
    expect(connectNote(saved('VERIFIED', null, paused()), 'gemini')).toBe(
    );
    // Another provider stays active: the new one waits until the user makes it active.
    expect(connectNote(saved('VERIFIED'), 'openai')).toBe(
      'OpenAI is connected. Make it active when you want it to read new mails.',
    );
    expect(connectNote(saved('INCONCLUSIVE', noAnswer({ timeoutMs: 10_000 })), 'gemini')).toBe(
      'Google Gemini is connected and reads new mails now. Google Gemini did not confirm right now: Gemini 3.8 Flash did not answer within 10 seconds. Career Companion will use it and show any problem here.',
    );
    expect(keyReplacedNote(saved('VERIFIED'), 'gemini')).toBe(
      'New Google Gemini key saved and verified.',
    );
    expect(keyReplacedNote(saved('INCONCLUSIVE'), 'gemini')).toBe(
      'New Google Gemini key saved. The provider did not confirm right now; Career Companion will use it and show any problem here.',
    );
  });
});

describe('a key the provider has not confirmed yet', () => {
  const checked = (
    verificationFailure: AIFailure | null,
    shown: AISettingsResponse,
  ): CheckAIProviderResponse => ({ ...shown, verification: 'INCONCLUSIVE', verificationFailure });

  it('shows one notice instead of "Ready", with why the last check did not finish', () => {
    const unconfirmed = settings({ verified: false });
    expect(notConfirmedNotice(unconfirmed, null)).toEqual({
      title: 'Google Gemini has not confirmed your key yet',
      detail: 'Mails are still read, and the first AI call that works confirms the key.',
    });
    expect(
      notConfirmedNotice(
        unconfirmed,
        checked(noAnswer({ timeoutMs: 10_000, waitedMs: 10_000 }), unconfirmed),
      )?.detail,
    ).toBe(
      'The last check did not finish: Gemini 3.8 Flash did not answer within 10 seconds. Mails are still read, and the first AI call that works confirms the key.',
    );
  });

  it('leaves the check note out while the notice says how the check went', () => {
    const unconfirmed = settings({ verified: false });
    const last = checked(null, unconfirmed);
    expect(checkNoteShown(last, false, true)).toBeNull();
    expect(checkNoteShown(last, false, false)).toBe(
      'Google Gemini did not confirm right now. Try again later.',
    );
    expect(checkNoteShown(null, true, true)).toBe('The check could not be completed.');
  });

  it('says nothing for a confirmed key, or while a problem is shown instead', () => {
    expect(notConfirmedNotice(settings(), null)).toBeNull();
    expect(
      notConfirmedNotice({ ...paused(), access: { ...paused().access, verified: false } }, null),
    ).toBeNull();
  });
});

describe('the model that read a mail', () => {
  it('names a fast model that read the details while the Detailed model was paused', () => {
    expect(analyzedBy('gemini', LITE, true)).toBe(
      'Analyzed by Google Gemini · Gemini 3.5 Flash-Lite (fallback)',
    );
    expect(analyzedBy('gemini', FLASH, true)).toBe('Analyzed by Google Gemini · Gemini 3.8 Flash');
    // Sorting alone is the fast model's own job.
    expect(analyzedBy('gemini', LITE)).toBe('Analyzed by Google Gemini · Gemini 3.5 Flash-Lite');
  });
});

describe('the sample test says which model did not answer, and how long we waited', () => {
  const sampleFailed = (shown: AIFailure) =>
    new ApiError('failed', 'http', 502, 'AI_SAMPLE_FAILED', { failure: shown });

  it('no answer in time (mock screen 7)', () => {
    expect(sampleTestProblem(sampleFailed(noAnswer()), 'gemini')).toBe(
      'The sample test did not finish: Gemini 3.8 Flash did not answer within 60 seconds. It may still have used a few tokens.',
    );
  });

  it.each([
    [
      noAnswer({ cause: 'PROVIDER_DEADLINE', httpStatus: 504, providerCode: 'DEADLINE_EXCEEDED' }),
      'The sample test did not finish: Gemini 3.8 Flash did not answer within 60 seconds (504 DEADLINE_EXCEEDED). It may still have used a few tokens.',
    ],
    [
      noAnswer({ cause: 'NETWORK_AFTER_SEND', networkCode: 'ECONNRESET', waitedMs: 12_000 }),
      'The sample test did not finish: Gemini 3.8 Flash did not answer: the line dropped at 11:44 AM (ECONNRESET), after 12 seconds. It may still have used a few tokens.',
    ],
    [
      failure({
        kind: 'INVALID_OUTPUT',
        httpStatus: null,
        providerCode: null,
        stopReason: 'MAX_TOKENS',
      }),
      'The sample test did not finish: Gemini 3.8 Flash returned an answer Career Companion could not use (stopped early: MAX_TOKENS).',
    ],
    [
      failure({ kind: 'INVALID_REQUEST', httpStatus: 400, providerCode: 'INVALID_ARGUMENT' }),
      'The sample test did not finish: Google answered 400 INVALID_ARGUMENT for Gemini 3.8 Flash at 11:44 AM, after 2 seconds.',
    ],
    [
      failure({
        kind: 'INTERNAL_ERROR',
        cause: 'UNCLASSIFIED',
        httpStatus: null,
        providerCode: null,
      }),
      'The sample test did not finish: Career Companion stopped on an error of its own.',
    ],
  ])('each kind of failed sample: %#', (shown, text) => {
    expect(sampleTestProblem(sampleFailed(shown), 'gemini')).toBe(text);
  });

  it('a paused model is named, with the end of its pause', () => {
    const refused = new ApiError('no', 'http', 409, 'AI_ACCESS_UNAVAILABLE', {
      state: 'LIMITED',
      reason: 'PROVIDER_BUSY',
      resumesAt: UNTIL,
      modelId: FLASH,
      failure: failure(),
    });
    expect(sampleTestProblem(refused, 'gemini')).toBe(
      'Gemini 3.8 Flash is paused until about 11:52 AM. See the status above.',
    );
    const safetyLimit = new ApiError('no', 'http', 409, 'AI_ACCESS_UNAVAILABLE', {
      state: 'LIMITED',
      reason: 'SAFETY_LIMIT',
      resumesAt: '2026-10-15T00:00:00.000Z',
      modelId: null,
      failure: null,
    });
    expect(sampleTestProblem(safetyLimit, 'gemini')).toBe(
      'AI access cannot be used right now. See the status above.',
    );
  });

  it('keeps the other answers', () => {
    const rejected = new ApiError('no', 'http', 422, 'AI_ACCESS_REJECTED', {
      reason: 'KEY_REJECTED',
      modelId: null,
    });
    expect(sampleTestProblem(rejected, 'gemini')).toBe(
      'Google Gemini refused the request. See the status above for the fix.',
    );
    const uncertain = 'The sample test did not finish. It may still have used a few tokens.';
    expect(sampleTestProblem(new ApiError('timed out', 'timeout'), 'gemini')).toBe(uncertain);
    expect(sampleTestProblem(new ApiError('x', 'http', 502, 'AI_SAMPLE_FAILED'), 'gemini')).toBe(
      uncertain,
    );
    expect(sampleTestProblem(new Error('boom'), 'gemini')).toBe('The sample test failed.');
  });
});

describe('the exact error in words', () => {
  it('names the model only when asked', () => {
    expect(failureSaid(failure(), false)).toBe(
      'Google answered 503 UNAVAILABLE at 11:44 AM, after 2 seconds',
    );
    expect(failureSaid(failure(), true)).toBe(
      'Google answered 503 UNAVAILABLE for Gemini 3.8 Flash at 11:44 AM, after 2 seconds',
    );
  });
});
