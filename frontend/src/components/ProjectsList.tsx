import { Plus, Edit2, Trash2 } from 'lucide-react';
import type { Project, ID } from '../types';
import { EntityListCard } from './EntityListCard';

export default function ProjectsList({
  projects,
  onAddProject,
  onEditProject,
  onDeleteProject,
}: {
  projects: Project[];
  onAddProject: () => void;
  onEditProject: (p: Project) => void;
  onDeleteProject: (id: ID) => void;
}) {
  return (
    <div className="card">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Projects</h2>
        <button onClick={onAddProject} className="button-base">
          <Plus size={20} className="inline mr-2" />
          Add Project
        </button>
      </div>
      {projects.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No projects yet</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <EntityListCard
              key={project.id}
              title={project.projectName}
              subtitle={<p>Project #: {project.projectNumber}</p>}
              meta={<p>{project.locations?.length || 0} Location(s)</p>}
              actions={
                <div className="flex gap-2">
                  <button
                    onClick={() => onEditProject(project)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => onDeleteProject(project.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
