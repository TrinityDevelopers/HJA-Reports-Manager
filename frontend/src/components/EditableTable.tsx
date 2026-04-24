import React from 'react';
import { EditableTableRow } from './EditableTableRow';
import { Edit2, Trash2 } from 'lucide-react';
import type { FieldConfig } from '../types';

export default function EditableTable<T extends object>({
  columns,
  rows,
  rowKey = 'id',
  editingRowId = null,
  onEdit,
  onDelete,
  onSave,
  fields,
  editRowRenderer,
  renderCell,
}: {
  columns: Array<{ key: string; label: string }>;
  rows: T[];
  rowKey?: string;
  editingRowId?: string | number | null;
  onEdit?: (id: string | number) => void;
  onDelete?: (id: string | number) => void;
  onSave?: (id: string | number, updated: Record<string, unknown>) => void;
  fields?: FieldConfig[]; // forwarded to EditableTableRow if needed
  editRowRenderer?: (row: T) => React.ReactNode;
  renderCell?: (row: T, colKey: string) => React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-primary-light">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="table-head">
                {c.label}
              </th>
            ))}
            {(onEdit || onDelete) && <th className="table-head">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {rows.map((row) => {
            const id = (row as unknown as Record<string, unknown>)[rowKey] as string | number;
            if (editingRowId !== null && id === editingRowId) {
              // Render custom edit row if provided, otherwise use EditableTableRow
              return (
                <React.Fragment key={String(id)}>
                  {editRowRenderer ? (
                    editRowRenderer(row)
                  ) : (
                    <EditableTableRow
                      key={String(id)}
                      data={row as unknown as Record<string, unknown>}
                      fields={fields || []}
                      onSave={(updated) => onSave?.(id, updated)}
                      onCancel={() => onEdit?.(null as unknown as number)}
                    />
                  )}
                </React.Fragment>
              );
            }

            return (
              <tr key={String(id)} className="table-row-hover">
                {columns.map((c) => (
                  <td key={c.key} className="table-cell">
                    {renderCell
                      ? renderCell(row, c.key)
                      : String((row as unknown as Record<string, unknown>)[c.key] ?? '')}
                  </td>
                ))}
                {(onEdit || onDelete) && (
                  <td className="table-cell">
                    {onEdit && (
                      <button
                        onClick={() => onEdit(id)}
                        className="text-blue-600 hover:text-blue-800 mr-2"
                        aria-label={`edit-${id}`}
                      >
                        <Edit2 size={16} />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => onDelete(id)}
                        className="text-red-600 hover:text-red-800"
                        aria-label={`delete-${id}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
