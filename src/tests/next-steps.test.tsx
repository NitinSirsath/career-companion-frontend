// @vitest-environment jsdom
/**
 * Each application's next step for the lists (owner, 18 Nov 2026, `PHONE-LINEAR-mock/`): read once
 * from the open steps, the one due first per application, red only when past due.
 */
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../api/client';
import { nextStepsByApplication, useNextSteps } from '../api/nextSteps';
import type { ActionWithContextResponse } from '../contracts/action';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  api: { getActions: vi.fn() },
}));

afterEach(() => vi.clearAllMocks());

let n = 0;
function step(fields: Partial<ActionWithContextResponse>): ActionWithContextResponse {
  n += 1;
  return {
    origin: 'EMAIL',
    actionRevision: 0,
    clientRequestId: null,
    snoozedUntil: null,
    id: `action-${n}`,
    applicationId: 'app-1',
    emailId: null,
    type: 'SCHEDULE_INTERVIEW',
    description: null,
    deadline: null,
    deadlinePrecision: null,
    status: 'PENDING',
    createdAt: `2026-11-0${(n % 9) + 1}T10:00:00.000Z`,
    application: { companyName: 'Brightwave', jobTitle: null },
    email: null,
    missed: null,
    ...fields,
  };
}

const NOW = new Date('2026-11-18T12:00:00.000Z');

describe('nextStepsByApplication', () => {
  it('keeps the open step due first per application, one without a date last', () => {
    const steps = nextStepsByApplication(
      [
        step({ id: 'later', description: 'Send references', deadline: '2026-11-25T10:00:00.000Z' }),
        step({ id: 'none', description: 'Say thanks' }),
        step({ id: 'soon', description: 'Pick a time', deadline: '2026-11-23T10:00:00.000Z' }),
        step({ id: 'other', applicationId: 'app-2', description: 'Finish the profile form' }),
      ],
      NOW,
    );
    expect(steps.get('app-1')).toMatchObject({
      actionId: 'soon',
      text: 'Pick a time',
      deadline: '2026-11-23T10:00:00.000Z',
      pastDue: false,
    });
    expect(steps.get('app-2')).toMatchObject({ text: 'Finish the profile form', deadline: null });
    expect(steps.size).toBe(2);
  });

  it('says past due, names a step by its type when it has no words, and skips closed steps', () => {
    const steps = nextStepsByApplication(
      [
        step({
          status: 'COMPLETED',
          description: 'Done already',
          deadline: '2026-11-01T10:00:00Z',
        }),
        step({ deadline: '2026-11-10', deadlinePrecision: 'DATE' }),
      ],
      NOW,
    );
    expect(steps.get('app-1')).toMatchObject({ text: 'Schedule interview', pastDue: true });
  });

  it('gives nothing for an application with no open step', () => {
    expect(nextStepsByApplication([step({ status: 'DISMISSED' })], NOW).size).toBe(0);
  });
});

describe('useNextSteps', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {children}
    </QueryClientProvider>
  );

  it('reads every page of open steps once', async () => {
    vi.mocked(api.getActions)
      .mockResolvedValueOnce({
        items: [step({ applicationId: 'app-1', description: 'Pick a time' })],
        metadata: { nextOffset: 20, limit: 20, offset: 0 },
      })
      .mockResolvedValueOnce({
        items: [step({ applicationId: 'app-2', description: 'Reply with a time' })],
        metadata: { nextOffset: null, limit: 20, offset: 20 },
      });
    const { result } = renderHook(() => useNextSteps(), { wrapper });
    await waitFor(() => expect(result.current.steps).toBeDefined());
    expect(api.getActions).toHaveBeenNthCalledWith(1, 'PENDING', { limit: 20, offset: 0 });
    expect(api.getActions).toHaveBeenNthCalledWith(2, 'PENDING', { limit: 20, offset: 20 });
    expect(result.current.steps?.get('app-2')?.text).toBe('Reply with a time');
  });

  it('has no steps when they cannot be read, so the lists keep their counts', async () => {
    vi.mocked(api.getActions).mockRejectedValue(new Error('down'));
    const { result } = renderHook(() => useNextSteps(), { wrapper });
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.steps).toBeUndefined();
  });
});
