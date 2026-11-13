// Nouveautés visibles par les membres (la plus récente en premier). Utilisé par la page /nouveautes et par la fenêtre « Quoi de neuf ».
// À compléter à chaque mise à jour visible : la fenêtre s'affiche une fois pour chaque nouvelle première entrée.
export type Entry = { date: string; titre: string; points: string[] }

export const ENTRIES: Entry[] = [
  {
    date: '26 novembre 2026', titre: 'La carte suit l’inclinaison de ton téléphone',
    points: [
      'Viewer 3D sur téléphone : la carte s’incline légèrement (15° au maximum) quand tu bouges ton téléphone, avec un reflet doux par-dessus. La photo n’est jamais modifiée. Sur iPhone, le site demande l’autorisation du capteur de mouvement au premier toucher.',
      'Pronos : un bouton « Masquer les scores » cache les scores des matchs terminés (et les bilans). Touche « Voir le score » pour révéler un match, ou « Tout révéler ce jour ». Pratique si tu regardes les matchs en différé.',
      'Setlists : tu vois maintenant l’état de tes demandes (demandée, en cours, ajoutée) et celles des autres membres, avec un bouton « Moi aussi » pour dire que tu veux la même. Tu reçois une notification quand ta setlist est ajoutée.',
    ],
  },
  {
    date: '25 novembre 2026', titre: 'Le Défilé, notifications regroupées, revue de lot',
    points: [
      'Nouveau « Défilé » (sur téléphone, à la place du mode Story) : tes cartes défilent en perspective, celle du centre de face et les autres inclinées de chaque côté. Fais-les glisser du doigt, touche celle du centre pour l’ouvrir.',
      'Notifications : les « j’aime » sur une même carte le même jour sont regroupés en une ligne, avec les avatars empilés (« Alex, Julie et 18 autres ont aimé votre carte »). Un toucher affiche le détail.',
      'Annuaire : l’aperçu d’un collectionneur reste ouvert quand tu vas dessus, avec ses équipes favorites et deux boutons (Voir la galerie, Écrire).',
      'Galerie sur téléphone : balaye l’écran vers la gauche ou la droite pour passer à l’onglet voisin.',
      'Ajout en lot : un bouton « Vérifier les cartes » à la fin. Les cartes défilent en grand : glisse à droite si c’est juste, à gauche pour corriger les champs sans quitter la revue.',
    ],
  },
  {
    date: '24 novembre 2026', titre: 'Recherche dans mes cartes et nettoyage des noms',
    points: [
      'Recherche du haut de page : tes propres cartes apparaissent maintenant dans les suggestions, dans un groupe « Mes cartes », avec un filtre pour ne voir que celles-ci.',
      'Nettoyer mes noms : si un même joueur ou une même équipe est écrit de plusieurs façons dans ta galerie (« Lebron James » et « LeBron James », « Sixers » et « Philadelphia 76ers »), un bandeau te propose de les unifier. Rien n’est modifié sans ton accord, et s’il n’y a rien à unifier, rien ne s’affiche.',
    ],
  },
  {
    date: '23 novembre 2026', titre: 'Trades : brouillons d’offres et relance',
    points: [
      'Brouillons d’offres : si tu fermes la fenêtre d’une offre sans l’envoyer, elle est gardée sur ton appareil. Tu la retrouves dans « Mes échanges », section « Brouillons d’offres », et en rouvrant l’échange avec le même membre.',
      'Relancer une offre : quand une offre reste sans réponse depuis 3 jours, un bouton « Relancer » envoie un rappel poli au membre. Une nouvelle relance est possible 3 jours plus tard.',
      'Nouvel onglet « Swipe » : les cartes à échanger des autres membres défilent en plein écran. Glisse à droite pour aimer, à gauche pour passer. Si l’autre a aussi aimé une de tes cartes, c’est un match et l’offre s’ouvre déjà préparée. Un « j’aime » reste invisible tant qu’il n’y a pas de match.',
      'Swipe : le bouton « Filtres » en haut à droite permet de ne voir que certaines cartes (équipe, joueur, collection, année, RC, auto, patch). Tes filtres sont gardés.',
      'Fenêtre d’échange : elle affiche maintenant toutes les cartes des deux membres, même au-delà de 1 000 cartes.',
    ],
  },
  {
    date: '22 novembre 2026', titre: 'Mes decks : il te manque combien de cartes ?',
    points: [
      'Nouvelle page « Mes decks » : colle la liste d’un deck (une carte par ligne, ex. « 4 Dracaufeu ex »), le site la compare avec les cartes à jouer de ta galerie et te dit combien de cartes il te manque, avec la liste à copier.',
      'Fiche d’une carte à jouer : un lien « Toutes les cartes de ce personnage » vers la page du personnage.',
    ],
  },
  {
    date: '21 novembre 2026', titre: 'TCG : accueil dédié, guide, annonces et ajout en lot',
    points: [
      'Accueil : un bloc « TCG » avec tes jeux, le nombre de cartes, la valeur estimée de ta collection et des accès rapides. Avec le réglage « TCG » seul, les pépites et podiums de sport sont masqués.',
      'Le choix « Sport / TCG / Les deux » est maintenant aussi dans le menu ⚙️ en haut et à l’inscription.',
      'Ajout en lot : choisis le type de cartes (Sport ou un jeu) pour tout le lot.',
      'Annonces et échanges : état, langue et édition des cartes à jouer, et filtre TCG.',
      'Nouveau guide des cartes à jouer : /tcg.',
      'Ajout de carte : le bouton « Ajouter à ma galerie » revient en bas du formulaire, comme avant.',
    ],
  },
  {
    date: '20 novembre 2026', titre: 'Cartes à jouer (TCG) : Pokémon, Magic, Yu-Gi-Oh!, Lorcana, One Piece',
    points: [
      'Nouveau réglage « Je collectionne » (Paramètres) : Sport, TCG ou Les deux. Avec « TCG » seul, les pronos disparaissent de ton accueil.',
      'Ajout d’une carte : choisis le type (Sport ou un jeu). Une carte à jouer a ses propres champs : extension, numéro, rareté, finition, langue, édition et état (de Mint à Poor, comme sur Cardmarket).',
      'Recherche de carte : tape le nom et la fiche se remplit toute seule (Pokémon et Magic), avec le prix en euros quand il existe.',
      'Scan IA : l’appareil reconnaît aussi les cartes à jouer et remplit le jeu, l’extension, le numéro, la rareté et la langue.',
      'Galerie : filtres Sport / TCG / par jeu, pastilles sur les cartes, recherche par numéro (ex. 025/165), rareté, langue ou édition.',
      'Progression par extension pour les cartes Pokémon (ex. 42 / 172), et prix Cardmarket (Pokémon) ou Scryfall (Magic) dans la fiche d’une carte.',
    ],
  },
  {
    date: '19 novembre 2026', titre: 'Cartes multi-équipes : chaque équipe a ses cartes',
    points: [
      'Cartes avec plusieurs équipes (échange, anciens coéquipiers…) : dans les listes et les filtres, chaque équipe apparaît seule (Boston Celtics, Philadelphia 76ers, Toronto Raptors…) au lieu d’une longue ligne. La carte est trouvée dans chacune de ses équipes.',
      'Ça s’applique au filtre « Équipe » de la galerie, à « Équipe en tête », à l’export de galerie et au filtre de la fenêtre d’échange.',
    ],
  },
  {
    date: '18 novembre 2026', titre: 'Galerie plus rapide, envois de photos accélérés, aide au cadrage retirée',
    points: [
      'Galerie : elle ne télécharge plus que les informations utiles à l’affichage, l’aperçu de chargement utilise les petites miniatures et a la même hauteur que les vraies cartes (plus de saut de page), et ta dernière galerie s’affiche tout de suite à l’ouverture pendant que les données fraîches arrivent.',
      'Recherche : taper reste fluide même sur une très grosse collection.',
      'Viewer 3D : il se prépare dès que tu touches ou survoles une carte, donc il s’ouvre plus vite.',
      'Ajout de cartes (une par une et en lot) : la photo, sa version HD et sa miniature partent en même temps, donc l’envoi est plus court.',
      'Navigation : « Ma galerie » va directement à ta galerie, sans redirection.',
      'Site plus léger : seules la langue française et la langue choisie sont chargées (avant : les cinq), donc les pages s’ouvrent plus vite.',
      'Accueil : le calcul de tes pronos gagnés n’est plus relancé à chaque visite, et le résumé de tes échanges est gardé 1 minute : l’accueil s’affiche plus vite quand tu y reviens.',
      'Appareil photo : l’aide au cadrage est retirée (elle ralentissait l’appareil).',
    ],
  },
  {
    date: '17 novembre 2026', titre: 'Zoom de l’appareil mémorisé, accueil plus clair, photo plus rapide',
    points: [
      'Appareil photo : ton dernier zoom est retenu pour chaque objectif et réappliqué à l’ouverture (plus besoin de recliquer plusieurs fois sur « + »).',
      'Appareil photo : la photo est traitée plus vite une fois prise (moins de décodages inutiles).',
      'Accueil : tes objectifs s’affichent en anneaux de progression avec les chiffres (ex. 430/500).',
      'Accueil : le message de bienvenue s’adapte à l’heure, au week-end et à ta langue.',
      'Accueil : les pronos montrent d’abord 3 matchs, avec un bouton pour voir les autres : l’écran est plus lisible.',
      'Badges : l’infobulle ne dépasse plus de l’écran sur téléphone.',
    ],
  },
  {
    date: '16 novembre 2026', titre: 'Exports vidéo et image, mode Story, galerie plus légère, alertes de vente',
    points: [
      'Export image et vidéos (menu « ⋯ » de ta galerie) : plusieurs cartes dans un même export. Une vidéo qui enchaîne tes cartes (transition et durée au choix), une planche de contact, ou un carrousel prêt à poster (une image par carte).',
      'Exports : format 9:16 (story), 4:5, 1:1 ou 16:9, et trois modèles (Sobre, Néon, Vitrine). Les cartes sont choisies et rangées comme tu veux, ou prises parmi tes plus précieuses (les 1/1 d’abord), tes dernières ajoutées ou au hasard. Tout est créé sur ton appareil.',
      '« Export assurance / données » : l’ancien export reste dans son entrée à part.',
      'Mode Story (sur téléphone) : tes cartes une par une en plein écran, à faire défiler du doigt.',
      'Galerie plus légère : la grille charge des miniatures environ 3 fois plus petites que les photos (le viewer 3D garde toujours la photo complète). Pour tes anciennes cartes, un bandeau en haut de ta galerie te propose de les créer en un clic. Elles sont aussi gardées pour le mode hors ligne.',
      'Grosses galeries : chez un visiteur, les cartes au-delà de 1000 n’arrivent qu’au moment où on en a besoin.',
      'Menu « ⋯ » de la galerie plus court : « Partager » regroupe le lien et le Multi-QR, la plaque de salon n’y figure plus.',
      'Messages : une recherche en haut de la liste retrouve un membre ou un message.',
      'Sorties : sous chaque set, « 🎯 N joueurs de ta wishlist dans ce set ».',
      'Mes ventes : alertes sur tes annonces eBay (nouvelle enchère, nouveaux suiveurs, fin dans 1 h, vendu ou sans acheteur) et rappel des colis à expédier. Chaque alerte se règle dans « 🔔 Alertes ».',
      'Retrait du mode mosaïque de la galerie.',
    ],
  },
  {
    date: '15 novembre 2026', titre: 'Aide au cadrage, réessai carte par carte, galerie plus fluide',
    points: [
      'Appareil photo : le cadre passe au vert quand ta carte est bien alignée. Un bouton « Aide au cadrage » en haut à gauche permet de le couper.',
      'Quantité par carte : le champ « Exemplaires » est disponible dans la fiche de la carte, et « ×3 » s’affiche sur la vignette et dans le viewer.',
      'Ajout en lot : chaque carte en échec a son bouton « Réessayer cette carte ». Si le détecteur de coins est indisponible, la photo est ajoutée telle quelle au lieu d’échouer, et tu peux régler les coins ensuite.',
      'Viewer 3D : la carte s’ouvre sans clignotement, et la barre de filtres de la galerie ne repasse plus par-dessus.',
      'Galerie : moins de calculs à chaque action, donc plus fluide sur les grosses collections (ouverture d’une carte, recherche, filtres).',
    ],
  },
  {
    date: '14 novembre 2026', titre: 'Ajout en lot plus sûr, quantité par carte, viewer sans clignotement',
    points: [
      'Ajout en lot : les coins de chaque photo sont détectés dès qu’elle arrive dans la liste. Quand le recadrage est douteux, la carte porte une pastille « Recadrage à vérifier » et un bouton « Régler les coins » ouvre le même réglage que pour une carte seule.',
      'Ajout en lot : si la page se ferme ou plante en plein lot, les cartes pas encore ajoutées sont gardées sur ton appareil et le site te propose de les reprendre au retour.',
      'Ajout en lot : choisis une collection pour tout le lot (ou carte par carte) et coche « À vendre / échanger ».',
      'Quantité par carte : une seule fiche pour plusieurs exemplaires identiques (« ×3 » sur la vignette et dans le viewer). Le champ « Exemplaires » est dans la fiche de la carte.',
      'Viewer 3D : plus de clignotements à l’ouverture ni quand tu modifies une carte (prix, collection…). La vignette que tu touches « grandit » jusqu’au viewer, et l’image haute définition commence à charger dès que tu poses le doigt.',
      'Réseau lent : sur 3G ou en économie de données, la galerie charge des vignettes bien plus légères.',
      'Trade Matching : les cartes s’ouvrent dans le viewer 3D.',
      'Appareil photo : la photo prise correspond maintenant exactement à ce que tu vois à l’écran, avec ou sans zoom.',
      'Corrections : bouton « Masquer » des messages, flèche de retour en haut qui recouvrait les boutons du classeur, menu des pages du classeur illisible en mode sombre, bandeau « Reprendre ton brouillon » sur téléphone.',
    ],
  },
  {
    date: '13 novembre 2026', titre: 'Propositions dans la wishlist, Trade Matching plus juste',
    points: [
      'Wishlist : quand tu écris un joueur ou une équipe, le site te propose les noms exacts (Philadelphia 76ers, Andre Iguodala…). Plus de faute d’orthographe qui fait rater une alerte.',
      'Trade Matching : le site ne te propose plus jamais une carte que tu as déjà dans ta collection.',
    ],
  },
  {
    date: '12 novembre 2026', titre: 'Une équipe dans ta wishlist, Trade Matching',
    points: [
      'Échanges : l’onglet « Pour toi » s’appelle maintenant « Trade Matching ».',
      'Wishlist : tu peux maintenant préciser une équipe (par exemple Iguodala chez les 76ers). Les alertes et les échanges ne te proposent alors que les cartes du joueur dans cette équipe.',
    ],
  },
  {
    date: '11 novembre 2026', titre: 'Trouve les meilleurs échanges et un seul prix par carte',
    points: [
      'Échanges, onglet « Pour toi » : le bouton « Chercher les meilleurs partenaires » parcourt les collections et les wishlists de tous les membres, et classe ceux avec qui l’échange est le plus intéressant (score sur 100, valeurs équilibrées, échange parfait).',
      'Dans la fenêtre d’échange, un petit € vert signale les cartes qui sont en Vente/Trade.',
      'Un seul prix par carte : le bloc « Prix de la carte » a maintenant un interrupteur Public / Privé. Public, le prix s’affiche sur la carte ; Privé, il reste visible par toi seul. Fini la valeur estimée à part.',
    ],
  },
  {
    date: '10 novembre 2026', titre: 'Ajout en lot plus fiable et plus clair',
    points: [
      'Ajout en lot : une seule liste de cartes pour les photos, la rafale et les pages de classeur. Tu peux les mélanger sans rien perdre, et retirer une carte la retire vraiment.',
      'Page de classeur : photographie d’abord le recto, puis ajoute le verso quand tu veux. La disposition (3 × 3, 3 × 4…) est devinée toute seule, et les emplacements simplement estimés (pochettes vides ?) ne sont plus ajoutés sans que tu les coches.',
      'Si l’ajout s’arrête (bouton Arrêter, coupure de réseau), tes cartes restent dans la liste : « Reprendre » continue là où ça s’est arrêté et « Réessayer » relance les échecs. Rien n’est ajouté en double.',
      'Les cartes sont envoyées trois par trois, donc beaucoup plus vite. L’écran reste allumé pendant l’envoi et une alerte te prévient si tu quittes la page par erreur.',
      'Moins de plantages sur téléphone avec beaucoup de photos, et un résumé de fin avec un lien direct vers les cartes « À compléter ».',
      'Accueil : les « Dernières pépites » défilent de nouveau toutes seules sur téléphone.',
      'Recherche du haut : des pastilles Tout / Équipes / Joueurs / Membres pour filtrer, et tes dernières recherches proposées dès l’ouverture.',
      'Galerie : après une suppression, tu as 8 secondes pour annuler, avec un compte à rebours bien visible.',
      'Classeur : quand tu déplaces une carte, la pochette visée s’allume, une pastille par page permet de la déposer sur une autre page sans feuilleter, et un message confirme où elle est allée.',
      'Mes ventes : les offres de prix reçues sur tes cartes s’affichent en haut, avec Accepter, Contre-offre et Refuser sans ouvrir les messages.',
      'Wishlist : un prix cible facultatif par carte. Tu es prévenu quand un membre met cette carte en vente à ce prix ou moins.',
      'Cartes à vendre : quand une offre est acceptée, la carte passe en « Réservée » (bandeau orange) et ne reçoit plus d’offres. Le vendeur peut lever la réservation depuis la fiche de la carte.',
    ],
  },
  {
    date: '9 novembre 2026', titre: 'Nouvelle police, onglets plus lisibles, bas de page en colonnes',
    points: [
      'Nouvelle police pour les titres, les noms et les chiffres : lettres plus larges et plus lisibles, avec des accents (É, À, Ç…) à pleine hauteur. Les noms des cartes dans la grille se lisent beaucoup mieux.',
      'Pronos : les scores, les bilans et les noms d’équipes utilisent la même police que le reste du site, et « 76ERS » n’est plus coupé.',
      'Galerie : les onglets (Collection, Classeurs, Objectifs, Badges, Commentaires, Aimées) sont plus grands et la barre est plus fine.',
      'Bas de page en colonnes (Réseaux sociaux, Légal, Communauté) : retrouve-nous sur X et sur Instagram.',
      'Connexion et inscription : le fond de cartes couvre maintenant tout l’écran.',
      'Personnalisation de ta galerie : dans le choix de couleur d’équipe, les pastilles montrent maintenant le logo de l’équipe au lieu de trois lettres.',
      'Grail Wall : chaque pièce maîtresse est maintenant exposée dans un cadre doré ouvragé, avec sa plaque dorée dessous (nom et variante).',
    ],
  },
  {
    date: '8 novembre 2026', titre: 'Une interface plus harmonieuse et plus pratique',
    points: [
      'Messages : séparateurs de jour (Aujourd’hui, Hier…), bulles d’une même personne regroupées, glisse un message vers la droite pour y répondre, glisse une conversation vers la gauche pour la masquer. Les tablettes et les téléphones à l’horizontale affichent aussi la liste et la discussion côte à côte.',
      'Galerie : un appui long sur une carte ouvre un menu rapide (voir, partager, modifier, supprimer), et le cœur « J’aime » rebondit.',
      'Recherche du haut : les résultats sont classés par Équipes, Joueurs et Membres, avec une vignette devant chaque ligne.',
      'Mes achats et Mes ventes : une nouvelle vue « Tableau » avec tri par colonne, en-têtes qui restent en haut et totaux en bas.',
      'Ajout en lot : une pastille sur chaque miniature (roue, coche verte, point d’exclamation) et une barre d’avancement pendant l’envoi.',
      'Connexion et inscription : un mur de vraies cartes en fond et une courte présentation du site à côté du formulaire.',
      'Partout : transitions douces entre les pages, dates relatives écrites de la même façon (« il y a 2 h », « hier »), contour de focus clair au clavier, zones tactiles de 44 px, champs, panneaux et fenêtres au même style, onglet actif souligné dans la barre du bas, clavier du téléphone qui ne recouvre plus les champs.',
      'Galerie personnalisée : les fonds clairs (balles de baseball, tennis, golf, volley) restent lisibles.',
    ],
  },
  {
    date: '7 novembre 2026', titre: 'Page de classeur, offres de prix, galerie personnalisable',
    points: [
      'Ajout en lot : « 📖 Page de classeur ». Prends en photo une page de classeur (recto, puis verso de la page retournée) : les cartes sont repérées et découpées toutes seules, et tu peux réajuster les coins de chacune (lien « coins »).',
      'Ajout en lot : les photos de cartes seules sont maintenant recadrées automatiquement (détection des coins), et un « 🎞️ Mode rafale » garde la caméra ouverte pour enchaîner recto, verso, recto, verso.',
      'Messages : le bouton 💶 te laisse proposer un prix pour une carte à vendre. Le vendeur accepte, refuse ou te répond par un autre prix, et l’offre expire au bout de 48 h.',
      'Galerie : le bouton 🎨 personnalise ta galerie au même endroit : le fond (29 au choix : pelouse, glace, terre battue, piste, matière des balles de basket, tennis, baseball, golf…), la couleur et tes équipes favorites. Tes visiteurs voient ton fond. Les mêmes réglages existent dans Paramètres.',
      'Thèmes de saison : pendant All-Star (février), les playoffs (avril à juin) et Noël, la couleur du site et un liseré en haut de l’écran changent tout seuls. Tu peux les désactiver dans Paramètres, et ta couleur choisie reste prioritaire.',
      'Wishlist : « Mode salon » et « Partager ma wishlist » sont maintenant directement dans l’onglet Wishlist de ta galerie.',
      'Sorties : le bouton Checklist ouvre notre propre setlist, et les checklists des prochaines sorties sont ajoutées automatiquement.',
      'Galerie : en pinçant pour réduire la grille, les noms et les textes des cartes s’adaptent à la taille. Au toucher d’une carte, elle s’agrandit en douceur.',
      'Un seul jeu d’icônes au trait fin dans les menus, un ballon de basket qui rebondit quand tu tires pour actualiser (appli), et un fond d’accueil plus vivant.',
    ],
  },
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
