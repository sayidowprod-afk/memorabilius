// Traductions des notifications push envoyées côté serveur (crons, routes
// API) — fichier plat sans dépendance React, utilisable hors du rendu client.
// La langue du destinataire vient de profiles.preferred_lang, synchronisée
// depuis LangContext.tsx à chaque changement de langue côté client.
export type PushLang = 'fr' | 'en' | 'de'

export function normalizePushLang(lang: unknown): PushLang {
  return lang === 'en' || lang === 'de' ? lang : 'fr'
}

export function genericCollectorName(lang: PushLang): string {
  return { fr: 'Un collectionneur', en: 'A collector', de: 'Ein Sammler' }[lang]
}

export function someoneNameFallback(lang: PushLang): string {
  return { fr: 'Quelqu\'un', en: 'Someone', de: 'Jemand' }[lang]
}

export function teamJoinRequestPush(lang: PushLang, candidateName: string, teamName: string) {
  return {
    title: { fr: '👥 Nouvelle candidature', en: '👥 New request', de: '👥 Neue Anfrage' }[lang],
    body: {
      fr: `${candidateName} souhaite rejoindre ${teamName}`,
      en: `${candidateName} wants to join ${teamName}`,
      de: `${candidateName} möchte ${teamName} beitreten`,
    }[lang],
  }
}

export function tradeOfferPush(lang: PushLang, senderName: string) {
  return {
    title: { fr: "🔄 Nouvelle offre d'échange", en: '🔄 New trade offer', de: '🔄 Neues Tauschangebot' }[lang],
    body: {
      fr: `${senderName} te propose un échange`,
      en: `${senderName} sent you a trade offer`,
      de: `${senderName} hat dir ein Tauschangebot gemacht`,
    }[lang],
  }
}

export function tradeResponsePush(lang: PushLang, action: 'accept' | 'refuse' | 'cancel', actorName: string) {
  const bodies = {
    accept: { fr: `${actorName} a accepté ton offre d'échange ! 🎉`, en: `${actorName} accepted your trade offer! 🎉`, de: `${actorName} hat dein Tauschangebot angenommen! 🎉` },
    refuse: { fr: `${actorName} a refusé ton offre d'échange`, en: `${actorName} declined your trade offer`, de: `${actorName} hat dein Tauschangebot abgelehnt` },
    cancel: { fr: `${actorName} a annulé son offre d'échange`, en: `${actorName} cancelled their trade offer`, de: `${actorName} hat sein Tauschangebot storniert` },
  }
  const titles = {
    accept: { fr: '🎉 Échange accepté !', en: '🎉 Trade accepted!', de: '🎉 Tausch angenommen!' },
    refuse: { fr: '❌ Échange refusé', en: '❌ Trade declined', de: '❌ Tausch abgelehnt' },
    cancel: { fr: '↩️ Échange annulé', en: '↩️ Trade cancelled', de: '↩️ Tausch storniert' },
  }
  return { title: titles[action][lang], body: bodies[action][lang] }
}

export function likeReceivedPush(lang: PushLang, likerName: string) {
  return {
    title: { fr: '❤️ Nouveau like', en: '❤️ New like', de: '❤️ Neuer Like' }[lang],
    body: { fr: `${likerName} a aimé votre carte`, en: `${likerName} liked your card`, de: `${likerName} hat deine Karte geliked` }[lang],
  }
}

function yearSuffix(year?: string) { return year ? ` ${year}` : '' }

export function wishlistMatchFoundPush(lang: PushLang, ownerName: string, cardName: string, year?: string) {
  const y = yearSuffix(year)
  return {
    title: { fr: '🎯 Wishlist Match', en: '🎯 Wishlist Match', de: '🎯 Wunschlisten-Treffer' }[lang],
    body: {
      fr: `${ownerName} recherche une carte que vous possédez : ${cardName}${y}`,
      en: `${ownerName} is looking for a card you own: ${cardName}${y}`,
      de: `${ownerName} sucht eine Karte, die du besitzt: ${cardName}${y}`,
    }[lang],
  }
}

export function wishlistCardAddedPush(lang: PushLang, ownerName: string, cardName: string, year?: string) {
  const y = yearSuffix(year)
  return {
    title: { fr: '🎯 Wishlist Match', en: '🎯 Wishlist Match', de: '🎯 Wunschlisten-Treffer' }[lang],
    body: {
      fr: `${ownerName} vient d'ajouter une carte de votre wishlist : ${cardName}${y}`,
      en: `${ownerName} just added a card from your wishlist: ${cardName}${y}`,
      de: `${ownerName} hat gerade eine Karte von deiner Wunschliste hinzugefügt: ${cardName}${y}`,
    }[lang],
  }
}

export function commentReceivedTitle(lang: PushLang): string {
  return { fr: '💬 Nouveau commentaire', en: '💬 New comment', de: '💬 Neuer Kommentar' }[lang]
}

export function messageReceivedPush(lang: PushLang, senderName: string | null) {
  const fallback = { fr: 'Nouveau message', en: 'New message', de: 'Neue Nachricht' }[lang]
  return {
    title: `💬 ${senderName || fallback}`,
    body: { fr: 'Vous avez reçu un message sur Memorabilius', en: 'You received a message on Memorabilius', de: 'Du hast eine Nachricht auf Memorabilius erhalten' }[lang],
  }
}

export function popularityDigestPush(lang: PushLang, views: number, likes: number) {
  const parts: string[] = []
  if (views) parts.push({ fr: `vue ${views} fois`, en: `viewed ${views} times`, de: `${views} Mal angesehen` }[lang])
  if (likes) {
    const likeWord = likes > 1
      ? { fr: 'likes reçus', en: 'likes received', de: 'erhaltene Likes' }[lang]
      : { fr: 'like reçu', en: 'like received', de: 'erhaltener Like' }[lang]
    parts.push(`${likes} ${likeWord}`)
  }
  const joiner = { fr: ' et ', en: ' and ', de: ' und ' }[lang]
  return {
    title: { fr: '👀 Ta semaine sur Memorabilius', en: '👀 Your week on Memorabilius', de: '👀 Deine Woche auf Memorabilius' }[lang],
    body: {
      fr: `Ta galerie a été ${parts.join(joiner)} cette semaine`,
      en: `Your gallery was ${parts.join(joiner)} this week`,
      de: `Deine Galerie wurde diese Woche ${parts.join(joiner)}`,
    }[lang],
  }
}

export function streakWarningPush(lang: PushLang, streak: number) {
  return {
    title: { fr: '🔥 Ta série est en danger !', en: '🔥 Your streak is at risk!', de: '🔥 Deine Serie ist in Gefahr!' }[lang],
    body: {
      fr: `Ta série de ${streak} jour${streak > 1 ? 's' : ''} s'arrête ce soir — ajoute une carte avant minuit`,
      en: `Your ${streak}-day streak ends tonight — add a card before midnight`,
      de: `Deine Serie von ${streak} Tagen endet heute Abend — füge vor Mitternacht eine Karte hinzu`,
    }[lang],
  }
}

export function winbackPush(lang: PushLang) {
  return {
    title: { fr: '👋 Ça fait un moment !', en: "👋 It's been a while!", de: '👋 Es ist eine Weile her!' }[lang],
    body: {
      fr: 'Niveaux, streaks, défis hebdo, suivi de collectionneurs… pas mal de choses ont changé depuis ta dernière visite. Reviens voir ta collection !',
      en: 'Levels, streaks, weekly challenges, following collectors… quite a bit has changed since your last visit. Come check out your collection!',
      de: 'Level, Serien, wöchentliche Herausforderungen, Sammlern folgen … es hat sich einiges seit deinem letzten Besuch getan. Schau dir deine Sammlung an!',
    }[lang],
  }
}
