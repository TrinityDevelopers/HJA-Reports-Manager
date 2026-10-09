import { useEffect, useLayoutEffect, useRef } from 'react';
import {
  XlsxViewer,
  XlsxViewerProvider,
  useXlsxViewer,
  useXlsxViewerZoom,
} from '@extend-ai/react-xlsx';

const PREVIEW_ZOOM_PERCENT = 100;

function StartAtFullZoom({ workbook }: { workbook: ArrayBuffer }) {
  const { setZoomScale } = useXlsxViewerZoom();
  const { activeSheet, isLoading } = useXlsxViewer();
  const applied = useRef<{ workbook: ArrayBuffer; sheets: Set<number> } | null>(null);

  useLayoutEffect(() => {
    if (isLoading || !activeSheet) return;
    if (applied.current?.workbook !== workbook) {
      applied.current = { workbook, sheets: new Set() };
    }
    const sheetIndex = activeSheet.workbookSheetIndex;
    if (applied.current.sheets.has(sheetIndex)) return;
    applied.current.sheets.add(sheetIndex);
    setZoomScale(PREVIEW_ZOOM_PERCENT);
  }, [activeSheet, isLoading, setZoomScale, workbook]);

  return null;
}

function BindingHighlight({
  ranges,
  onResult,
}: {
  ranges: readonly string[] | null;
  onResult: (ok: boolean | null) => void;
}) {
  const { highlightRanges, clearHighlightedRanges, isLoading, activeSheet } = useXlsxViewer();
  const commands = useRef({ highlightRanges, clearHighlightedRanges });
  const rangeKey = ranges === null ? null : ranges.join('\n');
  const sheetIndex = activeSheet?.workbookSheetIndex;

  useLayoutEffect(() => {
    commands.current = { highlightRanges, clearHighlightedRanges };
  }, [highlightRanges, clearHighlightedRanges]);

  useEffect(() => {
    if (isLoading || sheetIndex === undefined) return;
    const { highlightRanges: highlight, clearHighlightedRanges: clear } = commands.current;
    if (!rangeKey) {
      clear();
      onResult(null);
      return;
    }
    const highlighted = highlight(rangeKey.split('\n'), { autoScroll: true });
    if (!highlighted) clear();
    onResult(highlighted);
  }, [isLoading, onResult, rangeKey, sheetIndex]);

  return null;
}

export function TemplatePreview({
  file,
  fileName,
  ranges,
  onHighlightResult,
}: {
  file: ArrayBuffer;
  fileName?: string;
  ranges: readonly string[] | null;
  onHighlightResult: (ok: boolean | null) => void;
}) {
  return (
    <XlsxViewerProvider file={file} fileName={fileName} readOnly>
      <StartAtFullZoom workbook={file} />
      <BindingHighlight ranges={ranges} onResult={onHighlightResult} />
      <XlsxViewer
        height="70vh"
        showDefaultToolbar
        readOnly
        highlightClassName="binding-highlight"
      />
    </XlsxViewerProvider>
  );
}
