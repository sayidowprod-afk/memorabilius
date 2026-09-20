// Filet de secours partagé pour les chargements initiaux de page qui peuvent
// rester bloqués indéfiniment (requête réseau qui ne résout ni ne rejette
// jamais -- cold start avec radio/DNS pas stabilisé, WebView native mise en
// arrière-plan, etc.) -- même classe de bug que celle déjà traitée
// individuellement dans AuthContext.tsx, GalerieClient.tsx (fetchFirstBatch)
// et NativeHomeDashboard.tsx. Contrairement à un simple try/catch, ça ne
// suffit PAS pour ce cas précis : une promesse qui ne se règle jamais ne
// déclenche ni le bloc try, ni le catch, ni le finally -- il faut une course
// contre un timer pour forcer la résolution côté UI, même si la requête
// d'origine, elle, reste en suspens.
export function withTimeout<T>(promise: PromiseLike<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
  ])
}
