-- Image côté site pour chaque entrée de set — visible par tous les visiteurs
ALTER TABLE card_set_entries ADD COLUMN IF NOT EXISTS image_url TEXT;
