import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Supprime tous les fichiers d'un "dossier" (préfixe) du bucket — Storage n'a
// pas de suppression par préfixe direct, il faut lister puis supprimer les
// chemins un par un. Best-effort : une erreur ici ne doit jamais empêcher la
// suppression du compte (les fichiers orphelins sont un moindre mal face à
// un compte bloqué en cours de suppression).
async function deleteStorageFolder(bucket: string, prefix: string) {
  try {
    const { data: files } = await supabaseAdmin.storage.from(bucket).list(prefix)
    if (files?.length) {
      await supabaseAdmin.storage.from(bucket).remove(files.map(f => `${prefix}/${f.name}`))
    }
  } catch (e) { console.error('[delete-account] storage cleanup', bucket, prefix, e) }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    if (!user || user.id !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Équipes dont l'utilisateur est le fondateur (`created_by`) : un compte
    // supprimé laissant `created_by` pointer vers un id qui n'existera plus
    // rendait l'équipe définitivement injoignable en édition (la vérif
    // `created_by === user.id` ne matche plus jamais personne). On transfère
    // au membre le plus ancien restant, ou on supprime l'équipe si elle
    // n'a plus personne d'autre.
    const { data: ownedTeams } = await supabaseAdmin.from('teams').select('id').eq('created_by', userId)
    for (const team of ownedTeams || []) {
      const { data: nextOwner } = await supabaseAdmin
        .from('team_members').select('user_id').eq('team_id', team.id).neq('user_id', userId)
        .order('joined_at', { ascending: true }).limit(1).maybeSingle()
      if (nextOwner) {
        await supabaseAdmin.from('teams').update({ created_by: nextOwner.user_id }).eq('id', team.id)
      } else {
        await supabaseAdmin.from('teams').delete().eq('id', team.id)
      }
    }

    // Étape 1 : supprimer en parallèle toutes les tables indépendantes
    await Promise.all([
      supabaseAdmin.from('training_data').delete().eq('user_id', userId),
      supabaseAdmin.from('scan_corrections').delete().eq('user_id', userId),
      supabaseAdmin.from('ai_scan_events').delete().eq('user_id', userId),
      supabaseAdmin.from('card_likes').delete().eq('user_id', userId),
      supabaseAdmin.from('wishlist').delete().eq('user_id', userId),
      supabaseAdmin.from('badges').delete().eq('user_id', userId),
      supabaseAdmin.from('monthly_additions').delete().eq('user_id', userId),
      supabaseAdmin.from('push_subscriptions').delete().eq('user_id', userId),
      supabaseAdmin.from('notifications').delete().eq('user_id', userId),
      supabaseAdmin.from('messages').delete().eq('from_user_id', userId),
      supabaseAdmin.from('messages').delete().eq('to_user_id', userId),
      supabaseAdmin.from('team_members').delete().eq('user_id', userId),
      supabaseAdmin.from('team_candidatures').delete().eq('user_id', userId),
      supabaseAdmin.from('cartes_privees').delete().eq('user_id', userId),
      // Commentaires laissés par ce compte ailleurs, ET commentaires reçus
      // sur sa propre galerie (sinon ils restaient affichés indéfiniment,
      // rattachés à un author_id/galerie_user_id qui n'existe plus).
      supabaseAdmin.from('galerie_comments').delete().eq('author_id', userId),
      supabaseAdmin.from('galerie_comments').delete().eq('galerie_user_id', userId),
      supabaseAdmin.from('galerie_comment_likes').delete().eq('user_id', userId),
      supabaseAdmin.from('card_values').delete().eq('user_id', userId),
      supabaseAdmin.from('carte_tags').delete().eq('user_id', userId),
      supabaseAdmin.from('collection_tab_settings').delete().eq('user_id', userId),
      supabaseAdmin.from('grail_cards').delete().eq('user_id', userId),
      supabaseAdmin.from('card_collections').delete().eq('user_id', userId),
      supabaseAdmin.from('event_attendees').delete().eq('user_id', userId),
      supabaseAdmin.from('event_requests').delete().eq('user_id', userId),
      supabaseAdmin.from('user_set_completion').delete().eq('user_id', userId),
      supabaseAdmin.from('xp_events').delete().eq('user_id', userId),
      // `cartes_manuelles` en dernier dans ce groupe : binders/binder_slots et
      // galerie_comments (card_key) référencent ses photos par URL, pas par
      // FK — rien à nettoyer côté DB pour ça une fois les lignes de cartes
      // parties, mais binders/binder_slots eux-mêmes sont déjà couverts par
      // leur propre ON DELETE CASCADE depuis `profiles`.
      supabaseAdmin.from('cartes_manuelles').delete().eq('user_id', userId),
    ])

    // Étape 2 : trade_offer_cards avant trade_offers (contrainte FK)
    const { data: tradeIds } = await supabaseAdmin
      .from('trade_offers').select('id').or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    if (tradeIds?.length) {
      await supabaseAdmin.from('trade_offer_cards').delete().in('trade_id', tradeIds.map(t => t.id))
    }
    await Promise.all([
      supabaseAdmin.from('trade_offers').delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
      supabaseAdmin.from('trades').delete().or(`user_id.eq.${userId},partner_id.eq.${userId}`),
    ])

    // Étape 3 : fichiers Storage — avatar (profil) + toutes les photos de
    // cartes uploadées (avant, restaient publiquement accessibles à leur URL
    // d'origine indéfiniment après "suppression" du compte).
    await Promise.all([
      deleteStorageFolder('avatars', userId),
      deleteStorageFolder('avatars', `cartes/${userId}`),
    ])

    // Étape 4 : profil puis compte auth
    await supabaseAdmin.from('profiles').delete().eq('id', userId)
    await supabaseAdmin.auth.admin.deleteUser(userId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
