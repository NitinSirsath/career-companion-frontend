import type { DashboardResponse } from '../contracts/dashboard';

const DAY_MS = 24 * 60 * 60 * 1000;

/** 30 days of the period, from Sep 28, with a few of everything. */
function points(): DashboardResponse['series']['points'] {
  return Array.from({ length: 30 }, (_, i) => ({
    start: new Date(Date.UTC(2026, 8, 28) + i * DAY_MS).toISOString().slice(0, 10),
    applicationsSent: i % 3 === 0 ? 2 : 1,
    replies: i % 5 === 0 ? 1 : 0,
    interviews: i % 10 === 0 ? 1 : 0,
    replyMails: i % 4 === 0 ? 1 : 0,
    interviewMails: i % 9 === 0 ? 1 : 0,
    rejectionMails: i % 6 === 0 ? 1 : 0,
    otherMails: 1,
  }));
}

/** A Dashboard answer for tests: a user with some numbers and no automation. */
export function dashboardFixture(over: Partial<DashboardResponse> = {}): DashboardResponse {
  const totals = {
    applicationsSent: 34,
    repliesReceived: 12,
    interviewsReached: 5,
    offers: 1,
    rejections: 7,
  };
  return {
    generatedAt: '2026-10-27T10:00:00.000Z',
    period: '30d',
    timeZone: 'Asia/Kolkata',
    dataStartsAt: '2026-09-26T00:00:00.000Z',
    now: {
      newJobMails: { count: 5, today: 2 },
      needsAction: { count: 3, waitingOverADay: 1 },
      interviews: {
        count: 2,
        next: {
          applicationId: 'app-2',
          companyName: 'Harbor Analytics',
          jobTitle: 'Product Designer',
          conversationKey: 'thread-9',
          date: '2026-11-05',
          time: '10:00',
        },
      },
    },
    totals: { current: totals, previous: { ...totals, applicationsSent: 26 } },
    trend: {
      weeks: Array.from({ length: 12 }, (_, i) => ({
        weekStart: new Date(Date.UTC(2026, 7, 10) + i * 7 * DAY_MS).toISOString().slice(0, 10),
        applicationsSent: i,
        replies: 1,
        interviews: 0,
        offers: 0,
        rejections: 1,
      })),
    },
    series: { bucket: 'day', points: points() },
    funnel: {
      applied: 34,
      answered: 12,
      recruiterContact: 9,
      assessment: 6,
      interview: 5,
      offer: 1,
    },
    rates: {
      response: { count: 12, of: 34 },
      interview: { count: 5, of: 34 },
      offer: { count: 1, of: 34 },
    },
    usualReplyDays: 6,
    goneQuiet: {
      count: 1,
      jobs: [
        {
          applicationId: 'app-1',
          companyName: 'Acme Analytics',
          jobTitle: 'Frontend Engineer',
          status: null,
          daysQuiet: 34,
        },
      ],
    },
    mailbox: {
      scanned: { total: 1402, inPeriod: 214 },
      jobMails: { total: 312, inPeriod: 61 },
      notLinked: 3,
      fakeOffers: 2,
    },
    automation: {
      used: false,
      sites: [],
      workModes: [],
      lookedAt: 0,
      sent: 0,
      skipped: 0,
      needsYou: 0,
      topSkipReasons: [],
    },
    ...over,
  };
}
