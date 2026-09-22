const fs = require('fs');
let content = fs.readFileSync('src/api/client.ts', 'utf8');

content = content.replace(
  "async listApplications(): Promise<ListApplicationsResponse> {\n    return this.request<ListApplicationsResponse>('/api/applications', {\n      method: 'GET',\n    });\n  }",
  "async listApplications(params?: { limit?: number; offset?: number }): Promise<ListApplicationsResponse> {\n    const urlParams = new URLSearchParams();\n    if (params?.limit !== undefined) urlParams.append('limit', params.limit.toString());\n    if (params?.offset !== undefined) urlParams.append('offset', params.offset.toString());\n    const q = urlParams.toString();\n    return this.request<ListApplicationsResponse>(`/api/applications${q ? '?' + q : ''}`, {\n      method: 'GET',\n    });\n  }"
);

content = content.replace(
  "async getAmbiguousEmails(): Promise<AmbiguousMatchResponse[]> {\n    return this.request<AmbiguousMatchResponse[]>('/api/emails/ambiguous', {\n      method: 'GET',\n    });\n  }",
  "async getAmbiguousEmails(params?: { limit?: number; offset?: number }): Promise<PaginatedResponse<AmbiguousMatchResponse>> {\n    const urlParams = new URLSearchParams();\n    if (params?.limit !== undefined) urlParams.append('limit', params.limit.toString());\n    if (params?.offset !== undefined) urlParams.append('offset', params.offset.toString());\n    const q = urlParams.toString();\n    return this.request<PaginatedResponse<AmbiguousMatchResponse>>(`/api/emails/ambiguous${q ? '?' + q : ''}`, {\n      method: 'GET',\n    });\n  }"
);

content = content.replace(
  "async getUnmatchedEmails(): Promise<AmbiguousMatchResponse[]> {\n    return this.request<AmbiguousMatchResponse[]>('/api/emails/unmatched', {\n      method: 'GET',\n    });\n  }",
  "async getUnmatchedEmails(params?: { limit?: number; offset?: number }): Promise<PaginatedResponse<AmbiguousMatchResponse>> {\n    const urlParams = new URLSearchParams();\n    if (params?.limit !== undefined) urlParams.append('limit', params.limit.toString());\n    if (params?.offset !== undefined) urlParams.append('offset', params.offset.toString());\n    const q = urlParams.toString();\n    return this.request<PaginatedResponse<AmbiguousMatchResponse>>(`/api/emails/unmatched${q ? '?' + q : ''}`, {\n      method: 'GET',\n    });\n  }"
);

content = content.replace(
  "async getActions(status?: string): Promise<ActionWithContextResponse[]> {\n    const url = status ? `/api/actions?status=${status}` : '/api/actions';\n    return this.request<ActionWithContextResponse[]>(url, {\n      method: 'GET',\n    });\n  }",
  "async getActions(status?: string, params?: { limit?: number; offset?: number }): Promise<PaginatedResponse<ActionWithContextResponse>> {\n    const urlParams = new URLSearchParams();\n    if (status) urlParams.append('status', status);\n    if (params?.limit !== undefined) urlParams.append('limit', params.limit.toString());\n    if (params?.offset !== undefined) urlParams.append('offset', params.offset.toString());\n    const q = urlParams.toString();\n    return this.request<PaginatedResponse<ActionWithContextResponse>>(`/api/actions${q ? '?' + q : ''}`, {\n      method: 'GET',\n    });\n  }"
);

content = content.replace(
  "async getMessages(params?: { limit?: number; offset?: number }): Promise<MessagesListResponse> {\n    const urlParams = new URLSearchParams();\n    if (params?.limit !== undefined) urlParams.append('limit', params.limit.toString());\n    if (params?.offset !== undefined) urlParams.append('offset', params.offset.toString());\n    const qs = urlParams.toString();\n    \n    return this.request<MessagesListResponse>(`/api/gmail/messages${qs ? '?' + qs : ''}`, {\n      method: 'GET',\n    });\n  }",
  "async getMessages(params?: { limit?: number; offset?: number }): Promise<MessagesListResponse> {\n    const urlParams = new URLSearchParams();\n    if (params?.limit !== undefined) urlParams.append('limit', params.limit.toString());\n    if (params?.offset !== undefined) urlParams.append('offset', params.offset.toString());\n    const qs = urlParams.toString();\n    \n    return this.request<MessagesListResponse>(`/api/gmail/messages${qs ? '?' + qs : ''}`, {\n      method: 'GET',\n    });\n  }"
);

fs.writeFileSync('src/api/client.ts', content, 'utf8');
