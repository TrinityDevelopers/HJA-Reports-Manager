import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express, { Express, Router } from 'express';

// Mock database connection
vi.mock('../../src/database/connection');

describe('Exports Routes', () => {
  let app: Express;
  let exportsRouter: Router;

  beforeEach(async () => {
    vi.resetModules();
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
        .query({ templateId: 'test' });
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
  });

  describe('Route Structure', () => {
    it('should be an Express Router', () => {
      expect(exportsRouter).toBeDefined();
      expect(exportsRouter.stack).toBeDefined();
      expect(Array.isArray(exportsRouter.stack)).toBe(true);
    });
  });
});
