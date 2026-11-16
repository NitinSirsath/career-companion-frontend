import { useQuery } from '@tanstack/react-query';
import { freeAIStartsWithGmail } from '../lib/freeAI';
import { api } from './client';

/**
 * True when "Connect Gmail" also turns on the free AI (owner, 15 Nov 2026): the server offers it
 * and the user has no AI provider yet.
 */
export function useFreeAIWithGmail(): boolean {
  const { data } = useQuery({
    queryKey: ['aiSettings'],
    queryFn: ({ signal }) => api.getAISettings({ signal }),
  });
  return freeAIStartsWithGmail(data);
}
