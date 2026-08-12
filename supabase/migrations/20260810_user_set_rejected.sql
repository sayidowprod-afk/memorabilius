-- Table pour mémoriser les entrées explicitement rejetées par l'utilisateur
-- Le sync auto ne touchera plus ces entrées
CREATE TABLE IF NOT EXISTS user_set_rejected (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id INTEGER NOT NULL REFERENCES card_set_entries(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, entry_id)
);

ALTER TABLE user_set_rejected ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_set_rejected: user owns their rows" ON user_set_rejected
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
