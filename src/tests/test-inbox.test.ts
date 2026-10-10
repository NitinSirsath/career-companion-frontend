import { describe, expect, it } from 'vitest';
import { TEST_SCENARIOS } from '../contracts/testTools';
import {
  failureNotice,
  nextStepTemplate,
  resetSummary,
  scenarioStartNotice,
  scenarioStepNotice,
  templateById,
} from '../lib/testInbox';

describe('test inbox decisions', () => {
  const scenario = TEST_SCENARIOS[0];

  it('finds the next step and stops after the last one', () => {
    expect(nextStepTemplate({ scenario, next: 0, threadId: null })).toBe(
      templateById(scenario.steps[0]),
    );
    expect(
      nextStepTemplate({ scenario, next: scenario.steps.length, threadId: null }),
    ).toBeUndefined();
  });

  it('says whether the scenario created an application', () => {
    expect(scenarioStartNotice({ ...scenario, createApplication: true }, 'Contoso')).toBe(
      'Created the Contoso application. Deliver the first email when ready.',
    );
    expect(scenarioStartNotice({ ...scenario, createApplication: false }, 'Contoso')).toBe(
      'Scenario started. Deliver the first email when ready.',
    );
  });

  it('says when the scenario is finished', () => {
    expect(scenarioStepNotice('Offer', true)).toBe('Delivered "Offer". Scenario finished.');
    expect(scenarioStepNotice('Offer', false)).toContain('deliver the next one');
  });

  it('counts what reset deleted, singular and plural', () => {
    expect(resetSummary({ deletedEmails: 1, deletedApplications: 0 })).toBe(
      'Deleted 1 email and 0 applications.',
    );
  });

  it('shows the error message, or a fallback', () => {
    expect(failureNotice('reset', new Error('Server down'))).toBe('Could not reset: Server down');
    expect(failureNotice('reset', 'x')).toBe('Could not reset: Something went wrong.');
  });
});
