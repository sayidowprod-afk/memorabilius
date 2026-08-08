-- Ajout des colonnes de détection de coins au dataset ML
-- À appliquer si training_data existe déjà sans ces colonnes

ALTER TABLE training_data
  ADD COLUMN IF NOT EXISTS gemini_corners   jsonb,
  ADD COLUMN IF NOT EXISTS final_corners    jsonb,
  ADD COLUMN IF NOT EXISTS corners_adjusted boolean NOT NULL DEFAULT false;
