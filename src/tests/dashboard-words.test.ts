import { describe, expect, it } from 'vitest';
import {
  answerSpeedNote,
  changeText,
  daysText,
  hoursText,
  rateText,
  siteName,
  stepTab,
  workModeName,
} from '../lib/dashboard';

describe('Dashboard words', () => {
  it('the change against the period before', () => {
    expect(changeText(34, 26, '30d', null)).toBe('↑ 8 vs the 30 days before');
    expect(changeText(4, 11, '7d', null)).toBe('↓ 7 vs the 7 days before');
    expect(changeText(5, 5, '90d', null)).toBe('Same as the 90 days before');
    expect(changeText(5, null, 'all', '2026-10-22T00:00:00.000Z')).toBe('Since Oct 22');
  });

  it('a rate only from 5 applications', () => {
    expect(rateText({ count: 12, of: 34 })).toBe('35%');
    expect(rateText({ count: 1, of: 3 })).toBeNull();
  });

  it('days and hours in plain words', () => {
    expect(daysText(null)).toBeNull();
    expect(daysText(0)).toBe('Same day');
    expect(daysText(1)).toBe('About 1 day');
    expect(daysText(6.5)).toBe('About 7 days');
    expect(hoursText(0.4)).toBe('Under an hour');
    expect(hoursText(9)).toBe('About 9 hours');
    expect(hoursText(60)).toBe('About 3 days');
  });

  it('the answer-speed note', () => {
    expect(answerSpeedNote(0, null, null)).toBe('No company has answered in this period yet.');
    expect(answerSpeedNote(1, 2, 2)).toBe('1 company has answered so far.');
    expect(answerSpeedNote(12, 6, 13)).toBe(
      'Half of the companies that answered did so within 6 days; 8 in 10 within 13 days.',
    );
  });

  it('names of sites, work modes and the Applications tab of a step', () => {
    expect(siteName('linkedin')).toBe('LinkedIn');
    expect(siteName(null)).toBe('Not from automation');
    expect(workModeName('onsite')).toBe('On-site');
    expect(workModeName(null)).toBe('Not given');
    expect(stepTab('APPLIED')).toBe('RECEIVED');
    expect(stepTab('INTERVIEW')).toBe('INTERVIEW');
  });
});
