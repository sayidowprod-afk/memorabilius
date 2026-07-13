-- Table pour les abonnements push Web (VAPID).
-- Chaque combinaison user_id + endpoint est unique : un même navigateur/appareil
-- ne doit avoir qu'un seul enregistrement actif.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_user_endpoint_key UNIQUE (user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subscriptions_select" ON push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_insert" ON push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_delete" ON push_subscriptions;

-- Lecture par service-role uniquement (pas de lecture client)
-- Insert/upsert via l'API route (service-role) — pas besoin de policy anon/authenticated ici
-- La gestion se fait entièrement côté serveur (route /api/push-subscribe)
CREATE POLICY "push_subscriptions_own" ON push_subscriptions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
