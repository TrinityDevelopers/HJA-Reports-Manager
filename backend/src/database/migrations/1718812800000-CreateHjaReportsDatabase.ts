import { MigrationInterface, QueryRunner } from 'typeorm';

function databaseName(): string {
  return process.env.DB_DATABASE || 'hja_reports';
}

function databaseType(): 'mysql' | 'postgres' {
  return (process.env.DB_TYPE as 'mysql' | 'postgres') || 'mysql';
}

function escapeMySqlIdentifier(value: string): string {
  return value.replace(/`/g, '``');
}

function escapePostgresIdentifier(value: string): string {
  return value.replace(/"/g, '""');
}

/**
 * Creates the application database only. Table schemas are managed by TypeORM
 * synchronize when the backend starts (see connection.ts).
 */
export class CreateHjaReportsDatabase1718812800000 implements MigrationInterface {
  name = 'CreateHjaReportsDatabase1718812800000';

  /** PostgreSQL CREATE DATABASE cannot run inside a transaction. */
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dbName = databaseName();

    if (databaseType() === 'postgres') {
      const existing = await queryRunner.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [
        dbName,
      ]);

      if (existing.length === 0) {
        await queryRunner.query(
          `CREATE DATABASE "${escapePostgresIdentifier(dbName)}" ENCODING 'UTF8'`,
        );
      }

      return;
    }

    await queryRunner.query(
      `CREATE DATABASE IF NOT EXISTS \`${escapeMySqlIdentifier(dbName)}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const dbName = databaseName();

    if (databaseType() === 'postgres') {
      await queryRunner.query(
        `
          SELECT pg_terminate_backend(pid)
          FROM pg_stat_activity
          WHERE datname = $1 AND pid <> pg_backend_pid()
        `,
        [dbName],
      );
      await queryRunner.query(`DROP DATABASE IF EXISTS "${escapePostgresIdentifier(dbName)}"`);
      return;
    }

    await queryRunner.query(`DROP DATABASE IF EXISTS \`${escapeMySqlIdentifier(dbName)}\``);
  }
}
