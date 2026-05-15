const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'carteira.db');
let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS system_budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      total_budget INTEGER NOT NULL,
      used_budget INTEGER NOT NULL DEFAULT 0,
      created_by_admin_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      nfc_token TEXT UNIQUE NOT NULL,
      points INTEGER NOT NULL DEFAULT 1,
      budget INTEGER,
      spent INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      system_budget_id INTEGER REFERENCES system_budgets(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      campaign_id INTEGER NOT NULL,
      points INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, campaign_id),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      campaign_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrações seguras
  try { db.exec('ALTER TABLE campaigns ADD COLUMN system_budget_id INTEGER REFERENCES system_budgets(id)'); } catch {}
  try { db.exec('ALTER TABLE campaigns ADD COLUMN action_key TEXT'); } catch {}
  try { db.exec('ALTER TABLE campaigns ADD COLUMN allow_multiple INTEGER DEFAULT 0'); } catch {}
  try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_campaigns_action_key ON campaigns(action_key) WHERE action_key IS NOT NULL'); } catch {}

  require('../../../../shared/users-db').getUsersDb();
  console.log('✅ Banco Carteira Junina inicializado');
  return db;
}

function getBalance(userId) {
  const db = getDb();
  const row = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ?').get(userId);
  return row?.total || 0;
}

module.exports = { getDb, initDb, getBalance };
