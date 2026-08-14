import { useEffect, useRef, useState } from 'react';
import { ChevronDown, FileDown } from 'lucide-react';

export type ExportFormat = 'xlsx' | 'pdf';

export type ExportExtraMenuItem = {
  label: string;
  onSelect: () => void;
};

/**
 * Split button for exporting a report. The primary action downloads XLSX
 * (the default), and the caret opens a dropdown to pick a format explicitly
 * (XLSX or PDF).
 */
export function ExportSplitButton({
  label = 'Export',
  busy = false,
  disabled = false,
  onExport,
  pdfMenuLabel = 'Export as PDF',
  extraMenuItems = [],
}: {
  label?: string;
  busy?: boolean;
  disabled?: boolean;
  onExport: (format: ExportFormat) => void;
  pdfMenuLabel?: string;
  extraMenuItems?: ExportExtraMenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const isDisabled = disabled || busy;
  const wideMenu = extraMenuItems.length > 0 || pdfMenuLabel !== 'Export as PDF';

  const handleSelect = (format: ExportFormat) => {
    setOpen(false);
    onExport(format);
  };

  return (
    <div ref={containerRef} className="relative inline-flex">
      <div className="flex rounded overflow-hidden">
        <button
          type="button"
          onClick={() => handleSelect('xlsx')}
          disabled={isDisabled}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 hover:bg-green-700 transition-colors disabled:opacity-60"
        >
          <FileDown size={20} />
          {busy ? 'Exporting...' : `${label} as XLSX`}
        </button>
        <button
          type="button"
          aria-label="Choose export format"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
          disabled={isDisabled}
          className="flex items-center bg-green-600 text-white px-2 py-2 border-l border-green-500 hover:bg-green-700 transition-colors disabled:opacity-60"
        >
          <ChevronDown
            size={18}
            className={open ? 'rotate-180 transition-transform' : 'transition-transform'}
          />
        </button>
      </div>

      {open && (
        <div
          role="menu"
          className={`absolute right-0 top-full mt-1 z-10 rounded border border-gray-200 bg-white shadow-lg overflow-hidden ${
            wideMenu ? 'min-w-56 w-max' : 'w-44'
          }`}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => handleSelect('xlsx')}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-gray-700 hover:bg-gray-100"
          >
            <FileDown size={16} />
            Export as XLSX
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => handleSelect('pdf')}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-gray-700 hover:bg-gray-100"
          >
            <FileDown size={16} />
            {pdfMenuLabel}
          </button>
          {extraMenuItems.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-gray-700 hover:bg-gray-100"
            >
              <FileDown size={16} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
