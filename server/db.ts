import fs from 'fs';
import path from 'path';
import pg from 'pg';
import mysql from 'mysql2/promise';
import { config } from './config';

/**
 * Universal document store:
 * - With Railway MySQL (MYSQL_URL / MYSQLHOST): persisted to MySQL (JSON) and files as LONGBLOB.
 * - With Railway Postgres (DATABASE_URL postgres://): persisted to Postgres (JSONB) and files as BYTEA.
 * - Without them: persisted to DATA_DIR/db.json and DATA_DIR/uploads (volume storage).
 * - IN ALL MODES: continuous auto-sync to Git backup file (db-backup.json) so database state is safely tracked in Git!
 */

export type Collection =
  | 'users' | 'admins' | 'transactions' | 'auditLogs' | 'positions' | 'emails'
  | 'copies' | 'tokens' | 'submissions' | 'subscribers' | 'settings' | 'otps' | 'investors';

export const COLLECTIONS: Collection[] = [
  'users', 'admins', 'transactions', 'auditLogs', 'positions', 'emails',
  'copies', 'tokens', 'submissions', 'subscribers', 'settings', 'otps', 'investors'
];

type Doc = { id: string; [k: string]: any };

export interface StoredFile {
  id: string;
  ownerId: string;
  kind: string;
  filename: string;
  mime: string;
  size: number;
  createdAt: string;
}

class Store {
  private cache = new Map<Collection, Map<string, Doc>>();
  private pgPool: pg.Pool | null = null;
  private mysqlPool: mysql.Pool | null = null;
  private jsonPath = '';
  private uploadsDir = '';
  private flushTimer: NodeJS.Timeout | null = null;
  private gitBackupTimer: NodeJS.Timeout | null = null;
  mode: 'mysql' | 'postgres' | 'file' = 'file';

  async init() {
    COLLECTIONS.forEach(c => this.cache.set(c, new Map()));

    if (config.isMySql) {
      this.mode = 'mysql';
      try {
        const poolOptions: any = config.mysqlUrl
          ? { uri: config.mysqlUrl }
          : {
              host: config.mysql.host,
              port: config.mysql.port,
              user: config.mysql.user,
              password: config.mysql.password,
              database: config.mysql.database,
            };
        poolOptions.waitForConnections = true;
        poolOptions.connectionLimit = 10;
        poolOptions.enableKeepAlive = true;

        this.mysqlPool = mysql.createPool(poolOptions);

        await this.mysqlPool.query(`
          CREATE TABLE IF NOT EXISTS app_documents (
            collection VARCHAR(64) NOT NULL,
            id VARCHAR(128) NOT NULL,
            data JSON NOT NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (collection, id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await this.mysqlPool.query(`
          CREATE TABLE IF NOT EXISTS app_files (
            id VARCHAR(128) PRIMARY KEY,
            owner_id VARCHAR(128) NOT NULL,
            kind VARCHAR(64) NOT NULL,
            filename VARCHAR(255) NOT NULL,
            mime VARCHAR(128) NOT NULL,
            size INT NOT NULL,
            data LONGBLOB NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        const [rows]: any = await this.mysqlPool.query('SELECT collection, id, data FROM app_documents');
        let count = 0;
        for (const r of rows) {
          const coll = this.cache.get(r.collection as Collection);
          if (coll) {
            const parsed = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
            coll.set(r.id, parsed);
            count++;
          }
        }

        console.log(`[db] MySQL connected - loaded ${count} documents from database.`);

        // If MySQL database is fresh/empty, attempt auto-restore from Git backup file
        if (count === 0 && this.hasGitBackup()) {
          await this.restoreFromGitBackup();
        }
      } catch (err: any) {
        console.error('[db] MySQL connection failed:', err?.message || err);
        console.warn('[db] Falling back to file storage mode.');
        this.mysqlPool = null;
        this.initFileStore();
      }
    } else if (config.isPostgres && config.databaseUrl) {
      this.mode = 'postgres';
      try {
        const needsSsl = !/localhost|127\.0\.0\.1|\.railway\.internal/.test(config.databaseUrl) && !/sslmode=disable/.test(config.databaseUrl);
        this.pgPool = new pg.Pool({
          connectionString: config.databaseUrl,
          ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
          max: 10,
        });

        // Test connection; retry without SSL if server doesn't support SSL
        try {
          await this.pgPool.query('SELECT 1');
        } catch (connErr: any) {
          if (needsSsl && /does not support SSL/i.test(connErr?.message || '')) {
            console.warn('[db] Postgres does not support SSL, reconnecting without SSL...');
            await this.pgPool.end().catch(() => {});
            this.pgPool = new pg.Pool({
              connectionString: config.databaseUrl,
              ssl: undefined,
              max: 10,
            });
            await this.pgPool.query('SELECT 1');
          } else {
            throw connErr;
          }
        }
        await this.pgPool.query(`
          CREATE TABLE IF NOT EXISTS app_documents (
            collection TEXT NOT NULL,
            id TEXT NOT NULL,
            data JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (collection, id)
          );
          CREATE TABLE IF NOT EXISTS app_files (
            id TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL,
            kind TEXT NOT NULL,
            filename TEXT NOT NULL,
            mime TEXT NOT NULL,
            size INTEGER NOT NULL,
            data BYTEA NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);
        const { rows } = await this.pgPool.query('SELECT collection, id, data FROM app_documents');
        for (const r of rows) {
          const coll = this.cache.get(r.collection as Collection);
          if (coll) coll.set(r.id, r.data);
        }
        console.log(`[db] Postgres connected - loaded ${rows.length} documents.`);

        if (rows.length === 0 && this.hasGitBackup()) {
          await this.restoreFromGitBackup();
        }
      } catch (err: any) {
        console.error('[db] Postgres connection failed:', err?.message || err);
        console.warn('[db] Falling back to file storage mode.');
        this.pgPool = null;
        this.initFileStore();
      }
    } else {
      this.initFileStore();
    }

    // Always ensure initial Git backup file is written
    this.scheduleGitBackupFlush();
  }

  private initFileStore() {
    this.mode = 'file';
    fs.mkdirSync(config.dataDir, { recursive: true });
    this.jsonPath = path.join(config.dataDir, 'db.json');
    this.uploadsDir = path.join(config.dataDir, 'uploads');
    fs.mkdirSync(this.uploadsDir, { recursive: true });

    let loaded = false;
    if (fs.existsSync(this.jsonPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(this.jsonPath, 'utf8'));
        for (const c of COLLECTIONS) {
          for (const d of (raw[c] || []) as Doc[]) this.cache.get(c)!.set(d.id, d);
        }
        loaded = true;
      } catch (e) {
        console.warn('[db] Could not parse existing db.json', e);
      }
    }

    if (!loaded && this.hasGitBackup()) {
      this.restoreFromGitBackupSync();
    }

    console.log(`[db] Using persistent storage at ${path.resolve(this.jsonPath)} (Git backup at ${path.resolve(config.gitBackupPath)})`);
  }

  hasGitBackup(): boolean {
    return fs.existsSync(config.gitBackupPath);
  }

  async restoreFromGitBackup(): Promise<number> {
    if (!this.hasGitBackup()) return 0;
    try {
      const raw = JSON.parse(fs.readFileSync(config.gitBackupPath, 'utf8'));
      const snapshot = raw.collections || raw;
      let count = 0;
      for (const c of COLLECTIONS) {
        const items = snapshot[c];
        if (Array.isArray(items)) {
          for (const item of items) {
            await this.put(c, item);
            count++;
          }
        }
      }
      console.log(`[db] Restored ${count} documents from Git backup file: ${config.gitBackupPath}`);
      return count;
    } catch (err: any) {
      console.error('[db] Failed to restore from Git backup:', err?.message || err);
      return 0;
    }
  }

  private restoreFromGitBackupSync(): number {
    if (!this.hasGitBackup()) return 0;
    try {
      const raw = JSON.parse(fs.readFileSync(config.gitBackupPath, 'utf8'));
      const snapshot = raw.collections || raw;
      let count = 0;
      for (const c of COLLECTIONS) {
        const items = snapshot[c];
        if (Array.isArray(items)) {
          for (const item of items) {
            this.cache.get(c)!.set(item.id, item);
            count++;
          }
        }
      }
      this.flushNow();
      console.log(`[db] Restored ${count} documents into local file store from Git backup.`);
      return count;
    } catch {
      return 0;
    }
  }

  all<T = any>(c: Collection): T[] {
    const map = this.cache?.get(c);
    return map ? Array.from(map.values()) as T[] : [];
  }

  get<T = any>(c: Collection, id: string): T | undefined {
    return this.cache?.get(c)?.get(id) as T | undefined;
  }

  find<T = any>(c: Collection, pred: (d: T) => boolean): T | undefined {
    return this.all<T>(c).find(pred);
  }

  filter<T = any>(c: Collection, pred: (d: T) => boolean): T[] {
    return this.all<T>(c).filter(pred);
  }

  async put<T extends Doc>(c: Collection, doc: T): Promise<T> {
    this.cache.get(c)!.set(doc.id, doc);
    if (this.mysqlPool) {
      await this.mysqlPool.query(
        `INSERT INTO app_documents (collection, id, data) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = CURRENT_TIMESTAMP`,
        [c, doc.id, JSON.stringify(doc)]
      );
    } else if (this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO app_documents (collection, id, data, updated_at) VALUES ($1, $2, $3, NOW())
         ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [c, doc.id, JSON.stringify(doc)]
      );
    } else {
      this.scheduleFlush();
    }
    this.scheduleGitBackupFlush();
    return doc;
  }

  async update<T extends Doc>(c: Collection, id: string, patch: Partial<T>): Promise<T | undefined> {
    const existing = this.get<T>(c, id);
    if (!existing) return undefined;
    return this.put(c, { ...existing, ...patch });
  }

  async remove(c: Collection, id: string) {
    this.cache.get(c)!.delete(id);
    if (this.mysqlPool) {
      await this.mysqlPool.query('DELETE FROM app_documents WHERE collection = ? AND id = ?', [c, id]);
    } else if (this.pgPool) {
      await this.pgPool.query('DELETE FROM app_documents WHERE collection = $1 AND id = $2', [c, id]);
    } else {
      this.scheduleFlush();
    }
    this.scheduleGitBackupFlush();
  }

  // ---------- Files ----------
  async saveFile(meta: Omit<StoredFile, 'createdAt'>, data: Buffer): Promise<StoredFile> {
    const file: StoredFile = { ...meta, createdAt: new Date().toISOString() };
    if (this.mysqlPool) {
      await this.mysqlPool.query(
        'INSERT INTO app_files (id, owner_id, kind, filename, mime, size, data) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [file.id, file.ownerId, file.kind, file.filename, file.mime, file.size, data]
      );
    } else if (this.pgPool) {
      await this.pgPool.query(
        'INSERT INTO app_files (id, owner_id, kind, filename, mime, size, data) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [file.id, file.ownerId, file.kind, file.filename, file.mime, file.size, data]
      );
    } else {
      fs.writeFileSync(path.join(this.uploadsDir, file.id), data);
      fs.writeFileSync(path.join(this.uploadsDir, `${file.id}.json`), JSON.stringify(file));
    }
    return file;
  }

  async getFile(id: string): Promise<{ meta: StoredFile; data: Buffer } | null> {
    if (!/^[A-Za-z0-9_-]+$/.test(id)) return null;
    if (this.mysqlPool) {
      const [rows]: any = await this.mysqlPool.query('SELECT * FROM app_files WHERE id = ?', [id]);
      if (!rows || !rows[0]) return null;
      const r = rows[0];
      return {
        meta: { id: r.id, ownerId: r.owner_id, kind: r.kind, filename: r.filename, mime: r.mime, size: r.size, createdAt: r.created_at },
        data: Buffer.isBuffer(r.data) ? r.data : Buffer.from(r.data),
      };
    }
    if (this.pgPool) {
      const { rows } = await this.pgPool.query('SELECT * FROM app_files WHERE id = $1', [id]);
      if (!rows[0]) return null;
      const r = rows[0];
      return {
        meta: { id: r.id, ownerId: r.owner_id, kind: r.kind, filename: r.filename, mime: r.mime, size: r.size, createdAt: r.created_at },
        data: r.data,
      };
    }
    const p = path.join(this.uploadsDir, id);
    if (!fs.existsSync(p)) return null;
    return { meta: JSON.parse(fs.readFileSync(`${p}.json`, 'utf8')), data: fs.readFileSync(p) };
  }

  async ping(): Promise<boolean> {
    if (this.mysqlPool) {
      try { await this.mysqlPool.query('SELECT 1'); return true; } catch { return false; }
    }
    if (this.pgPool) {
      try { await this.pgPool.query('SELECT 1'); return true; } catch { return false; }
    }
    return true;
  }

  private scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushNow();
    }, 150);
  }

  flushNow() {
    if (this.mode !== 'file' || !this.jsonPath) return;
    const out: Record<string, Doc[]> = {};
    for (const c of COLLECTIONS) out[c] = this.all(c);
    const tmp = `${this.jsonPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(out));
    fs.renameSync(tmp, this.jsonPath);
  }

  // ---------- Continuous Git Repo File Backup ----------
  private scheduleGitBackupFlush() {
    if (this.gitBackupTimer) return;
    this.gitBackupTimer = setTimeout(() => {
      this.gitBackupTimer = null;
      this.syncGitBackupNow();
    }, 1000);
  }

  syncGitBackupNow() {
    try {
      const snapshot = this.exportSnapshot();
      const p = path.resolve(config.gitBackupPath);
      const dir = path.dirname(p);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const tmp = `${p}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(snapshot, null, 2), 'utf8');
      fs.renameSync(tmp, p);
    } catch (e: any) {
      console.error('[db] Error syncing git backup file:', e?.message || e);
    }
  }

  exportSnapshot() {
    const collections: Record<string, Doc[]> = {};
    let totalDocs = 0;
    for (const c of COLLECTIONS) {
      const items = this.all(c);
      collections[c] = items;
      totalDocs += items.length;
    }
    return {
      version: 1,
      appName: config.brand.appName,
      exportedAt: new Date().toISOString(),
      mode: this.mode,
      totalDocuments: totalDocs,
      collections,
    };
  }

  async importSnapshot(data: any): Promise<{ count: number }> {
    const collections = data?.collections || data;
    if (!collections || typeof collections !== 'object') throw new Error('Invalid database snapshot format');
    let count = 0;
    for (const c of COLLECTIONS) {
      const items = collections[c];
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item && item.id) {
            await this.put(c, item);
            count++;
          }
        }
      }
    }
    this.syncGitBackupNow();
    return { count };
  }

  getStats() {
    const counts: Record<string, number> = {};
    let total = 0;
    for (const c of COLLECTIONS) {
      const n = this.cache.get(c)?.size || 0;
      counts[c] = n;
      total += n;
    }
    let gitBackupInfo: any = { exists: false };
    if (fs.existsSync(config.gitBackupPath)) {
      const stat = fs.statSync(config.gitBackupPath);
      gitBackupInfo = {
        exists: true,
        size: stat.size,
        path: config.gitBackupPath,
        updatedAt: stat.mtime.toISOString(),
      };
    }
    return {
      mode: this.mode,
      totalDocuments: total,
      collections: counts,
      gitBackup: gitBackupInfo,
      mysqlUrlConfigured: !!config.mysqlUrl,
      postgresUrlConfigured: !!config.databaseUrl,
    };
  }
}

export const db = new Store();

export const newId = (prefix: string, len = 8) =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 2 + len).toUpperCase()}`;

export const shortNumericId = (prefix: string, existing: (id: string) => boolean) => {
  for (let i = 0; i < 50; i++) {
    const id = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
    if (!existing(id)) return id;
  }
  return newId(prefix);
};

export const nowStamp = (len = 16) => new Date().toISOString().replace('T', ' ').substring(0, len);

