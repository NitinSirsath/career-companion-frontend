import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AdminAccountResponseSchema,
  AdminFreeAIMoneySchema,
  AdminOverviewSchema,
  type AdminAccount,
  type AdminOverview,
} from '../contracts/admin';
import { api } from './client';

/** The Admin page (owner, 18 Nov 2026). The server answers 404 to anyone not in ADMIN_EMAILS. */
export const adminKeys = {
  overview: ['admin', 'overview'] as const,
  money: ['admin', 'freeAIMoney'] as const,
};

export function useAdminOverview() {
  return useQuery({
    queryKey: adminKeys.overview,
    queryFn: async ({ signal }) =>
      AdminOverviewSchema.parse(await api.get<unknown>('/api/admin', { signal })),
  });
}

/** Asked from OpenRouter on each load; a slow answer never holds up the rest of the page. */
export function useFreeAIMoney() {
  return useQuery({
    queryKey: adminKeys.money,
    queryFn: async ({ signal }) =>
      AdminFreeAIMoneySchema.parse(await api.get<unknown>('/api/admin/free-ai-money', { signal })),
    retry: false,
  });
}

/** Puts the changed account into the overview, so the page shows it at once. */
function useAccountChange(send: (input: { id: string; reason?: string }) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; reason?: string }) =>
      AdminAccountResponseSchema.parse(await send(input)).account,
    onSuccess: (account: AdminAccount) =>
      queryClient.setQueryData<AdminOverview>(
        adminKeys.overview,
        (overview) =>
          overview && {
            ...overview,
            accounts: overview.accounts.map((row) => (row.id === account.id ? account : row)),
          },
      ),
  });
}

export const useSuspendAccount = () =>
  useAccountChange(({ id, reason }) =>
    api.post<unknown>(`/api/admin/accounts/${id}/suspend`, { reason }),
  );

export const useResumeAccount = () =>
  useAccountChange(({ id }) => api.post<unknown>(`/api/admin/accounts/${id}/resume`));
