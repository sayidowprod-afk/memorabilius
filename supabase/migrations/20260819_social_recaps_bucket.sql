-- Bucket public pour héberger l'image du récap hebdo (nécessaire pour
-- l'API Instagram Graph, qui exige une image_url publique et non un upload binaire).
INSERT INTO storage.buckets (id, name, public)
VALUES ('social-recaps', 'social-recaps', true)
ON CONFLICT (id) DO NOTHING;
