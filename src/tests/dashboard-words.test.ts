import { describe, expect, it } from 'vitest';
import {
  axisTicks,
  changeShort,
  changeText,
  compareText,
  funnelFacts,
  oneInText,
  rateLine,
  spreadLabels,
  clockText,
  greeting,
  inPeriodText,
  interviewWhen,
  periodWeeks,
  pointLabel,
  pointTitle,
  rateText,
  replyDaysText,
  runningTotals,
  seriesSpan,
  siteName,
  todayLine,
  workModeName,
} from '../lib/dashboard';

describe('Dashboard words', () => {
  it('the change against the period before', () => {
    expect(changeText(34, 26, '30d', null)).toBe('↑ 8 vs the 30 days before');
    expect(changeText(4, 11, '7d', null)).toBe('↓ 7 vs the 7 days before');
    expect(changeText(5, 5, '90d', null)).toBe('Same as the 90 days before');
    expect(changeText(5, null, 'all', '2026-10-22T00:00:00.000Z')).toBe('Since Oct 22');
  });

  it('a rate only from 5 applications, and the usual reply time', () => {
    expect(rateText({ count: 12, of: 34 })).toBe('35%');
    expect(rateText({ count: 1, of: 3 })).toBeNull();
    expect(replyDaysText(0.4)).toBe('Same day');
    expect(replyDaysText(1)).toBe('1 day');
    expect(replyDaysText(6.4)).toBe('6 days');
  });

  it('greets by the time of day, with the first name when known', () => {
    const at = (hour: number) => new Date(2026, 10, 3, hour, 0);
    expect(greeting('Nitin Sirsath', at(8))).toBe('Good morning, Nitin');
    expect(greeting('Nitin', at(12))).toBe('Good afternoon, Nitin');
    expect(greeting('Nitin', at(18))).toBe('Good evening, Nitin');
    expect(greeting(null, at(9))).toBe('Good morning');
    expect(greeting('  ', at(9))).toBe('Good morning');
  });

  it("today's line under the greeting", () => {
    const today = new Date(2026, 10, 3, 9, 0);
    expect(todayLine('2026-10-04T08:00:00.000Z', today)).toBe(
      'Tuesday, November 3 · your job search, from your mails since Oct 4',
    );
    expect(todayLine(null, today)).toBe('Tuesday, November 3');
  });

  it('the next interview, with or without a time', () => {
    expect(clockText('09:05')).toBe('9:05 AM');
    expect(clockText('14:30')).toBe('2:30 PM');
    expect(clockText('00:15')).toBe('12:15 AM');
    expect(clockText('12:00')).toBe('12:00 PM');
    expect(interviewWhen({ date: '2026-11-05', time: '10:00' })).toBe('Thu, Nov 5 · 10:00 AM');
    expect(interviewWhen({ date: '2026-11-09', time: null })).toBe('Mon, Nov 9');
  });

  it('counts in the period, and the days of the charts', () => {
    expect(inPeriodText(214, '30d')).toBe('214 in the last 30 days');
    expect(inPeriodText(9, '7d')).toBe('9 in the last 7 days');
    expect(inPeriodText(1402, 'all')).toBe('1402 since you connected Gmail');
    expect(pointLabel('2026-10-05')).toBe('Oct 5');
    expect(pointTitle('2026-10-21', 'day')).toBe('Wed, Oct 21');
    expect(pointTitle('2026-10-19', 'week')).toBe('Week of Oct 19');
    expect(periodWeeks('7d')).toBe(2);
    expect(periodWeeks('30d')).toBe(5);
    expect(periodWeeks('all')).toBe(12);
  });

  it('adds up the period for the running total', () => {
    const point = (start: string, sent: number, replies: number, interviews: number) => ({
      start,
      applicationsSent: sent,
      replies,
      interviews,
      replyMails: 0,
      interviewMails: 0,
      rejectionMails: 0,
      otherMails: 0,
    });
    const points = [
      point('2026-10-05', 2, 0, 0),
      point('2026-10-06', 1, 1, 0),
      point('2026-10-07', 0, 1, 1),
    ];
    expect(runningTotals(points)).toEqual([
      { start: '2026-10-05', applicationsSent: 2, replies: 0, interviews: 0 },
      { start: '2026-10-06', applicationsSent: 3, replies: 1, interviews: 0 },
      { start: '2026-10-07', applicationsSent: 3, replies: 2, interviews: 1 },
    ]);
    expect(seriesSpan(points)).toBe('Oct 5 to Oct 7');
    const month = Array.from({ length: 31 }, (_, i) =>
      point(`2026-10-${String(i + 1).padStart(2, '0')}`, 0, 0, 0),
    );
    expect(axisTicks(month, 'day')).toEqual(['Oct 1', 'Oct 8', 'Oct 15', 'Oct 22', 'Oct 29']);
    expect(axisTicks(month.slice(0, 9), 'week')).toEqual(['Oct 1', 'Oct 5', 'Oct 9']);
    expect(seriesSpan([])).toBe('');
  });

  it('names of sites and work modes', () => {
    expect(siteName('linkedin')).toBe('LinkedIn');
    expect(siteName(null)).toBe('Not from automation');
    expect(workModeName('onsite')).toBe('On-site');
    expect(workModeName(null)).toBe('Not given');
  });

  it('rates in plain words, never on fewer than 5 applications', () => {
    expect(oneInText({ count: 12, of: 34 })).toBe('About 1 in 3');
    expect(oneInText({ count: 3, of: 24 })).toBe('1 in 8');
    expect(oneInText({ count: 1, of: 24 })).toBe('1 in 24');
    expect(oneInText({ count: 5, of: 10 })).toBe('1 in 2');
    expect(oneInText({ count: 6, of: 10 })).toBe('6 in 10');
    expect(oneInText({ count: 13, of: 20 })).toBe('About 7 in 10');
    expect(oneInText({ count: 39, of: 40 })).toBe('Almost all');
    expect(oneInText({ count: 7, of: 7 })).toBe('All');
    expect(oneInText({ count: 0, of: 9 })).toBe('None yet');
    expect(oneInText({ count: 1, of: 4 })).toBeNull();
    expect(rateLine({ count: 2, of: 6 }, 'replied')).toBe('1 in 3 replied');
    expect(rateLine({ count: 0, of: 6 }, 'replied')).toBe('No replies yet');
    expect(rateLine({ count: 0, of: 6 }, 'interview')).toBe('No interview yet');
    expect(rateLine({ count: 1, of: 3 }, 'replied')).toBeNull();
  });

  it('the funnel facts: three rates and the usual wait', () => {
    const facts = funnelFacts({
      rates: {
        response: { count: 12, of: 34 },
        interview: { count: 5, of: 34 },
        offer: { count: 1, of: 34 },
      },
      usualReplyDays: 6,
    });
    expect(facts.map((fact) => `${fact.value} ${fact.label}`)).toEqual([
      'About 1 in 3 got a reply',
      'About 1 in 7 got an interview',
      '1 in 34 got an offer',
      '6 days usual wait for a reply',
    ]);
  });

  it('the short change under a phone number, and what it compares with', () => {
    expect(changeShort(34, 26)).toBe('↑ 8');
    expect(changeShort(4, 6)).toBe('↓ 2');
    expect(changeShort(5, 5)).toBe('Same');
    expect(changeShort(5, null)).toBe('');
    expect(compareText('30d')).toBe('Arrows compare with the 30 days before.');
    expect(compareText('all')).toBeNull();
  });

  it('a phone chart keeps at most a few dates', () => {
    const points = Array.from({ length: 90 }, (_, i) => ({
      start: new Date(Date.UTC(2026, 8, 1) + i * 864e5).toISOString().slice(0, 10),
      applicationsSent: 0,
      replies: 0,
      interviews: 0,
      replyMails: 0,
      interviewMails: 0,
      rejectionMails: 0,
      otherMails: 0,
    }));
    expect(axisTicks(points, 'day')).toHaveLength(13);
    expect(axisTicks(points, 'day', 4)).toEqual(['Sep 1', 'Sep 29', 'Oct 27', 'Nov 24']);
  });

  it('keeps line-end names apart', () => {
    expect(spreadLabels([100, 20, 95], 16)).toEqual([111, 20, 95]);
    expect(spreadLabels([10, 50], 16)).toEqual([10, 50]);
  });
});
