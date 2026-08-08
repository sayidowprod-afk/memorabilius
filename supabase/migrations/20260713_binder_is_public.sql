-- Visibilité des classeurs : is_public = false masque le classeur aux visiteurs.
ALTER TABLE binders ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

-- Met à jour la policy SELECT pour masquer les classeurs privés aux non-propriétaires.
DROP POLICY IF EXISTS "binders_select" ON binders;
CREATE POLICY "binders_select" ON binders FOR SELECT TO authenticated, anon
  USING (is_public = true OR auth.uid() = user_id);
