-- Tables pour la setlist / completion tracker
-- À exécuter dans Supabase SQL Editor

-- Sets (Prizm 2023-24, Chrome 2022-23, etc.)
CREATE TABLE IF NOT EXISTS card_sets (
  id SERIAL PRIMARY KEY,
  tcdb_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  year INTEGER,
  brand TEXT,
  sport TEXT DEFAULT 'nba',
  total_cards INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Checklists (chaque carte d'un set)
CREATE TABLE IF NOT EXISTS card_set_entries (
  id SERIAL PRIMARY KEY,
  set_id INTEGER NOT NULL REFERENCES card_sets(id) ON DELETE CASCADE,
  card_number TEXT,
  player_name TEXT NOT NULL,
  team TEXT,
  variation TEXT,
  is_rc BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Completion utilisateur (carte possédée = auto-match ou check manuel)
CREATE TABLE IF NOT EXISTS user_set_completion (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entry_id INTEGER NOT NULL REFERENCES card_set_entries(id) ON DELETE CASCADE,
  matched_card_key TEXT,      -- URL de la carte dans la galerie (auto-match)
  manually_checked BOOLEAN DEFAULT false,  -- check manuel par l'utilisateur
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, entry_id)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_card_set_entries_set_id ON card_set_entries(set_id);
CREATE INDEX IF NOT EXISTS idx_card_set_entries_player ON card_set_entries(player_name);
CREATE INDEX IF NOT EXISTS idx_user_set_completion_user ON user_set_completion(user_id);
CREATE INDEX IF NOT EXISTS idx_user_set_completion_entry ON user_set_completion(entry_id);
CREATE INDEX IF NOT EXISTS idx_card_sets_sport_year ON card_sets(sport, year);

-- RLS
ALTER TABLE card_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_set_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_set_completion ENABLE ROW LEVEL SECURITY;

-- Lecture publique des sets et checklists
CREATE POLICY "public read sets" ON card_sets FOR SELECT USING (true);
CREATE POLICY "public read entries" ON card_set_entries FOR SELECT USING (true);

-- Completion: lecture publique, écriture seulement par le propriétaire
CREATE POLICY "public read completion" ON user_set_completion FOR SELECT USING (true);
CREATE POLICY "own completion" ON user_set_completion FOR ALL USING (auth.uid() = user_id);

-- Service role peut tout faire (pour le scraper)
CREATE POLICY "service insert sets" ON card_sets FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service insert entries" ON card_set_entries FOR ALL TO service_role USING (true) WITH CHECK (true);
