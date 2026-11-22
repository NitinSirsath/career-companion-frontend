import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AdminInvitesResponseSchema,
  InviteResponseSchema,
  type InviteRequest,
} from '../contracts/invites';
import { api } from './client';

/** Get an invite for the release (owner, 22 Nov 2026): the sign-in page form, and the Admin list. */
export const inviteKeys = { admin: ['admin', 'invites'] as const };

export function useAskForInvite() {
  return useMutation({
    mutationFn: async (input: InviteRequest) =>
      InviteResponseSchema.parse(await api.post<unknown>('/api/invites', input)),
  });
}

export function useAdminInvites() {
  return useQuery({
    queryKey: inviteKeys.admin,
    queryFn: async ({ signal }) =>
      AdminInvitesResponseSchema.parse(await api.get<unknown>('/api/admin/invites', { signal }))
        .invites,
  });
}
