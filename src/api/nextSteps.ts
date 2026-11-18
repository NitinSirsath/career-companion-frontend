import { useQuery } from '@tanstack/react-query';
import type { ActionWithContextResponse } from '../contracts/action';
import { stepText } from '../lib/applicationDetail';
import { deadlineOverdue } from '../lib/deadline';
import { api } from './client';

/**
 * Each application's next step for the lists (owner, 18 Nov 2026, `PHONE-LINEAR-mock/`): "1 to do"
 * with "Pick a time · Due Mon" under it, red only when past due. The Applications list has no step
 * text, so the open steps are read once from `GET /api/actions?status=PENDING`, on every page.
 */
export interface NextStep {
  applicationId: string;
  actionId: string;
  /** The step in words: its own text, else its type ("Interview scheduled"). */
  text: string;
  deadline: string | null;
  deadlinePrecision: 'DATE' | 'DATETIME' | null;
  /** The deadline has passed while the step is still open. */
  pastDue: boolean;
}

/** Starts with `application-actions`, so whatever refreshes an application's steps refreshes these. */
export const NEXT_STEPS_KEY = ['application-actions', 'next-steps'] as const;

/** The server gives at most 20 a page; 10 pages is far more open steps than anyone has. */
const PAGE = 20;
const MAX_PAGES = 10;

const time = (value: string | Date | null) => (value === null ? null : new Date(value).getTime());

/** Earliest deadline first, steps without one after them, then the oldest. */
function earlier(a: ActionWithContextResponse, b: ActionWithContextResponse) {
  const [da, db] = [time(a.deadline), time(b.deadline)];
  if (da !== db) {
    if (da === null) return false;
    if (db === null) return true;
    return da < db;
  }
  return (time(a.createdAt) ?? 0) < (time(b.createdAt) ?? 0);
}

/** One step per application: its open step that is due first. Done and dismissed steps are left out. */
export function nextStepsByApplication(
  actions: readonly ActionWithContextResponse[],
  now = new Date(),
): Map<string, NextStep> {
  const first = new Map<string, ActionWithContextResponse>();
  for (const action of actions) {
    if (action.status !== 'PENDING') continue;
    const current = first.get(action.applicationId);
    if (!current || earlier(action, current)) first.set(action.applicationId, action);
  }
  const steps = new Map<string, NextStep>();
  for (const [applicationId, action] of first) {
    const deadline = action.deadline === null ? null : new Date(action.deadline).toISOString();
    steps.set(applicationId, {
      applicationId,
      actionId: action.id,
      text: stepText(action),
      deadline,
      deadlinePrecision: action.deadlinePrecision,
      pastDue: deadlineOverdue(action, now),
    });
  }
  return steps;
}

/** Every open step of the user's active applications, page by page. */
async function fetchOpenSteps(): Promise<ActionWithContextResponse[]> {
  const all: ActionWithContextResponse[] = [];
  let offset: number | null = 0;
  for (let page = 0; page < MAX_PAGES && offset !== null; page += 1) {
    const response = await api.getActions('PENDING', { limit: PAGE, offset });
    all.push(...response.items);
    offset = response.metadata.nextOffset;
  }
  return all;
}

/** Stable, so the map is built once per answer, not on every render. */
const byApplication = (actions: ActionWithContextResponse[]) => nextStepsByApplication(actions);

/**
 * The next step of each application, by application id. `steps` is undefined while loading or
 * when the steps could not be read: the list then shows only its "N to do" counts.
 */
export function useNextSteps() {
  const query = useQuery({
    queryKey: NEXT_STEPS_KEY,
    queryFn: fetchOpenSteps,
    select: byApplication,
  });
  return {
    steps: query.data,
    isLoading: query.isLoading,
    error: query.error,
  };
}
