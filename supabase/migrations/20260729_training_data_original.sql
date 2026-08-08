-- Ajout de la colonne image originale (avant recadrage) pour dataset coins ML
ALTER TABLE training_data
  ADD COLUMN IF NOT EXISTS image_original text;

-- Bucket privé pour stocker les photos originales (avant recadrage)
-- Les coins gemini_corners/final_corners sont dans le référentiel de cette image
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('training-originals', 'training-originals', false, 5242880, ARRAY['image/jpeg'])
ON CONFLICT (id) DO NOTHING;

-- RLS bucket : chaque utilisateur gère ses propres images
CREATE POLICY "upload own training originals"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'training-originals' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "read own training originals"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'training-originals' AND (storage.foldername(name))[1] = auth.uid()::text);
