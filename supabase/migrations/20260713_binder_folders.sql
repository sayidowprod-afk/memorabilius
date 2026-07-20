-- Sous-bibliothèques : dossiers regroupant des classeurs.
-- Un classeur peut être rangé dans un dossier (folder_id NULL = à la racine).

CREATE TABLE IF NOT EXISTS binder_folders (
  id bigint generated always as identity primary key,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE binder_folders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "binder_folders_select" ON binder_folders;
DROP POLICY IF EXISTS "binder_folders_insert" ON binder_folders;
DROP POLICY IF EXISTS "binder_folders_update" ON binder_folders;
DROP POLICY IF EXISTS "binder_folders_delete" ON binder_folders;
CREATE POLICY "binder_folders_select" ON binder_folders FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "binder_folders_insert" ON binder_folders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "binder_folders_update" ON binder_folders FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "binder_folders_delete" ON binder_folders FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Le classeur référence son dossier (ON DELETE SET NULL : supprimer un dossier
-- ne supprime pas les classeurs, ils repassent à la racine)
ALTER TABLE binders ADD COLUMN IF NOT EXISTS folder_id bigint REFERENCES binder_folders(id) ON DELETE SET NULL;
