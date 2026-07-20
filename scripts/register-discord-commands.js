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
