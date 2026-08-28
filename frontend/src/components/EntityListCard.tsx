import type { ReactNode } from 'react';

export function EntityListCard({
  title,
  subtitle,
  meta,
  actions,
  onClick,
  className = 'card-border border-primary-light',
}: {
  title: string;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const body = (
    <>
      <div className={actions ? 'flex justify-between items-start mb-3' : undefined}>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-800">{title}</h3>
          {subtitle && <div className="subtext">{subtitle}</div>}
        </div>
        {actions}
      </div>
      {meta && <div className="flex flex-col subtext gap-1 mt-2 pt-3 border-t">{meta}</div>}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${className} text-left hover:shadow-lg transition-all`}
      >
        {body}
      </button>
    );
  }

  return <div className={className}>{body}</div>;
}
