-- Accumulation des corrections utilisateur pour futur entraînement ML
-- Stocke la prédiction Gemini vs ce que l'utilisateur a finalement sauvegardé

CREATE TABLE scan_corrections (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),
  gemini_output   jsonb       NOT NULL,  -- ce que Gemini a prédit
  final_output    jsonb       NOT NULL,  -- ce que l'utilisateur a validé/corrigé
  corrected_fields text[]     DEFAULT '{}',  -- champs qui ont été modifiés
  source          text        DEFAULT 'galerie'  -- 'galerie' | 'scanner'
);

ALTER TABLE scan_corrections ENABLE ROW LEVEL SECURITY;

-- Chaque utilisateur peut insérer ses propres corrections
CREATE POLICY "insert own corrections"
  ON scan_corrections FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Les corrections ne sont lisibles que par leur auteur (données perso)
CREATE POLICY "read own corrections"
  ON scan_corrections FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
