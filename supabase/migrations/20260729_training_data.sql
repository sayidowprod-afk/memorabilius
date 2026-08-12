-- Dataset d'entraînement ML — capture chaque scan avec son image et le résultat validé
-- Différence vs scan_corrections : capture TOUS les scans (confirmés + corrigés), pas seulement les corrections
-- Les images sont déjà dans Supabase Storage via cartes_manuelles — on stocke juste les chemins

CREATE TABLE training_data (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at       timestamptz DEFAULT now(),

  user_id          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  carte_id         uuid        REFERENCES cartes_manuelles(id) ON DELETE SET NULL,

  -- Chemins des images dans Supabase Storage (déjà stockées, pas de duplication)
  image_recto      text,
  image_verso      text,

  -- Prédiction Gemini brute
  gemini_model     text        NOT NULL DEFAULT 'gemini-2.5-flash',
  gemini_output    jsonb       NOT NULL,

  -- Vérité terrain (ce que l'utilisateur a confirmé/corrigé)
  final_output     jsonb       NOT NULL,

  -- Signal qualité identification carte
  corrected        boolean     NOT NULL DEFAULT false,  -- l'utilisateur a-t-il changé quelque chose ?
  corrected_fields text[]      DEFAULT '{}',            -- quels champs ont été corrigés

  -- Coins détectés par detect-corners (fractions 0-1, ordre : tl, tr, br, bl)
  gemini_corners   jsonb,           -- ce que Gemini a prédit (null si Gemini a échoué ou n'a pas tourné)
  final_corners    jsonb,           -- coins finaux après ajustement utilisateur
  corners_adjusted boolean     NOT NULL DEFAULT false,  -- l'utilisateur a-t-il bougé un coin ?

  source           text        DEFAULT 'galerie'        -- 'galerie' | 'scanner'
);

ALTER TABLE training_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insert own training_data"
  ON training_data FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "read own training_data"
  ON training_data FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Index pour export ML (par date, par correction)
CREATE INDEX training_data_created_at_idx ON training_data(created_at DESC);
CREATE INDEX training_data_corrected_idx  ON training_data(corrected);
