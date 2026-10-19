import { describe, expect, it } from 'vitest';
import { parseStoredTheme, resolveTheme } from '../lib/theme';
import { applicationTag, statusTag, STATUS_TAG_COLOR } from '../lib/statusTags';
import { initials } from '../components/ui/avatar';

describe('themes', () => {
  it('keeps System, Light, White and Dark, and falls back to System for anything else', () => {
    expect(parseStoredTheme('light')).toBe('light');
    expect(parseStoredTheme('white')).toBe('white');
    expect(parseStoredTheme('dark')).toBe('dark');
    expect(parseStoredTheme('system')).toBe('system');
    for (const removed of ['grey', 'github', 'monokai', null, '']) {
      expect(parseStoredTheme(removed)).toBe('system');
    }
  });

  it('follows the computer only for System', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('white', true)).toBe('white');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('one status look', () => {
  it('gives every status its own colour, in job-search order', () => {
    expect(STATUS_TAG_COLOR).toEqual({
      APPLIED: 'gray',
      RECRUITER_CONTACT: 'cyan',
      ASSESSMENT: 'teal',
      INTERVIEW: 'blue',
      OFFER: 'green',
      REJECTED: 'red',
      CLOSED: 'outline',
    });
    expect(new Set(Object.values(STATUS_TAG_COLOR)).size).toBe(7);
  });

  it('never uses yellow for a status: yellow means only "needs action"', () => {
    expect(Object.values(STATUS_TAG_COLOR)).not.toContain('yellow');
  });

  it('labels statuses in plain sentence case', () => {
    expect(statusTag('APPLIED')).toEqual({ label: 'Applied', color: 'gray' });
    expect(statusTag('RECRUITER_CONTACT')).toEqual({ label: 'Recruiter contact', color: 'cyan' });
    expect(statusTag(null)).toEqual({ label: 'Status unknown', color: 'outline' });
  });

  it('says "Sent by automation" only before any status exists', () => {
    expect(
      applicationTag({
        statusSource: 'UNKNOWN',
        submittedVia: 'AUTOMATION',
        effectiveStatus: null,
      }),
    ).toEqual({ label: 'Sent by automation', color: 'outline' });
    expect(
      applicationTag({ statusSource: 'AI', submittedVia: 'AUTOMATION', effectiveStatus: 'OFFER' }),
    ).toEqual({ label: 'Offer', color: 'green' });
  });
});

describe('avatar initials', () => {
  it('takes the first letters of up to two words', () => {
    expect(initials('Maya Chen')).toBe('MC');
    expect(initials('Quanta Labs Hiring')).toBe('QL');
    expect(initials('riya')).toBe('R');
    expect(initials('  ')).toBe('');
  });
});
