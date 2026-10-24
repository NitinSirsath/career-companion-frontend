import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AIFailure, AIModelPause, AISettingsResponse } from '../contracts/ai';
import type { GmailStatusResponse } from '../contracts/gmail';
import { accessCopy } from '../lib/aiLabels';
import {
  nothingCanChange,
  tryAnswered,
  waitingNotice,
  waitingPause,
  waitingTitle,
  type WaitingTry,
} from '../lib/aiWaiting';

// Local times, so the clock reads the same in every time zone. "Now" is Oct 14, 11:45 AM.
const at = (hours: number, minutes: number, secs = 0, day = 14) =>
  new Date(2026, 9, day, hours, minutes, secs).toISOString();
const UNTIL = at(11, 38);
const LATER = at(11, 46);

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
const pause = (overrides: Partial<AIModelPause> = {}): AIModelPause => ({
  model: 'gemini-3.8-flash',
  roles: ['detailed'],
  reason: 'PROVIDER_BUSY',
  resumesAt: UNTIL,
  failure: failure(),
  test: null,
  ...overrides,
});
const settings = (
  access: Partial<AISettingsResponse['access']> = {},
  waitingEmails = 1,
  extra: Partial<AISettingsResponse> = {},
): AISettingsResponse => ({
  configured: true,
  provider: 'gemini',
  offeredProviders: ['gemini'],
  models: {
    fast: { id: 'gemini-3.5-flash-lite', source: 'RECOMMENDED' },
    detailed: { id: 'gemini-3.8-flash', source: 'RECOMMENDED' },
  },
  access: {
    state: 'READY',
    reason: null,
    modelId: null,
    resumesAt: null,
    failure: null,
    pauses: [],
    verified: true,
    lastCheckedAt: null,
    ...access,
  },
  lastFailure: null,
  usageToday: { day: '2026-10-14', calls: 0, inputTokens: 0, outputTokens: 0 },
  safetyLimit: { callsPerDay: 500, resetsAt: '2026-10-15T00:00:00.000Z' },
  waitingEmails,
  needsYourOk: { emails: 0, model: null, lastTriedAt: null, tries: 0 },
  consent: null,
  connections: [],
  ...extra,
});
/** The AI access while one model's pause blocks, as the server shows it. */
const paused = (shown: AIModelPause, waitingEmails = 1, others: AIModelPause[] = []) =>
  settings(
    {
      state: 'LIMITED',
      reason: shown.reason,
      modelId: shown.model,
      resumesAt: shown.resumesAt,
      failure: shown.failure,
      pauses: [shown, ...others],
    },
    waitingEmails,
  );
const busy = (resumesAt = UNTIL, waitingEmails = 1) => paused(pause({ resumesAt }), waitingEmails);
const attempt = (overrides: Partial<WaitingTry> = {}): WaitingTry => ({
  title: 'Gemini 3.8 Flash is busy right now',
  pausedUntil: UNTIL,
  ...overrides,
});
/** The notice as the user reads it: title, text and the bold part. */
const read = (shown: AISettingsResponse) => {
  const notice = waitingNotice(shown, null);
  return notice && { title: notice.title, detail: notice.detail, strong: notice.strong };
};

describe('banner wording, as on the mock', () => {
  it('Google is busy (screen 1)', () => {
    expect(read(busy())).toEqual({
      title: 'Gemini 3.8 Flash is busy right now',
      detail:
        'Google answered 503 UNAVAILABLE at 11:36 AM. NorthList tries again by itself at about 11:38 AM. 1 email is waiting.',
      strong: '503 UNAVAILABLE',
    });
  });

  it('no answer in time, try 2 of 3 (screen 2)', () => {
    const noAnswer = failure({
      kind: 'NO_ANSWER_IN_TIME',
      cause: 'TIMEOUT',
      httpStatus: null,
      providerCode: null,
      at: at(11, 37, 55),
      waitedMs: 75_000,
      attempt: 1,
      maxAttempts: 3,
    });
    expect(read(paused(pause({ failure: noAnswer, resumesAt: at(11, 39) })))).toEqual({
      title: 'Gemini 3.8 Flash did not answer in time',
      detail:
        'No answer within 60 seconds at 11:37 AM. NorthList tries again by itself at about 11:39 AM (try 2 of 3). 1 email is waiting.',
      strong: '60 seconds',
    });
  });

  it('Google\'s own deadline (504) also says "no answer in time"', () => {
    const deadline = failure({
      kind: 'NO_ANSWER_IN_TIME',
      cause: 'PROVIDER_DEADLINE',
      httpStatus: 504,
      providerCode: 'DEADLINE_EXCEEDED',
      attempt: 2,
      maxAttempts: 3,
    });
    expect(read(paused(pause({ failure: deadline })))?.detail).toBe(
      'No answer within 60 seconds at 11:36 AM. NorthList tries again by itself at about 11:38 AM (try 3 of 3). 1 email is waiting.',
    );
  });

  it('the test mail of "Read waiting mails now" was still busy (screen 3)', () => {
    const tested = pause({
      failure: failure({ at: at(11, 44, 2), waitedMs: 2_000 }),
      resumesAt: LATER,
      test: { emailId: 'email-1', startedAt: at(11, 44), result: 'PROVIDER_BUSY' },
    });
    expect(read(paused(tested, 2))).toEqual({
      title: 'Gemini 3.8 Flash is still busy',
      detail:
        'Tried 1 test mail at 11:44 AM: Google answered 503 UNAVAILABLE. The pause did not get longer. NorthList tries again by itself at about 11:46 AM. 2 emails are waiting.',
      strong: '503 UNAVAILABLE',
    });
  });

  it('a test mail that got no answer in time says so', () => {
    const tested = pause({
      failure: failure({
        kind: 'NO_ANSWER_IN_TIME',
        cause: 'TIMEOUT',
        httpStatus: null,
        providerCode: null,
        attempt: 1,
        maxAttempts: 3,
      }),
      resumesAt: LATER,
      test: { emailId: 'email-1', startedAt: at(11, 44), result: 'NO_ANSWER_IN_TIME' },
    });
    expect(read(paused(tested))).toEqual({
      title: 'Gemini 3.8 Flash still did not answer in time',
      detail:
        'Tried 1 test mail at 11:44 AM: no answer within 60 seconds. The pause did not get longer. NorthList tries again by itself at about 11:46 AM (try 2 of 3). 1 email is waiting.',
      strong: '60 seconds',
    });
  });

  it('the free-tier daily limit: no button, when it resets, how to read sooner (screen 6)', () => {
    const daily = failure({
      kind: 'RATE_LIMITED',
      httpStatus: 429,
      providerCode: 'RESOURCE_EXHAUSTED',
      quotaScope: 'PER_DAY',
      freeTier: true,
      at: at(11, 10),
    });
    const notice = waitingNotice(
      paused(pause({ reason: 'RATE_LIMITED', failure: daily, resumesAt: at(12, 30, 0, 15) }), 4),
      null,
    )!;
    expect(notice).toMatchObject({
      title: 'Your free Gemini limit for today is used up',
      detail:
        'Google answered 429 RESOURCE_EXHAUSTED (daily limit, free tier) for Gemini 3.8 Flash at 11:10 AM. It resets at about 12:30 PM tomorrow, and reading continues by itself then. 4 emails are waiting.',
      strong: '429 RESOURCE_EXHAUSTED',
      hint: 'To read sooner, turn on billing for your key in Google AI Studio.',
      fix: {
        label: 'Open Google AI Studio billing',
        href: 'https://ai.google.dev/gemini-api/docs/billing',
      },
      button: 'none',
    });
  });

  it("a paid key's daily limit has its own title", () => {
    const daily = failure({
      kind: 'RATE_LIMITED',
      httpStatus: 429,
      providerCode: 'RESOURCE_EXHAUSTED',
      quotaScope: 'PER_DAY',
    });
    const notice = waitingNotice(
      paused(pause({ reason: 'RATE_LIMITED', failure: daily, resumesAt: at(12, 30, 0, 15) })),
      null,
    )!;
    expect(notice.title).toBe('Your daily Gemini limit is used up');
    expect(notice.detail).toContain('(daily limit) for Gemini 3.8 Flash');
    expect(notice.hint).toBeUndefined();
    expect(notice.button).toBe('none');
  });

  it('the per-minute limit', () => {
    const perMinute = failure({
      kind: 'RATE_LIMITED',
      httpStatus: 429,
      providerCode: 'RESOURCE_EXHAUSTED',
      quotaScope: 'PER_MINUTE',
    });
    expect(read(paused(pause({ reason: 'RATE_LIMITED', failure: perMinute })))).toEqual({
      title: 'Google is limiting requests from your key',
      detail:
        'Google answered 429 RESOURCE_EXHAUSTED (per-minute limit) at 11:36 AM. NorthList tries again by itself at about 11:38 AM. 1 email is waiting.',
      strong: '429 RESOURCE_EXHAUSTED',
    });
  });

  it('no connection to the provider', () => {
    const offline = failure({
      cause: 'NETWORK',
      httpStatus: null,
      providerCode: null,
      networkCode: 'ENOTFOUND',
    });
    expect(read(paused(pause({ failure: offline })))).toEqual({
      title: 'NorthList could not reach Google Gemini',
      detail:
        'No connection at 11:36 AM (ENOTFOUND). NorthList tries again by itself at about 11:38 AM. 1 email is waiting.',
      strong: undefined,
    });
  });

  it('the line dropped after sending, as on the row (try 2 of 3)', () => {
    const dropped = failure({
      kind: 'NO_ANSWER_IN_TIME',
      cause: 'NETWORK_AFTER_SEND',
      httpStatus: null,
      providerCode: null,
      networkCode: 'ECONNRESET',
      attempt: 1,
      maxAttempts: 3,
    });
    expect(read(paused(pause({ failure: dropped })))).toEqual({
      title: 'NorthList could not reach Google Gemini',
      detail:
        'The line dropped at 11:36 AM (ECONNRESET) after sending. NorthList tries again by itself at about 11:38 AM (try 2 of 3). 1 email is waiting.',
      strong: undefined,
    });
  });

  it.each([
    [
      'KEY_REJECTED',
      failure({ kind: 'KEY_REJECTED', httpStatus: 401, providerCode: 'API_KEY_INVALID' }),
      'Google Gemini rejected your API key',
      'Google answered 401 API_KEY_INVALID at 11:36 AM. Create a new key and replace it on the AI providers page. 1 email is waiting.',
    ],
    [
      'ACCOUNT_OR_BILLING',
      failure({ kind: 'ACCOUNT_OR_BILLING', httpStatus: 403, providerCode: 'SERVICE_DISABLED' }),
      'Google Gemini refused requests for your account',
      'Google answered 403 SERVICE_DISABLED at 11:36 AM. Check billing, and that the Gemini API is turned on for this key\'s project, then choose "Check again". 1 email is waiting.',
    ],
    [
      'MODEL_UNAVAILABLE',
      failure({ kind: 'MODEL_UNAVAILABLE', httpStatus: 404, providerCode: 'NOT_FOUND' }),
      'Your key cannot use Gemini 3.8 Flash',
      'Google answered 404 NOT_FOUND at 11:36 AM. Choose another detailed model on the AI providers page. 1 email is waiting.',
    ],
  ] as const)('%s names the code and the fix', (reason, kept, title, detail) => {
    const notice = waitingNotice(
      settings({
        state: 'NEEDS_ATTENTION',
        reason,
        modelId: 'gemini-3.8-flash',
        failure: kept,
      }),
      null,
    )!;
    expect(notice).toMatchObject({ title, detail, button: 'none' });
  });

  it('our own daily limit names whose it is and the number from the settings', () => {
    expect(
      read(
        settings({ state: 'LIMITED', reason: 'SAFETY_LIMIT', resumesAt: at(5, 30, 0, 15) }, 2, {
          safetyLimit: { callsPerDay: 300, resetsAt: at(5, 30, 0, 15) },
        }),
      ),
    ).toEqual({
      title: "You reached NorthList's daily AI limit",
      detail:
        "NorthList makes at most 300 AI calls a day for you. This is our limit, not Google's. Reading continues by itself at about 5:30 AM tomorrow. 2 emails are waiting.",
      strong: undefined,
    });
  });

  it('keeps the plain words for a pause from before failures were kept', () => {
    expect(read(paused(pause({ failure: null })))?.detail).toBe(
      'NorthList tries again by itself at about 11:38 AM. 1 email is waiting.',
    );
    expect(read(paused(pause({ reason: 'PROVIDER_UNAVAILABLE', failure: null })))?.title).toBe(
      'Gemini 3.8 Flash did not respond',
    );
  });

  it('never says "Sync" or "Paused until"', () => {
    for (const shown of [busy(), settings({ state: 'LIMITED', reason: 'SAFETY_LIMIT' })]) {
      expect(accessCopy(shown)?.detail).not.toMatch(/Sync|sync|Paused until/);
    }
  });
});

describe('two paused models', () => {
  it('shows the one that blocks most, then the other', () => {
    const fast = pause({ model: 'gemini-3.5-flash-lite', roles: ['fast'], resumesAt: UNTIL });
    const notice = waitingNotice(paused(pause({ resumesAt: LATER }), 1, [fast]), null)!;
    expect(notice.title).toBe('Gemini 3.8 Flash is busy right now');
    expect(notice.notes).toEqual(['Also paused: Gemini 3.5 Flash-Lite.']);
  });

  it('says nothing more with one paused model', () => {
    expect(waitingNotice(busy(), null)?.notes).toEqual([]);
  });
});

describe('mail that needs your OK', () => {
  const needsOk = { emails: 1, model: 'gemini-3.8-flash', lastTriedAt: at(11, 44), tries: 3 };
  const noAnswer = failure({
    kind: 'NO_ANSWER_IN_TIME',
    cause: 'TIMEOUT',
    httpStatus: null,
    providerCode: null,
    attempt: 3,
    maxAttempts: 3,
  });

  it('with no other mail waiting, says "1 email needs your OK" and never "continues by itself" (screen 4)', () => {
    for (const access of [
      paused(pause({ failure: noAnswer }), 0).access,
      settings().access,
      settings({ state: 'LIMITED', reason: 'SAFETY_LIMIT', resumesAt: at(5, 30, 0, 15) }).access,
    ]) {
      const notice = waitingNotice(settings(access, 0, { needsYourOk: needsOk }), null)!;
      expect(notice).toEqual({
        title: '1 email needs your OK',
        detail:
          'Gemini 3.8 Flash did not answer it 3 times, the last at 11:44 AM. NorthList stopped trying it by itself. Retry it from the list below when you want.',
        button: 'none',
        notes: [],
      });
      expect(notice.detail).not.toMatch(/continues by itself|tries again by itself/);
    }
  });

  it('words several mails, and one with a single try', () => {
    const many = settings({}, 0, { needsYourOk: { ...needsOk, emails: 2 } });
    expect(read(many)).toMatchObject({
      title: '2 emails need your OK',
      detail:
        'Gemini 3.8 Flash did not answer them in time, the last at 11:44 AM. NorthList stopped trying them by itself. Retry them from the list below when you want.',
    });
    const once = settings({}, 0, { needsYourOk: { ...needsOk, tries: 1 } });
    expect(read(once)?.detail).toMatch(
      /^Gemini 3.8 Flash did not answer it in time, at 11:44 AM\./,
    );
  });

  it('while other mail waits for a pause, keeps the pause and adds the mail that needs your OK', () => {
    const shown = { ...busy(UNTIL, 2), needsYourOk: needsOk };
    const notice = waitingNotice(shown, null)!;
    expect(notice.title).toBe('Gemini 3.8 Flash is busy right now');
    expect(notice.notes).toEqual([
      '1 email needs your OK. Retry it from the list below when you want.',
    ]);
    expect(notice.button).toBe('ready');
  });

  it('lets a key the user must fix come first', () => {
    const notice = waitingNotice(
      settings({ state: 'NEEDS_ATTENTION', reason: 'KEY_REJECTED' }, 0, { needsYourOk: needsOk }),
      null,
    )!;
    expect(notice.title).toBe('Google Gemini rejected your API key');
    expect(notice.notes).toEqual([]);
  });
});

describe('the "Read waiting mails now" button', () => {
  it.each(['RATE_LIMITED', 'PROVIDER_BUSY', 'PROVIDER_UNAVAILABLE'] as const)(
    'is offered while mail waits for a %s pause',
    (reason) => {
      const shown = paused(pause({ reason }));
      expect(waitingPause(shown)).toBe(reason);
      expect(waitingNotice(shown, null)?.button).toBe('ready');
    },
  );

  it.each([
    ['a rejected key', { state: 'NEEDS_ATTENTION', reason: 'KEY_REJECTED' }],
    ['a billing problem', { state: 'NEEDS_ATTENTION', reason: 'ACCOUNT_OR_BILLING' }],
    ['a refused model', { state: 'NEEDS_ATTENTION', reason: 'MODEL_UNAVAILABLE' }],
    ['the daily safety limit', { state: 'LIMITED', reason: 'SAFETY_LIMIT', resumesAt: LATER }],
    ['a pause by NorthList', { state: 'LIMITED', reason: 'PAUSED' }],
    ['no AI set up', { state: 'NOT_SET_UP', reason: 'NOT_SET_UP' }],
  ] as const)('is not offered for %s: a new try cannot help', (_label, access) => {
    const notice = waitingNotice(settings(access), null);
    expect(notice).not.toBeNull();
    expect(notice?.button).toBe('none');
  });

  it('is not offered when no mail waits', () => {
    expect(waitingNotice(busy(UNTIL, 0), null)?.button).toBe('none');
  });

  it('shows nothing while AI is ready and no try runs', () => {
    expect(waitingNotice(settings(), null)).toBeNull();
    expect(waitingNotice(settings({}, 0), attempt())).toBeNull();
  });
});

describe('a new try', () => {
  it('says "Trying again now" while the test mail waits for its answer, however long', () => {
    // The server shows the tested model's pause aside while its test mail runs.
    const testing = pause({
      test: { emailId: 'email-1', startedAt: at(11, 44), result: null },
    });
    const shown = settings({ pauses: [testing] }, 1);
    vi.advanceTimersByTime(10 * 60_000);
    expect(waitingNotice(shown, null)).toEqual({
      title: 'Gemini 3.8 Flash is busy right now',
      detail: 'Trying again now. 1 email is waiting.',
      button: 'trying',
      notes: [],
    });
    expect(waitingNotice({ ...shown, waitingEmails: 0 }, null)?.button).toBe('trying');
  });

  it('keeps the notice while a try runs and mail waits, with no fixed end', () => {
    vi.advanceTimersByTime(10 * 60_000);
    expect(waitingNotice(settings({}, 2), attempt())).toEqual({
      title: 'Gemini 3.8 Flash is busy right now',
      detail: 'Trying again now. 2 emails are waiting.',
      button: 'trying',
      notes: [],
    });
  });

  it("is named by the pause's own title, also after a test mail met the same answer", () => {
    const tested = pause({
      test: { emailId: 'email-1', startedAt: at(11, 44), result: 'PROVIDER_BUSY' },
    });
    expect(waitingTitle(paused(tested))).toBe('Gemini 3.8 Flash is busy right now');
    expect(waitingTitle(paused(tested, 0))).toBeNull();
    expect(waitingTitle(settings({ state: 'NEEDS_ATTENTION', reason: 'KEY_REJECTED' }))).toBeNull();
  });

  it('ends when the answer comes: all mail read, or a new state', () => {
    expect(tryAnswered(settings({}, 2), attempt())).toBe(false);
    expect(tryAnswered(settings({}, 0), attempt())).toBe(true);
    // The page has not loaded the new state yet: the same pause is no answer.
    expect(tryAnswered(busy(UNTIL), attempt())).toBe(false);
    expect(tryAnswered(busy(LATER), attempt())).toBe(true);
    expect(
      tryAnswered(settings({ state: 'NEEDS_ATTENTION', reason: 'KEY_REJECTED' }), attempt()),
    ).toBe(true);
  });
});

describe('stopping the reloads', () => {
  const gmail = (syncStatus: GmailStatusResponse['syncStatus']) =>
    ({ connected: true, syncStatus }) as GmailStatusResponse;

  it('stops when no sync runs and AI cannot read mail', () => {
    expect(nothingCanChange(gmail('IDLE'), busy())).toBe(true);
    expect(
      nothingCanChange(
        gmail('IDLE'),
        settings({ state: 'NEEDS_ATTENTION', reason: 'KEY_REJECTED' }),
      ),
    ).toBe(true);
  });

  it('goes on while a sync runs, AI can read, or a test mail waits for its answer', () => {
    expect(nothingCanChange(gmail('SYNCING'), busy())).toBe(false);
    expect(nothingCanChange(gmail('IDLE'), settings())).toBe(false);
    const testing = pause({
      model: 'gemini-3.5-flash-lite',
      test: { emailId: 'email-1', startedAt: at(11, 44), result: null },
    });
    expect(nothingCanChange(gmail('IDLE'), paused(pause(), 1, [testing]))).toBe(false);
  });
});
