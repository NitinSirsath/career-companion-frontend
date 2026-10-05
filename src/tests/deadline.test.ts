import { describe, expect, it } from 'vitest';
import { deadlineLabel, deadlineOverdue } from '../lib/deadline';
describe('calendar-date deadlines', () => {
  const now = new Date(2026, 10, 20, 23, 59, 30);
  it.each([[19, true], [20, false], [21, false]])('date %s respects the viewer calendar day', (day, overdue) => {
    const action = { deadline: `2026-11-${day}T00:00:00Z`, deadlinePrecision: 'DATE' as const };
    expect(deadlineLabel(action)).toBe(`Nov ${day}, 2026`);
    expect(deadlineLabel(action, true)).toBe(`Nov ${day}, 2026`);
    expect(deadlineOverdue(action, now)).toBe(overdue);
  });
  it.each(['DATETIME', null, undefined] as const)('keeps instant semantics for precision %s', deadlinePrecision => {
    const action = { deadline: new Date(now.getTime() - 1), deadlinePrecision };
    expect(deadlineOverdue(action, now)).toBe(true);
    expect(deadlineLabel(action)).toMatch(/11:59 PM/);
    expect(deadlineLabel(action, true)).toBe('Nov 20, 2026');
  });
  it('has no deadline when absent', () => {
    expect(deadlineLabel({ deadline: null })).toBe('');
    expect(deadlineOverdue({ deadline: null }, now)).toBe(false);
  });
});
