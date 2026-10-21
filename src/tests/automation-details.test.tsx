// @vitest-environment jsdom
// COM-279: automation details in the table, on the application page and on the Automation page.
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { format } from 'date-fns';
import { api } from '../api/client';
import { ApplicationsTable } from '../components/applications/ApplicationsTable';
import { ToastProvider } from '../components/ui/toast';
import type { ApplicationSubmission, NotSubmittedJob } from '../contracts/submission';
import { routeTree } from '../routeTree.gen';
import { makeApplication } from './fixtures';
import { renderPart } from './render';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    api: {
      get: vi.fn(),
      getGmailStatus: vi.fn(),
      getApplication: vi.fn(),
      getApplicationEvents: vi.fn(),
      getApplicationActions: vi.fn(),
      getApplicationSubmissions: vi.fn(),
      listIntegrationTokens: vi.fn(),
      getMcpConnection: vi.fn(),
      getPendingSubmissions: vi.fn(),
      listApplications: vi.fn(),
      getNotSubmittedJobs: vi.fn(),
    },
  };
});

const page = <T,>(items: T[]) => ({ items, metadata: { limit: 20, offset: 0, nextOffset: null } });
const SUBMITTED = '2026-10-20T08:44:05.000Z';
const automationApp = makeApplication({
  id: 'app-1',
  companyName: 'Acme',
  jobTitle: 'Frontend Engineer',
  appliedAt: SUBMITTED,
  submittedVia: 'AUTOMATION',
  automation: {
    platform: 'linkedin',
    jobUrl: 'https://www.linkedin.com/jobs/view/1/',
    submittedAt: SUBMITTED,
  },
});
const manualApp = makeApplication({ id: 'app-2', companyName: 'Manual Co' });

const submission = (overrides: Partial<ApplicationSubmission> = {}): ApplicationSubmission => ({
  id: 'sub-1',
  sourceRecordRef: '2026-10-20/14:14:05',
  matchState: 'CREATED',
  platform: 'workday',
  company: 'Acme',
  jobTitle: 'Frontend Engineer',
  submittedAt: SUBMITTED,
  receivedAt: SUBMITTED,
  jobUrl: 'https://weworkremotely.com/remote-jobs/acme',
  applyUrl: 'https://acme.wd3.myworkdayjobs.com/apply/R-1',
  portalJobId: 'R-1',
  destinationHost: 'acme.wd3.myworkdayjobs.com',
  discoverySource: 'we_work_remotely',
  location: 'Remote',
  workMode: 'remote',
  confirmationText: 'Thank you for applying.',
  resumeFilename: 'Resume.pdf',
  submittedAnswers: [
    { question: 'Notice period?', answer: '30 days' },
    { question: 'Expected CTC?', answer: '15 LPA' },
  ],
  ...overrides,
});
const notSubmitted = (overrides: Partial<NotSubmittedJob> = {}): NotSubmittedJob => ({
  id: 'n1',
  sourceRecordRef: '2026-10-21/12:41:03',
  outcome: 'NEEDS_USER',
  platform: 'workday',
  company: 'Tailspin',
  jobTitle: 'Engineer II',
  jobUrl: 'https://tailspin.example/job/1',
  reason: 'Required question with no saved answer',
  loggedAt: '2026-10-21T07:11:03.000Z',
  receivedAt: '2026-10-21T09:30:00.000Z',
  ...overrides,
});

function show(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { user: { id: 'u', email: 'u@test.local', name: 'U' } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return router;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.get).mockResolvedValue(page([]));
  vi.mocked(api.getGmailStatus).mockResolvedValue({ connected: false } as never);
  vi.mocked(api.getApplication).mockResolvedValue(automationApp);
  vi.mocked(api.getApplicationEvents).mockResolvedValue(page([]));
  vi.mocked(api.getApplicationActions).mockResolvedValue(page([]));
  vi.mocked(api.getApplicationSubmissions).mockResolvedValue({ items: [submission()] });
  vi.mocked(api.listIntegrationTokens).mockResolvedValue(page([]));
  vi.mocked(api.getMcpConnection).mockResolvedValue({ serverAddress: null });
  vi.mocked(api.getPendingSubmissions).mockResolvedValue(page([]));
  vi.mocked(api.listApplications).mockResolvedValue(page([automationApp]));
  vi.mocked(api.getNotSubmittedJobs).mockResolvedValue(page([notSubmitted()]));
});
afterEach(cleanup);

describe('applications table', () => {
  const rowOf = (name: string) => screen.getByRole('link', { name }).closest('[role="row"]')!;

  it('shows platform, job link and time for automation rows only', async () => {
    renderPart(<ApplicationsTable applications={[automationApp, manualApp]} />, new QueryClient());
    await screen.findByRole('link', { name: 'Acme' });
    const auto = within(rowOf('Acme') as HTMLElement);
    expect(auto.getByText('LinkedIn')).toBeInTheDocument();
    const jobLink = auto.getByRole('link', { name: /Open the job post for Acme/ });
    expect(jobLink).toHaveAttribute('href', 'https://www.linkedin.com/jobs/view/1/');
    expect(jobLink).toHaveAttribute('target', '_blank');
    expect(jobLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(auto.getByText(format(new Date(SUBMITTED), 'h:mm a'))).toBeInTheDocument();
    const manual = within(rowOf('Manual Co') as HTMLElement);
    expect(manual.queryByRole('link', { name: /Open the job post/ })).toBeNull();
    expect(manual.queryByText(/\d:\d\d [AP]M/)).toBeNull();
  });

  it('links only http(s) addresses and shows no time when the applied date is not the automation’s', async () => {
    const linked = makeApplication({
      id: 'app-3',
      companyName: 'Linked Co',
      appliedAt: '2026-10-01T00:00:00.000Z',
      submittedVia: 'AUTOMATION',
      automation: { platform: 'naukri', jobUrl: 'javascript:alert(1)', submittedAt: SUBMITTED },
    });
    renderPart(<ApplicationsTable applications={[linked]} />, new QueryClient());
    await screen.findByRole('link', { name: 'Linked Co' });
    const row = within(rowOf('Linked Co') as HTMLElement);
    expect(row.getByText('Naukri')).toBeInTheDocument();
    expect(row.queryByRole('link', { name: /Open the job post/ })).toBeNull();
    expect(row.queryByText(/\d:\d\d [AP]M/)).toBeNull();
  });
});

describe('application page', () => {
  it('has no tabs for an application without automation', async () => {
    vi.mocked(api.getApplication).mockResolvedValue(manualApp);
    show('/applications/app-2');
    await screen.findByRole('heading', { name: 'Manual Co' });
    expect(screen.queryByRole('tab', { name: 'Automation details' })).toBeNull();
    expect(api.getApplicationSubmissions).not.toHaveBeenCalled();
  });

  it('shows every detail and answer in the Automation details tab', async () => {
    show('/applications/app-1');
    expect(await screen.findByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Automation details' }));
    const details = await screen.findByRole('region', { name: 'Submission' });
    const value = (label: string) => within(details).getByText(label).nextElementSibling;
    expect(within(value('Job post') as HTMLElement).getByRole('link')).toHaveAttribute(
      'href',
      'https://weworkremotely.com/remote-jobs/acme',
    );
    expect(within(value('Apply page') as HTMLElement).getByRole('link')).toHaveAttribute(
      'target',
      '_blank',
    );
    expect(value('Platform')).toHaveTextContent('Workday');
    expect(value('Found on')).toHaveTextContent('We work remotely');
    expect(value('Work mode')).toHaveTextContent('Remote');
    expect(value('Job ID')).toHaveTextContent('R-1');
    expect(value('The site said')).toHaveTextContent('Thank you for applying.');
    expect(value('Resume')).toHaveTextContent('Resume.pdf');
    const answers = screen.getByRole('region', { name: 'Submitted answers (2)' });
    expect(within(answers).getByText('Notice period?')).toBeInTheDocument();
    expect(within(answers).getByText('15 LPA')).toBeInTheDocument();
  });

  it('marks what was not sent and shows text, never markup', async () => {
    vi.mocked(api.getApplicationSubmissions).mockResolvedValue({
      items: [
        submission({
          applyUrl: null,
          discoverySource: null,
          resumeFilename: null,
          confirmationText: '<img src=x onerror=alert(1)>',
          jobUrl: 'javascript:alert(1)',
          submittedAnswers: [],
        }),
      ],
    });
    show('/applications/app-1');
    fireEvent.click(await screen.findByRole('tab', { name: 'Automation details' }));
    const details = await screen.findByRole('region', { name: 'Submission' });
    expect(within(details).getAllByText('Not sent')).toHaveLength(3);
    expect(within(details).queryByRole('link')).toBeNull();
    expect(within(details).getByText('javascript:alert(1)')).toBeInTheDocument();
    expect(within(details).getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(details.querySelector('img')).toBeNull();
    expect(screen.getByText('No answers were sent.')).toBeInTheDocument();
  });
});

describe('automation page', () => {
  it('lists every application the automation sent under Submitted', async () => {
    show('/automation');
    expect(await screen.findByRole('tab', { name: 'Submitted' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await screen.findByRole('link', { name: 'Acme' })).toBeInTheDocument();
    expect(api.listApplications).toHaveBeenCalledWith(
      expect.objectContaining({ submittedVia: 'AUTOMATION', archive: 'all' }),
      expect.anything(),
    );
  });

  it('lists the jobs not submitted with their reason and time', async () => {
    vi.mocked(api.getNotSubmittedJobs).mockResolvedValue(
      page([
        notSubmitted(),
        notSubmitted({
          id: 'n2',
          outcome: 'SKIPPED',
          company: 'Litware',
          jobUrl: null,
          reason: 'Not a fit',
        }),
      ]),
    );
    const router = show('/automation');
    fireEvent.click(await screen.findByRole('tab', { name: 'Not submitted' }));
    const table = await screen.findByRole('table', { name: 'Jobs not submitted' });
    await within(table).findByText('Needs you');
    expect(router.state.location.search).toEqual({ tab: 'not-submitted' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Needs you')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Required question with no saved answer')).toBeInTheDocument();
    expect(within(rows[0]).getByRole('link', { name: /Open the job post/ })).toHaveAttribute(
      'href',
      'https://tailspin.example/job/1',
    );
    expect(
      within(rows[0]).getByText(format(new Date('2026-10-21T07:11:03.000Z'), 'h:mm a')),
    ).toBeInTheDocument();
    expect(within(rows[1]).getByText('Skipped')).toBeInTheDocument();
    expect(within(rows[1]).queryByRole('link')).toBeNull();
  });

  it('shows the backend address and the profile line under Setup', async () => {
    vi.mocked(api.getMcpConnection).mockResolvedValue({
      serverAddress: 'https://cc-api.example.com',
    });
    show('/automation?tab=setup');
    expect(await screen.findByText('https://cc-api.example.com/mcp')).toBeInTheDocument();
    expect(
      screen.getByText('- Career Companion server: https://cc-api.example.com'),
    ).toBeInTheDocument();
    expect(screen.queryByText(`${window.location.origin}/mcp`)).toBeNull();
  });
});
