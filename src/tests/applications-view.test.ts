import { describe, expect, it } from 'vitest';
import {
  activityLine,
  applicationsSearchSchema,
  INITIAL_VIEW,
  listFilters,
  searchFromView,
  viewFromSearch,
} from '../lib/applicationsView';

describe('Applications view in the URL', () => {
  it('keeps a plain list as a plain URL', () => {
    expect(searchFromView(INITIAL_VIEW)).toEqual({
      q: undefined,
      view: undefined,
      reply: undefined,
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
      list: 'progress',
      reply: 'ALL',
      tab: 'OFFER',
      archive: 'all',
      sort: 'company_asc',
    } as const;
    expect(viewFromSearch(applicationsSearchSchema.parse(searchFromView(view)))).toEqual(view);
    const apply = { ...view, list: 'apply', reply: 'replied', tab: 'ALL' } as const;
    expect(searchFromView(apply)).toMatchObject({
      view: 'apply',
      reply: 'replied',
      status: undefined,
    });
    expect(viewFromSearch(applicationsSearchSchema.parse(searchFromView(apply)))).toEqual(apply);
  });

  it('opens an old "Sent by automation" link as NorthList Apply › Waiting', () => {
    expect(viewFromSearch(applicationsSearchSchema.parse({ status: 'SUBMITTED' }))).toMatchObject({
      list: 'apply',
      reply: 'waiting',
      tab: 'ALL',
    });
  });

  it('keeps each list to its own tabs', () => {
    expect(
      viewFromSearch(applicationsSearchSchema.parse({ status: 'OFFER', view: 'apply' })),
    ).toMatchObject({ list: 'apply', reply: 'ALL', tab: 'ALL' });
    expect(viewFromSearch(applicationsSearchSchema.parse({ reply: 'replied' }))).toMatchObject({
      list: 'progress',
      reply: 'ALL',
    });
  });

  it('ignores a broken URL value instead of failing the page', () => {
    expect(
      applicationsSearchSchema.parse({ status: 'NOPE', offset: -3, view: 'x', reply: 'y' }),
    ).toEqual({
      status: undefined,
      offset: undefined,
      view: undefined,
      reply: undefined,
    });
  });

  it('maps the lists and their tabs to server filters', () => {
    const progress = { list: 'progress', reply: 'ALL' } as const;
    expect(listFilters({ ...progress, tab: 'ALL' })).toEqual({ group: 'progress' });
    expect(listFilters({ ...progress, tab: 'RECEIVED' })).toEqual({
      group: 'progress',
      effectiveStatus: 'APPLIED',
    });
    expect(listFilters({ ...progress, tab: 'INTERVIEW' })).toEqual({
      group: 'progress',
      effectiveStatus: 'INTERVIEW',
    });
    expect(listFilters({ list: 'apply', reply: 'ALL', tab: 'ALL' })).toEqual({ group: 'apply' });
    expect(listFilters({ list: 'apply', reply: 'waiting', tab: 'ALL' })).toEqual({
      group: 'apply',
      reply: 'waiting',
    });
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
  it('says when NorthList Apply sent it, and never shows system words', () => {
    expect(activityLine({ ...base, type: 'AUTOMATION_SUBMITTED', sourceEmail: null })?.what).toBe(
      'Sent by NorthList Apply',
    );
    expect(activityLine({ ...base, type: 'EMAIL_PROCESSED', sourceEmail: null })?.what).toBe(
      'A job mail',
    );
    expect(activityLine(null)).toBeNull();
  });
});
