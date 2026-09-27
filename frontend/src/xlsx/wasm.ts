import wasmUrl from '@extend-ai/react-xlsx/duke_sheets_wasm_bg.wasm?url';
import { setWasmSource } from '@extend-ai/react-xlsx';

let configured = false;

export function initXlsxWasm(): void {
  if (configured) return;
  setWasmSource(wasmUrl);
  configured = true;
}
