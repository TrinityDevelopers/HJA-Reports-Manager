import { useState, useEffect } from 'react';
import ProjectEditor from './components/ProjectEditor';
import ProjectsList from './components/ProjectsList';
import { DatabasePage } from './components/pages/DatabasePage';
import { ExportPage } from './components/pages/ExportPage';
import { SettingsPage } from './components/pages/SettingsPage';
import { ReportsPage } from './components/pages/ReportsPage';
import { NewReportPage } from './components/pages/NewReportPage';
import { ReportDetailPage } from './components/pages/ReportDetailPage';
import { NavButton } from './components/ui';
import { useCRUD, useFormState, useLocalStorage, useFontLoader } from './hooks';
import type { ID, Project, Report, SettingsState } from './types';
import { REPORT_TYPES } from './constants/reportTypes';
import { PAGES, type PageType } from './constants/pages';
import { FileDown, Database, Settings, FileText, MapPin } from 'lucide-react';

export default function TechnicianReportsManager() {
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
  const [currentPage, setCurrentPage] = useState<PageType>(PAGES.REPORTS);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showAddProject, setShowAddProject] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Data management with CRUD hooks and localStorage
  const {
    items: projects,
    add: addProjectToState,
    update: updateProject,
    remove: deleteProject,
    setItems: setProjects,
  } = useCRUD<Project>([]);
  const { items: reports, update: updateReport, setItems: setReports } = useCRUD<Report>([]);

  // Load and persist data with localStorage
  const [persistedProjects, setPersistProjectsStorage] = useLocalStorage<Project[]>('projects', []);
  const [persistedReports, setPersistReportsStorage] = useLocalStorage<Report[]>('reports', []);

  // Initialize from localStorage on mount or when persisted data changes
  useEffect(() => {
    if (persistedProjects.length > 0) {
      setProjects(persistedProjects);
    }
    if (persistedReports.length > 0) {
      setReports(persistedReports);
    }
  }, [persistedProjects, persistedReports, setProjects, setReports]);

  // Persist projects to localStorage
  useEffect(() => {
    if (projects.length > 0) {
      setPersistProjectsStorage(projects);
    }
  }, [projects, setPersistProjectsStorage]);

  // Persist reports to localStorage
  useEffect(() => {
    if (reports.length > 0) {
      setPersistReportsStorage(reports);
    }
  }, [reports, setPersistReportsStorage]);

  // Settings state
  const { state: settings, setState: setSettings } = useFormState<SettingsState>({
    companyName: 'Henley-Johnston & Associates, Inc.',
    units: 'imperial',
    autoSave: true,
  });

  // Wrapper for addProject that handles UI state
  const addProject = (project: Partial<Project>) => {
    // use CRUD add which will assign an id
    addProjectToState(project as Omit<Project, 'id'>);
    setShowAddProject(false);
  };

  // Wrapper for addReport that adds empty entries array
  const addReport = (report: Partial<Report>): Report => {
    const newReport: Report = {
      ...(report as Report),
      id: Date.now(),
      projectId: report.projectId as ID,
      reportType: report.reportType || REPORT_TYPES.DIGITAL_DENSITY,
      entries: report.entries || [],
    } as Report;
    setReports([...reports, newReport]);
    return newReport;
  };
  const exportData = (format: 'json' | string) => {
    if (format === 'json') {
      const data = { projects, reports };
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `technician-reports-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
    }
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
              <h1 className="text-2xl font-bold text-primary">Technician Reports Manager</h1>
            </div>
            <div className="flex gap-1">
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
                icon={<FileDown />}
                label="Export"
                active={currentPage === PAGES.EXPORT}
                onClick={() => setCurrentPage(PAGES.EXPORT)}
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
        {currentPage === PAGES.REPORTS && !selectedProject && !selectedReport && (
          <ReportsPage
            projects={projects}
            reports={reports}
            onSelectProject={setSelectedProject}
            onAddProject={() => {
              setCurrentPage(PAGES.PROJECTS);
              setShowAddProject(true);
            }}
          />
        )}
        {currentPage === PAGES.REPORTS && selectedProject && !selectedReport && (
          <NewReportPage
            project={selectedProject}
            onBack={() => setSelectedProject(null)}
            onCreateReport={(report) => {
              const created = addReport(report as Partial<Report>);
              setSelectedReport(created);
            }}
          />
        )}
        {currentPage === PAGES.REPORTS && selectedReport && (
          <ReportDetailPage
            report={reports.find((r) => r.id === selectedReport.id) || selectedReport}
            project={projects.find((p) => p.id === selectedReport.projectId)}
            onBack={() => {
              setSelectedReport(null);
              setSelectedProject(null);
            }}
            onUpdateReport={(updated) => updateReport(selectedReport.id, updated)}
          />
        )}
        {currentPage === PAGES.PROJECTS && !showAddProject && !editingProject && (
          <ProjectsList
            projects={projects}
            onAddProject={() => setShowAddProject(true)}
            onEditProject={setEditingProject}
            onDeleteProject={deleteProject}
          />
        )}
        {currentPage === PAGES.PROJECTS && (showAddProject || editingProject) && (
          <ProjectEditor
            editingProject={editingProject}
            onSave={(project: Project) => {
              if (editingProject) {
                updateProject(editingProject.id, project);
                setEditingProject(null);
              } else {
                addProject(project);
              }
            }}
            onCancel={() => {
              setShowAddProject(false);
              setEditingProject(null);
            }}
          />
        )}
        {currentPage === PAGES.DATABASE && <DatabasePage reports={reports} projects={projects} />}
        {currentPage === PAGES.EXPORT && (
          <ExportPage exportData={exportData} reportCount={reports.length} />
        )}
        {currentPage === PAGES.SETTINGS && (
          <SettingsPage settings={settings} setSettings={setSettings} />
        )}
      </main>
    </div>
  );
}
