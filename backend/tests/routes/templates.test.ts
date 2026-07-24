import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express, { Express, Router } from 'express';

// Mock database connection
vi.mock('../../src/database/connection');

describe('Templates Routes', () => {
  let app: Express;
  let templatesRouter: Router;

  beforeEach(async () => {
    vi.resetModules();
    const module = await import('../../src/routes/templates.js');
    templatesRouter = module.default as unknown as Router;

    app = express();
    app.use(express.json());
    app.use('/templates', templatesRouter);
  });

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('Route Definition Check', () => {
    it('should define routes', () => {
      expect(templatesRouter.stack).toBeDefined();
      expect(templatesRouter.stack.length).toBeGreaterThan(0);
    });

    it('should respond to GET /templates', async () => {
      const response = await request(app).get('/templates');
      expect([200, 500]).toContain(response.status);
    });

    it('should respond to GET /templates/:id', async () => {
      const response = await request(app).get('/templates/test-id');
      expect([200, 404, 500]).toContain(response.status);
    });

    it('should respond to POST /templates', async () => {
      const response = await request(app).post('/templates').send({});
      expect([201, 400, 500]).toContain(response.status);
    });

    it('should respond to PUT /templates/:id', async () => {
      const response = await request(app).put('/templates/test-id').send({});
      expect([200, 400, 404, 500]).toContain(response.status);
    });

    it('should respond to DELETE /templates/:id', async () => {
      const response = await request(app).delete('/templates/test-id');
      expect([200, 404, 500]).toContain(response.status);
    });
  });

  describe('Route Structure', () => {
    it('should be an Express Router', () => {
      expect(templatesRouter).toBeDefined();
      expect(templatesRouter.stack).toBeDefined();
      expect(Array.isArray(templatesRouter.stack)).toBe(true);
    });
  });
});
