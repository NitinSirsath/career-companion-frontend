import { describe, expect, it } from 'vitest';
import type { AISettingsResponse } from '../contracts/ai';
import type { GmailStatusResponse } from '../contracts/gmail';
import { accessCopy } from '../lib/aiLabels';
import { nothingCanChange, waitingNotice, waitingPause, type WaitingTry } from '../lib/aiWaiting';

const UNTIL = '2026-10-12T14:04:00.000Z';
const LATER = '2026-10-12T14:08:00.000Z';

const settings = (
  access: Partial<AISettingsResponse['access']> = {},
  waitingEmails = 1,
): AISettingsResponse => ({
  configured: true,
  provider: 'gemini',
  offeredProviders: ['gemini'],
  models: null,
  access: {
    state: 'READY',
    reason: null,
    modelId: null,
    resumesAt: null,
    verified: true,
    lastCheckedAt: null,
    ...access,
  },
  usageToday: { day: '2026-10-12', calls: 0, inputTokens: 0, outputTokens: 0 },
  safetyLimit: { callsPerDay: 500, resetsAt: '2026-10-13T00:00:00.000Z' },
  waitingEmails,
  consent: null,
});
const busy = (resumesAt = UNTIL, waitingEmails = 1) =>
  settings({ state: 'LIMITED', reason: 'PROVIDER_BUSY', resumesAt }, waitingEmails);
const attempt = (overrides: Partial<WaitingTry> = {}): WaitingTry => ({
  byUser: true,
  startedAt: '2026-10-12T14:01:00.000Z',
  reason: 'PROVIDER_BUSY',
  pausedUntil: UNTIL,
  expired: false,
  ...overrides,
});

describe('pause wording', () => {
  it('says a busy provider is busy, not that the account is limited', () => {
    const copy = accessCopy(busy())!;
    expect(copy.title).toBe('Google Gemini is busy right now');
    expect(copy.detail).toMatch(
      /^Paused until about \d{1,2}:\d{2} [AP]M\. Reading continues by itself then\. 1 email is waiting\.$/,
    );
    expect(copy.detail).not.toContain('Sync');
  });

  it('keeps "limiting requests" for a real rate limit and "did not respond" for no answer', () => {
    const copy = (reason: 'RATE_LIMITED' | 'PROVIDER_UNAVAILABLE') =>
      accessCopy(settings({ state: 'LIMITED', reason, resumesAt: UNTIL }))!;
    expect(copy('RATE_LIMITED').title).toBe('Google Gemini is limiting requests from your account');
    expect(copy('PROVIDER_UNAVAILABLE').title).toBe('Google Gemini did not respond');
    for (const reason of ['RATE_LIMITED', 'PROVIDER_UNAVAILABLE'] as const)
      expect(copy(reason).detail).toContain('Reading continues by itself then.');
  });

  it('still asks for a sync after the daily safety limit, which has no automatic try', () => {
    const copy = accessCopy(
      settings({ state: 'LIMITED', reason: 'SAFETY_LIMIT', resumesAt: '2026-10-13T00:00:00.000Z' }),
    )!;
    expect(copy.detail).toContain('sync then to continue');
  });
});

describe('the "Read waiting mails now" button', () => {
  it.each(['RATE_LIMITED', 'PROVIDER_BUSY', 'PROVIDER_UNAVAILABLE'] as const)(
    'is offered while mail waits for a %s pause',
    (reason) => {
      const paused = settings({ state: 'LIMITED', reason, resumesAt: UNTIL });
      expect(waitingPause(paused)).toBe(reason);
      expect(waitingNotice(paused, null)?.button).toBe('ready');
    },
  );

  it.each([
    ['a rejected key', { state: 'NEEDS_ATTENTION', reason: 'KEY_REJECTED' }],
    ['a billing problem', { state: 'NEEDS_ATTENTION', reason: 'ACCOUNT_OR_BILLING' }],
    ['a refused model', { state: 'NEEDS_ATTENTION', reason: 'MODEL_UNAVAILABLE' }],
    ['the daily safety limit', { state: 'LIMITED', reason: 'SAFETY_LIMIT', resumesAt: LATER }],
    ['a pause by Career Companion', { state: 'LIMITED', reason: 'PAUSED' }],
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
  it('keeps the notice while the try runs, instead of hiding it and showing it again', () => {
    expect(waitingNotice(settings({}, 2), attempt())).toEqual({
      title: 'Google Gemini is busy right now',
      detail: 'Trying again now. 2 emails are waiting.',
      button: 'trying',
    });
  });

  it('stops saying "trying" after a minute with no answer', () => {
    expect(waitingNotice(settings({}, 2), attempt({ expired: true }))).toBeNull();
  });

  it('says "still busy" with the time when the user\'s try met another pause', () => {
    const notice = waitingNotice(busy(LATER), attempt())!;
    expect(notice.title).toBe('Google Gemini is still busy');
    expect(notice.detail).toMatch(
      /^Tried at \d{1,2}:\d{2} [AP]M\. Paused until about \d{1,2}:\d{2} [AP]M\. Reading continues by itself then\. 1 email is waiting\.$/,
    );
    expect(notice.button).toBe('ready');
  });

  it('keeps the plain wording while the answer has not arrived, and after an automatic try', () => {
    expect(waitingNotice(busy(UNTIL), attempt())?.title).toBe('Google Gemini is busy right now');
    expect(waitingNotice(busy(LATER), attempt({ byUser: false }))?.title).toBe(
      'Google Gemini is busy right now',
    );
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

  it('goes on while a sync runs or AI can read', () => {
    expect(nothingCanChange(gmail('SYNCING'), busy())).toBe(false);
    expect(nothingCanChange(gmail('IDLE'), settings())).toBe(false);
  });
});
