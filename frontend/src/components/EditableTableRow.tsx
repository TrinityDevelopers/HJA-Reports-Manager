import { useState } from 'react';
import { Save } from 'lucide-react';
import type { FieldConfig } from '../types';
import { FieldInput } from './forms/FieldInput';

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

  return (
    <tr className="border-t bg-blue-50">
      {fields.map((field) => (
        <td key={field.id} className={cellClassName}>
          <FieldInput
            field={field}
            mode="table"
            value={editData[field.id]}
            onChange={(next) => setEditData({ ...editData, [field.id]: next })}
            onSelectChange={selectOnChange}
          />
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
