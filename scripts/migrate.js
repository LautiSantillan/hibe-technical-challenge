const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();
const dbFile = process.env.DATABASE_FILE || './data/hibe.db';
const migrationsDir = path.join(__dirname, '..', 'migrations');
fs.mkdirSync(path.dirname(dbFile), { recursive: true });
const db = new sqlite3.Database(dbFile);
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
for (const f of files) {
  const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
  console.log('Running', f);
  db.exec(sql);
}
db.close();
console.log('Migrations applied successfully to', dbFile);
