import { describe, expect, it } from 'vitest';
import type { AIReadingStatusResponse, AIReadingStep } from '../contracts/ai';
import {
  NO_PLAYBACK,
  jobLabel,
  showNext,
  statusWords,
  stepView,
  takeAnswer,
  timeLeftText,
  unseenSteps,
} from '../lib/aiReading';

const reading = (overrides: Partial<AIReadingStatusResponse> = {}): AIReadingStatusResponse => ({
  state: 'READING',
  reason: null,
  provider: 'career-companion',
  model: null,
  notDone: 38,
  done: 12,
  total: 50,
  inLine: false,
  secondsLeft: 230,
  resumesAt: null,
  steps: [],
  jobMails: { count: 0, newest: [] },
  ...overrides,
});
const step = (overrides: Partial<AIReadingStep> = {}): AIReadingStep => ({
  emailId: '00000000-0000-4000-8000-000000000001',
  subject: 'Your weekly digest',
  step: 'SORTING',
  provider: 'career-companion',
  model: 'openai/gpt-6-luna',
  category: null,
  companyName: null,
  jobTitle: null,
  at: '2026-10-24T10:00:00.000Z',
  ...overrides,
});

describe('the time left', () => {
  it('is always "about": by the minute, then by 5 minutes, then by the hour', () => {
    expect(timeLeftText(42)).toBe('less than a minute left');
    expect(timeLeftText(60)).toBe('about 1 min left');
    expect(timeLeftText(230)).toBe('about 4 min left');
    expect(timeLeftText(15 * 60)).toBe('about 15 min left');
    expect(timeLeftText(22 * 60)).toBe('about 20 min left');
    expect(timeLeftText(58 * 60)).toBe('about 1 hour left');
    expect(timeLeftText(150 * 60)).toBe('about 3 hours left');
  });
});

describe('the words of the status', () => {
  it('shows progress and the time while reading, or progress only', () => {
    expect(statusWords(reading())).toEqual({
      icon: 'reading',
      title: 'Reading your new mails',
      line: '12 of 50 done · about 4 min left',
      bar: 'live',
      link: null,
    });
    expect(statusWords(reading({ secondsLeft: null }))?.line).toBe('12 of 50 done');
    expect(
      statusWords(reading({ inLine: true, done: 0, notDone: 50, secondsLeft: 360 })),
    ).toMatchObject({ title: 'Waiting in line', line: '0 of 50 done · about 6 min left' });
  });

  it('shows who is busy and when it goes on, with the bar held', () => {
    const paused = (reason: AIReadingStatusResponse['reason'], provider = 'openrouter') =>
      statusWords(
        reading({
          state: 'PAUSED',
          reason,
          provider,
          model: 'openai/gpt-6-luna',
          secondsLeft: null,
          resumesAt: new Date(Date.now() + 600_000).toISOString(),
        }),
      )!;
    expect(paused('FREE_AI_BUSY', 'career-companion')).toMatchObject({
      icon: 'paused',
      title: 'Free AI is busy',
      line: expect.stringMatching(/^12 of 50 done · continues about \d/),
      bar: 'held',
    });
    expect(paused('RATE_LIMITED').title).toBe('OpenRouter is limiting your key');
    expect(paused('PROVIDER_BUSY').title).toBe('GPT-6 Luna is busy');
    expect(paused('SAFETY_LIMIT')).toMatchObject({
      title: 'Daily AI limit reached',
      line: expect.stringMatching(/ · continues at \d/),
    });
  });

  it('offers the own key when the free AI stops, and nothing when NorthList paused AI', () => {
    const stopped = (reason: AIReadingStatusResponse['reason']) =>
      statusWords(reading({ state: 'STOPPED', reason, secondsLeft: null }))!;
    expect(stopped('FREE_AI_BUDGET')).toEqual({
      icon: 'paused',
      title: 'Free AI is paused',
      line: '38 mails wait',
      bar: null,
      link: 'Connect your own key',
    });
    expect(stopped('FREE_AI_OFF').link).toBe('Connect your own key');
    expect(stopped('PAUSED')).toMatchObject({ title: 'AI reading is paused', link: null });
  });

  it('sends the user to the AI providers page for what only they can fix', () => {
    const needs = (reason: AIReadingStatusResponse['reason'], notDone = 38) =>
      statusWords(
        reading({ state: 'NEEDS_YOU', reason, provider: 'openrouter', notDone, secondsLeft: null }),
      )!;
    expect(needs('NOT_SET_UP')).toEqual({
      icon: 'setup',
      title: '38 new mails wait for AI',
      line: null,
      bar: null,
      link: "Choose how they're read",
    });
    expect(needs('NOT_SET_UP', 1).title).toBe('1 new mail waits for AI');
    expect(needs('KEY_REJECTED')).toEqual({
      icon: 'problem',
      title: 'OpenRouter rejected your key',
      line: '38 mails wait',
      bar: null,
      link: 'Fix it on AI providers',
    });
    expect(needs('ACCOUNT_OR_BILLING').title).toBe('OpenRouter refused your account');
  });

  it('says nothing when nothing waits', () => {
    expect(statusWords(reading({ state: 'NONE' }))).toBeNull();
  });
});

describe('the live feed', () => {
  it('names the model while it works, then the answer', () => {
    expect(stepView(step())).toEqual({
      key: '00000000-0000-4000-8000-000000000001:SORTING',
      model: 'GPT-6 Luna',
      action: 'Is it a job mail?',
      working: true,
      job: false,
      subject: 'Your weekly digest',
    });
    expect(stepView(step({ step: 'READING_DETAILS' }))).toMatchObject({
      action: 'Job mail · reading details…',
      working: true,
    });
    expect(stepView(step({ step: 'NOT_JOB' }))).toMatchObject({
      model: null,
      action: 'Not a job mail',
      working: false,
    });
    // A mail that is not about a job keeps no subject.
    expect(stepView(step({ step: 'NOT_JOB', subject: null })).subject).toBe('(subject not kept)');
    expect(
      stepView(
        step({
          step: 'JOB',
          category: 'INTERVIEW',
          companyName: 'Northwind',
          jobTitle: 'Frontend Engineer',
          subject: null,
        }),
      ),
    ).toMatchObject({
      action: 'Interview · Northwind, Frontend Engineer',
      job: true,
      subject: '(no subject)',
    });
  });

  it('names a job mail by what the AI found', () => {
    expect(jobLabel({ category: 'OFFER', companyName: 'Kite', jobTitle: null })).toBe(
      'Offer · Kite',
    );
    expect(jobLabel({ category: null, companyName: null, jobTitle: null })).toBe('Job mail');
  });

  it('shows the newest step of the first answer, then plays the new steps one after another', () => {
    const one = step({ emailId: '00000000-0000-4000-8000-000000000001' });
    const two = step({ emailId: '00000000-0000-4000-8000-000000000002' });
    const first = takeAnswer(NO_PLAYBACK, reading({ steps: [one, two] }));
    expect(first.current?.key).toBe(stepView(two).key);
    expect(first.queue).toEqual([]);
    const later = takeAnswer(
      first,
      reading({
        steps: [two, step({ ...one, step: 'NOT_JOB' }), step({ ...two, step: 'NOT_JOB' })],
      }),
    );
    expect(later.current?.key).toBe(stepView(two).key);
    expect(later.queue.map((view) => view.action)).toEqual(['Not a job mail', 'Not a job mail']);
    expect(showNext(later).current?.key).toBe(`${one.emailId}:NOT_JOB`);
    expect(takeAnswer(later, reading({ state: 'NONE' }))).toMatchObject({
      queue: [],
      current: null,
    });
  });

  it('plays each mail and step once', () => {
    const steps = [step(), step({ step: 'NOT_JOB' })];
    const seen = new Set([stepView(steps[0]).key]);
    expect(unseenSteps(steps, seen).map((view) => view.action)).toEqual(['Not a job mail']);
  });
});
