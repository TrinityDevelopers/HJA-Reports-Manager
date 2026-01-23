import type { SettingsState } from '../../types';

export function SettingsPage({
  settings,
  setSettings,
}: {
  settings: SettingsState;
  setSettings: (s: SettingsState) => void;
}) {
  return (
    <div className="card">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Settings</h2>
      <div className="flex flex-col gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
          <input
            type="text"
            value={settings.companyName}
            onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Measurement Units</label>
          <select
            value={settings.units}
            onChange={(e) =>
              setSettings({ ...settings, units: e.target.value as SettingsState['units'] })
            }
            className="select"
          >
            <option value="imperial">Imperial (pcf, inches)</option>
            <option value="metric">Metric (kg/m³, cm)</option>
          </select>
        </div>
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={settings.autoSave}
            onChange={(e) => setSettings({ ...settings, autoSave: e.target.checked })}
            className="w-5 h-5 border-gray-300 rounded accent-primary"
          />
          <label className="ml-3 text-sm font-medium text-gray-700">Enable auto-save</label>
        </div>
        <div className="pt-4 border-t border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">About</h3>
          <p className="subtext">Technician Reports Manager v1.0</p>
          <p className="subtext">Manage field test reports and project data efficiently.</p>
        </div>
      </div>
    </div>
  );
}
