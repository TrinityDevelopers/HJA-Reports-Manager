import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  FIELD_TYPES,
  type EditableField,
  type EditableSection,
  type SchemaFieldType,
} from './schemaDraft';

function FieldEditor({
  field,
  onChange,
}: {
  field: EditableField;
  onChange: (field: EditableField) => void;
}) {
  return (
    <div className="grid gap-2 border-t border-gray-100 py-3 md:grid-cols-2">
      <label className="block text-sm">
        <span className="mb-1 block text-gray-600">Id</span>
        <input
          className="input"
          value={field.id}
          onChange={(event) => onChange({ ...field, id: event.target.value })}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-gray-600">Label</span>
        <input
          className="input"
          value={field.label}
          onChange={(event) => onChange({ ...field, label: event.target.value })}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-gray-600">Type</span>
        <select
          className="select"
          value={field.type}
          onChange={(event) => onChange({ ...field, type: event.target.value as SchemaFieldType })}
        >
          {FIELD_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-end gap-2 pb-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={field.required}
          onChange={(event) => onChange({ ...field, required: event.target.checked })}
        />
        Required
      </label>
      {field.type === 'number' && (
        <label className="block text-sm md:col-span-2">
          <span className="mb-1 block text-gray-600">Step</span>
          <input
            className="input"
            value={field.step}
            onChange={(event) => onChange({ ...field, step: event.target.value })}
          />
        </label>
      )}
      {field.type === 'select' && (
        <label className="block text-sm md:col-span-2">
          <span className="mb-1 block text-gray-600">Options (one per line)</span>
          <textarea
            className="input min-h-24"
            value={field.optionsText}
            onChange={(event) => onChange({ ...field, optionsText: event.target.value })}
          />
        </label>
      )}
    </div>
  );
}

export function SchemaFieldsSection({
  sections,
  saving,
  error,
  onChange,
  onSave,
}: {
  sections: EditableSection[];
  saving: boolean;
  error: string | null;
  onChange: (sections: EditableSection[]) => void;
  onSave: () => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const updateSection = (index: number, section: EditableSection) => {
    onChange(sections.map((item, itemIndex) => (itemIndex === index ? section : item)));
  };

  const toggleSection = (key: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <section className="mb-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-gray-800">Schema</h3>
          <p className="subtext">
            Header and entry field definitions for this report type. They stay the same for every
            workbook.
          </p>
        </div>
        <button
          type="button"
          className="button-base"
          onClick={onSave}
          disabled={saving || sections.length === 0}
        >
          {saving ? 'Saving schema…' : 'Save schema'}
        </button>
      </div>
      {error && <p className="mb-3 text-red-600">{error}</p>}
      {sections.length === 0 ? (
        <p className="text-gray-600">This report type has no header or entry fields.</p>
      ) : (
        <div className="space-y-4">
          {sections.map((section, index) => {
            const isCollapsed = collapsed.has(section.key);
            const sectionLabel = `${section.type === 'entry' ? 'Entry section' : 'Header section'}${section.id ? ` - ${section.id}` : ''}`;
            return (
              <div key={section.key} className="panel">
                <div className={`flex flex-wrap items-end gap-3 ${isCollapsed ? '' : 'mb-3'}`}>
                  <button
                    type="button"
                    className="mb-2 rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                    aria-expanded={!isCollapsed}
                    aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${sectionLabel}`}
                    onClick={() => toggleSection(section.key)}
                  >
                    {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                  </button>
                  <label className="block min-w-64 flex-1 text-sm">
                    <span className="mb-1 block text-gray-600">{sectionLabel}</span>
                    <input
                      className="input"
                      value={section.title}
                      onChange={(event) =>
                        updateSection(index, { ...section, title: event.target.value })
                      }
                    />
                  </label>
                </div>
                {!isCollapsed &&
                  section.fields.map((field, fieldIndex) => (
                    <FieldEditor
                      key={`${section.key}:${fieldIndex}`}
                      field={field}
                      onChange={(next) =>
                        updateSection(index, {
                          ...section,
                          fields: section.fields.map((item, itemIndex) =>
                            itemIndex === fieldIndex ? next : item,
                          ),
                        })
                      }
                    />
                  ))}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
