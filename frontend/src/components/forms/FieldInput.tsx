import type { FieldConfig } from '../../types';
import { NameAndDateField } from '../ui';
import { asNameAndDateValue } from '../../utils/formHelpers';

type Props = {
  field: FieldConfig;
  value: unknown;
  onChange: (next: unknown) => void;
  className?: string;
  readOnly?: boolean;
  placeholder?: string;
  mode?: 'form' | 'table';
  onSelectChange?: (fieldId: string, value: string) => void;
};

export function FieldInput({
  field,
  value,
  onChange,
  className,
  readOnly,
  placeholder,
  mode = 'form',
  onSelectChange,
}: Props) {
  if (readOnly || field.readOnly) {
    return <div className={className ?? 'text-sm'}>{String(value ?? '')}</div>;
  }

  if (field.type === 'select' && field.options) {
    const v = String(value ?? '');
    return (
      <select
        value={v}
        onChange={(e) => {
          onChange(e.target.value);
          onSelectChange?.(field.id, e.target.value);
        }}
        className={
          className ??
          (mode === 'form'
            ? 'select focus-ring-primary'
            : 'w-full px-2 py-1 border rounded text-sm')
        }
      >
        <option value="">{mode === 'form' ? `-- Select ${field.label} --` : '-- Select --'}</option>
        {field.options.map((opt) => (
          <option key={opt.id} value={opt.name}>
            {opt.name}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'nameAndDate') {
    if (mode === 'form') {
      return (
        <NameAndDateField
          required={field.required}
          value={asNameAndDateValue(value)}
          onChange={(v) => onChange(v)}
        />
      );
    }

    const v = asNameAndDateValue(value);
    return (
      <div className={className ?? 'flex gap-2'}>
        <input
          type="text"
          value={String(v.name ?? '')}
          onChange={(e) => onChange({ ...v, name: e.target.value || undefined })}
          className="w-full px-2 py-1 border rounded text-sm"
          placeholder="Name"
        />
        <input
          type="date"
          value={String(v.date ?? '')}
          onChange={(e) => onChange({ ...v, date: e.target.value || undefined })}
          className="w-full px-2 py-1 border rounded text-sm"
        />
      </div>
    );
  }

  const inputType = field.type === 'number' || field.type === 'date' ? field.type : 'text';

  if (mode === 'form') {
    // Use the existing `InputField` wrapper styling/labeling in form mode by rendering the same markup.
    // (We keep this component focused on control behavior; the parent provides label layout.)
    return (
      <input
        type={inputType}
        step={field.step}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
        placeholder={placeholder}
        className={className ?? 'input focus-ring-primary'}
      />
    );
  }

  return (
    <input
      type={inputType}
      step={field.step}
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      className={className ?? 'w-full px-2 py-1 border rounded text-sm'}
      placeholder={placeholder}
    />
  );
}
