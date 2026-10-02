import type { QueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import {
  deriveStatus,
  type ApplicationResponse,
  type ListApplicationsResponse,
} from '../contracts/application';

export const applicationKey = (id: string) => ['application', id] as const;

/**
 * Manual status is ordered by userStatusRevision. A read that started before an acknowledged
 * correction must not repaint older manual state; its AI/enrichment fields are still current.
 */
export function preferNewerManualState(
  known: ApplicationResponse | undefined,
  fetched: ApplicationResponse,
): ApplicationResponse {
  if (!known || known.id !== fetched.id || known.userStatusRevision <= fetched.userStatusRevision)
    return fetched;
  return {
    ...fetched,
    userStatus: known.userStatus,
    userStatusSetAt: known.userStatusSetAt,
    userStatusRevision: known.userStatusRevision,
    ...deriveStatus(fetched.aiStatus, known.userStatus),
  };
}

export function applicationQueryOptions(queryClient: QueryClient, id: string) {
  return {
    queryKey: applicationKey(id),
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const fetched = await api.getApplication(id, { signal });
      // Compare with the cache as it is when the response arrives, not when the request started.
      return preferNewerManualState(
        queryClient.getQueryData<ApplicationResponse>(applicationKey(id)),
        fetched,
      );
    },
  };
}

export async function fetchApplicationsPage(
  queryClient: QueryClient,
  params: { offset: number; limit: number },
  signal?: AbortSignal,
): Promise<ListApplicationsResponse> {
  const page = await api.listApplications(params, { signal });
  return {
    ...page,
    items: page.items.map((item) =>
      preferNewerManualState(queryClient.getQueryData(applicationKey(item.id)), item),
    ),
  };
}

/** Applies an acknowledged canonical response to detail and list caches, never downgrading. */
export function applyAcknowledgedApplication(queryClient: QueryClient, app: ApplicationResponse) {
  queryClient.setQueryData<ApplicationResponse>(applicationKey(app.id), (old) =>
    old && old.userStatusRevision > app.userStatusRevision ? old : app,
  );
  queryClient.setQueriesData<ListApplicationsResponse>({ queryKey: ['applications'] }, (old) =>
    old && {
      ...old,
      items: old.items.map((item) =>
        item.id === app.id && item.userStatusRevision <= app.userStatusRevision ? app : item,
      ),
    },
  );
}
