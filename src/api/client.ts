import type { CreateFollowUp, EditFollowUp, SnoozeAction } from '../contracts/action';
import type { ArchiveApplication } from '../contracts/application';
import {
  AgendaResponseSchema,
  AgendaItemSchema,
  type AgendaQuery,
  type UpdateAgenda,
} from '../contracts/agenda';
import {
  WorkspaceActionsResponseSchema,
  WorkspaceReviewResponseSchema,
  type WorkspaceBucket,
} from '../contracts/workspace';
import { GmailStatusResponseSchema } from '../contracts/gmail';
import type { ApplicationFilters } from '../contracts/application';
import { CorrectEmailMatchResponseSchema, type CorrectEmailMatchRequest } from '../contracts/email';
import { z } from 'zod';
import {
  ActionWithContextResponseSchema,
  AISampleTestResponseSchema,
  AISettingsResponseSchema,
  ApplicationResponseSchema,
  CheckAISettingsResponseSchema,
  CreateIntegrationTokenResponseSchema,
  IntegrationTokenSchema,
  ListApplicationsResponseSchema,
  ListIntegrationTokensResponseSchema,
  ListPendingSubmissionsResponseSchema,
  ResolveSubmissionResponseSchema,
  ListApplicationEventsResponseSchema,
  RemoveAISettingsResponseSchema,
  SaveAISettingsResponseSchema,
} from '../contracts';
import type {
  CreateApplicationRequest,
  ApplicationResponse,
  ListApplicationsResponse,
  ListApplicationEventsResponse,
  UpdateApplicationStatusRequest,
  ListApplicationActionsResponse,
  GmailStatusResponse,
  SyncResponse,
  MessagesListResponse,
  AmbiguousMatchResponse,
  ResolveAmbiguityRequest,
  ActionWithContextResponse,
  UpdateActionRequest,
  PaginatedResponse,
  AISettingsResponse,
  AISampleTestResponse,
  CheckAISettingsResponse,
  SaveAISettingsRequest,
  SaveAISettingsResponse,
  CreateIntegrationTokenRequest,
  CreateIntegrationTokenResponse,
  IntegrationToken,
  ListIntegrationTokensResponse,
  ListPendingSubmissionsResponse,
  ResolveSubmissionRequest,
  ResolveSubmissionResponse,
} from '../contracts';

/** Shared client deadline (Sprint 5). Mutations reuse it; do not add competing timeouts. */
export const REQUEST_TIMEOUT_MS = 15_000;

export type ApiErrorKind = 'http' | 'timeout' | 'network' | 'contract';

/**
 * Keeps HTTP status, the server's machine-readable code and its structured details; messages are
 * safe to display. Never holds the request payload.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: ApiErrorKind,
    readonly status?: number,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** A write may have been applied: timeout, network failure, 5xx or a malformed success body. */
  get outcomeUncertain(): boolean {
    return this.kind !== 'http' || (this.status ?? 0) >= 500;
  }
}

export const isApiError = (err: unknown): err is ApiError => err instanceof ApiError;

type RequestOptions = { signal?: AbortSignal };

/** The sample test makes two real provider calls in sequence; it may outlast the shared deadline. */
export const SAMPLE_TEST_TIMEOUT_MS = 75_000;

export class ApiClient {
  private defaultHeaders: Record<string, string>;

  constructor() {
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    schema?: z.ZodType<T>,
    timeoutMs = REQUEST_TIMEOUT_MS,
  ): Promise<T> {
    // Every request is bounded. A caller/query AbortSignal is forwarded to fetch as well.
    const controller = new AbortController();
    const external = options.signal;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const forwardAbort = () => controller.abort();
    if (external?.aborted) controller.abort();
    else external?.addEventListener('abort', forwardAbort, { once: true });

    try {
      let response: Response;
      try {
        response = await fetch(endpoint, {
          ...options,
          signal: controller.signal,
          credentials: 'include',
          headers: {
            ...this.defaultHeaders,
            ...options.headers,
          },
        });
      } catch (err) {
        if (timedOut || external?.aborted) throw err;
        throw new ApiError('Network error. Check your connection and try again.', 'network');
      }

      if (!response.ok) {
        if (response.status === 401) {
          // Prevent redirect loop if already on login page
          if (!window.location.pathname.startsWith('/login')) {
            window.location.href = '/login?error=expired';
          }
        }

        const error = await response.json().catch(() => ({}));
        throw new ApiError(
          error?.error?.message || `API request failed with status ${response.status}`,
          'http',
          response.status,
          typeof error?.error?.code === 'string' ? error.error.code : undefined,
          error?.error?.details,
        );
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch (err) {
        if (timedOut || external?.aborted) throw err;
        throw new ApiError(
          'The server returned an unexpected response.',
          'contract',
          response.status,
        );
      }
      if (!schema) return body as T;
      const parsed = schema.safeParse(body);
      // Never echo the payload: it may contain application or email metadata.
      if (!parsed.success)
        throw new ApiError(
          'The server returned an unexpected response.',
          'contract',
          response.status,
        );
      return parsed.data;
    } catch (err) {
      if (timedOut)
        throw new ApiError(
          'The request timed out. Check your connection and try again.',
          'timeout',
        );
      throw err;
    } finally {
      clearTimeout(timer);
      external?.removeEventListener('abort', forwardAbort);
    }
  }

  async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET', cache: 'no-store' });
  }

  async post<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async createApplication(data: CreateApplicationRequest): Promise<ApplicationResponse> {
    return this.request(
      '/api/applications',
      { method: 'POST', body: JSON.stringify(data) },
      ApplicationResponseSchema,
    );
  }

  async listApplications(
    params?: { limit?: number; offset?: number } & ApplicationFilters,
    options?: RequestOptions,
  ): Promise<ListApplicationsResponse> {
    const urlParams = new URLSearchParams();
    if (params?.limit !== undefined) urlParams.append('limit', params.limit.toString());
    if (params?.offset !== undefined) urlParams.append('offset', params.offset.toString());
    if (params?.q) urlParams.append('q', params.q);
    if (params?.archive) urlParams.append('archive', params.archive);
    if (params?.effectiveStatus) urlParams.append('effectiveStatus', params.effectiveStatus);
    if (params?.submittedVia) urlParams.append('submittedVia', params.submittedVia);
    if (params?.sort) urlParams.append('sort', params.sort);
    const q = urlParams.toString();
    return this.request(
      `/api/applications${q ? '?' + q : ''}`,
      { method: 'GET', cache: 'no-store', signal: options?.signal },
      ListApplicationsResponseSchema,
    );
  }

  async getApplication(id: string, options?: RequestOptions): Promise<ApplicationResponse> {
    return this.request(
      `/api/applications/${id}`,
      { method: 'GET', cache: 'no-store', signal: options?.signal },
      ApplicationResponseSchema,
    );
  }

  /** Owned manual status set/change/clear. Never retried automatically by callers. */
  async updateApplicationStatus(
    id: string,
    data: UpdateApplicationStatusRequest,
  ): Promise<ApplicationResponse> {
    return this.request(
      `/api/applications/${id}/status`,
      { method: 'PATCH', body: JSON.stringify(data) },
      ApplicationResponseSchema,
    );
  }

  /** Fetch timeline events for one application, in recording order. */
  async correctEmailMatch(emailId: string, body: CorrectEmailMatchRequest) {
    return this.request(
      `/api/emails/${emailId}/match`,
      { method: 'PATCH', body: JSON.stringify(body) },
      CorrectEmailMatchResponseSchema,
    );
  }

  async getApplicationEvents(
    applicationId: string,
    params: { offset?: number; limit?: number } = {},
    options?: RequestOptions,
  ): Promise<ListApplicationEventsResponse> {
    return this.request(
      `/api/applications/${applicationId}/events?offset=${params.offset ?? 0}&limit=${params.limit ?? 20}`,
      { method: 'GET', cache: 'no-store', signal: options?.signal },
      ListApplicationEventsResponseSchema,
    );
  }

  /** Fetch actions for one application. */
  async getApplicationActions(
    applicationId: string,
    params: { offset?: number; limit?: number } = {},
    options?: RequestOptions,
  ): Promise<ListApplicationActionsResponse> {
    return this.request<ListApplicationActionsResponse>(
      `/api/applications/${applicationId}/actions?offset=${params.offset ?? 0}&limit=${params.limit ?? 20}`,
      { method: 'GET', signal: options?.signal },
    );
  }

  // --- Email Ambiguity (COM-32) ---

  async getAmbiguousEmails(params?: {
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<AmbiguousMatchResponse>> {
    const urlParams = new URLSearchParams();
    if (params?.limit !== undefined) urlParams.append('limit', params.limit.toString());
    if (params?.offset !== undefined) urlParams.append('offset', params.offset.toString());
    const q = urlParams.toString();
    return this.request<PaginatedResponse<AmbiguousMatchResponse>>(
      `/api/emails/ambiguous${q ? '?' + q : ''}`,
      {
        method: 'GET',
      },
    );
  }

  async resolveAmbiguousEmail(
    emailId: string,
    data: ResolveAmbiguityRequest,
  ): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/emails/${emailId}/resolve`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // --- Unmatched Emails (COM-36) ---

  async getUnmatchedEmails(params?: {
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<AmbiguousMatchResponse>> {
    const urlParams = new URLSearchParams();
    if (params?.limit !== undefined) urlParams.append('limit', params.limit.toString());
    if (params?.offset !== undefined) urlParams.append('offset', params.offset.toString());
    const q = urlParams.toString();
    return this.request<PaginatedResponse<AmbiguousMatchResponse>>(
      `/api/emails/unmatched${q ? '?' + q : ''}`,
      {
        method: 'GET',
      },
    );
  }

  async resolveUnmatchedEmail(
    emailId: string,
    data: { applicationId: string },
  ): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/emails/${emailId}/resolve`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Retries a failed email. `acceptPossibleDuplicateCharge` is sent only after the user approved
   * one more AI attempt for an uncertain outcome (409 AI_RETRY_NEEDS_APPROVAL). Never resent
   * automatically.
   */
  async retryEmail(
    emailId: string,
    options: { acceptPossibleDuplicateCharge?: true } = {},
  ): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/emails/${emailId}/retry`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  // --- User-provided AI (ADR-0001) ---

  async getAISettings(options?: RequestOptions): Promise<AISettingsResponse> {
    return this.request(
      '/api/ai/settings',
      { method: 'GET', cache: 'no-store', signal: options?.signal },
      AISettingsResponseSchema,
    );
  }

  /**
   * Saves (verifying first). The key is sent once in this request body and never comes back.
   * Call it directly from an event handler, not through a cached mutation: TanStack's mutation
   * cache keeps variables, and the key must not be kept anywhere in the browser.
   */
  async saveAISettings(data: SaveAISettingsRequest): Promise<SaveAISettingsResponse> {
    return this.request(
      '/api/ai/settings',
      { method: 'PUT', body: JSON.stringify(data) },
      SaveAISettingsResponseSchema,
    );
  }

  async checkAISettings(): Promise<CheckAISettingsResponse> {
    return this.request(
      '/api/ai/settings/check',
      { method: 'POST', body: '{}' },
      CheckAISettingsResponseSchema,
    );
  }

  async runAISampleTest(): Promise<AISampleTestResponse> {
    return this.request(
      '/api/ai/settings/sample-test',
      { method: 'POST', body: '{}' },
      AISampleTestResponseSchema,
      SAMPLE_TEST_TIMEOUT_MS,
    );
  }

  async removeAISettings(): Promise<{ removed: true }> {
    return this.request('/api/ai/settings', { method: 'DELETE' }, RemoveAISettingsResponseSchema);
  }

  // --- Automation submissions through MCP (ADR-0002) ---

  async listIntegrationTokens(
    params: { offset?: number; limit?: number } = {},
    options?: RequestOptions,
  ): Promise<ListIntegrationTokensResponse> {
    return this.request(
      `/api/integration-tokens?offset=${params.offset ?? 0}&limit=${params.limit ?? 20}`,
      { method: 'GET', cache: 'no-store', signal: options?.signal },
      ListIntegrationTokensResponseSchema,
    );
  }

  /**
   * The only response that carries a plaintext token. Call it directly from an event handler, not
   * through a cached mutation, and keep the result only in component state: TanStack's caches keep
   * results, and the token must not be kept anywhere in the browser. Never retried automatically.
   */
  async createIntegrationToken(
    data: CreateIntegrationTokenRequest,
  ): Promise<CreateIntegrationTokenResponse> {
    return this.request(
      '/api/integration-tokens',
      { method: 'POST', body: JSON.stringify(data) },
      CreateIntegrationTokenResponseSchema,
    );
  }

  async revokeIntegrationToken(id: string): Promise<IntegrationToken> {
    return this.request(
      `/api/integration-tokens/${id}`,
      { method: 'DELETE' },
      IntegrationTokenSchema,
    );
  }

  async getPendingSubmissions(
    params: { offset?: number; limit?: number } = {},
    options?: RequestOptions,
  ): Promise<ListPendingSubmissionsResponse> {
    return this.request(
      `/api/submissions/pending?offset=${params.offset ?? 0}&limit=${params.limit ?? 20}`,
      { method: 'GET', cache: 'no-store', signal: options?.signal },
      ListPendingSubmissionsResponseSchema,
    );
  }

  /** Final; never retried automatically by callers. */
  async resolveSubmission(
    id: string,
    data: ResolveSubmissionRequest,
  ): Promise<ResolveSubmissionResponse> {
    return this.request(
      `/api/submissions/${id}/resolve`,
      { method: 'POST', body: JSON.stringify(data) },
      ResolveSubmissionResponseSchema,
    );
  }

  // --- Action Management (COM-33) ---

  async getActions(
    status?: string,
    params?: { limit?: number; offset?: number },
  ): Promise<PaginatedResponse<ActionWithContextResponse>> {
    const urlParams = new URLSearchParams();
    if (status) urlParams.append('status', status);
    if (params?.limit !== undefined) urlParams.append('limit', params.limit.toString());
    if (params?.offset !== undefined) urlParams.append('offset', params.offset.toString());
    const q = urlParams.toString();
    return this.request<PaginatedResponse<ActionWithContextResponse>>(
      `/api/actions${q ? '?' + q : ''}`,
      {
        method: 'GET',
      },
    );
  }

  async updateAction(
    actionId: string,
    data: UpdateActionRequest,
  ): Promise<ActionWithContextResponse> {
    const result = await this.request(
      `/api/actions/${actionId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      },
      ActionWithContextResponseSchema,
    );
    if (result.id !== actionId)
      throw new ApiError('The server returned an unexpected response.', 'contract', 200);
    return result;
  }

  async createFollowUp(applicationId: string, data: CreateFollowUp) {
    const row = await this.request(
      `/api/applications/${applicationId}/actions`,
      { method: 'POST', body: JSON.stringify(data) },
      ActionWithContextResponseSchema,
    );
    if (row.applicationId !== applicationId || row.clientRequestId !== data.clientRequestId)
      throw new ApiError('Unexpected receipt.', 'contract', 201);
    return row;
  }
  async followUpByRequest(id: string) {
    const row = await this.request(
      `/api/actions/by-request/${id}`,
      { method: 'GET' },
      ActionWithContextResponseSchema,
    );
    if (row.clientRequestId !== id) throw new ApiError('Unexpected receipt.', 'contract', 200);
    return row;
  }
  async editFollowUp(id: string, data: EditFollowUp) {
    const row = await this.request(
      `/api/actions/${id}/personal`,
      { method: 'PATCH', body: JSON.stringify(data) },
      ActionWithContextResponseSchema,
    );
    if (row.id !== id) throw new ApiError('Unexpected action.', 'contract', 200);
    return row;
  }
  async snoozeAction(id: string, data: SnoozeAction) {
    const row = await this.request(
      `/api/actions/${id}/snooze`,
      { method: 'PATCH', body: JSON.stringify(data) },
      ActionWithContextResponseSchema,
    );
    if (row.id !== id) throw new ApiError('Unexpected action.', 'contract', 200);
    return row;
  }
  async archiveApplication(id: string, data: ArchiveApplication) {
    const row = await this.request(
      `/api/applications/${id}/archive`,
      { method: 'PATCH', body: JSON.stringify(data) },
      ApplicationResponseSchema,
    );
    if (row.id !== id) throw new ApiError('Unexpected application.', 'contract', 200);
    return row;
  }
  async getAgenda(
    params: Pick<AgendaQuery, 'view' | 'timeZone'> & { archive?: 'active' | 'archived' | 'all' } & {
      limit: number;
      offset: number;
    },
    options?: RequestOptions,
  ) {
    const query = new URLSearchParams({
      ...params,
      limit: String(params.limit),
      offset: String(params.offset),
    });
    return this.request(
      `/api/agenda?${query}`,
      { method: 'GET', signal: options?.signal },
      AgendaResponseSchema,
    );
  }
  async updateAgenda(id: string, data: UpdateAgenda) {
    const result = await this.request(
      `/api/agenda/${id}`,
      { method: 'PATCH', body: JSON.stringify(data) },
      AgendaItemSchema,
    );
    if (result.id !== id)
      throw new ApiError('The server returned an unexpected response.', 'contract', 200);
    return result;
  }

  // --- Gmail Integration (COM-21) ---

  async getWorkspaceActions(
    params: { bucket: WorkspaceBucket; timeZone: string; limit: number; offset: number },
    options?: RequestOptions,
  ) {
    const query = new URLSearchParams({
      ...params,
      limit: String(params.limit),
      offset: String(params.offset),
    });
    return this.request(
      `/api/workspace/actions?${query}`,
      { method: 'GET', signal: options?.signal },
      WorkspaceActionsResponseSchema,
    );
  }

  async getWorkspaceReview(options?: RequestOptions) {
    return this.request(
      '/api/workspace/review-summary',
      { method: 'GET', signal: options?.signal },
      WorkspaceReviewResponseSchema,
    );
  }

  async getGmailStatus(options?: { signal?: AbortSignal }): Promise<GmailStatusResponse> {
    return this.request(
      '/api/gmail/status',
      { method: 'GET', signal: options?.signal },
      GmailStatusResponseSchema.extend({
        lastSyncedAt: z.iso.datetime({ offset: true }).nullable(),
      }),
    );
  }

  async updateGmailSettings(settings: {
    syncLookbackDays: number;
  }): Promise<{ success: boolean; syncLookbackDays: number }> {
    return this.request<{ success: boolean; syncLookbackDays: number }>('/api/gmail/settings', {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
  }

  async triggerSync(): Promise<SyncResponse> {
    return this.request<SyncResponse>('/api/gmail/sync', {
      method: 'POST',
    });
  }

  async getMessages(params?: {
    limit?: number;
    offset?: number;
    relevance?: string;
  }): Promise<MessagesListResponse> {
    const urlParams = new URLSearchParams();
    if (params?.limit !== undefined) urlParams.append('limit', params.limit.toString());
    if (params?.offset !== undefined) urlParams.append('offset', params.offset.toString());
    if (params?.relevance !== undefined) urlParams.append('relevance', params.relevance);

    const queryString = urlParams.toString();
    const endpoint = `/api/gmail/messages${queryString ? `?${queryString}` : ''}`;

    return this.get<MessagesListResponse>(endpoint);
  }

  async disconnectGmail(): Promise<{ disconnected: boolean }> {
    return this.request<{ disconnected: boolean }>('/api/gmail/disconnect', {
      method: 'POST',
    });
  }
}

export const api = new ApiClient();
