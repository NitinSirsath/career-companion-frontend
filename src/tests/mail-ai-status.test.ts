import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AIFailure, AIModelPause } from '../contracts/ai';
import { EmailAINextStepSchema, EmailAIReasonSchema, type EmailAIStatus } from '../contracts/email';
import { mailAIInfo, mailAIView, onlyCareerCompanionText } from '../lib/mailAIStatus';

// Local times, so the clock reads the same in every time zone. "Now" is Oct 14, 11:45 AM.
const at = (hours: number, minutes: number, secs = 0, day = 14) =>
  new Date(2026, 9, day, hours, minutes, secs).toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 14, 11, 45));
});
afterEach(() => vi.useRealTimers());

const failure = (overrides: Partial<AIFailure> = {}): AIFailure => ({
  kind: 'PROVIDER_BUSY',
  cause: 'PROVIDER_ANSWER',
  provider: 'gemini',
  model: 'gemini-3.8-flash',
  httpStatus: 503,
  providerCode: 'UNAVAILABLE',
  quotaScope: null,
  freeTier: false,
  networkCode: null,
  stopReason: null,
  at: at(11, 36, 3),
  waitedMs: 3_000,
  timeoutMs: 60_000,
  attempt: null,
  maxAttempts: null,
  ...overrides,
});
const status = (overrides: Partial<EmailAIStatus> = {}): EmailAIStatus => ({
  reason: 'PROVIDER_BUSY',
  step: 'extraction',
  provider: 'gemini',
  model: 'gemini-3.8-flash',
  failure: failure(),
  attempts: 0,
  maxAttempts: 3,
  triedAt: [],
  nextTryAt: at(11, 38),
  nextStep: 'AUTOMATIC_RETRY',
  readNowTest: null,
  ...overrides,
});
const waiting = (aiStatus: EmailAIStatus) => mailAIView({ processingState: 'PENDING', aiStatus });
const stopped = (aiStatus: EmailAIStatus) => mailAIView({ processingState: 'FAILED', aiStatus });
/** The badge and the (i) as one line each, the way the row shows them. */
const shown = (view: ReturnType<typeof mailAIView>) => ({
  badge: view.badge,
  title: view.info?.title,
  text: view.info?.text,
  next: view.info && `${view.info.next.label} ${view.info.next.text}`,
});

describe('row badge and (i), as on the mock', () => {
  it('Google is busy (screen 1)', () => {
    const view = waiting(status());
    expect(shown(view)).toEqual({
      badge: 'Waiting for AI',
      title: 'Gemini 3.8 Flash was busy',
      text: 'Google answered 503 UNAVAILABLE at 11:36 AM, after 3 seconds. This does not use one of the 3 tries.',
      next: 'Next try: about 11:38 AM, by itself',
    });
    expect(view.info?.step).toBe('Reading the details');
    expect(view.question).toBe('Why is this mail waiting?');
    expect(view.retry).toBe(false);
  });

  it('no answer in time, try 2 of 3 (screen 2)', () => {
    const noAnswer = failure({
      kind: 'NO_ANSWER_IN_TIME',
      cause: 'TIMEOUT',
      httpStatus: null,
      providerCode: null,
      at: at(11, 37, 55),
      waitedMs: 60_000,
      attempt: 1,
      maxAttempts: 3,
    });
    expect(
      shown(
        waiting(
          status({
            reason: 'NO_ANSWER_IN_TIME',
            failure: noAnswer,
            attempts: 1,
            nextTryAt: at(11, 39),
          }),
        ),
      ),
    ).toEqual({
      badge: 'Waiting for AI',
      title: 'Gemini 3.8 Flash did not answer in time',
      text: 'We waited 60 seconds at 11:37 AM and got no answer. That used try 1 of 3.',
      next: 'Next try: about 11:39 AM, by itself (try 2 of 3)',
    });
  });

  it("names Google's own deadline code when it sent one", () => {
    const deadline = failure({
      kind: 'NO_ANSWER_IN_TIME',
      cause: 'PROVIDER_DEADLINE',
      httpStatus: 504,
      providerCode: 'DEADLINE_EXCEEDED',
      at: at(11, 37, 55),
      waitedMs: 60_000,
      attempt: 1,
      maxAttempts: 3,
    });
    expect(
      waiting(status({ reason: 'NO_ANSWER_IN_TIME', failure: deadline, attempts: 1 })).info?.text,
    ).toBe(
      'We waited 60 seconds at 11:37 AM and got no answer (504 DEADLINE_EXCEEDED). That used try 1 of 3.',
    );
  });

  it('the test mail is still busy, the others wait for it (screen 3)', () => {
    const test = status({
      failure: failure({ at: at(11, 44, 2), waitedMs: 2_000 }),
      nextTryAt: at(11, 46),
      readNowTest: 'TEST_MAIL',
    });
    expect(shown(waiting(test))).toEqual({
      badge: 'Waiting for AI',
      title: 'This was the test mail: still busy',
      text: 'Sent at 11:44 AM. Google answered 503 UNAVAILABLE after 2 seconds. This does not use one of the 3 tries.',
      next: 'Next try: about 11:46 AM, by itself',
    });
    const other = waiting(
      status({
        failure: null,
        nextStep: 'WAITS_FOR_TEST_MAIL',
        readNowTest: 'WAITS_FOR_TEST_MAIL',
      }),
    );
    expect(other.badge).toBe('Waiting for AI');
    expect(other.note).toBe('Not sent yet: waits for the test mail.');
    expect(other.info?.next).toEqual({ label: 'Next:', text: 'waits for the test mail.' });
  });

  it('says so while the test mail is being tried', () => {
    const view = waiting(status({ failure: null, nextTryAt: null, readNowTest: 'TEST_MAIL' }));
    expect(view.info?.title).toBe('This is the test mail');
    expect(view.info?.next).toEqual({ label: 'Next try:', text: 'now' });
  });

  it('needs your OK after 3 tries with no answer (screen 4)', () => {
    const view = stopped(
      status({
        reason: 'NO_ANSWER_IN_TIME',
        failure: failure({
          kind: 'NO_ANSWER_IN_TIME',
          cause: 'PROVIDER_DEADLINE',
          httpStatus: 504,
          providerCode: 'DEADLINE_EXCEEDED',
          at: at(11, 44, 55),
          waitedMs: 60_000,
          attempt: 3,
          maxAttempts: 3,
        }),
        attempts: 3,
        triedAt: [at(11, 37), at(11, 40), at(11, 44)],
        nextTryAt: null,
        nextStep: 'RETRY_WITH_YOUR_OK',
      }),
    );
    expect(shown(view)).toEqual({
      badge: 'Needs your OK',
      title: 'Gemini 3.8 Flash did not answer 3 times',
      text: 'No answer within 60 seconds at 11:37, 11:40 and 11:44 AM. Google may have charged for these tries.',
      next: 'Next: waits for you. Use Manual Retry.',
    });
    expect(view.tone).toBe('warning');
    expect(view.question).toBe('Why does this mail need my OK?');
    expect(view.retry).toBe(true);
  });

  it('names each minute of the tries once in the (i)', () => {
    vi.setSystemTime(new Date(2026, 9, 14, 17, 15));
    const pm = (minutes: number, secs: number) => at(17, minutes, secs);
    const needsOk = (triedAt: string[]) =>
      stopped(
        status({
          reason: 'NO_ANSWER_IN_TIME',
          failure: null,
          attempts: 3,
          triedAt,
          nextTryAt: null,
          nextStep: 'RETRY_WITH_YOUR_OK',
        }),
      ).info?.text;
    expect(needsOk([pm(7, 1), pm(7, 20), pm(7, 40)])).toBe(
      'No answer in time at 5:07 PM. Google may have charged for these tries.',
    );
    expect(needsOk([pm(7, 1), pm(7, 30), pm(9, 0)])).toBe(
      'No answer in time at 5:07 and 5:09 PM. Google may have charged for these tries.',
    );
  });

  it("waits for AI again right after the user's OK, until the worker picks it up", () => {
    const view = stopped(
      status({
        reason: 'NO_ANSWER_IN_TIME',
        failure: failure({
          kind: 'NO_ANSWER_IN_TIME',
          cause: 'TIMEOUT',
          httpStatus: null,
          providerCode: null,
          at: at(11, 44, 55),
          waitedMs: 60_000,
          attempt: 3,
          maxAttempts: 3,
        }),
        attempts: 3,
        maxAttempts: 4,
        triedAt: [at(11, 37), at(11, 40), at(11, 44)],
        nextTryAt: null,
        nextStep: 'AUTOMATIC_RETRY',
      }),
    );
    expect(shown(view)).toEqual({
      badge: 'Waiting for AI',
      title: 'Gemini 3.8 Flash is tried once more',
      text: 'You said OK. Career Companion tries it again in a moment.',
      next: 'Next try: in a moment, by itself',
    });
    expect(view.tone).toBe('neutral');
    expect(view.question).toBe('Why is this mail waiting?');
    expect(view.retry).toBe(false);
  });

  it('leaves out a wait under 1 second', () => {
    expect(waiting(status({ failure: failure({ waitedMs: 400 }) })).info?.text).toBe(
      'Google answered 503 UNAVAILABLE at 11:36 AM. This does not use one of the 3 tries.',
    );
    expect(waiting(status({ failure: failure({ waitedMs: 1_000 }) })).info?.text).toBe(
      'Google answered 503 UNAVAILABLE at 11:36 AM, after 1 second. This does not use one of the 3 tries.',
    );
    const test = status({ failure: failure({ waitedMs: 0 }), readNowTest: 'TEST_MAIL' });
    expect(waiting(test).info?.text).toBe(
      'Sent at 11:36 AM. Google answered 503 UNAVAILABLE. This does not use one of the 3 tries.',
    );
    const deadline = failure({
      kind: 'NO_ANSWER_IN_TIME',
      cause: 'PROVIDER_DEADLINE',
      httpStatus: 504,
      providerCode: 'DEADLINE_EXCEEDED',
      waitedMs: 300,
      attempt: 1,
      maxAttempts: 3,
    });
    expect(
      waiting(status({ reason: 'NO_ANSWER_IN_TIME', failure: deadline, attempts: 1 })).info?.text,
    ).toBe('No answer at 11:36 AM (504 DEADLINE_EXCEEDED). That used try 1 of 3.');
  });

  it('per-minute limit', () => {
    const limit = failure({
      kind: 'RATE_LIMITED',
      httpStatus: 429,
      providerCode: 'RESOURCE_EXHAUSTED',
      quotaScope: 'PER_MINUTE',
    });
    expect(shown(waiting(status({ reason: 'RATE_LIMITED', failure: limit })))).toEqual({
      badge: 'Waiting for AI',
      title: 'Too many requests',
      text: 'Google answered 429 at 11:36 AM: the per-minute limit for Gemini 3.8 Flash. This does not use one of the 3 tries.',
      next: 'Next try: about 11:38 AM, by itself',
    });
  });

  it('free-tier daily limit (screen 6)', () => {
    vi.setSystemTime(new Date(2026, 9, 14, 15, 15));
    const daily = failure({
      kind: 'RATE_LIMITED',
      httpStatus: 429,
      providerCode: 'RESOURCE_EXHAUSTED',
      quotaScope: 'PER_DAY',
      freeTier: true,
      at: at(15, 10),
    });
    expect(
      shown(
        waiting(status({ reason: 'RATE_LIMITED', failure: daily, nextTryAt: at(12, 30, 0, 15) })),
      ),
    ).toEqual({
      badge: 'Waiting for AI',
      title: 'Daily limit used up',
      text: 'Google answered 429 at 3:10 PM: the free-tier daily limit for Gemini 3.8 Flash. This does not use one of the 3 tries.',
      next: 'Next try: about 12:30 PM tomorrow, by itself',
    });
    const test = status({
      reason: 'RATE_LIMITED',
      failure: daily,
      nextTryAt: at(12, 30, 0, 15),
      readNowTest: 'TEST_MAIL',
    });
    expect(shown(waiting(test)).title).toBe('This was the test mail: daily limit used up');
  });

  it('a mail that only waits behind the daily limit says so too (screen 6, second row)', () => {
    vi.setSystemTime(new Date(2026, 9, 14, 15, 15));
    const pause: AIModelPause = {
      model: 'gemini-3.8-flash',
      roles: ['detailed'],
      reason: 'RATE_LIMITED',
      resumesAt: at(12, 30, 0, 15),
      failure: failure({
        kind: 'RATE_LIMITED',
        httpStatus: 429,
        providerCode: 'RESOURCE_EXHAUSTED',
        quotaScope: 'PER_DAY',
        freeTier: true,
        at: at(15, 10),
      }),
      test: null,
    };
    const onlyPaused = status({
      reason: 'RATE_LIMITED',
      failure: null,
      nextTryAt: pause.resumesAt,
    });
    expect(
      shown(mailAIView({ processingState: 'PENDING', aiStatus: onlyPaused }, [pause])),
    ).toEqual({
      badge: 'Waiting for AI',
      title: 'Daily limit used up',
      text: 'The free-tier daily limit for Gemini 3.8 Flash. This does not use one of the 3 tries.',
      next: 'Next try: about 12:30 PM tomorrow, by itself',
    });
    expect(waiting(onlyPaused).info?.title).toBe('Too many requests');
  });

  it.each([
    [
      'KEY_REJECTED',
      'Google Gemini rejected your API key',
      'Google answered 401 API_KEY_INVALID at 11:36 AM. Waiting for a working API key.',
      { httpStatus: 401, providerCode: 'API_KEY_INVALID' },
    ],
    [
      'ACCOUNT_OR_BILLING',
      'Google Gemini refused requests for your account',
      'Google answered 403 PERMISSION_DENIED at 11:36 AM. Waiting for your Google account to accept requests.',
      { httpStatus: 403, providerCode: 'PERMISSION_DENIED' },
    ],
    [
      'MODEL_UNAVAILABLE',
      'Your key cannot use Gemini 3.8 Flash',
      'Google answered 404 NOT_FOUND at 11:36 AM. Waiting for another model to be chosen.',
      { httpStatus: 404, providerCode: 'NOT_FOUND' },
    ],
  ] as const)('%s waits for the user', (reason, title, text, codes) => {
    const view = waiting(
      status({
        reason,
        failure: failure({ kind: reason, ...codes }),
        nextTryAt: null,
        nextStep: 'FIX_AI_SETTINGS',
      }),
    );
    expect(shown(view)).toEqual({
      badge: 'Waiting for AI',
      title,
      text,
      next: 'Next: waits for you in AI provider settings.',
    });
    // A mail that only waits behind the problem says what it waits for, without a code.
    expect(
      waiting(status({ reason, failure: null, nextTryAt: null, nextStep: 'FIX_AI_SETTINGS' })).info
        ?.text,
    ).toBe(text.slice(text.indexOf('Waiting')));
  });

  it('unusable answer', () => {
    const view = stopped(
      status({
        reason: 'INVALID_OUTPUT',
        failure: failure({
          kind: 'INVALID_OUTPUT',
          httpStatus: null,
          providerCode: null,
          stopReason: 'MAX_TOKENS',
        }),
        attempts: 1,
        nextTryAt: null,
        nextStep: 'RETRY_WITH_YOUR_OK',
      }),
    );
    expect(shown(view)).toEqual({
      badge: 'AI could not read it',
      title: 'Unusable answer',
      text: 'Gemini 3.8 Flash returned an answer Career Companion could not use (stopped early: MAX_TOKENS).',
      next: 'Next: waits for you. Use Manual Retry.',
    });
    expect(view.retry).toBe(true);
  });

  it('cannot reach the provider', () => {
    const network = failure({
      cause: 'NETWORK',
      httpStatus: null,
      providerCode: null,
      networkCode: 'ENOTFOUND',
    });
    expect(shown(waiting(status({ failure: network })))).toEqual({
      badge: 'Waiting for AI',
      title: 'Could not reach Google Gemini',
      text: 'No connection at 11:36 AM (ENOTFOUND). This does not use one of the 3 tries.',
      next: 'Next try: about 11:38 AM, by itself',
    });
    const dropped = failure({
      kind: 'NO_ANSWER_IN_TIME',
      cause: 'NETWORK_AFTER_SEND',
      httpStatus: null,
      providerCode: null,
      networkCode: 'ECONNRESET',
      attempt: 1,
      maxAttempts: 3,
    });
    expect(
      waiting(status({ reason: 'NO_ANSWER_IN_TIME', failure: dropped, attempts: 1 })).info?.text,
    ).toBe('The line dropped at 11:36 AM (ECONNRESET) after sending. That used try 1 of 3.');
  });

  it("Career Companion's own daily limit", () => {
    expect(
      shown(
        waiting(status({ reason: 'SAFETY_LIMIT', failure: null, nextTryAt: at(5, 30, 0, 15) })),
      ),
    ).toEqual({
      badge: 'Waiting for AI',
      title: "Career Companion's daily limit",
      text: "This is our limit, not Google's. This does not use one of the 3 tries.",
      next: 'Next try: about 5:30 AM tomorrow, by itself',
    });
  });

  it('request refused: our problem, and only Career Companion can retry it', () => {
    const view = stopped(
      status({
        reason: 'INVALID_REQUEST',
        failure: failure({
          kind: 'INVALID_REQUEST',
          httpStatus: 400,
          providerCode: 'INVALID_ARGUMENT',
        }),
        nextTryAt: null,
        nextStep: 'CAREER_COMPANION',
      }),
    );
    expect(shown(view)).toEqual({
      badge: 'AI could not read it',
      title: 'Request refused',
      text: 'Career Companion sent a request Google refused (400 INVALID_ARGUMENT). This is our problem, not yours.',
      next: 'Next: waits for Career Companion.',
    });
    expect(view.retry).toBe(false);
  });

  describe('a mail that only waits behind a paused model', () => {
    const pause = (paused: AIFailure): AIModelPause => ({
      model: 'gemini-3.8-flash',
      roles: ['detailed'],
      reason: 'PROVIDER_BUSY',
      resumesAt: at(11, 38),
      failure: paused,
      test: null,
    });
    const behind = (paused: AIFailure, overrides: Partial<EmailAIStatus> = {}) =>
      shown(
        mailAIView(
          { processingState: 'PENDING', aiStatus: status({ failure: null, ...overrides }) },
          [pause(paused)],
        ),
      );

    it("is worded from the pause's busy answer, with no try used", () => {
      expect(behind(failure())).toEqual({
        badge: 'Waiting for AI',
        title: 'Gemini 3.8 Flash was busy',
        text: 'Google answered 503 UNAVAILABLE at 11:36 AM. This does not use one of the 3 tries.',
        next: 'Next try: about 11:38 AM, by itself',
      });
    });

    it('says when the pause came from no connection', () => {
      const network = failure({
        cause: 'NETWORK',
        httpStatus: null,
        providerCode: null,
        networkCode: 'ENOTFOUND',
      });
      expect(behind(network)).toMatchObject({
        title: 'Could not reach Google Gemini',
        text: 'No connection at 11:36 AM (ENOTFOUND). This does not use one of the 3 tries.',
      });
    });

    it('says when the pause came from no answer in time', () => {
      const noAnswer = failure({
        kind: 'NO_ANSWER_IN_TIME',
        cause: 'TIMEOUT',
        httpStatus: null,
        providerCode: null,
        at: at(11, 37, 55),
        waitedMs: 60_000,
        attempt: 1,
        maxAttempts: 3,
      });
      expect(behind(noAnswer, { reason: 'NO_ANSWER_IN_TIME' })).toEqual({
        badge: 'Waiting for AI',
        title: 'Gemini 3.8 Flash did not answer in time',
        text: 'No answer within 60 seconds at 11:37 AM. This does not use one of the 3 tries.',
        next: 'Next try: about 11:38 AM, by itself',
      });
      const dropped = {
        ...noAnswer,
        cause: 'NETWORK_AFTER_SEND' as const,
        networkCode: 'ECONNRESET',
      };
      expect(behind(dropped, { reason: 'NO_ANSWER_IN_TIME' })).toMatchObject({
        title: 'Could not reach Google Gemini',
        text: 'The line dropped at 11:37 AM (ECONNRESET) after sending. This does not use one of the 3 tries.',
      });
    });

    it('falls back to plain words when the pause kept no failure', () => {
      expect(shown(waiting(status({ failure: null })))).toEqual({
        badge: 'Waiting for AI',
        title: 'Gemini 3.8 Flash is busy right now',
        text: 'This does not use one of the 3 tries.',
        next: 'Next try: about 11:38 AM, by itself',
      });
    });
  });
});

describe('a Manual Retry only Career Companion may do', () => {
  it("is refused in the row's own words", () => {
    const refused = status({
      reason: 'INVALID_REQUEST',
      failure: failure({
        kind: 'INVALID_REQUEST',
        httpStatus: 400,
        providerCode: 'INVALID_ARGUMENT',
      }),
      nextTryAt: null,
      nextStep: 'CAREER_COMPANION',
    });
    expect(onlyCareerCompanionText({ processingState: 'FAILED', aiStatus: refused })).toBe(
      'Request refused. Career Companion sent a request Google refused (400 INVALID_ARGUMENT). This is our problem, not yours.',
    );
  });

  it('has no words of its own when the row does not say so', () => {
    const needsOk = status({ reason: 'NO_ANSWER_IN_TIME', nextStep: 'RETRY_WITH_YOUR_OK' });
    expect(onlyCareerCompanionText({ processingState: 'FAILED', aiStatus: needsOk })).toBeNull();
    expect(
      onlyCareerCompanionText({ processingState: 'PROCESSING', processingStuck: true }),
    ).toBeNull();
    expect(onlyCareerCompanionText(undefined)).toBeNull();
  });
});

describe('row badges', () => {
  it('never shows the raw FAILED', () => {
    expect(mailAIView({ processingState: 'FAILED' }).badge).toBe('AI could not read it');
    for (const reason of EmailAIReasonSchema.options)
      for (const nextStep of EmailAINextStepSchema.options)
        expect(
          stopped(status({ reason, nextStep, failure: null, nextTryAt: null })).badge,
        ).not.toBe('FAILED');
  });

  it('gives every stopped mail a reason and a next step, old mails without a kept failure too', () => {
    for (const reason of EmailAIReasonSchema.options)
      for (const nextStep of ['RETRY_WITH_YOUR_OK', 'MANUAL_RETRY', 'CAREER_COMPANION'] as const) {
        const info = mailAIInfo(
          status({ reason, nextStep, failure: null, model: null, nextTryAt: null }),
          true,
        );
        expect(info.title).not.toBe('');
        expect(info.text).not.toMatch(/undefined|null|Outcome unknown|reconciliation|^\s*$/);
        expect(info.next.text).not.toBe('');
      }
  });

  it('words an older no-answer row from its stored kind', () => {
    const view = stopped(
      status({
        reason: 'NO_ANSWER_IN_TIME',
        failure: null,
        attempts: 1,
        nextTryAt: null,
        nextStep: 'RETRY_WITH_YOUR_OK',
      }),
    );
    expect(shown(view)).toEqual({
      badge: 'Needs your OK',
      title: 'Gemini 3.8 Flash did not answer in time',
      text: 'No answer in time. Google may have charged for this try.',
      next: 'Next: waits for you. Use Manual Retry.',
    });
  });

  it('words the other states plainly', () => {
    expect(mailAIView({ processingState: 'COMPLETED', aiStatus: null }).badge).toBe('Read');
    expect(mailAIView({ processingState: 'PROCESSING', aiStatus: null }).badge).toBe('Reading');
    expect(mailAIView({ processingState: 'PENDING', aiStatus: null })).toMatchObject({
      badge: 'Queued',
      info: null,
    });
    expect(mailAIView({ processingState: 'PROCESSING', processingRetryable: true }).badge).toBe(
      'Retry scheduled',
    );
    expect(mailAIView({ processingState: 'PROCESSING', processingStuck: true })).toMatchObject({
      badge: 'Stopped',
      retry: true,
    });
  });
});
