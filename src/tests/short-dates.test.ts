import { describe, expect, it } from 'vitest';
import { shortDue } from '../lib/deadline';
import { shortAgo } from '../lib/shortAgo';

describe('phone row dates (mock `PHONE-LINEAR-mock/`, 18 Nov 2026)', () => {
  const now = new Date(2026, 10, 18, 12, 0, 0);
  const ago = (ms: number) => new Date(now.getTime() - ms);
  it.each([
    [30_000, 'now'],
    [12 * 60_000, '12m'],
    [2 * 3_600_000, '2h'],
    [5 * 86_400_000, '5d'],
    [14 * 86_400_000, '2w'],
    [60 * 86_400_000, 'Sep 19'],
  ])('%s ms ago is %s', (ms, text) => expect(shortAgo(ago(ms), now)).toBe(text));

  it('says nothing for a missing date', () => expect(shortAgo(null, now)).toBe(''));

  it.each([
    ['2026-11-17T00:00:00Z', 'Past due'],
    ['2026-11-18T00:00:00Z', 'Due today'],
    ['2026-11-19T00:00:00Z', 'Due tomorrow'],
    ['2026-11-23T00:00:00Z', 'Due Mon'],
    ['2026-12-01T00:00:00Z', 'Due Dec 1'],
  ])('a to-do due %s says %s', (deadline, text) =>
    expect(shortDue({ deadline, deadlinePrecision: 'DATE' }, now)).toBe(text),
  );
});
