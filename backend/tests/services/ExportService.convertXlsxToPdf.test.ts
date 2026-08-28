import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const { convertXlsxFilesViaLibreOfficeMock, convertDocumentXlsxToPdfMock, ConvertDocumentApiMock } =
  vi.hoisted(() => {
    const convertDocumentXlsxToPdfMock = vi.fn();
    const ConvertDocumentApiMock = vi.fn(function ConvertDocumentApi(this: {
      convertDocumentXlsxToPdf: typeof convertDocumentXlsxToPdfMock;
    }) {
      this.convertDocumentXlsxToPdf = convertDocumentXlsxToPdfMock;
    });
    return {
      convertXlsxFilesViaLibreOfficeMock: vi.fn(),
      convertDocumentXlsxToPdfMock,
      ConvertDocumentApiMock,
    };
  });

vi.mock('../../src/exports/libreOfficePool', () => ({
  convertXlsxFilesViaLibreOffice: convertXlsxFilesViaLibreOfficeMock,
}));

vi.mock('cloudmersive-convert-api-client', () => ({
  default: {
    ApiClient: {
      instance: {
        authentications: {
          Apikey: { apiKey: '' },
        },
      },
    },
    ConvertDocumentApi: ConvertDocumentApiMock,
  },
}));

vi.mock('../../src/database/connection', () => ({
  AppDataSource: {
    getRepository: vi.fn(),
  },
}));

import { ExportService } from '../../src/services/ExportService';

describe('ExportService.convertXlsxToPdf', () => {
  const xlsxBuffer = Buffer.from('fake-xlsx');
  const pdfFromCloudmersive = Buffer.from('pdf-from-cloudmersive');
  const pdfFromLibre = Buffer.from('pdf-from-libre');
  let service: ExportService;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    convertXlsxFilesViaLibreOfficeMock.mockReset();
    convertDocumentXlsxToPdfMock.mockReset();
    ConvertDocumentApiMock.mockClear();
    delete process.env.CLOUDMERSIVE_API_KEY;
    service = new ExportService();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    delete process.env.CLOUDMERSIVE_API_KEY;
  });

  it('uses the LibreOffice pool only when CLOUDMERSIVE_API_KEY is unset', async () => {
    convertXlsxFilesViaLibreOfficeMock.mockResolvedValue([pdfFromLibre]);

    const result = await service.convertXlsxToPdf(xlsxBuffer);

    expect(result).toEqual(pdfFromLibre);
    expect(convertXlsxFilesViaLibreOfficeMock).toHaveBeenCalledOnce();
    expect(convertDocumentXlsxToPdfMock).not.toHaveBeenCalled();
    expect(ConvertDocumentApiMock).not.toHaveBeenCalled();
  });

  it('uses the LibreOffice pool only when CLOUDMERSIVE_API_KEY is blank', async () => {
    process.env.CLOUDMERSIVE_API_KEY = '   ';
    convertXlsxFilesViaLibreOfficeMock.mockResolvedValue([pdfFromLibre]);

    const result = await service.convertXlsxToPdf(xlsxBuffer);

    expect(result).toEqual(pdfFromLibre);
    expect(convertXlsxFilesViaLibreOfficeMock).toHaveBeenCalledOnce();
    expect(convertDocumentXlsxToPdfMock).not.toHaveBeenCalled();
    expect(ConvertDocumentApiMock).not.toHaveBeenCalled();
  });

  it('uses Cloudmersive when the API key is set and the call succeeds', async () => {
    process.env.CLOUDMERSIVE_API_KEY = 'test-api-key';
    convertDocumentXlsxToPdfMock.mockImplementation((_buf, callback) => {
      callback(null, pdfFromCloudmersive);
    });

    const result = await service.convertXlsxToPdf(xlsxBuffer);

    expect(result).toEqual(pdfFromCloudmersive);
    expect(ConvertDocumentApiMock).toHaveBeenCalledOnce();
    expect(convertDocumentXlsxToPdfMock).toHaveBeenCalledOnce();
    expect(convertXlsxFilesViaLibreOfficeMock).not.toHaveBeenCalled();
  });

  it('reuses the same Cloudmersive API instance across conversions', async () => {
    process.env.CLOUDMERSIVE_API_KEY = 'test-api-key';
    convertDocumentXlsxToPdfMock.mockImplementation((_buf, callback) => {
      callback(null, pdfFromCloudmersive);
    });

    await service.convertXlsxToPdf(xlsxBuffer);
    await service.convertXlsxToPdf(xlsxBuffer);

    expect(ConvertDocumentApiMock).toHaveBeenCalledOnce();
    expect(convertDocumentXlsxToPdfMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to the LibreOffice pool when Cloudmersive fails', async () => {
    process.env.CLOUDMERSIVE_API_KEY = 'test-api-key';
    convertDocumentXlsxToPdfMock.mockImplementation((_buf, callback) => {
      callback(new Error('out of credits'));
    });
    convertXlsxFilesViaLibreOfficeMock.mockResolvedValue([pdfFromLibre]);

    const result = await service.convertXlsxToPdf(xlsxBuffer);

    expect(result).toEqual(pdfFromLibre);
    expect(convertDocumentXlsxToPdfMock).toHaveBeenCalledOnce();
    expect(convertXlsxFilesViaLibreOfficeMock).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cloudmersive PDF conversion failed'),
    );
  });

  it('throws when both Cloudmersive and the LibreOffice pool fail', async () => {
    process.env.CLOUDMERSIVE_API_KEY = 'test-api-key';
    convertDocumentXlsxToPdfMock.mockImplementation((_buf, callback) => {
      callback(new Error('api down'));
    });
    convertXlsxFilesViaLibreOfficeMock.mockRejectedValue(new Error('soffice missing'));

    await expect(service.convertXlsxToPdf(xlsxBuffer)).rejects.toThrow(
      /PDF conversion failed via Cloudmersive and LibreOffice/,
    );
  });
});

describe('ExportService.convertXlsxFilesToPdfs', () => {
  const pdfFromCloudmersiveA = Buffer.from('pdf-a');
  const pdfFromCloudmersiveC = Buffer.from('pdf-c');
  const pdfFromLibreB = Buffer.from('pdf-b');
  let service: ExportService;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    convertXlsxFilesViaLibreOfficeMock.mockReset();
    convertDocumentXlsxToPdfMock.mockReset();
    ConvertDocumentApiMock.mockClear();
    delete process.env.CLOUDMERSIVE_API_KEY;
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'export-service-test-'));
    service = new ExportService();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    warnSpy.mockRestore();
    delete process.env.CLOUDMERSIVE_API_KEY;
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  });

  async function writeTempXlsx(name: string, contents: string): Promise<string> {
    const filePath = path.join(tempDir, name);
    await fs.writeFile(filePath, contents);
    return filePath;
  }

  it('preserves order when Cloudmersive converts files concurrently', async () => {
    process.env.CLOUDMERSIVE_API_KEY = 'test-api-key';
    const paths = await Promise.all([
      writeTempXlsx('a.xlsx', 'file-a'),
      writeTempXlsx('b.xlsx', 'file-b'),
      writeTempXlsx('c.xlsx', 'file-c'),
    ]);

    convertDocumentXlsxToPdfMock.mockImplementation((buf, callback) => {
      const text = buf.toString();
      if (text.includes('file-b')) {
        callback(new Error('cloudmersive failed for b'));
        return;
      }
      if (text.includes('file-a')) {
        setTimeout(() => callback(null, pdfFromCloudmersiveA), 30);
        return;
      }
      setTimeout(() => callback(null, pdfFromCloudmersiveC), 10);
    });

    convertXlsxFilesViaLibreOfficeMock.mockImplementation(async (fallbackPaths: string[]) =>
      fallbackPaths.map((filePath) =>
        filePath.endsWith('b.xlsx') ? pdfFromLibreB : Buffer.from(`unexpected:${filePath}`),
      ),
    );

    const pdfs = await service.convertXlsxFilesToPdfs(paths);

    expect(pdfs).toEqual([pdfFromCloudmersiveA, pdfFromLibreB, pdfFromCloudmersiveC]);
    expect(convertXlsxFilesViaLibreOfficeMock).toHaveBeenCalledWith([paths[1]]);
  });

  it('uses the LibreOffice pool for all files when Cloudmersive is unset', async () => {
    const paths = await Promise.all([
      writeTempXlsx('one.xlsx', 'file-one'),
      writeTempXlsx('two.xlsx', 'file-two'),
    ]);
    convertXlsxFilesViaLibreOfficeMock.mockResolvedValue([
      Buffer.from('pdf-one'),
      Buffer.from('pdf-two'),
    ]);

    const pdfs = await service.convertXlsxFilesToPdfs(paths);

    expect(pdfs.map((pdf) => pdf.toString())).toEqual(['pdf-one', 'pdf-two']);
    expect(convertXlsxFilesViaLibreOfficeMock).toHaveBeenCalledWith(paths);
  });
});
