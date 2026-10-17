import { describe, expect, it, vi } from 'vitest';
import { actionState } from '../lib/actionState';

describe("an application's action", () => {
  it('needs action until the user replies, then says when they did', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 17, 12, 0));
    try {
      expect(actionState({ status: 'PENDING', repliedAt: null })).toEqual({
        label: 'Needs action',
        tone: 'open',
        note: null,
      });
      expect(
        actionState({ status: 'PENDING', repliedAt: new Date(2026, 9, 17, 1, 4).toISOString() }),
      ).toEqual({ label: 'Replied', tone: 'replied', note: 'You replied Today, 1:04 AM' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('a finished action keeps its status', () => {
    expect(actionState({ status: 'COMPLETED', repliedAt: null })).toMatchObject({
      label: 'COMPLETED',
      tone: 'closed',
    });
  });
});
