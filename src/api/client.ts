const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface RequestOptions extends RequestInit {
  headers?: Record<string, string>;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.error || error.message || 'API request failed');
  }

  return response.json();
}

export const apiClient = {
  // Projects
  projects: {
    getAll: () => request('/projects'),
    getById: (id: string) => request(`/projects/${id}`),
    create: (data: unknown) => request('/projects', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) =>
      request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/projects/${id}`, { method: 'DELETE' }),
  },

  // Reports
  reports: {
    getAll: (projectId?: string) =>
      request(projectId ? `/reports?projectId=${projectId}` : '/reports'),
    getById: (id: string) => request(`/reports/${id}`),
    create: (data: unknown) => request('/reports', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) =>
      request(`/reports/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/reports/${id}`, { method: 'DELETE' }),
    addEntry: (reportId: string, data: unknown) =>
      request(`/reports/${reportId}/entries`, { method: 'POST', body: JSON.stringify(data) }),
    updateEntry: (entryId: string, data: unknown) =>
      request(`/reports/entries/${entryId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteEntry: (entryId: string) => request(`/reports/entries/${entryId}`, { method: 'DELETE' }),
  },

  // Templates
  templates: {
    getAll: () => request('/templates'),
    getById: (id: string) => request(`/templates/${id}`),
    create: (data: unknown) =>
      request('/templates', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) =>
      request(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/templates/${id}`, { method: 'DELETE' }),
  },

  // Exports
  exports: {
    getTemplates: () => request('/export/templates'),
    listFiles: () => request('/export/list'),
    registerTemplate: (data: unknown) =>
      request('/export/register-template', { method: 'POST', body: JSON.stringify(data) }),
    downloadXLS: (reportId: string, templateId: string) =>
      `${API_BASE_URL}/export/report/${reportId}/xls?templateId=${templateId}`,
  },
};
