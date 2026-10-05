import type { QueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../api/client";
import {
  deriveStatus,
  type ApplicationResponse,
  type ApplicationFilters,
  type ListApplicationsResponse,
} from "../contracts/application";

export const applicationKey = (id: string) => ["application", id] as const;

/**
 * Manual status is ordered by userStatusRevision. A read that started before an acknowledged
 * correction must not repaint older manual state; its AI/enrichment fields are still current.
 */
export function preferNewerManualState(
  known: ApplicationResponse | undefined,
  fetched: ApplicationResponse,
): ApplicationResponse {
  if (!known || known.id !== fetched.id) return fetched;
  const status = known.userStatusRevision > fetched.userStatusRevision ? {
    userStatus: known.userStatus, userStatusSetAt: known.userStatusSetAt,
    userStatusRevision: known.userStatusRevision, ...deriveStatus(fetched.aiStatus, known.userStatus),
  } : {};
  const archive = known.archiveRevision > fetched.archiveRevision ? { archivedAt: known.archivedAt, archiveRevision: known.archiveRevision } : {};
  return { ...fetched, ...status, ...archive };
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
  params: { offset: number; limit: number } & ApplicationFilters,
  signal?: AbortSignal,
): Promise<ListApplicationsResponse> {
  // A newer acknowledged manual status can invalidate server-selected membership.
  // Reread once rather than returning a short page with misleading pagination.
  for (let attempt = 0; attempt < 2; attempt++) {
    const page = await api.listApplications(params, { signal });
    const items = page.items.map((item) =>
      preferNewerManualState(
        queryClient.getQueryData(applicationKey(item.id)),
        item,
      ),
    );
    if (
      items.every((item) => matchesFilters(item, params))
    )
      return { ...page, items };
  }
  throw new ApiError(
    "Application status changed while loading. Refresh the list.",
    "contract",
  );
}

/** Applies an acknowledged canonical response to detail and list caches, never downgrading. */
export function applyAcknowledgedApplication(
  queryClient: QueryClient,
  app: ApplicationResponse,
) {
  queryClient.setQueryData<ApplicationResponse>(
    applicationKey(app.id),
    (old) =>
      preferNewerManualState(old, app),
  );
  const acknowledged = queryClient.getQueryData<ApplicationResponse>(
    applicationKey(app.id),
  )!;
  for (const query of queryClient
    .getQueryCache()
    .findAll({ queryKey: ["applications"] })) {
    const filters = query.queryKey[1] as ApplicationFilters | undefined;
    queryClient.setQueryData<ListApplicationsResponse>(
      query.queryKey,
      (old) =>
        old && {
          ...old,
          items: old.items
            .map((item) =>
              item.id === acknowledged.id
                ? preferNewerManualState(item, acknowledged)
                : item,
            )
            .filter(
              (item) =>
                matchesFilters(item, filters ?? {}),
            ),
        },
    );
    // Page membership/order is authoritative only after the server refills it.
    void queryClient.invalidateQueries({
      queryKey: query.queryKey,
      exact: true,
      refetchType: "none",
    });
  }
}

function matchesFilters(item: ApplicationResponse, filters: ApplicationFilters) {
  return (!filters.effectiveStatus || (filters.effectiveStatus === 'UNKNOWN' ? item.effectiveStatus === null : item.effectiveStatus === filters.effectiveStatus))
    && (!filters.submittedVia || item.submittedVia === filters.submittedVia)
    && (filters.archive === 'all' || (filters.archive === 'archived' ? Boolean(item.archivedAt) : !item.archivedAt));
}
