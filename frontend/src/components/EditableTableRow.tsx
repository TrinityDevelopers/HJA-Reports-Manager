import { useState } from 'react';
import { Save } from 'lucide-react';
import type { FieldConfig } from '../types';
import { asNameAndDateValue } from '../utils/formHelpers';

interface EditableTableRowProps {
  data: Record<string, unknown>;
  fields: FieldConfig[];
  onSave: (updatedData: Record<string, unknown>) => void;
  onCancel: () => void;
  cellClassName?: string;
  selectOnChange?: (fieldId: string, value: string) => void;
}

export function EditableTableRow({
  data,
  fields,
  onSave,
  onCancel,
  cellClassName = 'table-cell',
  selectOnChange,
}: EditableTableRowProps) {
  // Local state for edit data
  const [editData, setEditData] = useState<Record<string, unknown>>(data);

  const handleFieldChange = (fieldId: string, value: string) => {
    setEditData({ ...editData, [fieldId]: value });
  };

  return (
    <tr className="border-t bg-blue-50">
      {fields.map((field) => (
        <td key={field.id} className={cellClassName}>
          {field.readOnly ? (
            <div className="text-sm">{String(editData[field.id] ?? '')}</div>
          ) : field.type === 'select' && field.options ? (
            <select
              value={String(editData[field.id] ?? '')}
              onChange={(e) => {
                handleFieldChange(field.id, e.target.value);
                selectOnChange?.(field.id, e.target.value);
              }}
              className="w-full px-2 py-1 border rounded text-sm"
            >
              <option value="">-- Select --</option>
              {field.options.map((opt) => (
                <option key={opt.id} value={opt.name}>
                  {opt.name}
                </option>
              ))}
            </select>
          ) : field.type === 'nameAndDate' ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={String(asNameAndDateValue(editData[field.id]).name ?? '')}
                onChange={(e) => {
                  const prev = asNameAndDateValue(editData[field.id]);
                  setEditData({
                    ...editData,
                    [field.id]: { ...prev, name: e.target.value || undefined },
                  });
                }}
                className="w-full px-2 py-1 border rounded text-sm"
                placeholder="Name"
              />
              <input
                type="date"
                value={String(asNameAndDateValue(editData[field.id]).date ?? '')}
                onChange={(e) => {
                  const prev = asNameAndDateValue(editData[field.id]);
                  setEditData({
                    ...editData,
                    [field.id]: { ...prev, date: e.target.value || undefined },
                  });
                }}
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
          ) : field.type === 'text' || field.type === 'date' || field.type === 'number' ? (
            <input
              type={field.type || 'text'}
              step={field.step}
              value={String(editData[field.id] ?? '')}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              className="w-full px-2 py-1 border rounded text-sm"
            />
          ) : (
            <input
              type="text"
              value={String(editData[field.id] ?? '')}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              className="w-full px-2 py-1 border rounded text-sm"
            />
          )}
        </td>
      ))}
      <td className={cellClassName}>
        <button
          onClick={() => onSave(editData)}
          className="bg-primary text-white px-2 py-1 rounded text-xs mr-1"
        >
          <Save size={14} />
        </button>
        <button onClick={onCancel} className="text-gray-600 hover:text-gray-800 text-xs">
          Cancel
        </button>
      </td>
    </tr>
  );
}
