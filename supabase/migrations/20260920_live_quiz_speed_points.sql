-- Points = bonne réponse + rapidité (comme Kahoot) plutôt qu'un simple
-- compteur de bonnes réponses -- voir /api/live-quiz/answer, qui calcule
-- points à l'écriture à partir du temps écoulé depuis round_started_at.
ALTER TABLE quiz_answers ADD COLUMN IF NOT EXISTS response_ms INT;
ALTER TABLE quiz_answers ADD COLUMN IF NOT EXISTS points INT NOT NULL DEFAULT 0;
