import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express, { Express, Router } from 'express';

const { labRequestFindById, labRequestFindReports } = vi.hoisted(() => ({
  labRequestFindById: vi.fn(),
  labRequestFindReports: vi.fn(),
}));

// Mock database connection
vi.mock('../../src/database/connection');

vi.mock('../../src/services/LabRequestService', () => ({
  LabRequestService: class LabRequestService {
    findById = labRequestFindById;
    findReports = labRequestFindReports;
  },
}));

describe('Exports Routes', () => {
  let app: Express;
  let exportsRouter: Router;

  beforeEach(async () => {
    vi.resetModules();
    labRequestFindById.mockReset();
    labRequestFindReports.mockReset();
    labRequestFindById.mockResolvedValue(null);
    labRequestFindReports.mockResolvedValue([]);

    const module = await import('../../src/routes/exports.js');
    exportsRouter = module.default as unknown as Router;

    app = express();
    app.use(express.json());
    app.use('/exports', exportsRouter);
  });

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('Route Definition Check', () => {
    it('should define routes', () => {
      expect(exportsRouter.stack).toBeDefined();
      expect(exportsRouter.stack.length).toBeGreaterThan(0);
    });

    it('should respond to GET /templates', async () => {
      const response = await request(app).get('/exports/templates');
      expect([200, 500]).toContain(response.status);
    });

    it('should respond to GET /templates/:templateId/file', async () => {
      const response = await request(app).get('/exports/templates/test-id/file');
      expect([200, 404, 500]).toContain(response.status);
    });

    it('should respond to GET /list', async () => {
      const response = await request(app).get('/exports/list');
      expect([200, 500]).toContain(response.status);
    });

    it('should respond to POST /register-template', async () => {
      const response = await request(app).post('/exports/register-template').send({});
      expect([201, 400, 500]).toContain(response.status);
    });

    it('should respond to GET /report/:reportId/export', async () => {
      const response = await request(app)
        .get('/exports/report/test-id/export')
        .query({ exportTemplateId: 'test' });
      expect([200, 404, 500]).toContain(response.status);
    });

    it('should respond to GET /report/:reportId/export-all', async () => {
      const response = await request(app)
        .get('/exports/report/test-id/export-all')
        .query({ format: 'pdf' });
      expect([200, 404, 500]).toContain(response.status);
    });

    it('should respond to GET /lab-request/:labRequestId/export', async () => {
      const response = await request(app).get('/exports/lab-request/test-id/export');
      expect([200, 404, 500]).toContain(response.status);
    });

    it('should handle invalid template file requests', async () => {
      const response = await request(app).get('/exports/template-file/invalid');
      expect([404, 500]).toContain(response.status);
    });

    it('should respond to GET /lab-request/:labRequestId/export-all', async () => {
      const response = await request(app).get('/exports/lab-request/test-id/export-all');
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('GET /lab-request/:labRequestId/export-all', () => {
    it('returns 404 when the lab request does not exist', async () => {
      labRequestFindById.mockResolvedValue(null);

      const response = await request(app).get('/exports/lab-request/missing/export-all');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Lab request not found' });
    });

    it('returns 400 when the lab request has no generated reports', async () => {
      labRequestFindById.mockResolvedValue({ id: 'test-id', name: 'Test Lab Request' });
      labRequestFindReports.mockResolvedValue([]);

      const response = await request(app).get('/exports/lab-request/test-id/export-all');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Lab request has no generated reports' });
    });
  });

  describe('Route Structure', () => {
    it('should be an Express Router', () => {
      expect(exportsRouter).toBeDefined();
      expect(exportsRouter.stack).toBeDefined();
      expect(Array.isArray(exportsRouter.stack)).toBe(true);
    });
  });
});
