import { 
  CreateApplicationRequest, 
  ApplicationResponse, 
  ListApplicationsResponse,
  ListApplicationEventsResponse,
  ListApplicationActionsResponse,
  GmailStatusResponse,
  SyncResponse,
  MessagesListResponse 
} from '../contracts';

export class ApiClient {
  private defaultHeaders: Record<string, string>;

  constructor() {
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
    
    const devUser = import.meta.env.VITE_DEV_USER;
    if (devUser) {
      this.defaultHeaders['X-Development-User'] = devUser;
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(endpoint, {
      ...options,
      credentials: 'include',
      headers: {
        ...this.defaultHeaders,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error?.error?.message || `API request failed with status ${response.status}`);
    }

    return response.json();
  }

  async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async createApplication(data: CreateApplicationRequest): Promise<ApplicationResponse> {
    return this.request<ApplicationResponse>('/api/applications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async listApplications(): Promise<ListApplicationsResponse> {
    return this.request<ListApplicationsResponse>('/api/applications', {
      method: 'GET',
    });
  }

  /** Fetch timeline events for one application. Ordered createdAt ASC. */
  async getApplicationEvents(applicationId: string): Promise<ListApplicationEventsResponse> {
    return this.request<ListApplicationEventsResponse>(
      `/api/applications/${applicationId}/events`,
      { method: 'GET' }
    );
  }

  /** Fetch actions for one application. */
  async getApplicationActions(applicationId: string): Promise<ListApplicationActionsResponse> {
    return this.request<ListApplicationActionsResponse>(
      `/api/applications/${applicationId}/actions`,
      { method: 'GET' }
    );
  }

  // --- Gmail Integration (COM-21) ---

  async getGmailStatus(): Promise<GmailStatusResponse> {
    return this.request<GmailStatusResponse>('/api/gmail/status', {
      method: 'GET',
    });
  }

  async triggerSync(): Promise<SyncResponse> {
    return this.request<SyncResponse>('/api/gmail/sync', {
      method: 'POST',
    });
  }

  async getMessages(params?: { limit?: number; offset?: number }): Promise<MessagesListResponse> {
    const urlParams = new URLSearchParams();
    if (params?.limit !== undefined) urlParams.append('limit', params.limit.toString());
    if (params?.offset !== undefined) urlParams.append('offset', params.offset.toString());
    
    const queryString = urlParams.toString();
    const endpoint = `/api/gmail/messages${queryString ? `?${queryString}` : ''}`;
    
    return this.request<MessagesListResponse>(endpoint, {
      method: 'GET',
    });
  }

  async disconnectGmail(): Promise<{ disconnected: boolean }> {
    return this.request<{ disconnected: boolean }>('/api/gmail/disconnect', {
      method: 'POST',
    });
  }
}

export const api = new ApiClient();
