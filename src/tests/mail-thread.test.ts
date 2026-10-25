import { describe, expect, it } from 'vitest';
import { mailFrameDocument } from '../lib/mailHtml';
import {
  askingMessageId,
  dayLabel,
  dueIn,
  hasHtmlQuote,
  initiallyFolded,
  keyDates,
  mailPreview,
  mailText,
  readingFor,
  readingSummary,
} from '../lib/mailThread';
import { makeConversation, makeConversationMail } from './fixtures';

describe('the conversation timeline', () => {
  it('folds all but the newest three mails of a long conversation', () => {
    expect(initiallyFolded(['a', 'b', 'c'])).toEqual(new Set());
    expect(initiallyFolded(['a', 'b', 'c', 'd', 'e'])).toEqual(new Set(['a', 'b']));
  });

  it('names the day of a mail', () => {
    expect(dayLabel(new Date().toISOString())).toBe('Today');
    expect(dayLabel(null)).toBe('Date unknown');
    expect(dayLabel('2025-03-07T10:00:00.000Z')).toBe('Fri 7 Mar 2025');
  });

  it('puts each AI reading under the Gmail message it read', () => {
    const mails = [
      makeConversationMail({ id: '11111111-1111-4111-8111-111111111111', gmailMessageId: 'g-1' }),
      makeConversationMail({ id: '22222222-2222-4222-8222-222222222222', gmailMessageId: 'g-2' }),
    ];
    expect(readingFor('g-2', mails)?.id).toBe('22222222-2222-4222-8222-222222222222');
    expect(readingFor('g-9', mails)).toBeNull();
  });

  it('finds the mail that asked for the open to-do, also when it is not the newest', () => {
    const asking = makeConversationMail({
      id: '11111111-1111-4111-8111-111111111111',
      gmailMessageId: 'g-1',
    });
    const newer = makeConversationMail({
      id: '22222222-2222-4222-8222-222222222222',
      gmailMessageId: 'g-2',
    });
    const conversation = makeConversation();
    const detail = {
      conversation: {
        ...conversation,
        request: { ...conversation.request!, emailId: asking.id },
      },
      mails: [asking, newer],
      sentAt: [],
      replyChoices: [],
    };
    expect(askingMessageId(detail)).toBe('g-1');
    expect(
      askingMessageId({ ...detail, conversation: { ...conversation, request: null } }),
    ).toBeNull();
  });
});

describe('what the AI read, in one line', () => {
  it("keeps the AI's own words and leaves out what it did not read", () => {
    const mail = makeConversationMail({
      category: 'INTERVIEW',
      interviewType: 'Video',
      interviewStage: null,
      interviewDate: '14 Oct',
      interviewTime: '11:00 AM IST',
      offerInfo: null,
      requestedAction: 'Confirm the time',
      actionDeadline: '13 Oct',
      assessmentDeadline: null,
    });
    expect(readingSummary(mail)).toBe(
      'Interview · Video · 14 Oct 11:00 AM IST · asks: Confirm the time · due 13 Oct',
    );
  });

  it('points to the warning instead of the payment a fake offer asks for', () => {
    const mail = makeConversationMail({
      category: 'OFFER',
      interviewType: null,
      interviewStage: null,
      offerInfo: 'Software Developer',
      requestedAction: 'Pay Rs 8,500',
      actionDeadline: '25 Oct',
      fakeOfferWarning: 'Asks you to pay Rs 8,500 to join',
    });
    expect(readingSummary(mail)).toBe(
      'Offer · Software Developer · Probably fake, see the warning above',
    );
  });

  it('lists the dates the mails name, newest mail first', () => {
    const older = makeConversationMail({
      actionDeadline: null,
      assessmentDeadline: null,
      interviewDate: '3 Nov',
      interviewTime: null,
      followUpDate: null,
    });
    const newer = makeConversationMail({
      interviewDate: null,
      assessmentDeadline: '30 Oct, 11:59 PM IST',
      actionDeadline: null,
      followUpDate: null,
    });
    expect(keyDates([older, newer])).toEqual([
      { label: 'Interview', value: '3 Nov' },
      { label: 'Assessment due', value: '30 Oct, 11:59 PM IST' },
    ]);
  });

  it('says how far a due date is', () => {
    // These times fall on the same calendar day from UTC to UTC+14: CI and the dev machines.
    const now = new Date('2026-10-17T06:00:00.000Z');
    expect(dueIn('2026-10-17T08:00:00.000Z', now)).toBe('today');
    expect(dueIn('2026-10-18T08:00:00.000Z', now)).toBe('tomorrow');
    expect(dueIn('2026-10-30T08:00:00.000Z', now)).toBe('in 13 days');
    expect(dueIn('2026-10-15T08:00:00.000Z', now)).toBe('2 days late');
  });
});

describe('quoted earlier mail in HTML', () => {
  it('finds Gmail, Apple Mail and Outlook quotes', () => {
    expect(hasHtmlQuote('<div class="gmail_quote">On … wrote:</div>')).toBe(true);
    expect(hasHtmlQuote('<blockquote type="cite">earlier</blockquote>')).toBe(true);
    expect(hasHtmlQuote('<div id="divRplyFwdMsg">From: …</div>')).toBe(true);
    expect(hasHtmlQuote('<p>Just a mail</p>')).toBe(false);
  });

  it('hides the quote inside the frame only when asked', () => {
    expect(mailFrameDocument('<p>x</p>', false, undefined, true)).toContain('.gmail_quote');
    expect(mailFrameDocument('<p>x</p>', false)).not.toContain('.gmail_quote');
  });

  const own = 'Hi,\n\nGreat, you are confirmed.';
  const quoted = 'On Sat, 17 Oct 2026, Maya wrote:\n> Hi Maya,';
  const text = `${own}\n\n${quoted}`;

  it('uses the HTML when it marks its quote, or when there is no quote at all', () => {
    const marked = '<p>Great</p><div class="gmail_quote">On Sat… wrote:</div>';
    expect(mailText({ text, html: marked })).toMatchObject({ html: marked, hasQuote: true });
    expect(mailText({ text: own, html: '<p>Great</p>' })).toMatchObject({ hasQuote: false });
  });

  it('uses the plain text when only there the quote can be found', () => {
    const html = `<div>${text.replace(/\n/g, '<br>')}</div>`;
    expect(mailText({ text, html })).toEqual({ html: null, own, quoted, hasQuote: true });
  });

  it("shows a folded mail's own words on one line, without the quote", () => {
    expect(mailPreview({ text })).toBe('Hi, Great, you are confirmed.');
  });
});
