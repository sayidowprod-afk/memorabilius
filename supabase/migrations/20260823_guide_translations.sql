-- Traductions auto-generees (IA) des guides, une ligne par (guide, langue).
-- Le francais reste la langue source stockee sur `guides` elle-meme ; EN/DE
-- vivent ici et sont regenerees a la demande depuis l'admin, pas synchronisees
-- automatiquement a chaque modification du guide source.
create table if not exists guide_translations (
  id bigserial primary key,
  guide_id bigint not null references guides(id) on delete cascade,
  lang text not null check (lang in ('en', 'de')),
  title text not null,
  excerpt text,
  cover_image text,
  blocks jsonb not null,
  translated_at timestamptz not null default now(),
  unique (guide_id, lang)
);

alter table guide_translations enable row level security;

-- Lecture publique : la page /{lang}/guides/{slug} doit pouvoir servir la
-- traduction a un visiteur anonyme. Les ecritures passent uniquement par
-- l'API admin (service role), pas de policy insert/update necessaire.
create policy "guide_translations_public_read" on guide_translations
  for select using (true);
