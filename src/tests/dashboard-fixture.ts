import type { DashboardResponse } from '../contracts/dashboard';

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
    data: { jobMailsRead: 48, notLinked: 3, waitingForAI: 1, fakeOffers: 2 },
    totals: { current: totals, previous: { ...totals, applicationsSent: 26 } },
    rightNow: { APPLIED: 41, RECRUITER_CONTACT: 4, ASSESSMENT: 3, INTERVIEW: 2, OFFER: 1 },
    funnel: {
      applied: 34,
      answered: 12,
      recruiterContact: 9,
      assessment: 6,
      interview: 5,
      offer: 1,
    },
    rejectedAfter: { noAnswer: 2, recruiterContact: 2, assessment: 2, interview: 1 },
    weeks: Array.from({ length: 12 }, (_, i) => ({
      weekStart: `2026-08-${String(10 + i).padStart(2, '0')}`,
      applicationsSent: i,
      answers: 1,
      interviews: 0,
    })),
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
    answerSpeed: {
      answered: 12,
      medianDays: 6,
      p80Days: 13,
      slowest: [{ companyName: 'Infosys Limited', days: 19 }],
    },
    keepingUp: {
      replied: 11,
      medianReplyHours: 9,
      waitingOverADay: 2,
      closed: { yourReply: 8, youSaidDone: 4, newerMail: 2, applicationClosed: 0 },
      openNow: 3,
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
    rates: {
      response: { count: 12, of: 34 },
      interview: { count: 5, of: 34 },
      offer: { count: 1, of: 34 },
    },
    tips: [],
    aiTip: null,
    ...over,
  };
}
