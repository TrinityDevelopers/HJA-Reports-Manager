import { useState } from 'react';
import { Save } from 'lucide-react';

interface FieldConfig {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'select';
  step?: string | number;
  options?: Array<{ id: string | number; name: string }>;
  readOnly?: boolean;
}

interface EditableTableRowProps {
  data: Record<string, unknown>;
  fields: FieldConfig[];
  onSave: (updatedData: Record<string, unknown>) => void;
  onCancel: () => void;
  cellClassName?: string;
  selectOnChange?: (fieldKey: string, value: string) => void;
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

  const handleFieldChange = (fieldKey: string, value: string) => {
    setEditData({ ...editData, [fieldKey]: value });
  };

  return (
    <tr className="border-t bg-blue-50">
      {fields.map((field) => (
        <td key={field.key} className={cellClassName}>
          {field.readOnly ? (
            <div className="text-sm">{String(editData[field.key] ?? '')}</div>
          ) : field.type === 'select' && field.options ? (
            <select
              value={String(editData[field.key] ?? '')}
              onChange={(e) => {
                handleFieldChange(field.key, e.target.value);
                selectOnChange?.(field.key, e.target.value);
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
          ) : field.type === 'text' || field.type === 'date' || field.type === 'number' ? (
            <input
              type={field.type || 'text'}
              step={field.step}
              value={String(editData[field.key] ?? '')}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              className="w-full px-2 py-1 border rounded text-sm"
            />
          ) : (
            <input
              type="text"
              value={String(editData[field.key] ?? '')}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
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
