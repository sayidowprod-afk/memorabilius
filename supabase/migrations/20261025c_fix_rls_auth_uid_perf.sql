-- Perf (2026-10-25) : 78 policies RLS utilisaient auth.uid() directement dans leur
-- condition, re-evalue PAR LIGNE scannee au lieu dune seule fois par requete
-- (anti-pattern documente Supabase/postgres). Sans impact fonctionnel (meme
-- resultat, meme controle dacces) -- seulement la vitesse, sur toutes les
-- requetes des utilisateurs connectes, site entier.

-- ai_scan_events : exclu volontairement -- table liee au rate-limiting du
-- scan IA, jamais touchee sans demander d'abord (meme pour un changement de
-- pure perf comme celui-ci). A faire separement si approuve.

-- binder_folders.binder_folders_delete
ALTER POLICY binder_folders_delete ON public.binder_folders
  USING (((select auth.uid()) = user_id));

-- binder_folders.binder_folders_insert
ALTER POLICY binder_folders_insert ON public.binder_folders
  WITH CHECK (((select auth.uid()) = user_id));

-- binder_folders.binder_folders_update
ALTER POLICY binder_folders_update ON public.binder_folders
  USING (((select auth.uid()) = user_id));

-- binder_slots.binder_slots_delete
ALTER POLICY binder_slots_delete ON public.binder_slots
  USING (((select auth.uid()) = ( SELECT binders.user_id
   FROM binders
  WHERE (binders.id = binder_slots.binder_id))));

-- binder_slots.binder_slots_insert
ALTER POLICY binder_slots_insert ON public.binder_slots
  WITH CHECK (((select auth.uid()) = ( SELECT binders.user_id
   FROM binders
  WHERE (binders.id = binder_slots.binder_id))));

-- binder_slots.binder_slots_update
ALTER POLICY binder_slots_update ON public.binder_slots
  USING (((select auth.uid()) = ( SELECT binders.user_id
   FROM binders
  WHERE (binders.id = binder_slots.binder_id))))
  WITH CHECK (((select auth.uid()) = ( SELECT binders.user_id
   FROM binders
  WHERE (binders.id = binder_slots.binder_id))));

-- binders.binders_delete
ALTER POLICY binders_delete ON public.binders
  USING (((select auth.uid()) = user_id));

-- binders.binders_insert
ALTER POLICY binders_insert ON public.binders
  WITH CHECK (((select auth.uid()) = user_id));

-- binders.binders_select
ALTER POLICY binders_select ON public.binders
  USING (((is_public = true) OR ((select auth.uid()) = user_id)));

-- binders.binders_update
ALTER POLICY binders_update ON public.binders
  USING (((select auth.uid()) = user_id));

-- blocked_users.Bloquer quelqu'un
ALTER POLICY "Bloquer quelqu'un" ON public.blocked_users
  WITH CHECK ((((select auth.uid()) = blocker_id) AND (blocker_id <> blocked_id)));

-- blocked_users.Debloquer quelqu'un
ALTER POLICY "Debloquer quelqu'un" ON public.blocked_users
  USING (((select auth.uid()) = blocker_id));

-- blocked_users.Voir ses blocages
ALTER POLICY "Voir ses blocages" ON public.blocked_users
  USING (((select auth.uid()) = blocker_id));

-- card_collections.card_collections_delete
ALTER POLICY card_collections_delete ON public.card_collections
  USING (((select auth.uid()) = user_id));

-- card_collections.card_collections_insert
ALTER POLICY card_collections_insert ON public.card_collections
  WITH CHECK (((select auth.uid()) = user_id));

-- card_collections.card_collections_update
ALTER POLICY card_collections_update ON public.card_collections
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

-- card_likes.own likes
ALTER POLICY "own likes" ON public.card_likes
  USING (((select auth.uid()) = liker_user_id));

-- card_values.owner_only
ALTER POLICY owner_only ON public.card_values
  USING (((select auth.uid()) = user_id));

-- carte_tags.owner
ALTER POLICY owner ON public.carte_tags
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

-- cartes_manuelles.Ajouter une carte
ALTER POLICY "Ajouter une carte" ON public.cartes_manuelles
  WITH CHECK (((select auth.uid()) = user_id));

-- cartes_manuelles.Modifier sa carte
ALTER POLICY "Modifier sa carte" ON public.cartes_manuelles
  USING (((select auth.uid()) = user_id));

-- cartes_manuelles.Supprimer sa carte
ALTER POLICY "Supprimer sa carte" ON public.cartes_manuelles
  USING (((select auth.uid()) = user_id));

-- cartes_manuelles.delete own cards
ALTER POLICY "delete own cards" ON public.cartes_manuelles
  USING (((select auth.uid()) = user_id));

-- cartes_manuelles.insert own cards
ALTER POLICY "insert own cards" ON public.cartes_manuelles
  WITH CHECK (((select auth.uid()) = user_id));

-- cartes_manuelles.select own cards
ALTER POLICY "select own cards" ON public.cartes_manuelles
  USING (((select auth.uid()) = user_id));

-- cartes_manuelles.update own cards
ALTER POLICY "update own cards" ON public.cartes_manuelles
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

-- cartes_privees.Ajouter une carte privée
ALTER POLICY "Ajouter une carte privée" ON public.cartes_privees
  WITH CHECK (((select auth.uid()) = user_id));

-- cartes_privees.Supprimer une carte privée
ALTER POLICY "Supprimer une carte privée" ON public.cartes_privees
  USING (((select auth.uid()) = user_id));

-- collection_tab_settings.Users manage own tab settings
ALTER POLICY "Users manage own tab settings" ON public.collection_tab_settings
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

-- contest_entries.entries_delete
ALTER POLICY entries_delete ON public.contest_entries
  USING (((select auth.uid()) = user_id));

-- contest_entries.entries_insert
ALTER POLICY entries_insert ON public.contest_entries
  WITH CHECK (((select auth.uid()) = user_id));

-- contest_votes.votes_delete
ALTER POLICY votes_delete ON public.contest_votes
  USING (((select auth.uid()) = voter_id));

-- contest_votes.votes_insert
ALTER POLICY votes_insert ON public.contest_votes
  WITH CHECK (((select auth.uid()) = voter_id));

-- contest_votes.votes_update
ALTER POLICY votes_update ON public.contest_votes
  USING (((select auth.uid()) = voter_id))
  WITH CHECK (((select auth.uid()) = voter_id));

-- entry_images.entry_images_delete
ALTER POLICY entry_images_delete ON public.entry_images
  USING (((select auth.uid()) = user_id));

-- entry_images.entry_images_insert
ALTER POLICY entry_images_insert ON public.entry_images
  WITH CHECK (((select auth.uid()) = user_id));

-- event_attendees.attendees_delete
ALTER POLICY attendees_delete ON public.event_attendees
  USING (((select auth.uid()) = user_id));

-- event_attendees.attendees_insert
ALTER POLICY attendees_insert ON public.event_attendees
  WITH CHECK (((select auth.uid()) = user_id));

-- event_requests.requests_all_admin
ALTER POLICY requests_all_admin ON public.event_requests
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));

-- event_requests.requests_insert
ALTER POLICY requests_insert ON public.event_requests
  WITH CHECK (((select auth.uid()) = user_id));

-- event_requests.requests_select_own
ALTER POLICY requests_select_own ON public.event_requests
  USING (((select auth.uid()) = user_id));

-- events.events_delete_admin
ALTER POLICY events_delete_admin ON public.events
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));

-- events.events_insert_admin
ALTER POLICY events_insert_admin ON public.events
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));

-- events.events_update_admin
ALTER POLICY events_update_admin ON public.events
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));

-- fcm_tokens.fcm_tokens_own
ALTER POLICY fcm_tokens_own ON public.fcm_tokens
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

-- follows.follows_delete
ALTER POLICY follows_delete ON public.follows
  USING (((select auth.uid()) = follower_id));

-- follows.follows_insert
ALTER POLICY follows_insert ON public.follows
  WITH CHECK (((select auth.uid()) = follower_id));

-- galerie_comment_likes.like connecté
ALTER POLICY "like connecté" ON public.galerie_comment_likes
  WITH CHECK (((select auth.uid()) = user_id));

-- galerie_comment_likes.unlike own
ALTER POLICY "unlike own" ON public.galerie_comment_likes
  USING (((select auth.uid()) = user_id));

-- galerie_comments.delete galerie owner
ALTER POLICY "delete galerie owner" ON public.galerie_comments
  USING (((select auth.uid()) = galerie_user_id));

-- galerie_comments.delete own
ALTER POLICY "delete own" ON public.galerie_comments
  USING (((select auth.uid()) = author_id));

-- galerie_comments.insert connecté
ALTER POLICY "insert connecté" ON public.galerie_comments
  WITH CHECK (((select auth.uid()) = author_id));

-- grail_cards.Users manage own grail
ALTER POLICY "Users manage own grail" ON public.grail_cards
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

-- guides.admin full access guides
ALTER POLICY "admin full access guides" ON public.guides
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_admin = true)))));

-- login_history.login_history_select_own
ALTER POLICY login_history_select_own ON public.login_history
  USING (((select auth.uid()) = user_id));

-- messages.Envoyer un message
ALTER POLICY "Envoyer un message" ON public.messages
  WITH CHECK ((((select auth.uid()) = from_user_id) AND (NOT (EXISTS ( SELECT 1
   FROM blocked_users
  WHERE (((blocked_users.blocker_id = messages.to_user_id) AND (blocked_users.blocked_id = messages.from_user_id)) OR ((blocked_users.blocker_id = messages.from_user_id) AND (blocked_users.blocked_id = messages.to_user_id))))))));

-- messages.Marquer lu
ALTER POLICY "Marquer lu" ON public.messages
  USING (((select auth.uid()) = to_user_id));

-- messages.Voir ses messages
ALTER POLICY "Voir ses messages" ON public.messages
  USING ((((select auth.uid()) = from_user_id) OR ((select auth.uid()) = to_user_id)));

-- notifications.Marquer lu
ALTER POLICY "Marquer lu" ON public.notifications
  USING (((select auth.uid()) = user_id));

-- notifications.Voir ses notifications
ALTER POLICY "Voir ses notifications" ON public.notifications
  USING (((select auth.uid()) = user_id));

-- player_sheets.admins manage player sheets
ALTER POLICY "admins manage player sheets" ON public.player_sheets
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND profiles.is_admin))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND profiles.is_admin))));

-- profiles.Modifier son propre profil
ALTER POLICY "Modifier son propre profil" ON public.profiles
  USING (((select auth.uid()) = id))
  WITH CHECK (((select auth.uid()) = id));

-- push_subscriptions.push_subscriptions_own
ALTER POLICY push_subscriptions_own ON public.push_subscriptions
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

-- team_candidatures.Gérer candidatures
ALTER POLICY "Gérer candidatures" ON public.team_candidatures
  USING ((((select auth.uid()) = ( SELECT teams.created_by
   FROM teams
  WHERE (teams.id = team_candidatures.team_id))) OR (EXISTS ( SELECT 1
   FROM team_members
  WHERE ((team_members.team_id = team_candidatures.team_id) AND (team_members.user_id = (select auth.uid())) AND (team_members.role = 'admin'::text))))));

-- team_candidatures.Postuler
ALTER POLICY "Postuler" ON public.team_candidatures
  WITH CHECK (((select auth.uid()) = user_id));

-- team_candidatures.Supprimer candidature
ALTER POLICY "Supprimer candidature" ON public.team_candidatures
  USING (((select auth.uid()) = user_id));

-- team_candidatures.Voir ses candidatures
ALTER POLICY "Voir ses candidatures" ON public.team_candidatures
  USING ((((select auth.uid()) = user_id) OR ((select auth.uid()) = ( SELECT teams.created_by
   FROM teams
  WHERE (teams.id = team_candidatures.team_id))) OR (EXISTS ( SELECT 1
   FROM team_members
  WHERE ((team_members.team_id = team_candidatures.team_id) AND (team_members.user_id = (select auth.uid())) AND (team_members.role = 'admin'::text))))));

-- team_contests.contests_write
ALTER POLICY contests_write ON public.team_contests
  USING (((select auth.uid()) IS NOT NULL))
  WITH CHECK (((select auth.uid()) IS NOT NULL));

-- team_hof.team_hof ecriture membre
ALTER POLICY "team_hof ecriture membre" ON public.team_hof
  WITH CHECK ((((select auth.uid()) = user_id) AND (EXISTS ( SELECT 1
   FROM team_members m
  WHERE ((m.team_id = team_hof.team_id) AND (m.user_id = (select auth.uid())))))));

-- team_hof.team_hof maj membre
ALTER POLICY "team_hof maj membre" ON public.team_hof
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

-- team_hof.team_hof suppression
ALTER POLICY "team_hof suppression" ON public.team_hof
  USING (((select auth.uid()) = user_id));

-- team_members.Modifier role membre
ALTER POLICY "Modifier role membre" ON public.team_members
  USING ((((select auth.uid()) IN ( SELECT tm2.user_id
   FROM team_members tm2
  WHERE ((tm2.team_id = team_members.team_id) AND (tm2.user_id = (select auth.uid())) AND (tm2.role = 'admin'::text)))) OR ((select auth.uid()) IN ( SELECT teams.created_by
   FROM teams
  WHERE (teams.id = team_members.team_id)))));

-- team_members.Quitter ou être kické
ALTER POLICY "Quitter ou être kické" ON public.team_members
  USING ((((select auth.uid()) = user_id) OR ((select auth.uid()) IN ( SELECT teams.created_by
   FROM teams
  WHERE (teams.id = team_members.team_id))) OR ((select auth.uid()) IN ( SELECT tm2.user_id
   FROM team_members tm2
  WHERE ((tm2.team_id = team_members.team_id) AND (tm2.role = 'admin'::text))))));

-- team_members.Rejoindre une team
ALTER POLICY "Rejoindre une team" ON public.team_members
  WITH CHECK ((((select auth.uid()) = user_id) OR ((select auth.uid()) = ( SELECT teams.created_by
   FROM teams
  WHERE (teams.id = team_members.team_id))) OR (EXISTS ( SELECT 1
   FROM team_members tm
  WHERE ((tm.team_id = team_members.team_id) AND (tm.user_id = (select auth.uid())) AND (tm.role = 'admin'::text))))));

-- team_message_reactions.team_message_reactions_delete
ALTER POLICY team_message_reactions_delete ON public.team_message_reactions
  USING (((select auth.uid()) = user_id));

-- team_message_reactions.team_message_reactions_insert
ALTER POLICY team_message_reactions_insert ON public.team_message_reactions
  WITH CHECK (((select auth.uid()) = user_id));

-- team_messages.Envoyer message team
ALTER POLICY "Envoyer message team" ON public.team_messages
  WITH CHECK ((((select auth.uid()) = user_id) AND ((select auth.uid()) IN ( SELECT team_members.user_id
   FROM team_members
  WHERE (team_members.team_id = team_messages.team_id)))));

-- team_messages.Supprimer son message
ALTER POLICY "Supprimer son message" ON public.team_messages
  USING (((select auth.uid()) = user_id));

-- team_messages.Voir messages team
ALTER POLICY "Voir messages team" ON public.team_messages
  USING (((select auth.uid()) IN ( SELECT team_members.user_id
   FROM team_members
  WHERE (team_members.team_id = team_messages.team_id))));

-- team_post_comments.Auteur peut supprimer son commentaire
ALTER POLICY "Auteur peut supprimer son commentaire" ON public.team_post_comments
  USING ((user_id = (select auth.uid())));

-- team_post_comments.Membres peuvent commenter
ALTER POLICY "Membres peuvent commenter" ON public.team_post_comments
  WITH CHECK (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM (team_members tm
     JOIN team_posts tp ON ((tp.team_id = tm.team_id)))
  WHERE ((tp.id = team_post_comments.post_id) AND (tm.user_id = (select auth.uid())))))));

-- team_post_comments.Membres peuvent lire les commentaires
ALTER POLICY "Membres peuvent lire les commentaires" ON public.team_post_comments
  USING ((EXISTS ( SELECT 1
   FROM (team_members tm
     JOIN team_posts tp ON ((tp.team_id = tm.team_id)))
  WHERE ((tp.id = team_post_comments.post_id) AND (tm.user_id = (select auth.uid()))))));

-- team_post_comments.team_post_comments_delete
ALTER POLICY team_post_comments_delete ON public.team_post_comments
  USING (((select auth.uid()) = user_id));

-- team_post_comments.team_post_comments_insert
ALTER POLICY team_post_comments_insert ON public.team_post_comments
  WITH CHECK (((select auth.uid()) = user_id));

-- team_post_reactions.team_post_reactions_delete
ALTER POLICY team_post_reactions_delete ON public.team_post_reactions
  USING (((select auth.uid()) = user_id));

-- team_post_reactions.team_post_reactions_insert
ALTER POLICY team_post_reactions_insert ON public.team_post_reactions
  WITH CHECK (((select auth.uid()) = user_id));

-- team_posts.Auteur peut supprimer ses posts
ALTER POLICY "Auteur peut supprimer ses posts" ON public.team_posts
  USING ((user_id = (select auth.uid())));

-- team_posts.Membres peuvent créer des posts
ALTER POLICY "Membres peuvent créer des posts" ON public.team_posts
  WITH CHECK (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM team_members
  WHERE ((team_members.team_id = team_posts.team_id) AND (team_members.user_id = (select auth.uid())))))));

-- team_posts.Membres peuvent lire les posts
ALTER POLICY "Membres peuvent lire les posts" ON public.team_posts
  USING ((EXISTS ( SELECT 1
   FROM team_members
  WHERE ((team_members.team_id = team_posts.team_id) AND (team_members.user_id = (select auth.uid()))))));

-- teams.Créer une team
ALTER POLICY "Créer une team" ON public.teams
  WITH CHECK (((select auth.uid()) = created_by));

-- teams.Modifier sa team
ALTER POLICY "Modifier sa team" ON public.teams
  USING (((select auth.uid()) = created_by));

-- teams.Supprimer sa team
ALTER POLICY "Supprimer sa team" ON public.teams
  USING (((select auth.uid()) = created_by));

-- trade_favorites.Ajouter un favori
ALTER POLICY "Ajouter un favori" ON public.trade_favorites
  WITH CHECK (((select auth.uid()) = user_id));

-- trade_favorites.Retirer un favori
ALTER POLICY "Retirer un favori" ON public.trade_favorites
  USING (((select auth.uid()) = user_id));

-- trade_favorites.Voir ses favoris
ALTER POLICY "Voir ses favoris" ON public.trade_favorites
  USING (((select auth.uid()) = user_id));

-- trade_offer_cards.trade_offer_cards_select
ALTER POLICY trade_offer_cards_select ON public.trade_offer_cards
  USING ((EXISTS ( SELECT 1
   FROM trade_offers
  WHERE ((trade_offers.id = trade_offer_cards.trade_id) AND ((trade_offers.sender_id = (select auth.uid())) OR (trade_offers.receiver_id = (select auth.uid())))))));

-- trade_offers.trade_offers_insert
ALTER POLICY trade_offers_insert ON public.trade_offers
  WITH CHECK (((select auth.uid()) = sender_id));

-- trade_offers.trade_offers_select
ALTER POLICY trade_offers_select ON public.trade_offers
  USING ((((select auth.uid()) = sender_id) OR ((select auth.uid()) = receiver_id)));

-- trade_offers.trade_offers_update
ALTER POLICY trade_offers_update ON public.trade_offers
  USING (((status = 'pending'::text) AND (((select auth.uid()) = sender_id) OR ((select auth.uid()) = receiver_id))))
  WITH CHECK (((((select auth.uid()) = sender_id) AND (status = 'cancelled'::text)) OR (((select auth.uid()) = receiver_id) AND (status = ANY (ARRAY['accepted'::text, 'refused'::text])))));

-- trades.Modifier son trade
ALTER POLICY "Modifier son trade" ON public.trades
  USING (((select auth.uid()) = user_id));

-- trades.Poster un trade
ALTER POLICY "Poster un trade" ON public.trades
  WITH CHECK (((select auth.uid()) = user_id));

-- trades.Supprimer son trade
ALTER POLICY "Supprimer son trade" ON public.trades
  USING (((select auth.uid()) = user_id));

-- trades.Trades visibles aux membres
ALTER POLICY "Trades visibles aux membres" ON public.trades
  USING (((select auth.uid()) IS NOT NULL));

-- training_data.insert own training_data
ALTER POLICY "insert own training_data" ON public.training_data
  WITH CHECK (((select auth.uid()) = user_id));

-- training_data.read own training_data
ALTER POLICY "read own training_data" ON public.training_data
  USING (((select auth.uid()) = user_id));

-- user_set_completion.own completion
ALTER POLICY "own completion" ON public.user_set_completion
  USING (((select auth.uid()) = user_id));

-- wishlist.own write
ALTER POLICY "own write" ON public.wishlist
  USING (((select auth.uid()) = user_id));

-- xp_events.xp_events_select
ALTER POLICY xp_events_select ON public.xp_events
  USING (((select auth.uid()) = user_id));
