import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { CheckAIProviderResponse } from '../../contracts/ai';
import { settingsOf } from '../../lib/aiProviderPage';
import { startProcessingRefresh } from '../../lib/processingRefresh';

/** "Check key" on the active provider, and the note it leaves. */
export function useKeyCheck(providerId: string) {
  const queryClient = useQueryClient();
  const [lastCheck, setLastCheck] = useState<CheckAIProviderResponse | null>(null);
  const [failed, setFailed] = useState(false);
  // No key is involved, so an ordinary mutation is fine here.
  const check = useMutation({
    mutationFn: () => api.checkAIProvider(providerId),
    retry: false,
    onSuccess: (response) => {
      const next = settingsOf(response);
      queryClient.setQueryData(['aiSettings'], next);
      if (response.verification === 'VERIFIED' && next.waitingEmails > 0) startProcessingRefresh();
      setFailed(false);
      setLastCheck(response);
    },
    onError: () => {
      setFailed(true);
      queryClient.invalidateQueries({ queryKey: ['aiSettings'] });
    },
  });
  return { check, lastCheck, failed };
}
