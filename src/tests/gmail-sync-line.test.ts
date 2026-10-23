import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gmailSyncLine } from '../lib/gmailConnection';

describe('the Gmail sync line', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 22, 17, 0));
  });
  afterEach(() => vi.useRealTimers());

  const last = new Date(2026, 9, 22, 16, 34).toISOString();
  const next = new Date(2026, 9, 22, 18, 0).toISOString();

  it('says when mail last came in and when it comes next', () => {
    expect(
      gmailSyncLine({ syncStatus: 'IDLE', lastSyncedAt: last, nextScheduledSyncAt: next }),
    ).toBe('Synced Today, 4:34 PM · next sync Today, 6:00 PM');
  });

  it('says when nothing was synced yet, or the automatic sync is off', () => {
    expect(
      gmailSyncLine({ syncStatus: 'IDLE', lastSyncedAt: null, nextScheduledSyncAt: null }),
    ).toBe('Not synced yet · automatic sync is off');
  });

  it('says when the last sync failed', () => {
    expect(
      gmailSyncLine({ syncStatus: 'FAILED', lastSyncedAt: last, nextScheduledSyncAt: next }),
    ).toBe('Last sync failed · next sync Today, 6:00 PM');
  });
});
