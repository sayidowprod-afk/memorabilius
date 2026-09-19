-- Minuteur optionnel par question (NULL = pas de limite, l'animateur garde le
-- contrôle manuel total -- déclenchement et révélation restent TOUJOURS
-- manuels, ce minuteur ferme juste le vote plus tôt si l'animateur le
-- souhaite).
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS duration_seconds INT;
ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS round_duration_seconds INT;
