import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { EventEmitter } from 'events';

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
}));

vi.mock('child_process', () => ({
  spawn: spawnMock,
}));

import {
  convertXlsxFilesViaLibreOffice,
  getLibreOfficeConcurrency,
  resolveSofficeExecutable,
  userInstallationUri,
} from '../../src/exports/libreOfficePool';

class MockChildProcess extends EventEmitter {
  stderr = new EventEmitter();
}

function mockSuccessfulSpawn(onSpawn?: (executable: string, args: string[]) => void) {
  spawnMock.mockImplementation((executable: string, args: string[]) => {
    onSpawn?.(executable, args);
    const proc = new MockChildProcess();
    queueMicrotask(async () => {
      const outDirIndex = args.indexOf('--outdir');
      const outDir = outDirIndex >= 0 ? args[outDirIndex + 1] : '';
      const inputPaths = args.slice(outDirIndex + 2);
      for (const inputPath of inputPaths) {
        const pdfName = `${path.basename(inputPath, path.extname(inputPath))}.pdf`;
        await fs.writeFile(path.join(outDir, pdfName), Buffer.from(`pdf:${inputPath}`));
      }
      proc.emit('close', 0);
    });
    return proc;
  });
}

describe('libreOfficePool helpers', () => {
  const originalPlatform = process.platform;
  const originalEnv = { ...process.env };

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    process.env = { ...originalEnv };
  });

  it('defaults concurrency to 3', () => {
    delete process.env.LIBREOFFICE_CONCURRENCY;
    expect(getLibreOfficeConcurrency()).toBe(3);
  });

  it('uses soffice.com on Windows', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    delete process.env.LIBREOFFICE_PATH;
    expect(resolveSofficeExecutable()).toBe('soffice.com');
  });

  it('uses soffice on Linux', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    delete process.env.LIBREOFFICE_PATH;
    expect(resolveSofficeExecutable()).toBe('soffice');
  });

  it('builds unique UserInstallation URIs per worker', () => {
    const first = userInstallationUri(0);
    const second = userInstallationUri(1);
    expect(first).toContain('worker-0');
    expect(second).toContain('worker-1');
    expect(first).not.toEqual(second);
  });
});

describe('convertXlsxFilesViaLibreOffice', () => {
  let tempDir: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    spawnMock.mockReset();
    delete process.env.LIBREOFFICE_CONCURRENCY;
    delete process.env.LIBREOFFICE_PATH;
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lo-pool-test-'));
    vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  });

  it('returns PDF buffers in input order', async () => {
    const firstXlsx = path.join(tempDir, 'first.xlsx');
    const secondXlsx = path.join(tempDir, 'second.xlsx');
    const thirdXlsx = path.join(tempDir, 'third.xlsx');
    await fs.writeFile(firstXlsx, 'xlsx-1');
    await fs.writeFile(secondXlsx, 'xlsx-2');
    await fs.writeFile(thirdXlsx, 'xlsx-3');

    mockSuccessfulSpawn();

    const pdfs = await convertXlsxFilesViaLibreOffice([firstXlsx, secondXlsx, thirdXlsx]);

    expect(pdfs).toHaveLength(3);
    expect(pdfs[0].toString()).toBe(`pdf:${path.resolve(firstXlsx)}`);
    expect(pdfs[1].toString()).toBe(`pdf:${path.resolve(secondXlsx)}`);
    expect(pdfs[2].toString()).toBe(`pdf:${path.resolve(thirdXlsx)}`);
  });

  it('uses isolated worker profiles when concurrency is greater than 1', async () => {
    process.env.LIBREOFFICE_CONCURRENCY = '3';
    const xlsxPaths: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      const filePath = path.join(tempDir, `sheet-${i}.xlsx`);
      await fs.writeFile(filePath, `xlsx-${i}`);
      xlsxPaths.push(filePath);
    }

    const profileArgs: string[] = [];
    mockSuccessfulSpawn((_executable, args) => {
      const profileArg = args.find((arg) => arg.startsWith('-env:UserInstallation='));
      if (profileArg) {
        profileArgs.push(profileArg);
      }
    });

    await convertXlsxFilesViaLibreOffice(xlsxPaths);

    expect(spawnMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(new Set(profileArgs).size).toBeGreaterThan(1);
  });

  it('uses soffice.com on Windows', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const xlsxPath = path.join(tempDir, 'win.xlsx');
    await fs.writeFile(xlsxPath, 'xlsx');

    mockSuccessfulSpawn((executable) => {
      expect(executable).toBe('soffice.com');
    });

    await convertXlsxFilesViaLibreOffice([xlsxPath]);
  });
});
