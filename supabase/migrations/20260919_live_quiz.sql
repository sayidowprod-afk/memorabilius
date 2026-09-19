-- Quiz interactif en direct (podcast/émission) : une session que l'animateur
-- pilote depuis /admin/live-quiz, les spectateurs rejoignent sans compte via
-- un code court (/quiz/[code]) et votent en temps réel depuis leur téléphone.
-- round_type générique ('qcm' pour l'instant) pour pouvoir brancher d'autres
-- types de manches plus tard (ex: le quiz autographes existant) sans changer
-- le schéma.
CREATE TABLE quiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL DEFAULT 'Quiz en direct',
  status TEXT NOT NULL DEFAULT 'lobby', -- lobby | question | reveal | ended
  round_type TEXT,                      -- 'qcm' pour l'instant
  round_key TEXT,                       -- id de la question active (lie les réponses à CETTE manche)
  round_question TEXT,
  round_choices JSONB,                  -- ["choix A", "choix B", ...]
  round_correct_index INT,              -- jamais renvoyé au public avant status='reveal'
  round_started_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Banque de questions réutilisable, préparée à l'avance par l'animateur.
CREATE TABLE quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  choices JSONB NOT NULL,
  correct_index INT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un spectateur = un participant_id généré côté client (localStorage), pas de
-- compte. Unique par (round_key, participant_id) : un seul vote par manche,
-- un nouveau essai sur le même round_key écrase le précédent (upsert).
CREATE TABLE quiz_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  round_key TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  pseudo TEXT NOT NULL,
  choice_index INT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (round_key, participant_id)
);

CREATE INDEX quiz_questions_session_idx ON quiz_questions(session_id, position);
CREATE INDEX quiz_answers_round_idx ON quiz_answers(round_key);

ALTER TABLE quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;

-- Volontairement AUCUNE policy (RLS activé + aucune policy = accès refusé à
-- la clé anonyme, y compris en lecture). round_correct_index est une donnée
-- sensible tant que status != 'reveal' -- si on l'exposait en lecture directe
-- (même juste pour les colonnes "affichées"), Realtime/PostgREST renvoient la
-- ligne complète, donc un spectateur inspectant le réseau verrait la bonne
-- réponse avant l'animateur. Tout passe par les routes /api/live-quiz*
-- (service role, qui bypass RLS) : elles seules décident ce qui est visible
-- selon l'état de la session. La page spectateur fait du polling léger sur
-- ces routes plutôt que du Realtime direct sur ces tables.
