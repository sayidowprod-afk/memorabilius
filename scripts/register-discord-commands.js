// Usage: node scripts/register-discord-commands.js
require('dotenv').config({ path: '.env.local' })

const APP_ID    = process.env.DISCORD_APPLICATION_ID
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN

if (!APP_ID || !BOT_TOKEN) {
  console.error('Manque DISCORD_APPLICATION_ID ou DISCORD_BOT_TOKEN dans .env.local')
  process.exit(1)
}

const commands = [
  {
    name: 'collection',
    description: "Affiche les stats de collection d'un membre Memorabilius",
    options: [{
      name: 'utilisateur',
      description: 'Nom du collectionneur (ex: Killian)',
      type: 3,
      required: true,
    }],
  },
  {
    name: 'top',
    description: 'Podium des meilleurs collectionneurs du mois en cours',
  },
  {
    name: 'carte',
    description: 'Affiche une carte de la communauté avec son image',
    options: [
      {
        name: 'nom',
        description: 'Nom du joueur ou de la carte (ex: Wembanyama)',
        type: 3,
        required: false,
      },
      {
        name: 'utilisateur',
        description: 'Filtrer par collectionneur (optionnel)',
        type: 3,
        required: false,
      },
      {
        name: 'lien',
        description: 'Lien direct vers une carte Memorabilius (memorabilius.fr/galerie/...)',
        type: 3,
        required: false,
      },
    ],
  },
  {
    name: 'carte-gif',
    description: 'Affiche une carte qui tourne en boucle (GIF animé)',
    options: [
      {
        name: 'nom',
        description: 'Nom du joueur ou de la carte (ex: Wembanyama)',
        type: 3,
        required: false,
      },
      {
        name: 'utilisateur',
        description: 'Filtrer par collectionneur (optionnel)',
        type: 3,
        required: false,
      },
      {
        name: 'lien',
        description: 'Lien direct vers une carte Memorabilius (memorabilius.fr/galerie/...)',
        type: 3,
        required: false,
      },
    ],
  },
  {
    name: 'concours-participer',
    description: 'Soumets une carte pour le concours de la semaine',
    options: [
      {
        name: 'image',
        description: 'Photo de ta carte (si tu ne joues pas via `nom`/`lien`)',
        type: 11,
        required: false,
      },
      {
        name: 'nom',
        description: 'Nom d\'une carte de ta galerie Memorabilius (comme /carte)',
        type: 3,
        required: false,
      },
      {
        name: 'utilisateur',
        description: 'Ton nom de collectionneur (si tu utilises `nom`)',
        type: 3,
        required: false,
      },
      {
        name: 'lien',
        description: 'Lien direct vers une carte Memorabilius (memorabilius.fr/galerie/...)',
        type: 3,
        required: false,
      },
    ],
  },
  {
    name: 'concours-themes',
    description: 'Liste les thèmes disponibles dans le pool du concours',
  },
  {
    name: 'concours-gagnants',
    description: 'Historique des gagnants du concours hebdomadaire',
  },
  {
    name: 'concours-participants',
    description: "[Admin] Nombre de participants inscrits au concours de la semaine",
    default_member_permissions: '32',
  },
  {
    name: 'concours-theme-ajouter',
    description: '[Admin] Ajoute un thème au pool du concours',
    // Reserve par defaut aux membres avec la permission "Gerer le serveur" --
    // ajustable ensuite librement par un admin depuis Discord (Parametres du
    // serveur > Integrations > Memorabilius Bot > Permissions des commandes),
    // sans avoir besoin de redeployer le bot.
    default_member_permissions: '32',
    options: [{
      name: 'texte',
      description: 'Le thème à ajouter (ex: "Rookies 2024-25")',
      type: 3,
      required: true,
    }],
  },
  {
    name: 'concours-theme-supprimer',
    description: '[Admin] Retire un thème du pool du concours',
    default_member_permissions: '32',
    options: [{
      name: 'texte',
      description: 'Le thème à retirer (recherche approximative)',
      type: 3,
      required: true,
    }],
  },
  {
    name: 'concours-theme-forcer',
    description: '[Admin] Impose le thème de la semaine (evenement special), sans passer par le vote',
    default_member_permissions: '32',
    options: [{
      name: 'texte',
      description: 'Le thème à imposer pour cette semaine',
      type: 3,
      required: true,
    }],
  },
]

async function register(url, label) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  })
  const data = await res.json()
  if (!res.ok) { console.error(`Erreur ${label}:`, JSON.stringify(data, null, 2)); return false }
  console.log(`✅ ${label} — ${data.length} commande(s) :`)
  data.forEach(c => console.log(`  /${c.name}`))
  return true
}

// Bot prive, utilise uniquement sur des serveurs precis -- on enregistre les
// commandes par guilde (propagation instantanee) et jamais en global. Un
// enregistrement global EN PLUS du guild-specifique fait apparaitre chaque
// commande en double partout (palette de saisie "/", page Integrations...),
// puisque Discord les traite comme deux enregistrements distincts meme si un
// seul repond reellement. Ajoute chaque nouveau serveur ici.
const GUILD_IDS = (process.env.DISCORD_GUILD_ID || '1525208040221970582,722440375280599164').split(',')

async function main() {
  for (const guildId of GUILD_IDS) {
    await register(`https://discord.com/api/v10/applications/${APP_ID}/guilds/${guildId}/commands`, `Guild ${guildId}`)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
