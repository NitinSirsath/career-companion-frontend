// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import type { DashboardResponse } from '../contracts/dashboard';
import { Tips } from '../components/dashboard/Tips';
import { tipWords } from '../lib/dashboardTips';

afterEach(cleanup);

describe('the words of the rule tips', () => {
  it('jobs gone quiet', () => {
    expect(tipWords({ kind: 'GONE_QUIET', count: 6 })).toEqual({
      text: '6 jobs have gone quiet. Follow up, or close the ones you have given up on.',
      link: { label: 'See them', to: 'GONE_QUIET' },
    });
  });

  it('reply time, with or without mails waiting', () => {
    expect(tipWords({ kind: 'REPLY_TIME', medianReplyHours: 9, waitingOverADay: 2 }).text).toBe(
      'You answer recruiters in about 9 hours. 2 mails have waited more than a day.',
    );
    expect(tipWords({ kind: 'REPLY_TIME', medianReplyHours: null, waitingOverADay: 1 })).toEqual({
      text: '1 mail has waited more than a day.',
      link: { label: 'Open it', to: 'MAILS_NEEDS_ACTION' },
    });
    expect(
      tipWords({ kind: 'REPLY_TIME', medianReplyHours: 30, waitingOverADay: 0 }).link,
    ).toBeNull();
  });

  it('a site that answers more often, by its name', () => {
    expect(
      tipWords({
        kind: 'SITE_ANSWERS_MORE',
        site: 'linkedin',
        percent: 42,
        otherSite: 'naukri',
        otherPercent: 25,
      }).text,
    ).toBe('LinkedIn gets you replies more often than Naukri: 42% against 25%.');
  });

  it('early days', () => {
    expect(tipWords({ kind: 'EARLY_DAYS', medianDays: null }).text).toMatch(
      /^Replies usually come 1 to 2 weeks/,
    );
  });
});

function show(tips: DashboardResponse['tips'], aiTip: DashboardResponse['aiTip']) {
  const rootRoute = createRootRoute({ component: () => <Tips tips={tips} aiTip={aiTip} /> });
  const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory() });
  return render(<RouterProvider router={router} />);
}

describe('the tips on the page', () => {
  it('rule tips and the AI tip with its model name', async () => {
    show([{ kind: 'GONE_QUIET', count: 2 }], {
      text: 'Send more to remote roles.',
      modelName: 'GPT-6 Luna',
      createdAt: '2026-10-27T03:30:00.000Z',
    });
    expect(await screen.findByText(/2 jobs have gone quiet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See them' })).toHaveAttribute('href', '#gone-quiet');
    expect(screen.getByText('Send more to remote roles.')).toBeInTheDocument();
    expect(screen.getByText(/AI tip by GPT-6 Luna, from your numbers only/)).toBeInTheDocument();
  });

  it('no AI tip and no empty box when there is nothing to say', async () => {
    const { container } = show([], null);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container).toBeEmptyDOMElement();
  });
});
