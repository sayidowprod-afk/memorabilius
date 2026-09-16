#!/usr/bin/env node
// Cree (ou reinitialise le mot de passe d') le compte demo pour les salons
// de cartes -- voir /admin/demo. A executer APRES avoir applique la
// migration supabase/migrations/20260916_demo_account.sql (colonne
// profiles.is_demo), sinon la mise a jour du profil echoue silencieusement
// (colonne inexistante).
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') })
const { createClient } = require('@supabase/supabase-js')

const DEMO_EMAIL = 'demo@memorabilius.fr'
const DEMO_DISPLAY_NAME = 'Demo Memorabilius'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Variables Supabase manquantes (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).')
  process.exit(1)
}
const admin = createClient(url, key)

async function main() {
  const password = require('crypto').randomBytes(24).toString('base64url')

  let userId
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password,
    email_confirm: true,
  })

  if (createErr) {
    if (!/already registered|already exists/i.test(createErr.message || '')) {
      console.error('Erreur creation compte:', createErr.message)
      process.exit(1)
    }
    console.log('Compte demo deja existant, recuperation de son id...')
    const { data: list, error: listErr } = await admin.auth.admin.listUsers()
    if (listErr) { console.error(listErr.message); process.exit(1) }
    const existing = list.users.find(u => u.email === DEMO_EMAIL)
    if (!existing) { console.error('Compte introuvable malgre "already exists".'); process.exit(1) }
    userId = existing.id
  } else {
    userId = created.user.id
    console.log('Compte auth cree:', userId)
  }

  // Le mot de passe reel n'a aucune importance : la connexion se fait
  // exclusivement via le lien magique genere par /api/admin/demo-login.
  // Un mot de passe aleatoire jamais communique evite tout risque qu'il
  // fuite ou soit devine.

  // upsert plutot qu'update : si aucun trigger ne cree la ligne profiles au
  // signup admin (createUser ne passe pas forcement par le meme chemin que
  // l'inscription normale), update() sur une ligne inexistante ne renverrait
  // aucune erreur mais ne ferait rien non plus.
  const { error: profileErr } = await admin
    .from('profiles')
    .upsert({ id: userId, is_demo: true, display_name: DEMO_DISPLAY_NAME })

  if (profileErr) {
    console.error('Erreur mise a jour du profil (la migration is_demo a-t-elle ete appliquee ?):', profileErr.message)
    process.exit(1)
  }

  console.log('Profil demo configure (is_demo=true, display_name="' + DEMO_DISPLAY_NAME + '").')
  console.log('Compte pret. Depuis /admin/demo (connecte en admin), clique "Lancer la demo" sur la tablette.')
}

main()
