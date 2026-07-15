// Usage: node scripts/register-discord-commands.js
// Enregistre (ou met à jour) les slash commands globales de l'application Discord.
// À relancer à chaque fois qu'une commande est ajoutée/modifiée.
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
      type: 3,       // STRING
      required: true,
    }],
  },
  {
    name: 'top',
    description: 'Podium des meilleurs collectionneurs du mois en cours',
  },
  {
    name: 'prix',
    description: 'Prix eBay récents pour une carte de collection',
    options: [{
      name: 'carte',
      description: 'Nom de la carte (ex: Wembanyama RC Prizm 2024)',
      type: 3,       // STRING
      required: true,
    }],
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
