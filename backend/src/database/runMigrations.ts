import 'dotenv/config';
import { createBootstrapDataSource } from './bootstrapDataSource';

async function runMigrations(): Promise<void> {
  const dataSource = createBootstrapDataSource();

  try {
    await dataSource.initialize();
    console.log('Running database bootstrap migrations...');
    await dataSource.runMigrations();
    console.log('Database bootstrap migrations completed successfully');
  } catch (error) {
    console.error('Database bootstrap migration failed:', error);
    process.exit(1);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

void runMigrations();
