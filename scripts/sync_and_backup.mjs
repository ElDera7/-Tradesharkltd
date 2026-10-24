import pg from 'pg';
import fs from 'fs';
import path from 'path';

const connectionString = 'postgresql://tradeshark:3JfCebBjDSJ0vf5RaVCSiHjtJbDLNw7m@dpg-dbd4vbl9fdbs73afu9u0-a.oregon-postgres.render.com:5432/tradeshark';
const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log('Connecting to tradeshark-db on Render...');
  
  // 1. Fetch current live Mandy Lim user from onrender file store
  let mandyDoc = null;
  try {
    const adminLogin = await fetch('https://tradeshark.onrender.com/api/auth/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Shark@Admin2025!', remember: true })
    });
    const cookie = adminLogin.headers.get('set-cookie');
    const stateRes = await fetch('https://tradeshark.onrender.com/api/admin/state', {
      headers: { 'Cookie': cookie }
    });
    const state = await stateRes.json();
    mandyDoc = state.users.find(u => u.email.toLowerCase() === 'mandylim713@gmail.com');
  } catch (e) {
    console.warn('Could not fetch from web service, using template', e);
  }

  if (mandyDoc) {
    console.log('Saving Mandy Lim user into Postgres app_documents...');
    await pool.query(
      `INSERT INTO app_documents (collection, id, data) VALUES ($1, $2, $3)
       ON CONFLICT (collection, id) DO UPDATE SET data = $3, updated_at = NOW()`,
      ['users', mandyDoc.id, JSON.stringify(mandyDoc)]
    );
    console.log('Mandy Lim successfully inserted into Postgres!');
  }

  // 2. Export full snapshot of Postgres
  const { rows } = await pool.query('SELECT collection, id, data FROM app_documents ORDER BY collection, id');
  const collections = {};
  for (const r of rows) {
    if (!collections[r.collection]) collections[r.collection] = [];
    collections[r.collection].push(r.data);
  }

  const snapshot = {
    version: 1,
    appName: 'TradeShark',
    exportedAt: new Date().toISOString(),
    mode: 'postgres',
    databaseUrl: 'tradeshark-db (Render Postgres)',
    totalDocuments: rows.length,
    collections,
  };

  // 3. Save to workspace db-backup.json
  const repoBackup = path.resolve('./db-backup.json');
  fs.writeFileSync(repoBackup, JSON.stringify(snapshot, null, 2), 'utf8');
  console.log(`Saved workspace backup to: ${repoBackup}`);

  // 4. Save to Downloads "dwo sites back up" folder
  const backupFolder = 'c:/Users/Prince DWO/Downloads/dwo sites back up';
  if (fs.existsSync(backupFolder)) {
    const archiveFile = path.join(backupFolder, 'tradeshark-db-backup-2026-10-24.json');
    fs.writeFileSync(archiveFile, JSON.stringify(snapshot, null, 2), 'utf8');
    console.log(`Saved archive backup to: ${archiveFile}`);
  }

  console.log('=== SUMMARY OF BACKED UP DATA ===');
  for (const [coll, items] of Object.entries(collections)) {
    console.log(`  - ${coll}: ${items.length} items`);
  }

  await pool.end();
}

run().catch(console.error);
