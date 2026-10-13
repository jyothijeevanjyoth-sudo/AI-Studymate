import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Robust SQLite database path resolution across dev (src) and production (dist)
function resolveDefaultDbPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'data/studymate.sqlite'),
    path.resolve(process.cwd(), 'server/data/studymate.sqlite'),
    path.resolve(__dirname, '../../data/studymate.sqlite'),
    path.resolve(__dirname, '../../../../data/studymate.sqlite'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return path.resolve(process.cwd(), 'data/studymate.sqlite');
}

const dbPath = process.env.DATABASE_PATH || resolveDefaultDbPath();
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new DatabaseSync(dbPath);

// Enable WAL mode & foreign keys for performance and data integrity
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function initDatabase(): void {
  const schemaCandidates = [
    path.join(__dirname, 'schema.sql'),
    path.resolve(__dirname, '../../../src/db/schema.sql'),
    path.resolve(process.cwd(), 'server/src/db/schema.sql'),
    path.resolve(process.cwd(), 'src/db/schema.sql'),
  ];
  const schemaPath = schemaCandidates.find(p => fs.existsSync(p)) || schemaCandidates[0];
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
  console.log('[DB] SQLite database initialized at:', dbPath);
}

// Transaction helper
export function transaction<T>(fn: () => T): T {
  db.exec('BEGIN TRANSACTION');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// Helper query functions
export function queryAll<T = any>(sql: string, params: any[] = []): T[] {
  const stmt = db.prepare(sql);
  return stmt.all(...params) as T[];
}

export function queryOne<T = any>(sql: string, params: any[] = []): T | undefined {
  const stmt = db.prepare(sql);
  return stmt.get(...params) as T | undefined;
}

export function execute(sql: string, params: any[] = []): { changes: number | bigint; lastInsertRowid: number | bigint } {
  const stmt = db.prepare(sql);
  return stmt.run(...params);
}
