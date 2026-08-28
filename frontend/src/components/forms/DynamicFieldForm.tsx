import { useState } from 'react';
import type { FieldConfig } from '../../types';
import { fromISODateOnly, toISODateOnly } from '../../utils/dateAndNormalize.ts';
import { validateEntry, type FieldDefinition } from '../../utils/formHelpers';
import { FieldInput } from './FieldInput';

export function DynamicFieldForm({
  title,
  fields,
  initialData,
  onSave,
  onCancel,
  saveLabel,
}: {
  title: string;
  fields: FieldConfig[];
  initialData?: Record<string, unknown>;
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  saveLabel: string;
}) {
  const [formData, setFormData] = useState<Record<string, unknown>>(() => {
    if (initialData) return { ...initialData };
    return fields.reduce<Record<string, unknown>>((acc, field) => {
      acc[field.id] = '';
      return acc;
    }, {});
  });

  const handleSubmit = () => {
    const { valid, errors } = validateEntry(fields as FieldDefinition[], formData);
    if (!valid) {
      const firstError = Object.values(errors)[0];
      alert(firstError ?? 'Please fill in all required fields');
      return;
    }
    onSave(formData);
  };

  return (
    <>
      <h3 className="text-xl font-semibold text-gray-800 mb-4">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map((field) => (
          <div
            key={field.id}
            className={field.type === 'text' || field.type === 'number' ? '' : 'md:col-span-2'}
          >
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <FieldInput
              field={field}
              mode="form"
              value={
                field.type === 'date' && formData[field.id]
                  ? formData[field.id] instanceof Date
                    ? toISODateOnly(formData[field.id] as Date)
                    : formData[field.id]
                  : formData[field.id]
              }
              onChange={(next) => {
                if (field.type === 'date') {
                  setFormData({
                    ...formData,
                    [field.id]:
                      typeof next === 'string' && next ? fromISODateOnly(next) : new Date(),
                  });
                } else {
                  setFormData({ ...formData, [field.id]: next });
                }
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-4">
        <button type="button" onClick={handleSubmit} className="button-base">
          {saveLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="button-secondary border-primary text-primary"
        >
          Cancel
        </button>
      </div>
    </>
  );
}
