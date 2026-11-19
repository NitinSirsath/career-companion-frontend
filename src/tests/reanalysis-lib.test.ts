import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReanalysisRun } from '../contracts/reanalysis';
import {
  agendaRetiredText,
  blockedText,
  readingText,
  recentlyStopped,
  savedText,
  stoppedText,
  whatIsRead,
} from '../lib/reanalysis';

const run = (overrides: Partial<ReanalysisRun> = {}): ReanalysisRun => ({
  id: '0b9f9a57-6c3a-4d1e-8d2f-2a4e6f1b7c90',
  state: 'SAVED',
  stopReason: null,
  conversations: 1,
  saved: 1,
  changed: 0,
  gone: 0,
  createdAt: '2026-11-19T10:00:00.000Z',
  finishedAt: '2026-11-19T10:01:00.000Z',
  ...overrides,
});

afterEach(() => vi.useRealTimers());

describe('Reanalyze words (owner, 19 Nov 2026)', () => {
  it('says how much a saved run changed, and the mails Gmail no longer has', () => {
    expect(savedText(run())).toBe('Reanalyzed. Nothing changed.');
    expect(savedText(run({ changed: 1 }))).toBe('Reanalyzed. 1 thing changed.');
    expect(savedText(run({ changed: 2, gone: 1 }))).toBe(
      'Reanalyzed. 2 things changed. 1 mail no longer in Gmail kept the old read.',
    );
  });

  it('says why a run stopped, and how far an application run got', () => {
    expect(stoppedText(run({ state: 'STOPPED', saved: 0, stopReason: 'NEW_ACTIVITY' }))).toBe(
      'Not reanalyzed: a new mail came in or something changed while reading. Try again. Nothing changed.',
    );
    expect(
      stoppedText(run({ state: 'STOPPED', conversations: 3, saved: 1, stopReason: 'AI_LIMIT' })),
    ).toBe('Reanalyzed 1 of 3 conversations, then stopped: your AI reached its limit for today.');
  });

  it('keeps a stopped line for 10 minutes only', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-19T10:05:00.000Z'));
    const stopped = run({ state: 'STOPPED', finishedAt: '2026-11-19T10:00:00.000Z' });
    expect(recentlyStopped(stopped)).toBe(true);
    vi.setSystemTime(new Date('2026-11-19T10:11:00.000Z'));
    expect(recentlyStopped(stopped)).toBe(false);
    expect(recentlyStopped(run())).toBe(false);
  });

  it('names what is read and what the reading line says', () => {
    const preview = { mails: 2, replies: 1 } as Parameters<typeof whatIsRead>[0];
    expect(whatIsRead(preview)).toBe('2 mails and your 1 reply');
    expect(whatIsRead({ ...preview, replies: 0 })).toBe('2 mails');
    expect(readingText({ kind: 'conversation' }, run())).toBe('Reanalyzing');
    expect(readingText({ kind: 'application' }, run({ conversations: 2 }))).toBe(
      'Reanalyzing 2 conversations',
    );
  });

  it('says why it cannot start, and why a date was retired', () => {
    expect(blockedText('AI_RESERVE')).toBe(
      'Not enough AI reads left today: some are always kept for your new mail.',
    );
    expect(agendaRetiredText('REANALYZED')).toBe(
      'Retired: Reanalyze no longer found this date in the mail.',
    );
    expect(agendaRetiredText('EMAIL_MOVED')).toBe('Retired after the email link was moved.');
    expect(agendaRetiredText(null)).toBe('Retired after the email link was removed.');
  });
});
