import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { CreateHjaReportsDatabase1718812800000 } from './migrations/1718812800000-CreateHjaReportsDatabase';

function databaseType(): 'mysql' | 'postgres' {
  return (process.env.DB_TYPE as 'mysql' | 'postgres') || 'mysql';
}

/**
 * Connects to the database server (not the app database) so bootstrap
 * migrations can create DB_DATABASE when it does not exist yet.
 */
export function createBootstrapDataSource(): DataSource {
  const type = databaseType();
  const defaultPort = type === 'postgres' ? '5432' : '3306';

  return new DataSource({
    type,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || defaultPort, 10),
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD,
    database: type === 'postgres' ? 'postgres' : 'mysql',
    migrations: [CreateHjaReportsDatabase1718812800000],
    migrationsTableName: 'typeorm_migrations_bootstrap',
    migrationsTransactionMode: 'each',
  });
}
