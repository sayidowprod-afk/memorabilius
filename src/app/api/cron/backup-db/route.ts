import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

// Backup complet de la base (a appeler a la main, pas planifie) : le cron
// quotidien (/api/cron/backup) n'exporte que 3 tables (cartes_manuelles,
// profiles, classeurs) -- celle-ci exporte TOUTES les tables publiques vers
// R2, un fichier JSON par table (db-full/{table}.json, toujours l'etat
// courant, pas un snapshot date). Boucle en interne sur plusieurs tables
// jusqu'a une deadline, resumable via ?cursor=tableIndex:offset -- avec 60
// tables (certaines potentiellement volumineuses : messages, team_messages,
// xp_events, page_views...) un seul appel peut ne pas suffire.
export const maxDuration = 300
export const dynamic = 'force-dynamic'

const DEADLINE_MS = 40_000
const PAGE_SIZE = 1000

// Liste figee plutot que decouverte dynamique via information_schema : plus
// previsible (pas de table systeme/temporaire surprise), et facile a ajuster
// si une table doit etre exclue (trop volumineuse, sans valeur de restauration).
const TABLES = [
  'ai_scan_events', 'badges', 'binder_folders', 'binder_slots', 'binders',
  'card_collections', 'card_likes', 'card_price_history', 'card_set_entries',
  'card_sets', 'card_values', 'carte_tags', 'cartes_manuelles', 'cartes_privees',
  'collection_tab_settings', 'contest_entries', 'contest_votes', 'csv_card_links',
  'ebay_cache', 'entry_images', 'event_attendees', 'event_requests', 'events',
  'fcm_tokens', 'follows', 'galerie_comment_likes', 'galerie_comments',
  'grail_cards', 'guide_translations', 'guides', 'messages', 'monthly_additions',
  'notifications', 'page_views', 'pc_targets', 'profiles', 'push_subscriptions',
  'stats_snapshots', 'team_candidatures', 'team_contests', 'team_members',
  'team_message_reactions', 'team_messages', 'team_post_comments',
  'team_post_reactions', 'team_posts', 'teams', 'trade_favorites',
  'trade_offer_cards', 'trade_offers', 'trades', 'training_data', 'user_badges',
  'user_countries', 'user_sessions', 'user_set_completion', 'wishlist', 'xp_events',
]

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function r2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CF_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CF_R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY!,
    },
  })
}

async function upload(key: string, body: string, contentType = 'application/json') {
  await r2Client().send(new PutObjectCommand({
    Bucket: process.env.CF_R2_BUCKET || 'memorabilius-backup',
    Key: key,
    Body: body,
    ContentType: contentType,
  }))
}

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.CF_R2_ACCOUNT_ID || !process.env.CF_R2_ACCESS_KEY_ID) {
    return NextResponse.json({ error: 'R2 credentials not configured' }, { status: 503 })
  }

  const cursorParam = req.nextUrl.searchParams.get('cursor') || '0:0'
  const [cursorTableIdxStr, cursorOffsetStr] = cursorParam.split(':')
  let tableIdx = Number(cursorTableIdxStr) || 0
  let offset = Number(cursorOffsetStr) || 0

  const start = Date.now()
  const results: { tablesCompleted: string[]; currentTable: string | null; rowsWritten: number; errors: { table: string; message: string }[] } =
    { tablesCompleted: [], currentTable: null, rowsWritten: 0, errors: [] }

  let allRows: any[] = []
  let done = false

  while (Date.now() - start < DEADLINE_MS) {
    if (tableIdx >= TABLES.length) { done = true; break }
    const table = TABLES[tableIdx]
    results.currentTable = table

    try {
      const { data, error } = await supabase.from(table).select('*').range(offset, offset + PAGE_SIZE - 1)
      if (error) throw error

      if (offset === 0) allRows = []
      allRows.push(...(data || []))
      results.rowsWritten += data?.length || 0

      if (!data || data.length < PAGE_SIZE) {
        // Table terminee : un seul fichier avec toutes ses lignes.
        await upload(`db-full/${table}.json`, JSON.stringify(allRows))
        results.tablesCompleted.push(table)
        tableIdx++
        offset = 0
        allRows = []
      } else {
        offset += PAGE_SIZE
      }
    } catch (e: any) {
      results.errors.push({ table, message: e?.message || String(e) })
      // Passe a la table suivante plutot que de bloquer tout le backup sur une seule table en echec.
      tableIdx++
      offset = 0
      allRows = []
    }
  }

  const nextCursor = done ? null : `${tableIdx}:${offset}`
  return NextResponse.json({ done, ...results, nextCursor })
}
