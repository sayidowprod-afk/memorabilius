-- Icône d'un dossier de classeurs : soit un emoji (ex "🔥"), soit un logo
-- d'équipe encodé "team:<id>" (ex "team:nba:LAL"). NULL = dossier par défaut (📁).
ALTER TABLE binder_folders ADD COLUMN IF NOT EXISTS icon text;
