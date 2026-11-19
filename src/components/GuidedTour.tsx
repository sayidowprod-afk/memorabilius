'use client'
// Tutos guidés : un menu de petits tutos (importer sa première carte, trades, setlists, galerie, jeux). Chaque tuto emmène sur la bonne page et met en lumière
// la zone expliquée, avec une carte d'explication courte (en haut ou en bas selon la zone, pensé pour le téléphone). L'avancement survit au changement de page.
// Ouvert au premier passage, puis avec le bouton « Visite guidée » de l'accueil (ou ?tour=1).
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'
import { TOUR_STEPS, TOUR_HUB, TOUR_CTA, TOUR_UI, type TLang } from '@/lib/tourI18n'

const DONE = 'tour_hub_v2', RUN = 'tour_run_v2'
type T2 = [string, string]
type Step = { path?: string; sel?: string; optional?: boolean; click?: string; wait?: 'pc' | 'nav'; icon: string; fr: T2; en: T2; cta?: { fr: string; en: string; to: string } }
type Tour = { id: string; icon: string; fr: T2; en: T2; steps: Step[] }

const TOURS: Tour[] = [
  { id: 'onboarding', icon: '🚀', fr: ['Visite complète pour débuter', 'Accueil, galerie, première carte : pas à pas'], en: ['Full start-up tour', 'Home, gallery, first card: step by step'], steps: [
    { path: '/', icon: '👋', fr: ['Bienvenue sur Memorabilius !', 'Ta collection, tes échanges et des jeux, au même endroit. On te montre l’essentiel en 2 minutes, puis on ajoute ensemble ta première carte.'], en: ['Welcome to Memorabilius!', 'Your collection, trades and games in one place. We’ll show you the essentials in 2 minutes, then add your first card together.'] },
    { path: '/', sel: '.dd-hero', icon: '🖼️', fr: ['L’accueil', 'En haut, le total de tes cartes et les dernières ajoutées. Au début, il est vide : on va le remplir.'], en: ['Home', 'At the top: your card total and latest additions. It’s empty for now: we’ll fill it.'] },
    { path: '/', sel: '.dd-actions', icon: '⚡', fr: ['Tes raccourcis', 'Scanner un prix, ajouter une carte, tes échanges… Tu choisis lesquels s’affichent.'], en: ['Your shortcuts', 'Scan a price, add a card, your trades… You choose which ones appear.'] },
    { path: '/', sel: '.hd-row', icon: '🎴', fr: ['Les jeux', 'La carte du jour à gratter, et un pack gratuit toutes les heures. Reviens souvent !'], en: ['Games', 'A scratch card every day, and a free pack every hour. Come back often!'] },
    { path: '/', sel: '.mobile-bottom-nav-bar', optional: true, icon: '🧭', fr: ['Le menu du bas', 'Communauté (annuaire, équipes, échanges), ta galerie au centre, et les Outils (scanner, setlists, guides).'], en: ['The bottom menu', 'Community (directory, teams, trades), your gallery in the middle, and Tools (scanner, setlists, guides).'] },
    { path: '/', sel: '.dd-hero', wait: 'nav', icon: '👉', fr: ['À toi : ouvre ta galerie', 'Touche la grande bannière « Ma galerie ». C’est là que vivent toutes tes cartes. Je continue dès que tu y es.'], en: ['Your turn: open your gallery', 'Tap the big “My gallery” banner. This is where all your cards live. I’ll continue as soon as you’re there.'] },
    { path: '/galerie/{uid}', sel: '.da-profile', icon: '🖼️', fr: ['Ta galerie', 'Ton profil de collectionneur : ton nom, tes abonnés et tes chiffres. Les autres membres voient cette page.'], en: ['Your gallery', 'Your collector profile: your name, followers and numbers. Other members see this page.'] },
    { path: '/galerie/{uid}', sel: '.header-stats-block', icon: '🔢', fr: ['Tes chiffres', 'Total de cartes, rookies (RC), signées (Auto), patchs et cartes numérotées : ils se remplissent tout seuls.'], en: ['Your numbers', 'Total cards, rookies (RC), autographs (Auto), patches and numbered cards: they fill in by themselves.'] },
    { path: '/galerie/{uid}', sel: '.da-tabs', icon: '🗂️', fr: ['Les onglets', 'Collection : toutes tes cartes. Classeurs, Objectifs (tes PC, ta wishlist), Badges, Commentaires, cartes aimées.'], en: ['Tabs', 'Collection: all your cards. Binders, Goals (your PCs, wishlist), Badges, Comments, liked cards.'] },
    { path: '/galerie/{uid}', click: 'btn:Objectifs', sel: 'btn:Objectifs', icon: '⭐', fr: ['D’abord : ta PC', 'Une PC (collection personnelle), c’est ce que tu collectionnes en priorité : un joueur, une équipe ou une collection. On commence par la tienne.'], en: ['First: your PC', 'A PC (personal collection) is what you collect first: a player, a team or a set. Let’s start with yours.'] },
    { path: '/galerie/{uid}', click: 'btn:Objectifs', sel: 'btn:+ Ajouter||txt:Aucun PC suivi', wait: 'pc', icon: '➕', fr: ['À toi : ajoute ta première PC', 'Touche « + Ajouter », cherche un joueur (ou une équipe, une collection), puis touche son nom. Je continue dès que ta PC est ajoutée.'], en: ['Your turn: add your first PC', 'Tap “+ Add”, search a player (or team, or set), then tap the name. I’ll continue as soon as your PC is added.'] },
    { path: '/galerie/{uid}', click: 'btn:Collection', sel: 'text:+ ajouter||.galerie-actions', wait: 'nav', icon: '👉', fr: ['À toi : ajoute une carte', 'Touche « + Ajouter » pour commencer. Je te guide sur la page suivante.'], en: ['Your turn: add a card', 'Tap “+ Add” to begin. I’ll guide you on the next page.'] },
    { path: '/galerie/{uid}/ajouter', icon: '📷', fr: ['Ajouter ta première carte', 'Tu y es ! En quelques gestes, ta carte est dans ta galerie. On regarde chaque zone, dans l’ordre.'], en: ['Add your first card', 'You’re here! In a few taps your card is in your gallery. We’ll go through each area in order.'] },
    { path: '/galerie/{uid}/ajouter', sel: 'parent:#upload-recto', icon: '📸', fr: ['1. La photo du recto', 'Touche ici pour prendre une photo ou choisir une image. La carte est recadrée toute seule : pose-la à plat, sur un fond uni.'], en: ['1. Front photo', 'Tap here to take a photo or pick an image. The card is cropped automatically: lay it flat on a plain background.'] },
    { path: '/galerie/{uid}/ajouter', sel: 'parent:#upload-verso', icon: '🔄', fr: ['2. Le verso', 'Avec les deux faces, l’IA remplit les champs pour toi. Pas de verso ? Un bouton te laisse analyser le recto seul.'], en: ['2. Back photo', 'With both sides, the AI fills the fields for you. No back? A button lets you analyse the front only.'] },
    { path: '/galerie/{uid}/ajouter', sel: 'form input[required]', icon: '✍️', fr: ['3. Vérifie les infos', 'Le nom du joueur est obligatoire. Vérifie aussi l’équipe, l’année et la marque.'], en: ['3. Check the details', 'The player name is required. Also check team, year and brand.'] },
    { path: '/galerie/{uid}/ajouter', sel: 'button[type="submit"]', icon: '✅', fr: ['4. Enregistre', 'Touche « Enregistrer » : ta première carte est dans ta galerie. Bravo, tu es lancé !'], en: ['4. Save', 'Tap “Save”: your first card is in your gallery. Well done, you’re off!'] },
  ] },
  { id: 'card', icon: '📷', fr: ['Importer ma première carte', 'Ajoute une carte en 1 minute'], en: ['Add my first card', 'Add a card in one minute'], steps: [
    { path: '/galerie/{uid}/ajouter', icon: '📷', fr: ['Ajouter une carte', 'Tu es sur la page d’ajout. En quelques gestes, ta carte est dans ta galerie, avec ses infos. On regarde chaque zone, dans l’ordre.'], en: ['Add a card', 'You’re on the add page. In a few taps your card is in your gallery with its details. We’ll go through each area in order.'] },
    { path: '/galerie/{uid}/ajouter', sel: 'lbl:Format', icon: '📐', fr: ['1. Le format', 'Choisis d’abord le format de ta carte (standard, mini, grande, booklet…) : le cadrage de la photo s’adapte à sa forme.'], en: ['1. Format', 'First pick your card’s format (standard, mini, large, booklet…): the photo frame adapts to its shape.'] },
    { path: '/galerie/{uid}/ajouter', sel: 'parent:#upload-recto', icon: '📸', fr: ['2. La photo du recto', 'Touche ici pour prendre une photo avec l’appareil, ou choisir une image de ton téléphone. La carte est recadrée toute seule : pose-la bien à plat, sur un fond uni.'], en: ['2. Front photo', 'Tap here to take a photo or pick one from your phone. The card is cropped automatically: lay it flat on a plain background.'] },
    { path: '/galerie/{uid}/ajouter', sel: 'parent:#upload-verso', icon: '🔄', fr: ['3. Le verso', 'Ajoute aussi le verso : l’IA lit alors les deux faces et remplit les champs pour toi (joueur, année, marque…). Pas de verso ? Un bouton te laisse analyser le recto seul.'], en: ['3. Back photo', 'Add the back too: the AI then reads both sides and fills the fields for you (player, year, brand…). No back? A button lets you analyse the front only.'] },
    { path: '/galerie/{uid}/ajouter', sel: 'form input[required]', icon: '✍️', fr: ['4. Vérifie les infos', 'Le nom du joueur est obligatoire. Vérifie aussi l’équipe, l’année et la marque : c’est ce qui permet de retrouver ta carte dans les setlists.'], en: ['4. Check the details', 'The player name is required. Also check team, year and brand: this is what lets your card match in setlists.'] },
    { path: '/galerie/{uid}/ajouter', sel: 'lbl:Variation', icon: '🏷️', fr: ['5. Ce qui rend ta carte spéciale', 'Collection, variation (couleur, parallèle…), numérotation (/25), patch, signature, grade… Plus c’est précis, mieux ta carte est valorisée et retrouvée.'], en: ['5. What makes it special', 'Collection, variation (colour, parallel…), numbering (/25), patch, autograph, grade… The more precise, the better it is valued and found.'] },
    { path: '/galerie/{uid}/ajouter', sel: 'parent:#qte', icon: '🔁', fr: ['6. À vendre ou à échanger ?', 'Active « disponible à la vente / échange » pour que la carte apparaisse dans les trades, et indique le nombre d’exemplaires.'], en: ['6. For sale or trade?', 'Turn on “available for sale / trade” so the card shows up in Trades, and set how many copies you have.'] },
    { path: '/galerie/{uid}/ajouter', sel: 'button[type="submit"]', icon: '✅', fr: ['7. Enregistre', 'C’est tout ! Après l’enregistrement, la carte est dans ta galerie.'], en: ['7. Save', 'That’s it! After saving, the card is in your gallery.'] },
    { path: '/galerie/{uid}/ajouter', sel: '.da-lot-entry', optional: true, icon: '📚', fr: ['Beaucoup de cartes ?', 'Pour une pile entière, utilise « Ajouter plusieurs cartes d’un coup » : recto et verso, par lot. Bien plus rapide.'], en: ['Lots of cards?', 'For a whole stack, use “Add several cards at once”: front and back, in batches. Much faster.'], cta: { fr: 'Voir ma galerie', en: 'See my gallery', to: '/galerie/{uid}' } },
  ] },
  { id: 'trades', icon: '🔁', fr: ['Voir les trades', 'Acheter, vendre, échanger'], en: ['Trades', 'Buy, sell, swap'], steps: [
    { path: '/trades', icon: '🔁', fr: ['Les échanges', 'Ici, les collectionneurs mettent des cartes à vendre ou à échanger. Tu les retrouves toutes, filtrables.'], en: ['Trades', 'Collectors list cards for sale or trade here. You can browse and filter them all.'] },
    { path: '/trades', sel: '.tr-tabs', icon: '🗂️', fr: ['Les onglets', 'Annonces, Trade Matching (les membres qui ont ce que tu cherches), Swipe pour parcourir vite, et tes échanges en cours.'], en: ['Tabs', 'Listings, Trade Matching (members who have what you want), Swipe to browse fast, and your ongoing trades.'] },
    { path: '/trades', sel: '.tr-layout', icon: '🔎', fr: ['Les filtres', 'Cherche un joueur, une équipe, une année, ou filtre RC, auto, patch, numérotée.'], en: ['Filters', 'Search a player, team or year, or filter RC, auto, patch, numbered.'] },
    { path: '/trades', sel: 'text:Poster une annonce', icon: '➕', fr: ['Poster une annonce', 'Mets une de tes cartes à vendre ou à échanger : elle sera visible de tous les membres.'], en: ['Post a listing', 'List one of your cards for sale or trade: every member will see it.'] },
  ] },
  { id: 'setlist', icon: '📋', fr: ['Les setlists', 'Suivre un set, cocher ses cartes'], en: ['Setlists', 'Follow a set, tick your cards'], steps: [
    { path: '/setlist', sel: '.sl-sport-grid', icon: '📋', fr: ['Les setlists', 'Chaque collection (set) a sa checklist complète. Choisis un sport, puis un set.'], en: ['Setlists', 'Every collection (set) has its full checklist. Pick a sport, then a set.'] },
    { path: '/setlist/41', icon: '📘', fr: ['La page d’un set', 'Chiffres clés, top rookies et ta progression : tu vois ce que tu possèdes et ce qu’il te manque.'], en: ['A set page', 'Key numbers, top rookies and your progress: see what you own and what you’re missing.'] },
    { path: '/setlist/41', sel: '.sl2 .anchors', icon: '🧭', fr: ['Naviguer dans le set', 'Ces boutons te mènent aux rookies, aux signatures, à la checklist complète et aux équipes.'], en: ['Move around', 'These buttons jump to rookies, autographs, the full checklist and teams.'] },
    { path: '/setlist/41', sel: '#checklist', icon: '✅', fr: ['Coche tes cartes', 'Dans la checklist, coche ce que tu as, ajoute des cartes à ta wishlist, et vois qui les a à échanger.'], en: ['Tick your cards', 'In the checklist, tick what you own, add cards to your wishlist, and see who has them to trade.'] },
  ] },
  { id: 'gallery', icon: '🖼️', fr: ['Ma galerie', 'Collection, PC, classeurs'], en: ['My gallery', 'Collection, PCs, binders'], steps: [
    { path: '/galerie/{uid}', sel: '.da-profile', icon: '🖼️', fr: ['Ta galerie', 'Ton profil de collectionneur : ton nom, tes abonnés et tes chiffres. Les autres membres voient cette page quand ils visitent ta galerie.'], en: ['Your gallery', 'Your collector profile: your name, followers and numbers. Other members see this page when they visit your gallery.'] },
    { path: '/galerie/{uid}', sel: '.header-stats-block', icon: '🔢', fr: ['Tes chiffres', 'Total de cartes, rookies (RC), signées (Auto), patchs et cartes numérotées.'], en: ['Your numbers', 'Total cards, rookies (RC), autographs (Auto), patches and numbered cards.'] },
    { path: '/galerie/{uid}', sel: '.galerie-actions', icon: '➕', fr: ['Les actions', '« + Ajouter » pour une nouvelle carte, « … » pour les autres options, et la palette pour changer le thème de ta galerie.'], en: ['Actions', '“+ Add” for a new card, “…” for more options, and the palette to change your gallery’s theme.'] },
    { path: '/galerie/{uid}', sel: '.grail-museum', optional: true, icon: '💎', fr: ['Le Grail Wall', 'Tes pièces maîtresses, exposées comme dans un musée. Tu choisis lesquelles.'], en: ['The Grail Wall', 'Your best pieces, displayed like in a museum. You choose which ones.'] },
    { path: '/galerie/{uid}', sel: '.da-tabs', icon: '🗂️', fr: ['Les onglets', 'Collection : toutes tes cartes. Classeurs : tes pages de classeur. Objectifs : tes PC, ta wishlist, tes rainbows. Badges, commentaires, cartes aimées.'], en: ['Tabs', 'Collection: all your cards. Binders: your binder pages. Goals: your PCs, wishlist, rainbows. Badges, comments, liked cards.'] },
    { path: '/galerie/{uid}', click: 'btn:Collection', sel: '.gf-panel', icon: '🔎', fr: ['Chercher et filtrer', 'Cherche un joueur, une variation ou une équipe, et filtre par RC, Auto, Patch ou numérotée. Mémo, Vente et Privé trient selon l’état de la carte.'], en: ['Search and filter', 'Search a player, variation or team, and filter by RC, Auto, Patch or numbered. Memo, Sale and Private sort cards by status.'] },
    { path: '/galerie/{uid}', click: 'btn:Collection', sel: '.gf-ch', icon: '🏷️', fr: ['Tes collections', 'Range tes cartes en collections (étiquettes). Glisse pour réordonner, touche le crayon pour changer le nom ou la couleur.'], en: ['Your collections', 'Sort your cards into collections (tags). Drag to reorder, tap the pencil to rename or recolour.'] },
    { path: '/galerie/{uid}', click: 'btn:Collection', sel: 'up:text:Chronologie', optional: true, icon: '👁️', fr: ['Les 4 modes d’affichage', 'Grille pour les voir en grand, Chronologie par date d’ajout, Défilé pour les faire glisser en perspective, et Compact pour en voir beaucoup à la fois.'], en: ['The 4 view modes', 'Grid to see them large, Timeline by date added, Parade to swipe them in perspective, and Compact to see lots at once.'] },
    { path: '/galerie/{uid}', click: 'btn:Collection', sel: '.card-grid', icon: '🃏', fr: ['Tes cartes', 'Touche une carte pour la voir en grand ou en 3D, la modifier, la mettre à vendre ou à échanger, ou la partager.'], en: ['Your cards', 'Tap a card to see it large or in 3D, edit it, list it for sale or trade, or share it.'] },
    { path: '/galerie/{uid}', click: 'btn:Objectifs', sel: 'btn:Objectifs', icon: '⭐', fr: ['Objectifs : ton écran PC', 'Une PC (collection personnelle), c’est ce que tu collectionnes en priorité : un joueur, une équipe ou une collection. C’est ici que tu les renseignes.'], en: ['Goals: your PC screen', 'A PC (personal collection) is what you collect first: a player, a team or a set. This is where you list them.'] },
    { path: '/galerie/{uid}', click: 'btn:Objectifs', sel: 'btn:+ Ajouter||txt:Aucun PC suivi', wait: 'pc', icon: '➕', fr: ['À toi : ajoute une PC', 'Touche « + Ajouter », cherche un joueur (ou une équipe, une collection), puis touche son nom. Je continue dès que ta première PC est ajoutée.'], en: ['Your turn: add a PC', 'Tap “+ Add”, search a player (or team, or set), then tap the name. I’ll continue as soon as your first PC is added.'] },
    { path: '/galerie/{uid}', click: 'btn:Objectifs', sel: 'btn:Wishlist', icon: '🎯', fr: ['Wishlist et Rainbows', 'À côté des PC : ta Wishlist (les cartes que tu cherches, pour que les autres sachent quoi t’échanger) et les Rainbows (toutes les couleurs d’une même carte).'], en: ['Wishlist and Rainbows', 'Next to PCs: your Wishlist (cards you want, so others know what to trade you) and Rainbows (every colour of the same card).'] },
    { path: '/galerie/{uid}', icon: '🧸', fr: ['Tes PC prennent vie', 'Dès que tu as ajouté des PC, elles apparaissent en boîtes de figurines ici, et leurs figurines s’affichent en haut de ton profil. Tu peux même choisir leur maillot.'], en: ['Your PCs come alive', 'As soon as you add PCs, they appear here as figure boxes and their figures show at the top of your profile. You can even pick their kit.'] },
  ] },
  { id: 'play', icon: '🎮', fr: ['Les jeux', 'Carte du jour, packs, pronos'], en: ['Games', 'Daily card, packs, predictions'], steps: [
    { path: '/', sel: '.hd-row .cdj', icon: '🎴', fr: ['La carte du jour', 'Gratte-la chaque jour : une carte d’un membre à découvrir, et ta semaine en un coup d’œil.'], en: ['Card of the day', 'Scratch it every day: a member’s card to discover, plus your week at a glance.'] },
    { path: '/', sel: '.hd-row .pt', icon: '📦', fr: ['Les packs', 'Un pack gratuit toutes les heures : 6 vraies cartes avec des raretés. 15 doublons s’échangent contre un pack bonus.'], en: ['Packs', 'A free pack every hour: 6 real cards with rarities. 15 duplicates trade for a bonus pack.'] },
    { path: '/', sel: '.pronos-row', icon: '🏆', fr: ['Les pronos', 'Devine le vainqueur des matchs du jour et gagne de l’XP.'], en: ['Predictions', 'Guess the winner of today’s games and earn XP.'] },
    { path: '/', sel: '.dd-edit-btn', icon: '✏️', fr: ['Personnalise ton accueil', 'Ce crayon te laisse déplacer ou masquer chaque bloc, comme tu veux.'], en: ['Make it yours', 'This pencil lets you move or hide any block, however you like.'] },
  ] },
]

type Run = { id: string; i: number }
const readRun = (): Run | null => { try { return JSON.parse(sessionStorage.getItem(RUN) || 'null') } catch { return null } }
const writeRun = (r: Run | null) => { try { if (r) sessionStorage.setItem(RUN, JSON.stringify(r)); else sessionStorage.removeItem(RUN) } catch { /* rien */ } }

// même page ? La galerie s'ouvre aussi par son pseudo (/galerie/gknnn-cards) : le segment « {uid} » accepte donc n'importe quelle valeur
function samePage(pathname: string, want: string, uid: string | null): boolean {
  const a = pathname.split('/').filter(Boolean), b = want.split('/').filter(Boolean)
  if (a.length !== b.length) return false
  return b.every((seg, i) => seg === a[i] || (uid !== null && seg === uid && i === 1 && b[0] === 'galerie'))
}

function findEl(sel: string): Element | null {
  if (sel.startsWith('up:')) { const e = findEl(sel.slice(3)); const p = e?.parentElement; return p && p.getBoundingClientRect().width > 4 ? p : null }
  if (sel.includes('||')) { for (const part of sel.split('||')) { const e = findEl(part); if (e) return e } return null }
  if (sel.startsWith('btn:')) {
    // bouton dont le texte est exactement celui demandé, hors de l'en-tête du profil (qui a aussi un « + Ajouter »)
    const want = sel.slice(4).trim().toLowerCase()
    return [...document.querySelectorAll('button, a')].find(x => (() => { const tx = (x.textContent || '').trim().toLowerCase(); return tx === want || (tx.endsWith(want) && tx.length <= want.length + 4) })() && !x.closest('.da-profile, .galerie-actions, nav, header') && x.getBoundingClientRect().width > 4) || null
  }
  if (sel.startsWith('txt:')) {
    const want = sel.slice(4).toLowerCase()
    const hit = [...document.querySelectorAll('div, p, span, h2, h3')].filter(x => x.children.length === 0 && (x.textContent || '').toLowerCase().includes(want))[0]
    const box = hit?.parentElement; return box && box.getBoundingClientRect().width > 4 ? box : null
  }
  if (sel.startsWith('parent:')) { const e = document.querySelector(sel.slice(7)); const p = e?.parentElement; return p && p.getBoundingClientRect().width > 4 ? p : null }
  if (sel.startsWith('lbl:')) {
    const want = sel.slice(4).toLowerCase()
    const l = [...document.querySelectorAll('label')].find(x => (x.textContent || '').trim().toLowerCase().startsWith(want))
    const p = l?.parentElement; return p && p.getBoundingClientRect().width > 4 ? p : null
  }
  if (sel.startsWith('text:')) {
    const want = sel.slice(5).toLowerCase()
    return [...document.querySelectorAll('a, button')].find(e => (e.textContent || '').toLowerCase().includes(want) && e.getBoundingClientRect().width > 4) || null
  }
  const e = document.querySelector(sel)
  return e && e.getBoundingClientRect().width > 4 && e.getBoundingClientRect().height > 4 ? e : null
}

export default function GuidedTour() {
  const { lang } = useLang()
  const L = lang === 'fr' ? 'fr' : 'en'
  const X: TLang | null = lang === 'de' || lang === 'es' || lang === 'it' ? lang : null
  const U = X ? TOUR_UI[X] : L === 'fr'
    ? { tour: 'Visite guidée', where: 'Par où commencer ?', pick: 'Choisis un petit tuto. Chacun dure une minute et te montre où cliquer.', later: 'Plus tard', quit: 'Quitter', back: 'Retour', next: 'Suivant', skip: 'Passer', more: 'Autres tutos' }
    : { tour: 'Guided tour', where: 'Where to start?', pick: 'Pick a short tutorial. Each takes a minute and shows you where to tap.', later: 'Later', quit: 'Quit', back: 'Back', next: 'Next', skip: 'Skip', more: 'More tutorials' }
  const hubText = (t: Tour): [string, string] => (X && TOUR_HUB[t.id]?.[X]) || t[L]
  const stepText = (t: Tour, i: number): [string, string] => (X && TOUR_STEPS[t.id]?.[X]?.[i]) || t.steps[i][L]
  const router = useRouter()
  const pathname = usePathname()
  const [uid, setUid] = useState<string | null>(null)
  const [hub, setHub] = useState(false)
  const [run, setRun] = useState<Run | null>(null)
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [missing, setMissing] = useState(false)
  const t0 = useRef(0)
  const clicked = useRef('')

  useEffect(() => { supabase.auth.getSession().then(({ data }) => setUid(data.session?.user?.id || null)) }, [])

  // reprise après un changement de page + ouverture du menu (bouton de l'accueil, ?tour=1, première visite)
  useEffect(() => { setRun(readRun()) }, [])
  const openHub = useCallback(() => { writeRun(null); setRun(null); setHub(true) }, [])
  useEffect(() => {
    const h = () => openHub()
    window.addEventListener('start-tour', h)
    return () => window.removeEventListener('start-tour', h)
  }, [openHub])
  useEffect(() => {
    if (!uid || pathname !== '/') return
    const forced = new URLSearchParams(window.location.search).get('tour') === '1'
    let done = false
    try { done = !!localStorage.getItem(DONE) } catch { /* rien */ }
    if (done && !forced) return
    let n = 0
    const t = setInterval(() => {
      n++
      if (document.querySelector('.dd-hero')) {
        clearInterval(t)
        // compte récent (première connexion après l'inscription) : la visite complète démarre toute seule ; sinon, seulement sur demande
        supabase.auth.getUser().then(({ data }) => {
          const created = data.user?.created_at ? Date.parse(data.user.created_at) : 0
          const fresh = created > 0 && Date.now() - created < 14 * 86400000
          setTimeout(() => { if (forced) setHub(true); else if (fresh) { markDone(); go('onboarding', 0) } }, 1200)
        })
      } else if (n > 30) clearInterval(t)
    }, 500)
    return () => clearInterval(t)
  }, [uid, pathname])

  const tour = run ? TOURS.find(t => t.id === run.id) : null
  const step = tour && run ? tour.steps[run.i] : null
  const resolve = (p: string) => p.replace('{uid}', uid || '')

  const markDone = () => { try { localStorage.setItem(DONE, '1') } catch { /* rien */ } }
  const quit = useCallback(() => { writeRun(null); setRun(null); setRect(null); markDone() }, [])
  const go = useCallback((id: string, i: number) => { const r = { id, i }; writeRun(r); setRun(r); setMissing(false); t0.current = Date.now() }, [])
  const start = (id: string) => { setHub(false); markDone(); go(id, 0) }

  // l'étape demande une autre page : on y va
  useEffect(() => {
    if (!step?.path || !uid) return
    const want = resolve(step.path)
    if (!samePage(pathname, want, uid)) router.push(want)
  }, [step, pathname, uid]) // eslint-disable-line

  // projecteur : on attend la zone (jusqu'à 3,5 s), on la centre, on suit sa place ; sinon carte au centre
  useEffect(() => {
    if (!step || !uid) return
    if (step.path && !samePage(pathname, resolve(step.path), uid)) return
    setRect(null); setMissing(false)
    if (!step.sel) return
    let stop = false, centered = false, seen = 0, afterClick = 0
    const upd = () => {
      if (stop) return
      if (step.click && clicked.current !== run?.id + ':' + run?.i) {
        const c = findEl(step.click) as HTMLElement | null
        if (!c) { if (Date.now() - t0.current > 3500) clicked.current = run?.id + ':' + run?.i; return }
        c.click(); clicked.current = run?.id + ':' + run?.i; afterClick = Date.now(); return
      }
      const e = findEl(step.sel!)
      if (!e && step.wait) { setRect(null); setMissing(false); return }   // le bouton a été touché (il devient « Annuler ») : plus de cadre, l'écran reste libre
      if (!e) { if (Date.now() - t0.current > 3500) { if (step.optional && tour && run && run.i < tour.steps.length - 1) { stop = true; go(tour.id, run.i + 1); return } setRect(null); setMissing(true) } return }
      // on ne fait défiler qu'UNE fois, quand la page s'est stabilisée (zone trouvée deux fois de suite, 0,5 s après un changement d'onglet), et seulement si la zone n'est pas déjà bien visible :
      // plus de va-et-vient pendant que la mise en page bouge
      seen++
      if (!centered && seen >= 2 && Date.now() - afterClick > 500) {
        centered = true
        const b = e.getBoundingClientRect(), vh = window.innerHeight
        const fits = b.height < vh * 0.6
        if (fits ? (b.top < 80 || b.bottom > vh - 150) : b.top < 0 || b.top > vh * 0.5) e.scrollIntoView({ block: fits ? 'center' : 'start', behavior: 'auto' })
      }
      const r = e.getBoundingClientRect(); setMissing(false); setRect({ x: r.left, y: r.top, w: r.width, h: r.height })
    }
    t0.current = t0.current || Date.now()
    upd()
    const t = setInterval(upd, 150)
    window.addEventListener('resize', upd)
    return () => { stop = true; clearInterval(t); window.removeEventListener('resize', upd) }
  }, [step, pathname, uid]) // eslint-disable-line

  useEffect(() => {
    if (!step || step.wait !== 'nav' || !tour || !run) return
    const next = tour.steps[run.i + 1]
    if (next?.path && samePage(pathname, resolve(next.path), uid)) setTimeout(() => go(tour.id, run.i + 1), 500)
  }, [pathname, step, run?.i]) // eslint-disable-line

  useEffect(() => {
    if (!step || step.wait !== 'pc' || !tour || !run) return
    const count = () => document.querySelectorAll('.pc-grid > *').length
    const base = count()
    let ok = true
    const t = setInterval(() => { if (ok && count() > base) { ok = false; clearInterval(t); setTimeout(() => go(tour.id, Math.min(tour.steps.length - 1, run.i + 1)), 900) } }, 600)
    return () => { ok = false; clearInterval(t) }
  }, [step, run?.i]) // eslint-disable-line

  useEffect(() => {
    if (!hub && !run) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (run) quit(); else { setHub(false); markDone() } } }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [hub, run, quit])

  if (!uid) return null

  // ── menu des tutos ──
  if (hub && !run) {
    return (
      <div className="gt" role="dialog" aria-modal="true" aria-label={U.tour}>
        <div className="gt-dim" onClick={() => { setHub(false); markDone() }} />
        <div className="gt-hub">
          <button type="button" className="gt-x" aria-label="Fermer" onClick={() => { setHub(false); markDone() }}>✕</button>
          <h2>{U.where}</h2>
          <p>{U.pick}</p>
          <div className="gt-list">
            {TOURS.map((t, k) => (
              <button key={t.id} type="button" className={k === 0 ? 'first' : ''} onClick={() => start(t.id)}>
                <span>{t.icon}</span><b>{hubText(t)[0]}</b><small>{hubText(t)[1]}</small>
              </button>
            ))}
          </div>
          <button type="button" className="gt-later" onClick={() => { setHub(false); markDone() }}>{U.later}</button>
        </div>
      </div>
    )
  }
  if (!tour || !step || !run) return null
  if (step.path && !samePage(pathname, resolve(step.path), uid)) return <div className="gt"><div className="gt-dim" /></div>   // changement de page en cours

  const total = tour.steps.length, last = run.i === total - 1
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const upper = rect ? rect.y + rect.h / 2 < vh * 0.5 : false
  const pad = 6
  const [title, text] = stepText(tour, run.i)
  return (
    <div className={'gt' + (step.wait ? ' pass' : '')} role="dialog" aria-modal="true" aria-label={hubText(tour)[0]}>
      {rect && !missing ? <div className="gt-spot" style={{ left: rect.x - pad, top: rect.y - pad, width: rect.w + pad * 2, height: rect.h + pad * 2 }} /> : <div className="gt-dim" />}
      <div className={'gt-card ' + (!step.wait && rect && !missing && !upper ? 'up' : 'down')}>
        <div className="gt-dots">{tour.steps.map((_, k) => <i key={k} className={k === run.i ? 'on' : k < run.i ? 'seen' : ''} />)}</div>
        <div className="gt-head"><span>{step.icon}</span><b>{title}</b></div>
        <p>{text}</p>
        <div className="gt-btns">
          <button type="button" className="gt-skip" onClick={quit}>{U.quit}</button>
          <div>
            {run.i > 0 && <button type="button" onClick={() => go(tour.id, run.i - 1)}>{U.back}</button>}
            {last
              ? <>
                  {step.cta && <button type="button" onClick={() => { quit(); router.push(resolve(step.cta!.to)) }}>{X ? TOUR_CTA[X] : step.cta[L]}</button>}
                  <button type="button" className="fill" onClick={() => { quit(); setHub(true) }}>{U.more}</button>
                </>
              : <button type="button" className="fill" onClick={() => go(tour.id, run.i + 1)}>{step.wait ? U.skip : U.next}</button>}
          </div>
        </div>
      </div>
    </div>
  )
}
