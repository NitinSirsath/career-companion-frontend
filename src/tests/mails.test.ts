import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { hasRemoteImages, mailFrameDocument } from '../lib/mailHtml';
import {
  ACTION_FILTERS,
  aiReading,
  APPLICATION_FILTERS,
  attachmentInfo,
  CATEGORY_LABEL,
  conversationSummary,
  fileSize,
  filtersFromSearch,
  linkProblem,
  mailCounts,
  mailDate,
  mailDateTime,
  mailsSearchSchema,
  pageCount,
  parseSender,
  recipientLine,
  recipientNames,
  REQUEST_STATE_LABEL,
  requestControls,
  requestDetail,
  requestTitle,
  scheduleLine,
  snippetText,
  TYPE_OPTIONS,
} from '../lib/mails';
import { makeConversation, makeConversationMail } from './fixtures';

const asked = makeConversation().request!;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 11, 15, 0));
});
afterEach(() => vi.useRealTimers());

describe('labels', () => {
  it('shows a confirmation or status mail as "Update"', () => {
    expect(CATEGORY_LABEL.FOLLOW_UP).toBe('Update');
    expect(TYPE_OPTIONS.map((option) => option.label)).toEqual([
      'Recruiter',
      'Interview',
      'Assessment',
      'Offer',
      'Rejection',
      'Update',
    ]);
  });

  it('never uses a pipeline word', () => {
    const labels = [
      ...Object.values(CATEGORY_LABEL),
      ...Object.values(REQUEST_STATE_LABEL),
      ...ACTION_FILTERS.map((option) => option.label),
      ...APPLICATION_FILTERS.map((option) => option.label),
    ];
    for (const label of labels)
      expect(label).not.toMatch(/unmatched|processed|relevant|ambiguous/i);
  });
});

describe('senders and counts', () => {
  it('splits a sender into name and address', () => {
    expect(parseSender('Priya Nair <priya@northwind.example>')).toEqual({
      name: 'Priya Nair',
      address: 'priya@northwind.example',
    });
    expect(parseSender('"Nair, Priya" <priya@northwind.example>').name).toBe('Nair, Priya');
    expect(parseSender('<careers@umbrella.example>')).toEqual({
      name: 'careers@umbrella.example',
      address: null,
    });
    expect(parseSender('careers@umbrella.example').name).toBe('careers@umbrella.example');
    expect(parseSender(null).name).toBe('Unknown sender');
  });

  it('says who a message went to', () => {
    const ME = 'me@example.com';
    expect(recipientLine({ sentByUser: false, to: ME, cc: null }, ME)).toBe('to me');
    expect(
      recipientLine(
        { sentByUser: true, to: '"Nair, Priya" <p@x.example>, Sam <s@x.example>', cc: null },
        ME,
      ),
    ).toBe('to Nair, Priya, Sam');
    expect(recipientLine({ sentByUser: true, to: null, cc: null }, ME)).toBeNull();
  });

  it('names the other people on a mail, so the user sees who a reply to all reaches', () => {
    const ME = 'me@example.com';
    const received = {
      sentByUser: false,
      to: `Me Myself <ME@example.com>, Daniel Okafor <daniel@x.example>`,
      cc: '"Fischer, Lena" <lena@x.example>, me+jobs@example.com, sam@x.example',
    };
    expect(recipientLine(received, ME)).toBe(
      'to me, Daniel Okafor · cc Fischer, Lena, sam@x.example',
    );
    // Until the user's own address is known, nobody can be told apart from "me".
    expect(recipientLine(received, null)).toBe('to me');
    // The user was only copied, or the mail came by a list: still "to me" first.
    expect(recipientLine({ sentByUser: false, to: 'team@x.example', cc: ME }, ME)).toBe(
      'to me, team@x.example',
    );
    expect(
      recipientLine({ sentByUser: true, to: 'Priya <p@x.example>', cc: 'Sam <s@x.example>' }, ME),
    ).toBe('to Priya · cc Sam');
    expect(recipientNames(null)).toEqual([]);
    expect(recipientNames('Priya <p@x.example>, s@x.example', 'S@X.example')).toEqual(['Priya']);
  });
  });

  it('counts mails and the ones the user wrote', () => {
    expect(mailCounts(1, 0)).toBe('1 mail');
    expect(mailCounts(4, 2)).toBe('4 mails · 2 from you');
    expect(conversationSummary(makeConversation({ mailCount: 2, sentCount: 1 }))).toBe(
      'Priya Nair · Northwind Robotics · 3 mails · 1 from you',
    );
    expect(
      pageCount({
        items: [makeConversation()],
        metadata: { limit: 20, offset: 0, nextOffset: null },
      }),
    ).toBe('1');
    expect(
      pageCount({
        items: [makeConversation()],
        metadata: { limit: 20, offset: 0, nextOffset: 20 },
      }),
    ).toBe('1+');
  });
});

describe('dates', () => {
  it('shows the time for today, then only the day', () => {
    expect(mailDate(new Date(2026, 9, 11, 10, 42).toISOString())).toBe('Today, 10:42 AM');
    expect(mailDate(new Date(2026, 9, 10, 9, 5).toISOString())).toBe('Yesterday');
    expect(mailDate(new Date(2026, 9, 8, 9, 5).toISOString())).toBe('Oct 8');
    expect(mailDate(new Date(2025, 11, 31, 9, 5).toISOString())).toBe('Dec 31, 2025');
    expect(mailDate(null)).toBe('Date unknown');
  });

  it('always shows the time on a message', () => {
    expect(mailDateTime(new Date(2026, 9, 10, 9, 5).toISOString())).toBe('Yesterday, 9:05 AM');
    expect(mailDateTime(new Date(2026, 9, 9, 18, 10).toISOString())).toBe('Oct 9, 6:10 PM');
  });
});

describe('the action', () => {
  it("uses the AI's words, or a plain title when it gave none", () => {
    expect(requestTitle(asked)).toBe('Send your available dates');
    expect(requestTitle({ ...asked, text: null })).toBe('Action needed');
    expect(requestTitle({ ...asked, text: null, kind: 'FOLLOW_UP' })).toBe('Follow up');
  });

  it('says when it is due or when the user replied', () => {
    expect(requestDetail(asked)).toBe('Due Oct 13, 2026');
    expect(requestDetail({ ...asked, deadline: null })).toBeNull();
    const repliedAt = new Date(2026, 9, 11, 14, 15).toISOString();
    expect(requestDetail({ ...asked, state: 'REPLIED', repliedAt })).toBe(
      'You replied Today, 2:15 PM',
    );
    expect(requestDetail({ ...asked, state: 'DONE' })).toBeNull();
  });

  it('offers the buttons that fit the state', () => {
    const labels = (state: 'OPEN' | 'REPLIED' | 'DONE', detailed: boolean) =>
      requestControls(state, detailed).map((control) => `${control.label}>${control.state}`);
    expect(labels('OPEN', false)).toEqual(['Mark done>DONE']);
    expect(labels('DONE', false)).toEqual(['Reopen>OPEN']);
    expect(labels('REPLIED', false)).toEqual(['Ask me again>OPEN']);
    expect(labels('REPLIED', true)).toEqual(['Mark done>DONE', 'Ask me again>OPEN']);
  });

  it('shows an interview or assessment date when nothing is asked', () => {
    expect(
      scheduleLine({ interview: { date: 'Oct 12', time: '3:00 PM' }, assessmentDeadline: null }),
    ).toBe('Interview: Oct 12, 3:00 PM');
    expect(scheduleLine({ interview: null, assessmentDeadline: 'Friday' })).toBe(
      'Assessment due Friday',
    );
    expect(
      scheduleLine({ interview: { date: null, time: null }, assessmentDeadline: null }),
    ).toBeNull();
  });
});

describe('mail parts', () => {
  it('describes an attachment', () => {
    const file = { partId: '1', filename: 'JD.pdf', mimeType: 'application/pdf', size: 188_416 };
    expect(attachmentInfo(file)).toBe('PDF · 184 KB');
    expect(
      attachmentInfo({ ...file, filename: 'table.jpg', mimeType: 'image/jpeg', size: 1_258_291 }),
    ).toBe('Image · 1.2 MB');
    expect(
      attachmentInfo({ ...file, filename: 'notes.docx', mimeType: 'application/zip', size: 12 }),
    ).toBe('DOCX · 12 B');
    expect(fileSize(0)).toBe('0 B');
  });

  it("shows the characters behind Gmail's HTML entities", () => {
    expect(snippetText('I&#39;m free &amp; ready &lt;soon&gt; &#x1F600; &unknown;')).toBe(
      "I'm free & ready <soon> 😀 &unknown;",
    );
    expect(snippetText('&#99999999;')).toBe('&#99999999;');
  });

  it('lists what the AI read and leaves empty fields out', () => {
    expect(aiReading(makeConversationMail())).toEqual([
      { label: 'Type', value: 'Interview' },
      { label: 'Company', value: 'Northwind Robotics' },
      { label: 'Role', value: 'Senior Platform Engineer' },
      { label: 'Recruiter', value: 'Priya Nair' },
      { label: 'Interview', value: 'First round, video' },
      { label: 'Asked for', value: 'Dates and times you are free next week' },
      { label: 'Deadline', value: 'Oct 13' },
    ]);
  });
});

describe('the URL of the Mails page', () => {
  it('turns the search into API filters', () => {
    const search = mailsSearchSchema.parse({
      q: '  acme ',
      request: 'open',
      category: 'OFFER',
      application: 'none',
      unseen: true,
      sort: 'newest',
      offset: 20,
    });
    expect(filtersFromSearch(search)).toEqual({
      q: 'acme',
      request: 'open',
      category: 'OFFER',
      application: 'none',
      unseen: 'true',
      sort: 'newest',
    });
  });

  it('drops a value it does not know instead of failing', () => {
    expect(
      mailsSearchSchema.parse({ tab: 'spam', request: 'later', unseen: 'yes', offset: -5, q: 12 }),
    ).toEqual({});
  });
});

describe('a refused "Create application"', () => {
  const refused = (code: string, details?: unknown) =>
    new ApiError('Refused', 'http', 409, code, details);

  it('asks for the company, offers a choice, or says what happened', () => {
    expect(linkProblem(refused('COMPANY_REQUIRED'))).toEqual({ kind: 'company' });
    const candidates = [
      { id: '22222222-2222-4222-8222-222222222222', companyName: 'Acme', jobTitle: null },
    ];
    expect(linkProblem(refused('APPLICATION_CHOICE_REQUIRED', { candidates }))).toEqual({
      kind: 'choice',
      candidates,
    });
    expect(linkProblem(refused('APPLICATION_CHOICE_REQUIRED', { wrong: true })).kind).toBe(
      'message',
    );
    expect(linkProblem(refused('CONVERSATION_LINKED'))).toEqual({
      kind: 'message',
      text: 'This conversation already has an application.',
    });
    expect(linkProblem(new Error('offline'))).toEqual({
      kind: 'message',
      text: 'Could not create the application: offline',
    });
  });
});

describe('the mail frame', () => {
  it('allows no script and no network, and pictures only when asked', () => {
    const closed = mailFrameDocument('<p>Hello</p>', false);
    expect(closed).toContain("default-src 'none'; style-src 'unsafe-inline'; img-src data:\"");
    expect(closed).toContain('<base target="_blank">');
    expect(closed).toContain('<body><p>Hello</p></body>');
    expect(mailFrameDocument('<p>Hello</p>', true)).toContain('img-src https: data:"');
  });

  it('notices pictures that come from the internet', () => {
    expect(hasRemoteImages('<img alt="" src="https://track.example/p.gif">')).toBe(true);
    expect(hasRemoteImages('<img src="data:image/png;base64,AAAA">')).toBe(false);
    expect(hasRemoteImages('<p>No pictures</p>')).toBe(false);
  });
});
