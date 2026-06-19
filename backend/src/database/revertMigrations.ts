import 'dotenv/config';
import { createBootstrapDataSource } from './bootstrapDataSource';

async function revertMigrations(): Promise<void> {
  const dataSource = createBootstrapDataSource();

  try {
    await dataSource.initialize();
    console.log('Reverting last database bootstrap migration...');
    await dataSource.undoLastMigration();
    console.log('Database bootstrap migration reverted successfully');
  } catch (error) {
    console.error('Database bootstrap migration revert failed:', error);
    process.exit(1);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

void revertMigrations();
