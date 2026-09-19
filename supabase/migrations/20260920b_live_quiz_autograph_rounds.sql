-- Round de type 'autograph' (carte du quiz autographes lancee comme manche
-- QCM en direct, sans passer par la tier list) : besoin de stocker l'image +
-- le cadrage de la signature a afficher cote spectateur/overlay, en plus du
-- texte/choix deja existants (reutilises pour les deux types de round).
ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS round_prompt_image JSONB;
