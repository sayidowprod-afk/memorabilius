-- 113 · Wishlist partageable par lien : le jeton vit dans une table à part (jamais lisible depuis le navigateur,
--       sinon n'importe qui pourrait lire les jetons des autres via le profil). Accès uniquement par les routes serveur.
CREATE TABLE IF NOT EXISTS public.wishlist_shares (
  user_id    uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  token      text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wishlist_shares ENABLE ROW LEVEL SECURITY;
-- aucune policy : ni lecture ni écriture depuis le navigateur ; la clé de service (routes API) contourne la RLS
GRANT ALL ON public.wishlist_shares TO service_role;

-- 115 · Répondre à un message en le citant
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to_id integer REFERENCES public.messages(id) ON DELETE SET NULL;
