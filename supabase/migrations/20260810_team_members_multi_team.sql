-- Permet à un utilisateur d'appartenir à plusieurs teams.
-- Supprime toute contrainte UNIQUE portant uniquement sur user_id dans team_members,
-- si elle existe (certaines DB créées avant les migrations pourraient l'avoir).
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'team_members'::regclass
    AND contype = 'u'
    AND cardinality(conkey) = 1
    AND conkey[1] = (
      SELECT attnum FROM pg_attribute
      WHERE attrelid = 'team_members'::regclass AND attname = 'user_id'
    );

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE team_members DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;
