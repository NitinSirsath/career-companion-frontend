import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { statusSourceLine } from '../lib/applicationDetail';
import { closedAfterDeclineLine, declineNote } from '../lib/declineQuestion';
import { reopenNote, stepNote } from '../lib/jobStep';
import { makeApplication, makeConversation } from './fixtures';

describe('after the user declined by mail (owner, 17 Nov 2026)', () => {
  // A fixed "now", so the dates below never read as "Today" or "Tomorrow".
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-01T12:00:00.000Z'));
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it('says when it closes by itself, or that it no longer does', () => {
    expect(
      declineNote({ repliedAt: '2026-11-15T10:00:00.000Z', closesAt: '2026-11-18T10:00:00.000Z' }),
    ).toBe('Closes by itself on Nov 18 if you do nothing.');
    expect(declineNote({ repliedAt: '2026-11-15T10:00:00.000Z', closesAt: null })).toBe(
      'They wrote again, so it does not close by itself.',
    );
  });

  it('says why the application is Closed while that Closed stands', () => {
    const closed = makeApplication({
      userStatus: 'CLOSED',
      userStatusSetAt: '2026-11-18T10:00:00.000Z',
      closedAfterDeclineAt: '2026-11-18T10:00:00.000Z',
    });
    expect(statusSourceLine(closed)).toBe(closedAfterDeclineLine('2026-11-18T10:00:00.000Z'));
    expect(statusSourceLine(closed)).toBe('Closed after you declined by mail · Nov 18');
    expect(statusSourceLine({ ...closed, closedAfterDeclineAt: null })).toMatch(/^Set by you/);
  });
});

describe('a reply that asked them a question', () => {
  const request = makeConversation().request!;

  it('waits for their reply, and Reopen does not say the reply closed it', () => {
    const asked = { ...request, state: 'REPLIED' as const, replyRead: 'ASKED_BACK' as const };
    expect(stepNote(asked, false)).toBe('You asked them a question. Waiting for their reply.');
    expect(reopenNote(asked)).toBe('Reopen puts it back on your list before they answer.');
  });

  it('says they answered when the step stands again', () => {
    const open = {
      ...request,
      state: 'OPEN' as const,
      replyRead: 'THEY_ANSWERED' as const,
      theyAnsweredAt: '2026-11-10T09:00:00.000Z',
    };
    expect(stepNote(open, false)).toMatch(/^They answered your question Nov 10\. /);
  });
});
