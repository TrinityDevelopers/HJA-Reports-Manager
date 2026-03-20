import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '../api/client';
import type { Project, Report, ReportTemplate } from '../types';

interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useFetch<T>(
  fetchFn: () => Promise<T>,
  deps: (string | number | boolean | null | undefined)[] = [],
): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, refetch]);

  return { data, loading, error, refetch };
}

export function useProjects() {
  const { data, loading, error, refetch } = useFetch(() => apiClient.projects.getAll());

  return {
    projects: (data as Project[]) || [],
    loading,
    error,
    refetch,
    createProject: async (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
      const newProject = await apiClient.projects.create(project);
      await refetch();
      return newProject;
    },
    updateProject: async (id: string, updates: Partial<Project>) => {
      const updated = await apiClient.projects.update(id, updates);
      await refetch();
      return updated;
    },
    deleteProject: async (id: string) => {
      await apiClient.projects.delete(id);
      await refetch();
    },
  };
}

export function useReports(projectId?: string) {
  const { data, loading, error, refetch } = useFetch(() => apiClient.reports.getAll(projectId));

  return {
    reports: (data as Report[]) || [],
    loading,
    error,
    refetch,
    createReport: async (report: Omit<Report, 'id' | 'createdAt' | 'updatedAt'>) => {
      const newReport = await apiClient.reports.create(report);
      await refetch();
      return newReport;
    },
    updateReport: async (id: string, updates: Partial<Report>) => {
      const updated = await apiClient.reports.update(id, updates);
      await refetch();
      return updated;
    },
    deleteReport: async (id: string) => {
      await apiClient.reports.delete(id);
      await refetch();
    },
    addEntry: async (
      reportId: string,
      entry: { data: Record<string, unknown>; entryOrder: number },
    ) => {
      return await apiClient.reports.addEntry(reportId, entry);
    },
  };
}

export function useTemplates() {
  const { data, loading, error, refetch } = useFetch(() => apiClient.templates.getAll());

  return {
    templates: (data as ReportTemplate[]) || [],
    loading,
    error,
    refetch,
  };
}

export function useReport(reportId: string) {
  const { data, loading, error, refetch } = useFetch(() => apiClient.reports.getById(reportId));

  return {
    report: data as Report | null,
    loading,
    error,
    refetch,
  };
}

export function useProject(projectId: string) {
  const { data, loading, error, refetch } = useFetch(() => apiClient.projects.getById(projectId));

  return {
    project: data as Project | null,
    loading,
    error,
    refetch,
  };
}
