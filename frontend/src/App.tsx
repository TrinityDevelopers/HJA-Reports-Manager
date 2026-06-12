import { useState, useEffect } from 'react';
import ProjectEditor from './components/ProjectEditor';
import ProjectsList from './components/ProjectsList';
import { DatabasePage } from './components/pages/DatabasePage';
import { SettingsPage } from './components/pages/SettingsPage';
import { ReportsPage } from './components/pages/ReportsPage';
import { ReportDetailPage } from './components/pages/ReportDetailPage';
import { LabRequestsPage } from './components/pages/LabRequestsPage';
import { LabRequestDetailPage } from './components/pages/LabRequestDetailPage';
import LabRequestEditor from './components/LabRequestEditor';
import { NavButton } from './components/ui';
import { useCRUD, useFormState, useLocalStorage, useFontLoader } from './hooks';
import { apiClient } from './api/client';
import type { LabRequest, Project, Report, ReportTemplate, SettingsState } from './types';
import { PAGES, type PageType } from './constants/pages';
import { Database, Settings, FileText, MapPin, FlaskConical } from 'lucide-react';

export default function HJAReportsManager() {
  // Font loading via hook (loads CSS and applies family when ready)
  const { loaded: fontLoaded } = useFontLoader(
    'https://fonts.googleapis.com/css2?family=Overpass:wght@300;400;600;700;800&display=swap',
  );

  useEffect(() => {
    if (fontLoaded) {
      document.body.style.fontFamily = "'Overpass', sans-serif";
    }
    return () => {
      document.body.style.fontFamily = '';
    };
  }, [fontLoaded]);

  // Page navigation state
  const [currentPage, setCurrentPage] = useState<PageType>(PAGES.LAB_REQUESTS);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isNewReport, setIsNewReport] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedLabRequest, setSelectedLabRequest] = useState<LabRequest | null>(null);
  const [editingLabRequest, setEditingLabRequest] = useState<LabRequest | null>(null);
  const [showAddLabRequest, setShowAddLabRequest] = useState(false);
  const [labRequestDraft, setLabRequestDraft] = useState<LabRequest | null>(null);
  const [reportFromLabRequest, setReportFromLabRequest] = useState(false);

  // Data management with CRUD hooks and localStorage
  const {
    items: projects,
    add: addProjectToState,
    update: updateProject,
    remove: deleteProject,
    setItems: setProjects,
  } = useCRUD<Project>([]);
  const { items: reports, update: updateReport, setItems: setReports } = useCRUD<Report>([]);
  const { items: templates, setItems: setTemplates } = useCRUD<ReportTemplate>([]);
  const { items: labRequests, setItems: setLabRequests } = useCRUD<LabRequest>([]);

  // Load and persist data with localStorage
  const [persistedProjects, setPersistProjectsStorage] = useLocalStorage<Project[]>('projects', []);
  const [persistedReports, setPersistReportsStorage] = useLocalStorage<Report[]>('reports', []);

  const isValidUUID = (id: string | undefined): boolean => {
    if (!id) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  };

  // Load templates from backend on mount - run once on mount only
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const templatesData = (await apiClient.templates.getAll()) as ReportTemplate[];
        setTemplates(templatesData);
      } catch (error) {
        console.error('Failed to load templates:', error);
      }
    };
    loadTemplates();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load projects from backend on mount - run once on mount only
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const projectsData = (await apiClient.projects.getAll()) as Project[];
        setProjects(projectsData);
      } catch (error) {
        console.error('Failed to load projects from backend, using cached data:', error);
      }
    };
    loadProjects();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load reports from backend on mount - run once on mount only
  useEffect(() => {
    const loadReports = async () => {
      try {
        const reportsData = (await apiClient.reports.getAll()) as Report[];
        setReports(reportsData);
      } catch (error) {
        console.error('Failed to load reports from backend, using cached data:', error);
      }
    };
    loadReports();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load lab requests from backend on mount - run once on mount only
  useEffect(() => {
    const loadLabRequests = async () => {
      try {
        const data = (await apiClient.labRequests.getAll()) as LabRequest[];
        setLabRequests(data);
      } catch (error) {
        console.error('Failed to load lab requests from backend:', error);
      }
    };
    loadLabRequests();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize from localStorage on mount if backend fails - run once on mount only
  useEffect(() => {
    if (persistedProjects.length > 0 && projects.length === 0) {
      const validProjects = persistedProjects.filter((p) => isValidUUID(p.id));
      if (validProjects.length > 0) {
        setProjects(validProjects);
      }
    }
    if (persistedReports.length > 0 && reports.length === 0) {
      setReports(persistedReports);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist projects to localStorage when they change
  useEffect(() => {
    if (projects.length > 0) {
      setPersistProjectsStorage(projects);
    }
  }, [projects, setPersistProjectsStorage]);

  // Persist reports to localStorage when they change
  useEffect(() => {
    if (reports.length > 0) {
      setPersistReportsStorage(reports);
    }
  }, [reports, setPersistReportsStorage]);

  // Settings state
  const { state: settings, setState: setSettingsState } = useFormState<SettingsState>({
    companyName: 'Henley-Johnston & Associates, Inc.',
    units: 'imperial',
    autoSave: true,
  });

  // Load settings from backend on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settingsData = (await apiClient.settings.get()) as SettingsState;
        setSettingsState(settingsData);
      } catch (error) {
        console.error('Failed to load settings from backend:', error);
      }
    };
    loadSettings();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save settings to backend when they change
  const setSettings = (newSettings: SettingsState) => {
    setSettingsState(newSettings);
    // Fire and forget - update backend in background
    apiClient.settings.update(newSettings).catch((error) => {
      console.error('Failed to save settings to backend:', error);
      alert('Failed to save settings. Please try again.');
    });
  };

  // Wrapper for addProject that handles UI state and backend API
  const addProject = async (project: Partial<Project>) => {
    try {
      // Filter out fields that should be generated by the backend
      const projectData = {
        projectName: project.projectName,
        projectNumber: project.projectNumber,
        description: project.description,
        locations: project.locations,
      };
      const newProject = (await apiClient.projects.create(projectData)) as Project;
      // Use the backend ID directly, don't generate a new one
      setProjects([...projects, newProject]);
      setShowAddProject(false);
      // If we came here from the lab request editor, return to it with the new project selected.
      if (labRequestDraft) {
        setLabRequestDraft({ ...labRequestDraft, projectId: newProject.id });
        setEditingProject(null);
        setCurrentPage(PAGES.LAB_REQUESTS);
      }
    } catch (error) {
      // Fallback to local state if API fails
      console.error('Failed to create project on backend:', error);
      addProjectToState(project as Omit<Project, 'id'>);
      setShowAddProject(false);
    }
  };

  const saveLabRequest = async (labRequest: LabRequest) => {
    const payload = {
      projectId: labRequest.projectId,
      name: labRequest.name,
      requestedBy: labRequest.requestedBy,
      technician: labRequest.technician,
      dateOfTest: labRequest.dateOfTest,
      borings: labRequest.borings,
    };
    try {
      if (editingLabRequest && editingLabRequest.id) {
        const updated = (await apiClient.labRequests.update(
          editingLabRequest.id,
          payload,
        )) as LabRequest;
        setLabRequests(labRequests.map((lr) => (lr.id === updated.id ? updated : lr)));
      } else {
        const created = (await apiClient.labRequests.create(payload)) as LabRequest;
        setLabRequests([...labRequests, created]);
        // After creating, open the saved lab request view rather than the list.
        setSelectedLabRequest(created);
      }
      setShowAddLabRequest(false);
      setEditingLabRequest(null);
      setLabRequestDraft(null);
    } catch (error) {
      console.error('Failed to save lab request:', error);
      alert('Failed to save lab request');
    }
  };

  const deleteLabRequest = async (id: string) => {
    try {
      await apiClient.labRequests.delete(id);
      setLabRequests(labRequests.filter((lr) => lr.id !== id));
    } catch (error) {
      console.error('Failed to delete lab request:', error);
      alert('Failed to delete lab request');
    }
  };

  const openReportFromLabRequest = (report: Report) => {
    setReports((prev) => (prev.some((r) => r.id === report.id) ? prev : [...prev, report]));
    setSelectedReport(report);
    setIsNewReport(false);
    setReportFromLabRequest(true);
    setCurrentPage(PAGES.REPORTS);
  };

  return (
    <div
      className="min-h-screen bg-primary-gradient"
      style={{ fontFamily: "'Overpass', sans-serif" }}
    >
      <nav className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <img src="/hja-logo.svg" alt="HJA Logo" className="h-10 w-10" />
              <h1 className="text-2xl font-bold text-primary">HJA Reports Manager</h1>
            </div>
            <div className="flex gap-1">
              <NavButton
                icon={<FlaskConical />}
                label="Lab Requests"
                active={currentPage === PAGES.LAB_REQUESTS}
                onClick={() => {
                  setCurrentPage(PAGES.LAB_REQUESTS);
                  setSelectedLabRequest(null);
                  setEditingLabRequest(null);
                  setShowAddLabRequest(false);
                  setLabRequestDraft(null);
                  setReportFromLabRequest(false);
                }}
              />
              <NavButton
                icon={<FileText />}
                label="Reports"
                active={currentPage === PAGES.REPORTS}
                onClick={() => setCurrentPage(PAGES.REPORTS)}
              />
              <NavButton
                icon={<MapPin />}
                label="Projects"
                active={currentPage === PAGES.PROJECTS}
                onClick={() => setCurrentPage(PAGES.PROJECTS)}
              />
              <NavButton
                icon={<Database />}
                label="Database"
                active={currentPage === PAGES.DATABASE}
                onClick={() => setCurrentPage(PAGES.DATABASE)}
              />
              <NavButton
                icon={<Settings />}
                label="Settings"
                active={currentPage === PAGES.SETTINGS}
                onClick={() => setCurrentPage(PAGES.SETTINGS)}
              />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {currentPage === PAGES.REPORTS && !selectedReport && (
          <ReportsPage
            projects={projects}
            reports={reports}
            templates={templates}
            onSelectProject={async (project, template) => {
              // Create a new empty report directly
              const newReport: Partial<Report> = {
                projectId: project.id,
                templateId: template.id,
                dateOfTest: new Date(),
                headerData: {},
                entries: [],
              };

              try {
                const created = (await apiClient.reports.create(newReport)) as Report;
                // Enrich with template info for display
                created.template = template;
                setReports([...reports, created]);
                setSelectedReport(created);
                setIsNewReport(true);
                setReportFromLabRequest(false);
              } catch (error) {
                console.error('Failed to create report:', error);
                // Fallback to local state
                const localReport: Report = {
                  ...(newReport as Report),
                  id: crypto.randomUUID(),
                  project: project,
                  dateOfTest: new Date(),
                  template: template,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                };
                setReports([...reports, localReport]);
                setSelectedReport(localReport);
                setIsNewReport(true);
                setReportFromLabRequest(false);
              }
            }}
            onSelectReport={(report) => {
              setSelectedReport(report);
              setIsNewReport(false);
              setReportFromLabRequest(false);
            }}
            onDeleteReport={async (id) => {
              try {
                await apiClient.reports.delete(id);
                setReports(reports.filter((r) => r.id !== id));
              } catch (error) {
                console.error('Failed to delete report:', error);
                alert('Failed to delete report');
              }
            }}
            onAddProject={() => {
              setCurrentPage(PAGES.PROJECTS);
              setShowAddProject(true);
            }}
          />
        )}
        {currentPage === PAGES.REPORTS && selectedReport && (
          <ReportDetailPage
            report={reports.find((r) => r.id === selectedReport.id) || selectedReport}
            project={projects.find((p) => p.id === selectedReport.projectId)}
            template={selectedReport.template}
            isNew={isNewReport}
            backLabel={reportFromLabRequest ? 'Back to Lab Request' : 'Back to Reports'}
            onBack={() => {
              setSelectedReport(null);
              setIsNewReport(false);
              if (reportFromLabRequest) {
                setReportFromLabRequest(false);
                setCurrentPage(PAGES.LAB_REQUESTS);
              }
            }}
            onUpdateReport={async (updated) => {
              try {
                // Filter out nested objects and relations before sending to API
                const updatePayload = {
                  dateOfTest: updated.dateOfTest,
                  headerData: updated.headerData,
                  projectId: updated.projectId,
                  templateId: updated.templateId,
                };
                await apiClient.reports.update(selectedReport.id, updatePayload);
                updateReport(selectedReport.id, updated);
              } catch (error) {
                console.error('Failed to update report:', error);
                alert('Failed to update report');
              }
            }}
          />
        )}
        {currentPage === PAGES.PROJECTS && !showAddProject && !editingProject && (
          <ProjectsList
            projects={projects}
            onAddProject={() => setShowAddProject(true)}
            onEditProject={setEditingProject}
            onDeleteProject={(id) => {
              try {
                deleteProject(id);
                // Attempt to delete from backend
                apiClient.projects.delete(id).catch(() => {
                  console.error('Failed to delete project from backend');
                });
              } catch (error) {
                console.error('Failed to delete project:', error);
              }
            }}
          />
        )}
        {currentPage === PAGES.PROJECTS && (showAddProject || editingProject) && (
          <ProjectEditor
            editingProject={editingProject}
            onSave={(project: Project) => {
              if (editingProject) {
                try {
                  apiClient.projects.update(editingProject.id, project).catch(() => {
                    console.error('Failed to update project on backend');
                  });
                  updateProject(editingProject.id, project);
                  setEditingProject(null);
                } catch (error) {
                  console.error('Failed to save project:', error);
                }
              } else {
                addProject(project);
              }
            }}
            onCancel={() => {
              setShowAddProject(false);
              setEditingProject(null);
              // Return to the in-progress lab request editor if we came from there.
              if (labRequestDraft) setCurrentPage(PAGES.LAB_REQUESTS);
            }}
          />
        )}
        {currentPage === PAGES.LAB_REQUESTS &&
          !selectedLabRequest &&
          !editingLabRequest &&
          !showAddLabRequest && (
            <LabRequestsPage
              labRequests={labRequests}
              projects={projects}
              onAdd={() => {
                setLabRequestDraft(null);
                setShowAddLabRequest(true);
              }}
              onEdit={(lr) => setEditingLabRequest(lr)}
              onSelect={(lr) => setSelectedLabRequest(lr)}
              onDelete={deleteLabRequest}
            />
          )}
        {currentPage === PAGES.LAB_REQUESTS && (showAddLabRequest || editingLabRequest) && (
          <LabRequestEditor
            editingLabRequest={editingLabRequest}
            draft={labRequestDraft}
            projects={projects}
            templates={templates}
            onSave={saveLabRequest}
            onCancel={() => {
              setShowAddLabRequest(false);
              setEditingLabRequest(null);
              setLabRequestDraft(null);
            }}
            onAddProject={(currentDraft) => {
              setLabRequestDraft(currentDraft);
              setCurrentPage(PAGES.PROJECTS);
              setShowAddProject(true);
            }}
          />
        )}
        {currentPage === PAGES.LAB_REQUESTS &&
          selectedLabRequest &&
          !editingLabRequest &&
          !showAddLabRequest && (
            <LabRequestDetailPage
              labRequest={
                labRequests.find((lr) => lr.id === selectedLabRequest.id) || selectedLabRequest
              }
              project={projects.find((p) => p.id === selectedLabRequest.projectId)}
              templates={templates}
              onBack={() => setSelectedLabRequest(null)}
              onEdit={() =>
                setEditingLabRequest(
                  labRequests.find((lr) => lr.id === selectedLabRequest.id) || selectedLabRequest,
                )
              }
              onOpenReport={openReportFromLabRequest}
            />
          )}
        {currentPage === PAGES.DATABASE && <DatabasePage reports={reports} projects={projects} />}
        {currentPage === PAGES.SETTINGS && (
          <SettingsPage settings={settings} setSettings={setSettings} />
        )}
      </main>
    </div>
  );
}
