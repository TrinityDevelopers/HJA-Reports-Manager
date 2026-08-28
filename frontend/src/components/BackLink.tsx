import { ArrowLeft } from 'lucide-react';

export function BackLink({
  label,
  onClick,
  className = 'mb-6',
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center text-gray-600 hover:text-gray-800 ${className}`}
    >
      <ArrowLeft size={20} className="mr-2" />
      {label}
    </button>
  );
}
