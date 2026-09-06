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
        required: true,
      },
      {
        name: 'utilisateur',
        description: 'Filtrer par collectionneur (optionnel)',
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
        required: true,
      },
      {
        name: 'utilisateur',
        description: 'Filtrer par collectionneur (optionnel)',
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
        description: 'Photo de ta carte (si tu ne joues pas via `nom`)',
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

async function main() {
  const GUILD_ID = process.env.DISCORD_GUILD_ID || '1525208040221970582'
  // Guild : propagation instantanée (test + serveur principal)
  await register(`https://discord.com/api/v10/applications/${APP_ID}/guilds/${GUILD_ID}/commands`, `Guild ${GUILD_ID}`)
  // Global : propagation ~1h, disponible sur tous les serveurs
  await register(`https://discord.com/api/v10/applications/${APP_ID}/commands`, 'Global (tous les serveurs)')
}

main().catch(err => { console.error(err); process.exit(1) })
