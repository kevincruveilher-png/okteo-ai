-- Lot 2 (05/11/2026) : mémoire des symboles commune à tous les postes. Créée aussi automatiquement par le Worker
-- (server/worker.js, symbolTable) à la première utilisation : appliquer ce fichier n'est pas obligatoire.
CREATE TABLE IF NOT EXISTS symbol_memory(id TEXT PRIMARY KEY,pav TEXT NOT NULL,pav_key TEXT NOT NULL,type TEXT NOT NULL,descr TEXT NOT NULL,chantier TEXT NOT NULL DEFAULT '',author TEXT NOT NULL,created TEXT NOT NULL,image TEXT NOT NULL DEFAULT '',lu TEXT NOT NULL DEFAULT '',inscription TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS symbol_memory_pav ON symbol_memory(pav_key);
