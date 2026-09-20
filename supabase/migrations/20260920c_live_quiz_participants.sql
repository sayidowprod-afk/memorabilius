-- Suivi de qui a REJOINT une session (pas seulement qui a repondu) -- pour
-- le selecteur "overlays individuels" du panel admin, utilisable des
-- l'arrivee sur le quiz meme avant la toute premiere question.
CREATE TABLE quiz_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL,
  pseudo TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, participant_id)
);

CREATE INDEX quiz_participants_session_idx ON quiz_participants(session_id, joined_at);

ALTER TABLE quiz_participants ENABLE ROW LEVEL SECURITY;
-- Aucune policy, exprès -- ecriture/lecture uniquement via /api/live-quiz/join
-- et /api/admin/live-quiz (cle service role), meme choix que les autres
-- tables quiz_* (voir 20260919_live_quiz.sql).
