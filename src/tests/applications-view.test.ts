import { describe, expect, it } from 'vitest';
import {
  activityLine,
  applicationsSearchSchema,
  INITIAL_VIEW,
  searchFromView,
  tabFilters,
  viewFromSearch,
} from '../lib/applicationsView';

describe('Applications view in the URL', () => {
  it('keeps a plain list as a plain URL', () => {
    expect(searchFromView(INITIAL_VIEW)).toEqual({
      q: undefined,
      status: undefined,
      archive: undefined,
      sort: undefined,
      offset: undefined,
    });
  });

  it('round-trips every filter through the URL', () => {
    const view = {
      offset: 20,
      search: 'acme',
      tab: 'OFFER',
      archive: 'all',
      sort: 'company_asc',
    } as const;
    expect(viewFromSearch(applicationsSearchSchema.parse(searchFromView(view)))).toEqual(view);
  });

  it('ignores a broken URL value instead of failing the page', () => {
    expect(applicationsSearchSchema.parse({ status: 'NOPE', offset: -3 })).toEqual({
      status: undefined,
      offset: undefined,
    });
  });

  it('maps the status tabs to server filters', () => {
    expect(tabFilters('ALL')).toEqual({});
    expect(tabFilters('RECEIVED')).toEqual({ effectiveStatus: 'APPLIED' });
    expect(tabFilters('SUBMITTED')).toEqual({
      effectiveStatus: 'UNKNOWN',
      submittedVia: 'AUTOMATION',
    });
    expect(tabFilters('INTERVIEW')).toEqual({ effectiveStatus: 'INTERVIEW' });
  });
});

describe('last activity in plain words', () => {
  const base = {
    createdAt: '2026-10-17T10:00:00.000Z',
    recordedAt: '2026-10-17T10:00:00.000Z',
    sourceSubmission: null,
  };
  it('names the sender of a mail', () => {
    expect(
      activityLine({
        ...base,
        type: 'EMAIL_PROCESSED',
        sourceEmail: {
          id: 'e1',
          subject: 'Next step',
          sender: 'Arjun Mehta <arjun@quanta.example>',
          receivedAt: null,
        },
      })?.what,
    ).toBe('Mail from Arjun Mehta');
  });
  it('says when the automation sent it, and never shows system words', () => {
    expect(activityLine({ ...base, type: 'AUTOMATION_SUBMITTED', sourceEmail: null })?.what).toBe(
      'Sent by your automation',
    );
    expect(activityLine({ ...base, type: 'EMAIL_PROCESSED', sourceEmail: null })?.what).toBe(
      'A job mail',
    );
    expect(activityLine(null)).toBeNull();
  });
});
