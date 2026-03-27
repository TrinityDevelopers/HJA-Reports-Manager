export function InputField({
  label,
  type = 'text',
  value,
  onChange,
  required = false,
  step,
}: {
  label: string;
  type?: string;
  value: string | number | undefined;
  onChange: (v: string) => void;
  required?: boolean;
  step?: string | number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <input
        type={type}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        step={step}
        className="input focus-ring-primary"
      />
    </div>
  );
}

export function NavButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const base = 'flex items-center gap-2 px-4 py-2 rounded-lg transition-all';
  const stateClass = active
    ? 'bg-primary text-white shadow-md'
    : 'text-gray-700 hover:bg-primary-lighter';
  return (
    <button onClick={onClick} className={`${base} ${stateClass}`}>
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}
