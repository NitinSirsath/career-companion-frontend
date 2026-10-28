import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/client';
import {
  REPLY_TEXT_PROBLEM,
  REPLY_TOO_LONG,
  allowSendingUrl,
  replyChoice,
  replyHint,
  replyProblem,
  replySentNote,
  replyTextProblem,
} from '../lib/mailReply';
import type { DraftDoc } from '../contracts/conversation';

const replyDoc = (text: string): DraftDoc => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

describe('what became of a reply', () => {
  it.each([
    ['the server could not confirm it', new ApiError('x', 'http', 502, 'MAIL_REPLY_UNCONFIRMED')],
    ['the request timed out', new ApiError('x', 'timeout')],
    ['the connection was lost', new ApiError('x', 'network')],
    ['the server failed', new ApiError('x', 'http', 500, 'INTERNAL_ERROR')],
    ['something unknown went wrong', new Error('x')],
  ])('may have gone out when %s: never sent again by itself', (_label, error) => {
    expect(replyProblem(error)).toEqual({ kind: 'unconfirmed' });
  });

  it.each([
    [
      'Gmail is busy',
      new ApiError('Gmail is busy. Nothing was sent. Try again.', 'http', 502, 'GMAIL_UNAVAILABLE'),
    ],
    [
      'Gmail is not connected',
      new ApiError('Connect Gmail to reply from here.', 'http', 409, 'GMAIL_NOT_CONNECTED'),
    ],
    [
      'the conversation is gone',
      new ApiError('This conversation is not in Gmail any more.', 'http', 404, 'NOT_FOUND'),
    ],
  ])('was not sent when %s, and says what the server said', (_label, error) => {
    expect(replyProblem(error)).toEqual({ kind: 'not-sent', message: error.message });
  });

  it('asks to allow sending when the connection may only read', () => {
    expect(replyProblem(new ApiError('x', 'http', 403, 'GMAIL_SEND_NOT_ALLOWED'))).toEqual({
      kind: 'allow-sending',
    });
  });
});

describe('reply wording', () => {
  it('comes back to the same mail after allowing sending', () => {
    expect(allowSendingUrl('/mails/18c2f0a1b2c3d4e5')).toBe(
      '/api/gmail/connect?returnTo=%2Fmails%2F18c2f0a1b2c3d4e5',
    );
    expect(allowSendingUrl('/mails/gmail/18c2')).toBe(
      '/api/gmail/connect?returnTo=%2Fmails%2Fgmail%2F18c2',
    );
  });

  it('says in dev mode that no real mail is sent', () => {
    expect(replyHint(true)).toContain('No real mail is sent.');
    expect(replyHint(false)).toContain('Sent from your Gmail');
    expect(replyHint(false)).not.toContain('sandbox');
  });

  it('names who the reply went to', () => {
    expect(replySentNote('Priya Nair <priya.nair@northwind.example>')).toBe(
      'Reply sent to Priya Nair.',
    );
    expect(replySentNote('priya.nair@northwind.example')).toBe(
      'Reply sent to priya.nair@northwind.example.',
    );
  });

  it('names everyone a reply to all went to', () => {
    const PRIYA = 'Priya Nair <priya.nair@northwind.example>';
    expect(replySentNote(PRIYA, ['Daniel Okafor <d@northwind.example>'])).toBe(
      'Reply sent to Priya Nair and Daniel Okafor.',
    );
    expect(
      replySentNote(PRIYA, ['Daniel Okafor <d@northwind.example>', 'lena@northwind.example']),
    ).toBe('Reply sent to Priya Nair, Daniel Okafor and lena@northwind.example.');
  });

  it('words the two choices when other people are on the mail', () => {
    const PRIYA = 'Priya Nair <priya.nair@northwind.example>';
    const others = ['Daniel Okafor <d@northwind.example>', '"Fischer, Lena" <l@northwind.example>'];
    expect(replyChoice(PRIYA, others, true)).toEqual({
      title: 'Reply to all · 3 people',
      other: 'Reply only to Priya Nair',
      leftOut: null,
    });
    expect(replyChoice(PRIYA, others, false)).toEqual({
      title: 'Reply only to Priya Nair',
      other: 'Reply to all 3 people',
      leftOut: 'Daniel Okafor and Fischer, Lena will not get this reply.',
    });
    expect(replyChoice(PRIYA, others.slice(0, 1), false).leftOut).toBe(
      'Daniel Okafor will not get this reply.',
    );
  });

  it('asks for text and refuses a reply over the limit', () => {
    expect(replyTextProblem(replyDoc('   '), '   ')).toBe(REPLY_TEXT_PROBLEM);
    expect(replyTextProblem({ type: 'doc', content: [{ type: 'paragraph' }] }, '')).toBe(
      REPLY_TEXT_PROBLEM,
    );
    const long = 'x'.repeat(20_001);
    expect(replyTextProblem(replyDoc(long), long)).toBe(REPLY_TOO_LONG);
    expect(replyTextProblem(replyDoc('Thursday works.'), 'Thursday works.')).toBeNull();
  });
});
