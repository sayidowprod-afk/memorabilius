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

async function register() {
  const res = await fetch(`https://discord.com/api/v10/applications/${APP_ID}/commands`, {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  })
  const data = await res.json()
  if (!res.ok) {
    console.error('Erreur Discord:', JSON.stringify(data, null, 2))
    process.exit(1)
  }
  console.log(`✅ ${data.length} commande(s) enregistrée(s) :`)
  data.forEach(c => console.log(`  /${c.name} — ${c.description}`))
}

register().catch(err => { console.error(err); process.exit(1) })
