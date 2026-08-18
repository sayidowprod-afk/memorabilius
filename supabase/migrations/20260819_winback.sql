-- Winback : évite de relancer un utilisateur inactif plus d'une fois par mois.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_winback_sent_at TIMESTAMPTZ;
