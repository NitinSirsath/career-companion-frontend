import { CreateApplicationRequest, ApplicationResponse, ListApplicationsResponse } from '../contracts';

export class ApiClient {
  private defaultHeaders: Record<string, string>;

  constructor() {
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      // Development authentication header as mandated by COM-13
      'X-Development-User': 'dev@career-companion.local',
    };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(endpoint, {
      ...options,
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
}

export const api = new ApiClient();
