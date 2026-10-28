import { createServerServiceClient } from '@/lib/supabaseServer'

// Accès à la marketplace (bêta privée) -- côté SERVEUR uniquement : la liste des adresses
// autorisées ne part jamais dans le code envoyé aux navigateurs. Surchargeable via la
// variable d'environnement MARKETPLACE_ALLOWED_EMAILS (adresses séparées par des virgules).
const ALLOWED = (process.env.MARKETPLACE_ALLOWED_EMAILS || 'killianbajoni@hotmail.com')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)

const supabase = createServerServiceClient()

// Renvoie l'utilisateur si le jeton est valide ET son adresse est autorisée, sinon null.
export async function getMarketplaceUser(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await supabase.auth.getUser(token)
  const email = user?.email?.toLowerCase()
  if (!user || !email || !ALLOWED.includes(email)) return null
  return user
}
