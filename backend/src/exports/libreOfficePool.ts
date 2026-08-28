import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { chunkArray } from '../utils/chunkArray';

const DEFAULT_CONCURRENCY = 3;
const MAX_FILES_PER_INVOCATION = 20;

const TEMP_DIR = path.join(process.cwd(), 'temp');
const PROFILE_ROOT = path.join(TEMP_DIR, 'lo-profiles');

export function getLibreOfficeConcurrency(): number {
  const raw = process.env.LIBREOFFICE_CONCURRENCY?.trim();
  if (!raw) {
    return DEFAULT_CONCURRENCY;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CONCURRENCY;
}

/** Resolve the LibreOffice CLI executable (soffice.com on Windows). */
export function resolveSofficeExecutable(): string {
  const custom = process.env.LIBREOFFICE_PATH?.trim();
  if (custom) {
    return custom;
  }
  return process.platform === 'win32' ? 'soffice.com' : 'soffice';
}

function profileDir(workerIndex: number): string {
  return path.join(PROFILE_ROOT, `worker-${workerIndex}`);
}

/** Build a LibreOffice UserInstallation URI for an isolated worker profile. */
export function userInstallationUri(workerIndex: number): string {
  const resolved = path.resolve(profileDir(workerIndex)).replace(/\\/g, '/');
  if (/^[A-Za-z]:\//.test(resolved)) {
    return `file:///${resolved}`;
  }
  return `file://${resolved}`;
}

function distributeAcrossWorkers<T>(items: T[], workerCount: number): T[][] {
  if (items.length === 0) {
    return [];
  }
  const chunkSize = Math.ceil(items.length / workerCount);
  return chunkArray(items, chunkSize);
}

async function ensureProfileDir(workerIndex: number): Promise<void> {
  await fs.mkdir(profileDir(workerIndex), { recursive: true });
}

async function runSofficeBatch(
  workerIndex: number,
  xlsxPaths: string[],
  outDir: string,
): Promise<void> {
  await ensureProfileDir(workerIndex);
  await fs.mkdir(outDir, { recursive: true });

  const executable = resolveSofficeExecutable();
  const args = [
    '--headless',
    '--norestore',
    '--nologo',
    '--nodefault',
    '--nofirststartwizard',
    `-env:UserInstallation=${userInstallationUri(workerIndex)}`,
    '--convert-to',
    'pdf',
    '--outdir',
    outDir,
    ...xlsxPaths.map((filePath) => path.resolve(filePath)),
  ];

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';

    proc.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    proc.on('error', (error) => {
      reject(
        new Error(
          `Failed to start LibreOffice (${executable}): ${error.message}. Is LibreOffice installed?`,
        ),
      );
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`LibreOffice exited with code ${code ?? 'unknown'}: ${stderr.trim()}`));
    });
  });
}

async function convertBatchWithWorker(
  workerIndex: number,
  xlsxPaths: string[],
): Promise<Map<string, Buffer>> {
  const outDir = path.join(
    TEMP_DIR,
    'lo-out',
    `worker-${workerIndex}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
  );

  try {
    await runSofficeBatch(workerIndex, xlsxPaths, outDir);

    const result = new Map<string, Buffer>();
    for (const xlsxPath of xlsxPaths) {
      const pdfName = `${path.basename(xlsxPath, path.extname(xlsxPath))}.pdf`;
      const pdfPath = path.join(outDir, pdfName);
      try {
        result.set(xlsxPath, await fs.readFile(pdfPath));
      } catch {
        throw new Error(`LibreOffice did not produce PDF for ${xlsxPath}`);
      }
    }
    return result;
  } finally {
    await fs.rm(outDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function convertWorkerChunk(
  workerIndex: number,
  xlsxPaths: string[],
): Promise<Map<string, Buffer>> {
  const merged = new Map<string, Buffer>();
  const batches = chunkArray(xlsxPaths, MAX_FILES_PER_INVOCATION);

  for (const batch of batches) {
    const batchResult = await convertBatchWithWorker(workerIndex, batch);
    for (const [key, value] of batchResult) {
      merged.set(key, value);
    }
  }

  return merged;
}

/**
 * Convert many XLSX files to PDF using a small pool of isolated LibreOffice workers.
 * Each worker batch-converts up to 20 files per invocation. Output order matches input order.
 */
export async function convertXlsxFilesViaLibreOffice(xlsxPaths: string[]): Promise<Buffer[]> {
  if (xlsxPaths.length === 0) {
    return [];
  }

  if (xlsxPaths.length === 1) {
    const single = await convertBatchWithWorker(0, xlsxPaths);
    const buffer = single.get(xlsxPaths[0]);
    if (!buffer) {
      throw new Error(`LibreOffice did not produce PDF for ${xlsxPaths[0]}`);
    }
    return [buffer];
  }

  const workerCount = Math.min(getLibreOfficeConcurrency(), xlsxPaths.length);
  const workerChunks = distributeAcrossWorkers(xlsxPaths, workerCount);
  const results = new Map<string, Buffer>();

  await Promise.all(
    workerChunks.map(async (chunk, workerIndex) => {
      if (chunk.length === 0) {
        return;
      }
      const chunkResults = await convertWorkerChunk(workerIndex, chunk);
      for (const [key, value] of chunkResults) {
        results.set(key, value);
      }
    }),
  );

  return xlsxPaths.map((xlsxPath) => {
    const pdf = results.get(xlsxPath);
    if (!pdf) {
      throw new Error(`LibreOffice did not produce PDF for ${xlsxPath}`);
    }
    return pdf;
  });
}
