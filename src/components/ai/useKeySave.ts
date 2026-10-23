import { useRef, useState, type FormEvent, type RefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, isApiError } from '../../api/client';
import type { SaveAIProviderRequest, SaveAIProviderResponse } from '../../contracts/ai';
import type { CatalogProvider } from '../../contracts/aiCatalog';
import { saveProblem, settingsOf, type SaveProblem } from '../../lib/aiProviderPage';
import { startProcessingRefresh } from '../../lib/processingRefresh';

/** Reads the key once, then clears the box at once. */
function takeKey(inputRef: RefObject<HTMLInputElement | null>): string {
  const input = inputRef.current;
  const key = input?.value.trim() ?? '';
  if (input) input.value = '';
  return key;
}

/**
 * Saving a typed key: it checks consent, reads the key from its box (and clears it), sends it once,
 * and maps a refusal to its one fix. The key is never kept in React state, the query or mutation
 * cache, the URL or browser storage, so the call is made here and not through a cached mutation.
 */
export function useKeySave({
  provider,
  consentNeeded,
  consent,
  missingKey,
  body,
  note,
  onDone,
}: {
  provider: CatalogProvider;
  consentNeeded: boolean;
  consent: boolean;
  missingKey: string;
  body: (apiKey: string) => SaveAIProviderRequest;
  note: (response: SaveAIProviderResponse) => string;
  onDone: (note: string) => void;
}) {
  const queryClient = useQueryClient();
  const keyRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<SaveProblem | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (consentNeeded && !consent) {
      setProblem({ text: `Confirm that you understand what is sent to ${provider.displayName}.` });
      return;
    }
    const apiKey = takeKey(keyRef);
    if (!apiKey) {
      setProblem({ text: missingKey });
      return;
    }
    setPending(true);
    setProblem(null);
    try {
      const response = await api.saveAIProvider(provider.id, body(apiKey));
      const saved = settingsOf(response);
      queryClient.setQueryData(['aiSettings'], saved);
      // Waiting emails resume once this provider reads the mail.
      if (saved.provider === provider.id && saved.waitingEmails > 0) startProcessingRefresh();
      onDone(note(response));
    } catch (err) {
      setProblem(saveProblem(err, provider));
      if (isApiError(err) && err.outcomeUncertain)
        queryClient.invalidateQueries({ queryKey: ['aiSettings'] });
    } finally {
      setPending(false);
    }
  }

  return { keyRef, pending, problem, submit };
}
