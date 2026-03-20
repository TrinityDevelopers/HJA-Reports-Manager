import 'reflect-metadata';
import 'dotenv/config';
import express, { Express } from 'express';
import cors from 'cors';
import { initializeDatabase } from './database/init';
import projectRoutes from './routes/projects';
import reportRoutes from './routes/reports';
import templateRoutes from './routes/templates';
import exportRoutes from './routes/exports';

const app: Express = express();
const PORT = parseInt(process.env.PORT || '5000', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// Middleware
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/projects', projectRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/export', exportRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
async function startServer(): Promise<void> {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
