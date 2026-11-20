import { readFile } from 'node:fs/promises';
import pg from 'pg';

export interface Database {
  query(sql: string, parameters?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  transaction<T>(run: (db: Pick<Database, 'query'>) => Promise<T>): Promise<T>;
}

export async function openDatabase(): Promise<Database> {
  if (!process.env.DATABASE_URL) {
    if (process.env.NODE_ENV === 'production') throw new Error('DATABASE_URL is required in production');
    const { PGlite } = await import('@electric-sql/pglite');
    return new PGlite(process.env.DATA_DIR || '.data');
  }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, allowExitOnIdle: true });
  return {
    query: (sql, params) => pool.query(sql, params),
    async transaction(run) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await run({ query: (sql, params) => client.query(sql, params) });
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

export async function migrate(db: Database) {
  const names = ['001_studio.sql', '002_community.sql'];
  const migrations = await Promise.all(names.map(name => readFile(new URL('../migrations/' + name, import.meta.url), 'utf8')));
  await db.transaction(async transaction => {
    await transaction.query('SELECT pg_advisory_xact_lock(19971824)');
    await transaction.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY)');
    for (const [index, name] of names.entries()) {
      const existing = await transaction.query('SELECT name FROM schema_migrations WHERE name = $1', [name]);
      if (existing.rows.length) continue;
      for (const statement of migrations[index].split(';')) {
        if (statement.trim()) await transaction.query(statement);
      }
      await transaction.query('INSERT INTO schema_migrations VALUES ($1)', [name]);
    }
  });
}
