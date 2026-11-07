// Freinage simple des routes publiques (meilleur effort : la mémoire est propre à chaque instance du serveur, donc ce n'est
// pas une garantie absolue, mais cela coupe court aux boucles et aux abus ordinaires venant d'une même adresse).
const buckets = new Map<string, { n: number; reset: number }>()

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  return (fwd?.split(',')[0] || req.headers.get('x-real-ip') || 'inconnue').trim()
}

// Vrai si l'adresse a dépassé `max` appels en `windowMs` pour cette clé.
export function rateLimited(req: Request, key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k)
  const k = `${key}:${clientIp(req)}`
  const b = buckets.get(k)
  if (!b || b.reset < now) { buckets.set(k, { n: 1, reset: now + windowMs }); return false }
  b.n++
  return b.n > max
}
