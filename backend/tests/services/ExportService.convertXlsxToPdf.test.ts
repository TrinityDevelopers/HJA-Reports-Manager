import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { convertMock, convertDocumentXlsxToPdfMock, ConvertDocumentApiMock } = vi.hoisted(() => {
  const convertDocumentXlsxToPdfMock = vi.fn();
  const ConvertDocumentApiMock = vi.fn(function ConvertDocumentApi(this: {
    convertDocumentXlsxToPdf: typeof convertDocumentXlsxToPdfMock;
  }) {
    this.convertDocumentXlsxToPdf = convertDocumentXlsxToPdfMock;
  });
  return {
    convertMock: vi.fn(),
    convertDocumentXlsxToPdfMock,
    ConvertDocumentApiMock,
  };
});

vi.mock('libreoffice-convert', () => ({
  convert: convertMock,
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
    convertMock.mockReset();
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

  it('uses LibreOffice only when CLOUDMERSIVE_API_KEY is unset', async () => {
    convertMock.mockImplementation((_buf, _ext, _filter, callback) => {
      callback(null, pdfFromLibre);
    });

    const result = await service.convertXlsxToPdf(xlsxBuffer);

    expect(result).toEqual(pdfFromLibre);
    expect(convertMock).toHaveBeenCalledOnce();
    expect(convertDocumentXlsxToPdfMock).not.toHaveBeenCalled();
    expect(ConvertDocumentApiMock).not.toHaveBeenCalled();
  });

  it('uses LibreOffice only when CLOUDMERSIVE_API_KEY is blank', async () => {
    process.env.CLOUDMERSIVE_API_KEY = '   ';
    convertMock.mockImplementation((_buf, _ext, _filter, callback) => {
      callback(null, pdfFromLibre);
    });

    const result = await service.convertXlsxToPdf(xlsxBuffer);

    expect(result).toEqual(pdfFromLibre);
    expect(convertMock).toHaveBeenCalledOnce();
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
    expect(convertDocumentXlsxToPdfMock).toHaveBeenCalledWith(xlsxBuffer, expect.any(Function));
    expect(convertMock).not.toHaveBeenCalled();
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

  it('falls back to LibreOffice when Cloudmersive fails', async () => {
    process.env.CLOUDMERSIVE_API_KEY = 'test-api-key';
    convertDocumentXlsxToPdfMock.mockImplementation((_buf, callback) => {
      callback(new Error('out of credits'));
    });
    convertMock.mockImplementation((_buf, _ext, _filter, callback) => {
      callback(null, pdfFromLibre);
    });

    const result = await service.convertXlsxToPdf(xlsxBuffer);

    expect(result).toEqual(pdfFromLibre);
    expect(convertDocumentXlsxToPdfMock).toHaveBeenCalledOnce();
    expect(convertMock).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cloudmersive PDF conversion failed; falling back to LibreOffice'),
    );
  });

  it('throws when both Cloudmersive and LibreOffice fail', async () => {
    process.env.CLOUDMERSIVE_API_KEY = 'test-api-key';
    convertDocumentXlsxToPdfMock.mockImplementation((_buf, callback) => {
      callback(new Error('api down'));
    });
    convertMock.mockImplementation((_buf, _ext, _filter, callback) => {
      callback(new Error('soffice missing'));
    });

    await expect(service.convertXlsxToPdf(xlsxBuffer)).rejects.toThrow(
      /PDF conversion failed via Cloudmersive and LibreOffice/,
    );
  });
});
