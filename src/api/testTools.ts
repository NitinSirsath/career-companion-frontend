import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import {
  DeliverTestEmailResponseSchema,
  ResetTestDataResponseSchema,
  TestToolsStatusSchema,
  type DeliverTestEmailRequest,
  type DeliverTestEmailResponse,
  type ResetTestDataResponse,
  type TemplateValues,
  type TestScenario,
} from '../contracts/testTools';
import { startProcessingRefresh } from '../lib/processingRefresh';

/** Test tools show only in a build made with VITE_TEST_TOOLS=true AND when the backend has them on. */
export const testToolsBuildEnabled = (): boolean => import.meta.env.VITE_TEST_TOOLS === 'true';

export const testToolsKeys = {
  status: ['testToolsStatus'] as const,
  /** Shared by every test-tools change, so the panel can wait while any of them runs. */
  change: ['testToolsChange'] as const,
};

/** Never throws: anything but a valid answer means off. Plain fetch, so a 401 never redirects. */
export async function getTestToolsEnabled(): Promise<boolean> {
  if (!testToolsBuildEnabled()) return false;
  try {
    const response = await fetch('/api/test-tools/status', {
      credentials: 'include',
      cache: 'no-store',
    });
    if (!response.ok) return false;
    return TestToolsStatusSchema.safeParse(await response.json()).success;
  } catch {
    return false;
  }
}

/** Delivers one test email, then refreshes the lists while it is processed. */
export async function deliverTestEmail(
  input: DeliverTestEmailRequest,
): Promise<DeliverTestEmailResponse> {
  return DeliverTestEmailResponseSchema.parse(
    await api.post<unknown>('/api/test-tools/emails', input),
  );
}

export async function resetTestData(): Promise<ResetTestDataResponse> {
  return ResetTestDataResponseSchema.parse(
    await api.post<unknown>('/api/test-tools/reset', { confirm: 'RESET' }),
  );
}

/** Whether this session is a test environment. A normal build never sends the request. */
export function useTestToolsEnabled(): boolean {
  const { data } = useQuery({
    queryKey: testToolsKeys.status,
    queryFn: getTestToolsEnabled,
    enabled: testToolsBuildEnabled(),
    staleTime: Infinity,
    retry: false,
  });
  return data ?? false;
}

/** True while any test-tools change is running. */
export const useTestToolsBusy = (): boolean =>
  useIsMutating({ mutationKey: testToolsKeys.change }) > 0;

/** Delivers one test email, then refreshes the lists while it is processed. */
export function useDeliverTestEmail() {
  return useMutation({
    mutationKey: testToolsKeys.change,
    mutationFn: deliverTestEmail,
    onSuccess: () => startProcessingRefresh(),
  });
}

/** Creates the scenario's application first when the scenario needs one. */
export function useStartTestScenario() {
  return useMutation({
    mutationKey: testToolsKeys.change,
    mutationFn: async ({
      scenario,
      values,
    }: {
      scenario: TestScenario;
      values: TemplateValues;
    }) => {
      if (scenario.createApplication)
        await api.createApplication({ companyName: values.company, jobTitle: values.role });
    },
  });
}

/** Deletes this user's test data; every cached view is stale afterwards. */
export function useResetTestData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: testToolsKeys.change,
    mutationFn: resetTestData,
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
