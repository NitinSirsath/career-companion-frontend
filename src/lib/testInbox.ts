import {
  TEST_EMAIL_TEMPLATES,
  type ResetTestDataResponse,
  type TestEmailLabel,
  type TestEmailTemplate,
  type TestScenario,
} from '../contracts/testTools';

export const TEST_EMAIL_LABEL_NAME: Record<TestEmailLabel, string> = {
  CATEGORY_PRIMARY: 'Primary',
  CATEGORY_UPDATES: 'Updates',
  CATEGORY_PROMOTIONS: 'Promotions',
  CATEGORY_SOCIAL: 'Social',
  SPAM: 'Spam',
};

export const templateById = (id: string): TestEmailTemplate | undefined =>
  TEST_EMAIL_TEMPLATES.find((template) => template.id === id);

/** A scenario in progress: the index of the next step and the test thread it replies in. */
export interface ScenarioRun {
  scenario: TestScenario;
  next: number;
  threadId: string | null;
}

/** The template for the run's next step, or undefined when the scenario is finished. */
export const nextStepTemplate = (run: ScenarioRun): TestEmailTemplate | undefined =>
  templateById(run.scenario.steps[run.next] ?? '');

export const scenarioStartNotice = (scenario: TestScenario, company: string): string =>
  scenario.createApplication
    ? `Created the ${company} application. Deliver the first email when ready.`
    : 'Scenario started. Deliver the first email when ready.';

export const scenarioStepNotice = (templateName: string, finished: boolean): string =>
  finished
    ? `Delivered "${templateName}". Scenario finished.`
    : `Delivered "${templateName}". Wait for it to finish, then deliver the next one.`;

const counted = (count: number, noun: string): string =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

export const resetSummary = (result: ResetTestDataResponse): string =>
  `Deleted ${counted(result.deletedEmails, 'email')} and ${counted(result.deletedApplications, 'application')}.`;

export const failureNotice = (action: string, err: unknown): string =>
  `Could not ${action}: ${err instanceof Error ? err.message : 'Something went wrong.'}`;
