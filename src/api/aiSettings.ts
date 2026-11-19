import { useQuery } from '@tanstack/react-query';
import { api } from './client';

/** The cache key of the user's AI settings. */
export const AI_SETTINGS_KEY = ['aiSettings'] as const;

/** The user's AI settings: whether the AI is set up, and the models it reads with. */
export function useAISettings() {
  return useQuery({
    queryKey: AI_SETTINGS_KEY,
    queryFn: ({ signal }) => api.getAISettings({ signal }),
  });
}
