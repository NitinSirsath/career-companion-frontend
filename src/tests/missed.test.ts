import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { missedByApplication, nextStepsByApplication } from '../api/nextSteps';
import { needsActionLine } from '../components/dashboard/needsLines';
import type { ActionWithContextResponse } from '../contracts/action';
import type { Missed } from '../contracts/application';
import { coverageParts } from '../lib/dashboard';
import { keyDates, keyDatesNote, readingSummary } from '../lib/mailThread';
import {
  ACTION_FILTERS,
  aiReading,
  mailsSearchSchema,
  requestControls,
  requestPastDue,
} from '../lib/mails';
import { MISSED, missedCount, missedLine, missedNote, missedWhy } from '../lib/missed';
import { dashboardFixture } from './dashboard-fixture';
import { makeConversation, makeConversationMail } from './fixtures';

/** 17 Nov 2026, 11:00 in the zone the test runs in, so the words are the same everywhere. */
const DUE = new Date(2026, 10, 17, 11, 0).toISOString();
const since = (reason: Missed['reason']): Missed => ({
  reason,
  since: new Date(2026, 10, 18, 11, 0).toISOString(),
});
const asked = makeConversation().request!;
const missedAsk = { ...asked, deadline: DUE, deadlinePrecision: 'DATETIME' as const };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 26, 15, 0));
});
afterEach(() => vi.useRealTimers());

describe('the words for a missed request', () => {
  it('says why it is missed: the deadline, a quiet thread, or no answer', () => {
    const late = { ...missedAsk, missed: since('DEADLINE_PASSED') };
    expect(missedWhy(late)).toBe('was due Nov 17, 2026 11:00 AM');
    expect(missedWhy(late, true)).toBe('was due Nov 17');
    expect(missedLine(late, true)).toBe('Missed · was due Nov 17');
    // A date without a time is the same day everywhere.
    const day = {
      ...late,
      deadline: '2026-11-17T00:00:00.000Z',
      deadlinePrecision: 'DATE' as const,
    };
    expect(missedWhy(day)).toBe('was due Nov 17, 2026');
    expect(missedWhy(day, true)).toBe('was due Nov 17');
    expect(missedWhy({ ...asked, deadline: null, missed: since('QUIET') })).toBe(
      'nothing new for 7 days',
    );
    expect(missedWhy({ ...asked, deadline: null, missed: since('NO_ANSWER') })).toBe(
      'no answer to your reply',
    );
    expect(missedWhy({ ...asked, missed: null })).toBeNull();
    expect(missedLine({ ...asked, missed: null })).toBe('Missed');
  });

  it('says why it left the list and what Still open does', () => {
    expect(missedNote(since('DEADLINE_PASSED'))).toBe(
      'Its deadline passed, so this left Needs action by itself. Still open puts it back on your list for 7 days.',
    );
    expect(missedNote(since('DEADLINE_PASSED'), true)).toBe(
      'Its deadline passed, so this left Needs action by itself on Nov 18. Still open puts it back on your list for 7 days.',
    );
    expect(missedNote(since('QUIET'))).toMatch(/^Nothing happened here for 7 days, so this left/);
    expect(missedNote(since('NO_ANSWER'))).toMatch(
      /^They did not answer your reply for 7 days, so/,
    );
    expect(missedCount(2)).toBe('2 missed');
  });
});

describe('a missed request on Mails', () => {
  it('has its own filter, kept in the URL', () => {
    expect(ACTION_FILTERS.map((filter) => filter.label)).toEqual([
      'Needs action',
      'Missed',
      'Replied',
      'Done',
      'Nothing needed',
    ]);
    expect(mailsSearchSchema.parse({ request: 'missed' })).toEqual({ request: 'missed' });
  });

  it('offers Still open first, and is never past due', () => {
    const missed = { ...missedAsk, missed: since('DEADLINE_PASSED') };
    const labels = (askKind: 'REPLY_BY_MAIL' | 'OUTSIDE_MAIL') =>
      requestControls({ ...missed, askKind }).map((control) => \`\${control.label}>\${control.state}\`);
    expect(labels('REPLY_BY_MAIL')).toEqual(['Still open>OPEN']);
    expect(labels('OUTSIDE_MAIL')).toEqual(['Still open>OPEN', 'I did this>DONE']);
    expect(requestPastDue(missed)).toBe(false);
    expect(requestPastDue({ ...missed, missed: null })).toBe(true);
  });
});

describe('dates in the user own time', () => {
  const read = makeConversationMail({
    interviewDate: null,
    assessmentDeadline: null,
    actionDeadline: '2026-11-17 05:30:00 GMT',
    actionDue: { at: DUE, precision: 'DATETIME' },
    followUpDate: null,
  });

  it('shows a deadline the app could read as a date, and says when it is missed or past due', () => {
    const request = { ...missedAsk, emailId: read.id, missed: since('DEADLINE_PASSED') };
    const dates = keyDates([read], request);
    expect(dates).toEqual([
      { label: 'Reply by', value: 'Nov 17, 2026 11:00 AM', own: true, state: 'Missed' },
    ]);
    expect(keyDatesNote(dates)).toBe('In your own time.');
    expect(keyDates([read], { ...request, missed: null })[0].state).toBe('Past due');
    // The state is the open request's: not shown for another mail's date, or once it is closed.
    expect(keyDates([read], { ...request, emailId: 'another-mail' })[0].state).toBeNull();
    expect(keyDates([read], { ...request, missed: null, state: 'DONE' })[0].state).toBeNull();
    expect(keyDates([read])[0].state).toBeNull();
  });

  it("keeps the mail's own words for a date the app cannot read, and says which is which", () => {
    const unclear = makeConversationMail({
      interviewDate: '20 Nov',
      interviewTime: '3 PM IST',
      assessmentDeadline: null,
      actionDeadline: 'by the end of next week',
      actionDue: null,
      followUpDate: 'early December',
      followUpDue: null,
    });
    const dates = keyDates([unclear]);
    expect(dates.map((date) => [date.label, date.value, date.own])).toEqual([
      ['Interview', '20 Nov, 3 PM IST', false],
      ['Reply by', 'by the end of next week', false],
      ['Follow up', 'early December', false],
    ]);
    expect(keyDatesNote(dates)).toBe('As the mails wrote them.');
    const mixed = keyDates([{ ...unclear, actionDue: { at: DUE, precision: 'DATETIME' } }]);
    expect(keyDatesNote(mixed)).toBe(
      'Reply by in your own time. The rest as the mails wrote them.',
    );
  });

  it('uses the date in the AI read line and its details', () => {
    expect(readingSummary(read)).toMatch(/ · due Nov 17, 2026 11:00 AM$/);
    expect(aiReading(read)).toContainEqual({ label: 'Deadline', value: 'Nov 17, 2026 11:00 AM' });
    const dayOnly = {
      ...read,
      actionDue: { at: '2026-11-17T00:00:00.000Z', precision: 'DATE' as const },
    };
    expect(readingSummary(dayOnly)).toMatch(/ · due Nov 17, 2026$/);
    expect(readingSummary({ ...read, actionDue: null })).toMatch(/ · due 2026-11-17 05:30:00 GMT$/);
  });
});

describe('missed steps of applications', () => {
  const step = (fields: Partial<ActionWithContextResponse>): ActionWithContextResponse => ({
    origin: 'EMAIL',
    actionRevision: 0,
    clientRequestId: null,
    snoozedUntil: null,
    id: 'step',
    applicationId: 'app-1',
    emailId: 'mail-1',
    type: 'ACTION_REQUIRED',
    description: 'Fill the availability survey',
    deadline: DUE,
    deadlinePrecision: 'DATETIME',
    status: 'PENDING',
    createdAt: '2026-11-12T10:00:00.000Z',
    application: { companyName: 'Globex', jobTitle: null },
    email: null,
    missed: null,
    ...fields,
  });

  it('is never the next step, and is counted apart', () => {
    const actions = [
      step({ id: 'missed-1', missed: since('DEADLINE_PASSED') }),
      step({ id: 'missed-2', applicationId: 'app-2', missed: since('QUIET') }),
      step({ id: 'open', applicationId: 'app-2', description: 'Send references', deadline: null }),
      step({ id: 'closed', applicationId: 'app-3', status: 'COMPLETED' }),
    ];
    const steps = nextStepsByApplication(actions);
    expect(steps.has('app-1')).toBe(false);
    expect(steps.get('app-2')).toMatchObject({ actionId: 'open', pastDue: false });
    expect([...missedByApplication(actions)]).toEqual([
      ['app-1', 1],
      ['app-2', 1],
    ]);
  });
});

describe('missed on the Dashboard', () => {
  const words = (needs: { count: number; waitingOverADay: number; missed: number }) =>
    renderToStaticMarkup(needsActionLine(needs)).replace(/<[^>]+>/g, '');

  it('names the missed ones after the line, and not at all when there are none', () => {
    expect(words({ count: 1, waitingOverADay: 0, missed: 2 })).toBe(
      'Answer them, or mark them done · 2 missed',
    );
    expect(words({ count: 3, waitingOverADay: 2, missed: 1 })).toBe(
      '2 waiting over a day · 1 missed',
    );
    expect(words({ count: 0, waitingOverADay: 0, missed: 2 })).toBe(
      'Nothing is waiting on you · 2 missed',
    );
    expect(words({ count: 0, waitingOverADay: 0, missed: 0 })).toBe('Nothing is waiting on you');
  });

  it("names NorthList Apply's missed jobs only when there is one", () => {
    const { automation } = dashboardFixture();
    expect(coverageParts(automation).map((part) => part.label)).toEqual([
      'Sent',
      'Skipped',
      'Needs you',
    ]);
    expect(coverageParts({ ...automation, missed: 1 }).slice(-1)[0]).toEqual({
      label: MISSED.label,
      count: 1,
      color: 'bg-text-disabled',
    });
  });
});
