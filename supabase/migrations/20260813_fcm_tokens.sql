-- Table pour les tokens FCM (notifications push natives Android via Capacitor).
-- Distincte de push_subscriptions (Web Push/VAPID) car le format du token diffère.

CREATE TABLE IF NOT EXISTS fcm_tokens (
  id bigint generated always as identity primary key,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fcm_tokens_user_token_key UNIQUE (user_id, token)
);

ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fcm_tokens_own" ON fcm_tokens;

CREATE POLICY "fcm_tokens_own" ON fcm_tokens
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
