PRAGMA foreign_keys = ON;
CREATE TABLE users(id TEXT PRIMARY KEY, login TEXT NOT NULL UNIQUE COLLATE NOCASE, password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','operator')), active INTEGER NOT NULL DEFAULT 1, ai_enabled INTEGER NOT NULL DEFAULT 1, monthly_limit INTEGER NOT NULL DEFAULT 25000000 CHECK(monthly_limit>=0), vault_key TEXT NOT NULL, must_change INTEGER NOT NULL DEFAULT 1, created TEXT NOT NULL);
CREATE TRIGGER max_admin_insert BEFORE INSERT ON users WHEN NEW.role='admin' AND (SELECT count(*) FROM users WHERE role='admin')>=3 BEGIN SELECT RAISE(ABORT,'Trois administrateurs maximum'); END;
CREATE TRIGGER max_admin_update BEFORE UPDATE OF role ON users WHEN NEW.role='admin' AND OLD.role!='admin' AND (SELECT count(*) FROM users WHERE role='admin')>=3 BEGIN SELECT RAISE(ABORT,'Trois administrateurs maximum'); END;
CREATE TABLE sessions(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE login_attempts(bucket TEXT PRIMARY KEY, count INTEGER NOT NULL);
CREATE TABLE config(id INTEGER PRIMARY KEY CHECK(id=1), monthly_limit INTEGER NOT NULL, concurrent_limit INTEGER NOT NULL, model TEXT NOT NULL, input_price INTEGER NOT NULL, output_price INTEGER NOT NULL);
-- Monetary units: millionths of USD. Prices: USD per million tokens, numerically also micro-USD per token.
INSERT INTO config VALUES(1,50000000,2,'claude-sonnet-5-5',2,10);
CREATE TABLE usage(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),month TEXT NOT NULL,created INTEGER NOT NULL,status TEXT NOT NULL,reserved INTEGER NOT NULL,actual INTEGER,input_tokens INTEGER,output_tokens INTEGER,model TEXT NOT NULL,input_price INTEGER NOT NULL,output_price INTEGER NOT NULL);
CREATE INDEX usage_month ON usage(month,user_id);
CREATE TABLE shared_versions(id INTEGER PRIMARY KEY AUTOINCREMENT,parent INTEGER,author TEXT NOT NULL,created TEXT NOT NULL,data TEXT NOT NULL,note TEXT NOT NULL);
CREATE TABLE proposals(id TEXT PRIMARY KEY,author TEXT NOT NULL,created TEXT NOT NULL,reference TEXT NOT NULL,message TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'ouverte',resolution TEXT NOT NULL DEFAULT '');
CREATE TABLE admin_audit(id INTEGER PRIMARY KEY AUTOINCREMENT,author TEXT NOT NULL,created TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL);
