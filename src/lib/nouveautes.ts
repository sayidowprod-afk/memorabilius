// Nouveautés visibles par les membres (la plus récente en premier). Utilisé par la page /nouveautes et par la fenêtre « Quoi de neuf ».
// À compléter à chaque mise à jour visible : la fenêtre s'affiche une fois pour chaque nouvelle première entrée.
export type Entry = { date: string; titre: string; points: string[] }

export const ENTRIES: Entry[] = [
  {
    date: '6 novembre 2026', titre: 'Ajout en lot, calendrier des sorties, mode salon et plus',
    points: [
      'Ajout en lot : choisis les photos (recto + verso) de plusieurs cartes d’un coup, elles sont identifiées automatiquement. Les cartes non identifiées se complètent ensuite avec « À compléter » dans ta galerie.',
      'Calendrier des sorties de cartes de basket, mis à jour tout seul chaque semaine, avec un agenda à ajouter à ton téléphone. Les prochaines sorties s’affichent aussi en haut des pages Guides et Événements.',
      'Mode salon : sur ta wishlist, un affichage en grosses lignes à cocher « trouvée », gardé sur ton téléphone (marche aussi sans réseau).',
      'Wishlist partageable par lien (en lecture seule), que tu peux arrêter à tout moment.',
      'Messages : répondre à un message en le citant (appui long sur le message, puis « Répondre »).',
      'Ajout de carte : ton brouillon est gardé si tu quittes la page, le bouton « Enregistrer » reste visible en bas, et les petits « ? » expliquent variation, numérotation, grade…',
      'Couleur du site au choix : dans Réglages (page « Paramètres », dans l’app comme sur le site) ou dans la roue crantée sur ordinateur. Le bleu actuel reste le choix par défaut.',
      'Meilleur contraste automatiquement si ton appareil le demande.',
      'Galerie : barre de saut rapide (A–Z ou années) quand tu tries par joueur ou par année, pincement à deux doigts pour changer la taille de la grille, et « Reprendre où tu t’étais arrêté ».',
      'Le bouton Précédent te ramène exactement où tu étais dans la galerie et l’annuaire.',
      '« ⚖ Comparer » sur la galerie d’un membre : ce que tu as et qu’il cherche, ce qu’il a et que tu cherches, et vos cartes en commun.',
      'Recherche vocale (micro) dans la recherche de cartes.',
    ],
  },
  {
    date: '5 novembre 2026', titre: 'Un site plus lisible et plus pratique',
    points: [
      'Menu avatar en haut à droite (ordinateur) : « Mon profil », « Nouveautés » et « Se déconnecter ». Un bouton vert « Quoi de nouveau ? » sur ton accueil, et cette petite fenêtre après chaque mise à jour.',
      'Palette de commandes : Ctrl / ⌘ + K pour aller n’importe où ou chercher une carte.',
      'Fenêtres de confirmation aux couleurs du site pour les suppressions, et boutons « Supprimer » en rouge dans Mes achats et Mes ventes.',
      'Textes plus lisibles (plus petits textes agrandis, gris plus clairs), titres de page plus nets, liens soulignés, champs plus nets avec un contour bleu quand on tape, boutons-icônes plus grands au toucher, fond un peu plus doux.',
      'Galerie : « Partager » et « Modifier » apparaissent au survol d’une carte (ordinateur), nouvelle vue « Mosaïque » où chaque carte garde sa forme, images qui se précisent en chargeant.',
      'Mes achats : évolution des dépenses par rapport au mois dernier.',
      'Annuaire : bascule « Confortable / Compact » pour voir plus de lignes.',
      'Recherche : tes cartes récemment consultées, gardées sur ton appareil. Messages : recherche dans une conversation, avec les mots trouvés surlignés.',
      'Connexion et inscription : alerte « Majuscules activées », correction des fautes d’e-mail (gmial.com…) et message d’erreur plus clair.',
      'Le nombre de notifications non lues s’affiche dans l’onglet du navigateur. La roue de réglages n’a plus de cadre autour.',
    ],
  },
  {
    date: '4 novembre 2026', titre: 'Mes achats : corrections',
    points: [
      'Le total « dépensé ce mois-ci » correspond maintenant au suivi des dépenses (une commande compte une seule fois).',
      'Un achat en préparation peut être marqué comme reçu.',
      'Galerie : une image qui échoue à charger est retentée avant d’afficher « Image indisponible ».',
    ],
  },
  {
    date: '2 novembre 2026', titre: 'Mes achats & ventes',
    points: [
      'Une seule page « Mes achats » avec les onglets Achats, Ventes et Suivi gradation.',
      'Rentabilité de tes ventes, suivi de tes envois en gradation, prix conseillé à la mise en vente.',
    ],
  },
  {
    date: '1er novembre 2026', titre: 'Import de tes achats eBay et Vinted',
    points: [
      'Import automatique de tes achats, enchères et suivis eBay, prix convertis en euros.',
      'Achats Vinted par capture d’écran ou lien, suivi de colis, budget mensuel et graphique de dépenses.',
    ],
  },
]
