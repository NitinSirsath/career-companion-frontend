import { describe, expect, it } from 'vitest';
import { parseStoredTheme, resolveTheme } from '../lib/theme';
import { applicationTag, statusTag, STATUS_RING } from '../lib/statusTags';
import { initials } from '../components/ui/avatar';

describe('themes', () => {
  it('keeps System, Light and Dark, and falls back to System for anything else', () => {
    expect(parseStoredTheme('light')).toBe('light');
    expect(parseStoredTheme('dark')).toBe('dark');
    expect(parseStoredTheme('system')).toBe('system');
    // A saved White, from before the flat themes, opens as System.
    for (const removed of ['white', 'grey', 'github', 'monokai', null, '']) {
      expect(parseStoredTheme(removed)).toBe('system');
    }
  });

  it('follows the computer only for System', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('one status look', () => {
  it('gives every status a ring, in job-search order, and closes Rejected and Closed alike', () => {
    expect(STATUS_RING).toEqual({
      APPLIED: 'applied',
      RECRUITER_CONTACT: 'recruiter',
      ASSESSMENT: 'assessment',
      INTERVIEW: 'interview',
      OFFER: 'offer',
      REJECTED: 'closed',
      CLOSED: 'closed',
    });
  });

  it('labels statuses in plain sentence case', () => {
    expect(statusTag('APPLIED')).toEqual({ label: 'Applied', ring: 'applied' });
    expect(statusTag('RECRUITER_CONTACT')).toEqual({
      label: 'Recruiter contact',
      ring: 'recruiter',
    });
    expect(statusTag(null)).toEqual({ label: 'Status unknown', ring: 'applied' });
  });

  it('says "No reply yet" only before any status exists', () => {
    expect(
      applicationTag({
        statusSource: 'UNKNOWN',
        submittedVia: 'AUTOMATION',
        effectiveStatus: null,
      }),
    ).toEqual({ label: 'No reply yet', ring: 'applied' });
    expect(
      applicationTag({ statusSource: 'AI', submittedVia: 'AUTOMATION', effectiveStatus: 'OFFER' }),
    ).toEqual({ label: 'Offer', ring: 'offer' });
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
