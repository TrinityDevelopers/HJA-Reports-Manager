import type { BindingRow } from './bindingRows';
import { layoutSummary } from './bindingRows';
import type { ExportTemplate } from '../../types';

const GROUP_LABELS: Record<BindingRow['group'], string> = {
  standard: 'Standard fields',
  field: 'Header and entry bindings',
  other: 'Other bindings',
  variant: 'Variant marks',
};

export function BindingsPanel({
  template,
  rows,
  selectedRowId,
  sharedWith,
  saving,
  error,
  highlightErrorRowId,
  onSelect,
  onChange,
  onSave,
}: {
  template: ExportTemplate;
  rows: BindingRow[];
  selectedRowId: string | null;
  sharedWith: string[];
  saving: boolean;
  error: string | null;
  highlightErrorRowId: string | null;
  onSelect: (rowId: string) => void;
  onChange: (rows: BindingRow[]) => void;
  onSave: () => void;
}) {
  const updateRow = (rowId: string, patch: Partial<BindingRow>) => {
    onChange(rows.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)));
  };

  const groups = (['standard', 'field', 'other', 'variant'] as const).filter((group) =>
    rows.some((row) => row.group === group),
  );

  return (
    <div className="flex max-h-[70vh] flex-col rounded-lg border-2">
      <div className="border-b border-gray-200 p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-gray-800">Bindings</h3>
          <button
            type="button"
            className="button-base px-3 py-1 text-sm"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save bindings'}
          </button>
        </div>
        <p className="subtext">{layoutSummary(template)}</p>
        {sharedWith.length > 0 && (
          <p className="mt-2 text-sm text-amber-800">
            This workbook is also used by {sharedWith.join(', ')}. Binding edits apply to every
            report type that uses it.
          </p>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
      <div className="overflow-y-auto p-2">
        {groups.map((group) => (
          <div key={group} className="mb-3">
            <h4 className="px-2 py-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">
              {GROUP_LABELS[group]}
            </h4>
            {rows
              .filter((row) => row.group === group)
              .map((row) => {
                const selected = row.rowId === selectedRowId;
                return (
                  <div
                    key={row.rowId}
                    className={`mb-1 rounded-lg p-2 ${selected ? 'bg-primary-lighter' : 'hover:bg-gray-50'}`}
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => onSelect(row.rowId)}
                    >
                      <span className="block text-sm font-medium text-gray-800">{row.label}</span>
                      <span className="block text-xs text-gray-500">{row.detail}</span>
                    </button>
                    <label className="mt-2 block text-xs text-gray-600">
                      Cell address
                      <input
                        className="input mt-1 py-1"
                        value={row.address}
                        onFocus={() => onSelect(row.rowId)}
                        onChange={(event) => updateRow(row.rowId, { address: event.target.value })}
                      />
                    </label>
                    {row.group === 'variant' && (
                      <label className="mt-2 block text-xs text-gray-600">
                        Fill text
                        <input
                          className="input mt-1 py-1"
                          value={row.fillText ?? ''}
                          onFocus={() => onSelect(row.rowId)}
                          onChange={(event) =>
                            updateRow(row.rowId, { fillText: event.target.value })
                          }
                        />
                      </label>
                    )}
                    {highlightErrorRowId === row.rowId && (
                      <p className="mt-1 text-xs text-red-600">Could not highlight this address.</p>
                    )}
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}
