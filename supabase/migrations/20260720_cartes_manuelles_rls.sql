-- SEC-04 : Activer RLS sur cartes_manuelles (absente des migrations précédentes)
-- Chaque utilisateur ne peut voir/modifier que ses propres cartes.

ALTER TABLE cartes_manuelles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select own cards"
  ON cartes_manuelles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "insert own cards"
  ON cartes_manuelles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update own cards"
  ON cartes_manuelles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete own cards"
  ON cartes_manuelles FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Les routes API qui utilisent la service_role key contournent RLS
-- et peuvent toujours lire/écrire toutes les cartes (recalc-stats, delete-account, etc.)
