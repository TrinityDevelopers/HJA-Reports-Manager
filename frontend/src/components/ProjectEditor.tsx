import { useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { useFormState, useCRUD } from '../hooks';
import type { Project, Location, ID } from '../types';
import { InputField } from './ui';
import { EditableTableRow } from './EditableTableRow';
import EditableTable from './EditableTable';

export function EditLocationRow({
  location,
  onSave,
  onCancel,
}: {
  location: Location;
  onSave: (updated: Location) => void;
  onCancel: () => void;
}) {
  const locationFields = [{ id: 'name', label: 'Location Name', type: 'text' as const }];

  return (
    <EditableTableRow
      data={location as unknown as Record<string, unknown>}
      fields={locationFields}
      onSave={(updated) => onSave(updated as unknown as Location)}
      onCancel={onCancel}
    />
  );
}

// Proctor and MDSpec components removed - these are not supported in the database schema

export default function ProjectEditor({
  editingProject,
  onSave,
  onCancel,
}: {
  editingProject?: Project | null;
  onSave: (p: Project) => void;
  onCancel: () => void;
}) {
  // Main form data
  const { state: formData, setState: setFormData } = useFormState<Project>(
    (editingProject as Project) || {
      id: '',
      projectName: '',
      projectNumber: '',
      locations: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  );

  // Location management
  const { state: currentLocation, setState: setCurrentLocation } = useFormState<string>('');
  const { add: addLocation, remove: removeLocation } = useCRUD<Location>(formData.locations || []);

  // UI state
  const [editingLocationId, setEditingLocationId] = useState<ID | null>(null);
  const [showAddLocation, setShowAddLocation] = useState(false);

  const handleAddLocation = () => {
    if (!currentLocation.trim()) {
      alert('Please enter a location name');
      return;
    }
    const newLocation: Location = {
      id: crypto.randomUUID(),
      name: currentLocation,
      projectId: formData.id || '',
    };
    addLocation(newLocation);
    setFormData({
      ...formData,
      locations: [...(formData.locations || []), newLocation],
    });
    setCurrentLocation('');
    setShowAddLocation(false);
  };

  const handleUpdateLocation = (id: ID, updatedLocation: Location) => {
    setFormData({
      ...formData,
      locations: (formData.locations || []).map((l: Location) =>
        l.id === id ? { ...updatedLocation, id } : l,
      ),
    });
    setEditingLocationId(null);
  };

  const handleRemoveLocation = (id: ID) => {
    removeLocation(id);
    setFormData({
      ...formData,
      locations: (formData.locations || []).filter((l: Location) => l.id !== id),
    });
    setEditingLocationId(null);
  };

  const handleSave = () => {
    if (!formData.projectName?.trim() || !formData.projectNumber?.trim()) {
      alert('Please fill in project name and number');
      return;
    }
    onSave(formData as Project);
  };

  return (
    <div className="card">
      <button
        onClick={onCancel}
        className="flex items-center text-gray-600 hover:text-gray-800 mb-6"
      >
        <ArrowLeft size={20} className="mr-2" />
        Back to Projects
      </button>
      <h2 className="text-3xl font-bold text-gray-800 mb-6">
        {editingProject ? 'Edit Project' : 'New Project'}
      </h2>
      <div className="flex flex-col gap-6">
        <InputField
          label="Project Name"
          value={formData.projectName}
          onChange={(v) => setFormData({ ...formData, projectName: v })}
          required
        />
        <InputField
          label="Project Number"
          value={formData.projectNumber}
          onChange={(v) => setFormData({ ...formData, projectNumber: v })}
          required
        />
        <InputField
          label="Description"
          value={formData.description || ''}
          onChange={(v) => setFormData({ ...formData, description: v })}
        />

        <div className="border-t pt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-800">Locations</h3>
            <button
              onClick={() => setShowAddLocation(!showAddLocation)}
              className="flex items-center px-4 py-2 rounded-lg font-semibold text-sm bg-primary text-white"
            >
              <Plus size={18} className="mr-2" />
              Add Location
            </button>
          </div>
          {showAddLocation && (
            <div className="panel mb-4 border-primary-lighter">
              <InputField
                label="Location Name"
                value={currentLocation}
                onChange={setCurrentLocation}
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleAddLocation}
                  className="px-4 py-2 rounded-lg font-semibold bg-primary text-white"
                >
                  Save Location
                </button>
                <button
                  onClick={() => setShowAddLocation(false)}
                  className="px-4 py-2 rounded-lg font-semibold border-2 border-primary text-primary"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {(formData.locations?.length || 0) > 0 && (
            <div className="mt-4">
              <EditableTable
                columns={[{ key: 'name', label: 'Location Name' }]}
                rows={formData.locations || []}
                rowKey={'id'}
                editingRowId={editingLocationId}
                onEdit={(id) => setEditingLocationId(id as string)}
                onDelete={(id) => handleRemoveLocation(id as string)}
                editRowRenderer={(row: Location) => (
                  <EditLocationRow
                    key={row.id}
                    location={row}
                    onSave={(updated: Location) => handleUpdateLocation(row.id, updated)}
                    onCancel={() => setEditingLocationId(null)}
                  />
                )}
              />
            </div>
          )}
        </div>

        <div className="flex gap-4 pt-4">
          <button onClick={handleSave} className="button-base w-full">
            {editingProject ? 'Update Project' : 'Save Project'}
          </button>
          <button
            onClick={onCancel}
            className="w-full button-secondary border-primary text-primary"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
