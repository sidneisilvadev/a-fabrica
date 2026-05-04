import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'factory.db');
const db = new Database(dbPath);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS factory_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    industry TEXT,
    mission TEXT,
    soul_model TEXT NOT NULL,
    api_key TEXT,
    base_url TEXT,
    production_path TEXT,
    hiring_mode TEXT DEFAULT 'auto', -- 'auto' or 'manual'
    ceo_name TEXT,
    ceo_bio TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    expertise TEXT,
    personality TEXT,
    soul_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(soul_id) REFERENCES factory_config(id)
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    is_processing INTEGER DEFAULT 0,
    factory_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(factory_id) REFERENCES factory_config(id)
  );

  CREATE TABLE IF NOT EXISTS production_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    agent_id INTEGER,
    to_agent_id INTEGER, -- NULL means public/thought, otherwise specific recipient
    message TEXT,
    type TEXT, -- 'thought', 'speak', 'action', 'email_to_user', 'email_to_agent'
    metadata TEXT, -- JSON for attachments, image links, etc.
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id),
    FOREIGN KEY(agent_id) REFERENCES agents(id),
    FOREIGN KEY(to_agent_id) REFERENCES agents(id)
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed'
    priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
    assigned_to INTEGER, -- agent_id
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id),
    FOREIGN KEY(assigned_to) REFERENCES agents(id)
  );
`);

// Migrations
try {
  db.exec("ALTER TABLE projects ADD COLUMN is_processing INTEGER DEFAULT 0");
} catch (e) {}

try {
  db.exec("ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT 'medium'");
} catch (e) {}

try {
  db.exec("ALTER TABLE production_logs ADD COLUMN to_agent_id INTEGER");
} catch (e) {}

try {
  db.exec("ALTER TABLE production_logs ADD COLUMN metadata TEXT");
} catch (e) {}

try {
  db.exec("ALTER TABLE production_logs ADD COLUMN is_read INTEGER DEFAULT 0");
} catch (e) {}

export default db;
