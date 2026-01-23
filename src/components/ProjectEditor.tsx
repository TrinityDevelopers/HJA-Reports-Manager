import { useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { useFormState, useCRUD } from '../hooks';
import type { Project, Location, Proctor, MDSpec, ID } from '../types';
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
  const locationFields = [{ key: 'name', label: 'Location Name', type: 'text' as const }];

  return (
    <EditableTableRow
      data={location as unknown as Record<string, unknown>}
      fields={locationFields}
      onSave={(updated) => onSave(updated as unknown as Location)}
      onCancel={onCancel}
    />
  );
}

export function EditProctorRow({
  proctor,
  locations,
  onSave,
  onCancel,
}: {
  proctor: Proctor;
  locations: Location[];
  onSave: (updated: Proctor) => void;
  onCancel: () => void;
}) {
  const proctorFields = [
    { key: 'reportNo', label: 'Report No', type: 'text' as const },
    { key: 'date', label: 'Date', type: 'date' as const },
    { key: 'location', label: 'Location', type: 'select' as const, options: locations },
    { key: 'materialDescription', label: 'Material', type: 'text' as const },
    { key: 'optimumMoisture', label: 'Opt. Moisture', type: 'number' as const, step: '0.1' },
    { key: 'maximumDensity', label: 'Max Density', type: 'number' as const, step: '0.1' },
    { key: 'liquidLimit', label: 'Liquid Limit', type: 'number' as const, step: '0.1' },
    { key: 'plasticLimit', label: 'Plastic Limit', type: 'number' as const, step: '0.1' },
    { key: 'plasticIndex', label: 'Plastic Index', type: 'number' as const, step: '0.1' },
    { key: 'passingNo40', label: '% Pass #40', type: 'number' as const, step: '0.1' },
    { key: 'passingNo200', label: '% Pass #200', type: 'number' as const, step: '0.1' },
    { key: 'testSpecifications', label: 'Test Specs', type: 'text' as const },
  ];

  return (
    <EditableTableRow
      data={proctor as unknown as Record<string, unknown>}
      fields={proctorFields}
      onSave={(updated) => onSave(updated as unknown as Proctor)}
      onCancel={onCancel}
    />
  );
}

export function EditMDSpecRow({
  mdSpec,
  locations,
  onSave,
  onCancel,
}: {
  mdSpec: MDSpec;
  locations: Location[];
  onSave: (updated: MDSpec) => void;
  onCancel: () => void;
}) {
  const mdSpecFields = [
    { key: 'location', label: 'Location', type: 'select' as const, options: locations },
    { key: 'lowerMoisture', label: 'Lower (%)', type: 'number' as const, step: '0.1' },
    { key: 'upperMoisture', label: 'Upper (%)', type: 'number' as const, step: '0.1' },
    { key: 'density', label: 'Density (%)', type: 'number' as const, step: '0.1' },
  ];

  return (
    <EditableTableRow
      data={mdSpec as unknown as Record<string, unknown>}
      fields={mdSpecFields}
      onSave={(updated) => onSave(updated as unknown as MDSpec)}
      onCancel={onCancel}
    />
  );
}

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
      projectName: '',
      projectNumber: '',
      locations: [],
      proctors: [],
      mdSpecs: [],
    },
  );

  // Location management
  const { state: currentLocation, setState: setCurrentLocation } = useFormState<string>('');
  const {
    add: addLocation,
    update: updateLocation,
    remove: removeLocation,
  } = useCRUD<Location>(formData.locations || []);

  // Proctor management
  const { state: currentProctor, setState: setCurrentProctor } = useFormState<Proctor>({
    id: 0,
    reportNo: '',
    date: '',
    location: '',
    materialDescription: '',
    optimumMoisture: '',
    maximumDensity: '',
    liquidLimit: '',
    plasticLimit: '',
    plasticIndex: '',
    passingNo40: '',
    passingNo200: '',
    testSpecifications: '',
  });
  const {
    add: addProctor,
    update: updateProctor,
    remove: removeProctor,
  } = useCRUD<Proctor>(formData.proctors || []);

  // M/D Spec management
  const { state: currentMDSpec, setState: setCurrentMDSpec } = useFormState<MDSpec>({
    id: 0,
    lowerMoisture: '',
    upperMoisture: '',
    density: '',
    location: '',
  });
  const {
    add: addMDSpec,
    update: updateMDSpec,
    remove: removeMDSpec,
  } = useCRUD<MDSpec>(formData.mdSpecs || []);

  // UI state
  const [editingProctorId, setEditingProctorId] = useState<ID | null>(null);
  const [editingMDSpecId, setEditingMDSpecId] = useState<ID | null>(null);
  const [editingLocationId, setEditingLocationId] = useState<ID | null>(null);
  const [showAddProctor, setShowAddProctor] = useState(false);
  const [showAddMDSpec, setShowAddMDSpec] = useState(false);
  const [showAddLocation, setShowAddLocation] = useState(false);

  // Handler implementations
  const handleAddLocation = () => {
    if (!currentLocation.trim()) {
      alert('Please enter a location name');
      return;
    }
    addLocation({ name: currentLocation });
    setFormData({
      ...formData,
      locations: [...(formData.locations || []), { id: Date.now(), name: currentLocation }],
    });
    setCurrentLocation('');
    setShowAddLocation(false);
  };

  const handleUpdateLocation = (id: ID, updatedLocation: Location) => {
    updateLocation(id, updatedLocation);
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

  const handleAddProctor = () => {
    if (!currentProctor.materialDescription?.trim()) {
      alert('Please fill in at least the material description');
      return;
    }
    if (!currentProctor.location) {
      alert('Please select a location');
      return;
    }
    addProctor(currentProctor as unknown as Omit<Proctor, 'id'>);
    setFormData({
      ...formData,
      proctors: [...(formData.proctors || []), { ...currentProctor, id: Date.now() }],
    });
    setCurrentProctor({
      id: 0,
      reportNo: '',
      date: '',
      location: '',
      materialDescription: '',
      optimumMoisture: '',
      maximumDensity: '',
      liquidLimit: '',
      plasticLimit: '',
      plasticIndex: '',
      passingNo40: '',
      passingNo200: '',
      testSpecifications: '',
    });
    setShowAddProctor(false);
  };

  const handleUpdateProctor = (id: ID, updatedProctor: Proctor) => {
    updateProctor(id, updatedProctor);
    setFormData({
      ...formData,
      proctors: (formData.proctors || []).map((p: Proctor) =>
        p.id === id ? { ...updatedProctor, id } : p,
      ),
    });
    setEditingProctorId(null);
  };

  const handleRemoveProctor = (id: ID) => {
    removeProctor(id);
    setFormData({
      ...formData,
      proctors: (formData.proctors || []).filter((p: Proctor) => p.id !== id),
    });
  };

  const handleAddMDSpec = () => {
    if (
      currentMDSpec.lowerMoisture === '' ||
      currentMDSpec.upperMoisture === '' ||
      currentMDSpec.density === ''
    ) {
      alert('Please fill in all M/D spec fields');
      return;
    }
    if (!currentMDSpec.location) {
      alert('Please select a location');
      return;
    }
    addMDSpec(currentMDSpec as unknown as Omit<MDSpec, 'id'>);
    setFormData({
      ...formData,
      mdSpecs: [...(formData.mdSpecs || []), { ...currentMDSpec, id: Date.now() }],
    });
    setCurrentMDSpec({ id: 0, lowerMoisture: '', upperMoisture: '', density: '', location: '' });
    setShowAddMDSpec(false);
  };

  const handleUpdateMDSpec = (id: ID, updatedMDSpec: MDSpec) => {
    updateMDSpec(id, updatedMDSpec);
    setFormData({
      ...formData,
      mdSpecs: (formData.mdSpecs || []).map((m: MDSpec) =>
        m.id === id ? { ...updatedMDSpec, id } : m,
      ),
    });
    setEditingMDSpecId(null);
  };

  const handleRemoveMDSpec = (id: ID) => {
    removeMDSpec(id);
    setFormData({
      ...formData,
      mdSpecs: (formData.mdSpecs || []).filter((m: MDSpec) => m.id !== id),
    });
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
                onEdit={(id) => setEditingLocationId(id as number)}
                onDelete={(id) => handleRemoveLocation(id as number)}
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

        <div className="border-t pt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-800">Proctors</h3>
            <button
              onClick={() => setShowAddProctor(!showAddProctor)}
              className="flex items-center px-4 py-2 rounded-lg font-semibold text-sm bg-primary text-white"
            >
              <Plus size={18} className="mr-2" />
              Add Proctor
            </button>
          </div>
          {showAddProctor && (
            <div className="panel mb-4 border-primary-lighter">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <InputField
                  label="Report No"
                  value={currentProctor.reportNo}
                  onChange={(v) => setCurrentProctor({ ...currentProctor, reportNo: v })}
                />
                <InputField
                  label="Date"
                  type="date"
                  value={currentProctor.date}
                  onChange={(v) => setCurrentProctor({ ...currentProctor, date: v })}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                  <select
                    value={currentProctor.location}
                    onChange={(e) =>
                      setCurrentProctor({ ...currentProctor, location: e.target.value })
                    }
                    className="select"
                  >
                    <option value="">-- Select --</option>
                    {(formData.locations || []).map((loc) => (
                      <option key={loc.id} value={loc.name}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <InputField
                  label="Material Description"
                  value={currentProctor.materialDescription}
                  onChange={(v) => setCurrentProctor({ ...currentProctor, materialDescription: v })}
                />
                <InputField
                  label="Optimum Moisture"
                  type="number"
                  step="0.1"
                  value={String(currentProctor.optimumMoisture ?? '')}
                  onChange={(v) => setCurrentProctor({ ...currentProctor, optimumMoisture: v })}
                />
                <InputField
                  label="Maximum Density"
                  type="number"
                  step="0.1"
                  value={String(currentProctor.maximumDensity ?? '')}
                  onChange={(v) => setCurrentProctor({ ...currentProctor, maximumDensity: v })}
                />
                <InputField
                  label="Liquid Limit"
                  type="number"
                  step="0.1"
                  value={String(currentProctor.liquidLimit ?? '')}
                  onChange={(v) => setCurrentProctor({ ...currentProctor, liquidLimit: v })}
                />
                <InputField
                  label="Plastic Limit"
                  type="number"
                  step="0.1"
                  value={String(currentProctor.plasticLimit ?? '')}
                  onChange={(v) => setCurrentProctor({ ...currentProctor, plasticLimit: v })}
                />
                <InputField
                  label="Plastic Index"
                  type="number"
                  step="0.1"
                  value={String(currentProctor.plasticIndex ?? '')}
                  onChange={(v) => setCurrentProctor({ ...currentProctor, plasticIndex: v })}
                />
                <InputField
                  label="% Passing #40"
                  type="number"
                  step="0.1"
                  value={String(currentProctor.passingNo40 ?? '')}
                  onChange={(v) => setCurrentProctor({ ...currentProctor, passingNo40: v })}
                />
                <InputField
                  label="% Passing #200"
                  type="number"
                  step="0.1"
                  value={String(currentProctor.passingNo200 ?? '')}
                  onChange={(v) => setCurrentProctor({ ...currentProctor, passingNo200: v })}
                />
                <InputField
                  label="Test Specifications"
                  value={currentProctor.testSpecifications}
                  onChange={(v) => setCurrentProctor({ ...currentProctor, testSpecifications: v })}
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleAddProctor}
                  className="px-4 py-2 rounded-lg font-semibold bg-primary text-white"
                >
                  Save Proctor
                </button>
                <button
                  onClick={() => setShowAddProctor(false)}
                  className="px-4 py-2 rounded-lg font-semibold border-2 border-primary text-primary"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {(formData.proctors?.length || 0) > 0 && (
            <div className="mt-4">
              <EditableTable
                columns={[
                  { key: 'reportNo', label: 'Report No' },
                  { key: 'date', label: 'Date' },
                  { key: 'location', label: 'Location' },
                  { key: 'materialDescription', label: 'Material' },
                  { key: 'optimumMoisture', label: 'Opt. Moisture' },
                  { key: 'maximumDensity', label: 'Max Density' },
                  { key: 'liquidLimit', label: 'Liquid Limit' },
                  { key: 'plasticLimit', label: 'Plastic Limit' },
                  { key: 'plasticIndex', label: 'Plastic Index' },
                  { key: 'passingNo40', label: '% Pass #40' },
                  { key: 'passingNo200', label: '% Pass #200' },
                  { key: 'testSpecifications', label: 'Test Specs' },
                ]}
                rows={formData.proctors || []}
                rowKey={'id'}
                editingRowId={editingProctorId}
                onEdit={(id) => setEditingProctorId(id as number)}
                onDelete={(id) => handleRemoveProctor(id as number)}
                editRowRenderer={(row: Proctor) => (
                  <EditProctorRow
                    key={row.id}
                    proctor={row}
                    locations={formData.locations || []}
                    onSave={(updated: Proctor) => handleUpdateProctor(row.id, updated)}
                    onCancel={() => setEditingProctorId(null)}
                  />
                )}
              />
            </div>
          )}
        </div>

        <div className="border-t pt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-800">M/D Specifications</h3>
            <button
              onClick={() => setShowAddMDSpec(!showAddMDSpec)}
              className="flex items-center px-4 py-2 rounded-lg font-semibold text-sm bg-primary text-white"
            >
              <Plus size={18} className="mr-2" />
              Add M/D Spec
            </button>
          </div>
          {showAddMDSpec && (
            <div className="panel mb-4 border-primary-lighter">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                  <select
                    value={currentMDSpec.location}
                    onChange={(e) =>
                      setCurrentMDSpec({ ...currentMDSpec, location: e.target.value })
                    }
                    className="select"
                  >
                    <option value="">-- Select --</option>
                    {(formData.locations || []).map((loc) => (
                      <option key={loc.id} value={loc.name}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <InputField
                  label="Lower Moisture (%)"
                  type="number"
                  step="0.1"
                  value={String(currentMDSpec.lowerMoisture ?? '')}
                  onChange={(v) => setCurrentMDSpec({ ...currentMDSpec, lowerMoisture: v })}
                />
                <InputField
                  label="Upper Moisture (%)"
                  type="number"
                  step="0.1"
                  value={String(currentMDSpec.upperMoisture ?? '')}
                  onChange={(v) => setCurrentMDSpec({ ...currentMDSpec, upperMoisture: v })}
                />
                <InputField
                  label="Density (%)"
                  type="number"
                  step="0.1"
                  value={String(currentMDSpec.density ?? '')}
                  onChange={(v) => setCurrentMDSpec({ ...currentMDSpec, density: v })}
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleAddMDSpec}
                  className="px-4 py-2 rounded-lg font-semibold bg-primary text-white"
                >
                  Save M/D Spec
                </button>
                <button
                  onClick={() => setShowAddMDSpec(false)}
                  className="px-4 py-2 rounded-lg font-semibold border-2 border-primary text-primary"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {(formData.mdSpecs?.length || 0) > 0 && (
            <div className="mt-4">
              <EditableTable
                columns={[
                  { key: 'location', label: 'Location' },
                  { key: 'lowerMoisture', label: 'Lower Moisture (%)' },
                  { key: 'upperMoisture', label: 'Upper Moisture (%)' },
                  { key: 'density', label: 'Density (%)' },
                ]}
                rows={formData.mdSpecs || []}
                rowKey={'id'}
                editingRowId={editingMDSpecId}
                onEdit={(id) => setEditingMDSpecId(id as number)}
                onDelete={(id) => handleRemoveMDSpec(id as number)}
                editRowRenderer={(row: MDSpec) => (
                  <EditMDSpecRow
                    key={row.id}
                    mdSpec={row}
                    locations={formData.locations || []}
                    onSave={(updated: MDSpec) => handleUpdateMDSpec(row.id, updated)}
                    onCancel={() => setEditingMDSpecId(null)}
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
