-- Audit perf (2026-10-25) : 55 colonnes de cle etrangere sans index dans le
-- schema public (auth.*/storage.* geres par Supabase, non touches ici).
-- Chaque DELETE/UPDATE sur la table referencee (ex: supprimer un profil)
-- force un scan complet de chacune de ces tables pour verifier la
-- contrainte, et tout JOIN/filtre applicatif sur ces colonnes fait un seq
-- scan. Tables modestes (pas des tables catalogue a plusieurs millions de
-- lignes comme card_set_entries) -- creation directe, sans CONCURRENTLY.
CREATE INDEX IF NOT EXISTS idx_autograph_quiz_cards_source_card_id ON public.autograph_quiz_cards (source_card_id);
CREATE INDEX IF NOT EXISTS idx_binder_folders_user_id ON public.binder_folders (user_id);
CREATE INDEX IF NOT EXISTS idx_binders_folder_id ON public.binders (folder_id);
CREATE INDEX IF NOT EXISTS idx_binders_user_id ON public.binders (user_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked_id ON public.blocked_users (blocked_id);
CREATE INDEX IF NOT EXISTS idx_card_likes_gallery_user_id ON public.card_likes (gallery_user_id);
CREATE INDEX IF NOT EXISTS idx_card_likes_liker_user_id ON public.card_likes (liker_user_id);
CREATE INDEX IF NOT EXISTS idx_contest_votes_entry_id ON public.contest_votes (entry_id);
CREATE INDEX IF NOT EXISTS idx_discord_contest_weeks_winning_entry_id ON public.discord_contest_weeks (winning_entry_id);
CREATE INDEX IF NOT EXISTS idx_discord_contest_weeks_winning_theme_id ON public.discord_contest_weeks (winning_theme_id);
CREATE INDEX IF NOT EXISTS idx_entry_images_user_id ON public.entry_images (user_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_user_id ON public.event_attendees (user_id);
CREATE INDEX IF NOT EXISTS idx_event_requests_user_id ON public.event_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_galerie_comment_likes_user_id ON public.galerie_comment_likes (user_id);
CREATE INDEX IF NOT EXISTS idx_galerie_comments_author_id ON public.galerie_comments (author_id);
CREATE INDEX IF NOT EXISTS idx_galerie_comments_parent_id ON public.galerie_comments (parent_id);
CREATE INDEX IF NOT EXISTS idx_messages_from_user_id ON public.messages (from_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_to_user_id ON public.messages (to_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_trade_id ON public.messages (trade_id);
CREATE INDEX IF NOT EXISTS idx_nba_birthday_posts_chosen_player_id ON public.nba_birthday_posts (chosen_player_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_player_sheets_card_id ON public.player_sheets (card_id);
CREATE INDEX IF NOT EXISTS idx_player_sheets_user_id ON public.player_sheets (user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_session_id ON public.quiz_answers (session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_created_by ON public.quiz_sessions (created_by);
CREATE INDEX IF NOT EXISTS idx_reports_reported_user_id ON public.reports (reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON public.reports (reporter_id);
CREATE INDEX IF NOT EXISTS idx_team_candidatures_user_id ON public.team_candidatures (user_id);
CREATE INDEX IF NOT EXISTS idx_team_message_reactions_user_id ON public.team_message_reactions (user_id);
CREATE INDEX IF NOT EXISTS idx_team_messages_card_user_id ON public.team_messages (card_user_id);
CREATE INDEX IF NOT EXISTS idx_team_messages_reply_to_id ON public.team_messages (reply_to_id);
CREATE INDEX IF NOT EXISTS idx_team_messages_team_id ON public.team_messages (team_id);
CREATE INDEX IF NOT EXISTS idx_team_messages_user_id ON public.team_messages (user_id);
CREATE INDEX IF NOT EXISTS idx_team_post_comments_post_id ON public.team_post_comments (post_id);
CREATE INDEX IF NOT EXISTS idx_team_post_comments_user_id ON public.team_post_comments (user_id);
CREATE INDEX IF NOT EXISTS idx_team_post_reactions_user_id ON public.team_post_reactions (user_id);
CREATE INDEX IF NOT EXISTS idx_team_posts_card_user_id ON public.team_posts (card_user_id);
CREATE INDEX IF NOT EXISTS idx_team_posts_team_id ON public.team_posts (team_id);
CREATE INDEX IF NOT EXISTS idx_team_posts_user_id ON public.team_posts (user_id);
CREATE INDEX IF NOT EXISTS idx_teams_created_by ON public.teams (created_by);
CREATE INDEX IF NOT EXISTS idx_trade_offer_cards_owner_id ON public.trade_offer_cards (owner_id);
CREATE INDEX IF NOT EXISTS idx_trade_offers_parent_offer_id ON public.trade_offers (parent_offer_id);
CREATE INDEX IF NOT EXISTS idx_trade_reviews_reviewer_id ON public.trade_reviews (reviewer_id);
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON public.trades (user_id);
CREATE INDEX IF NOT EXISTS idx_training_data_carte_id ON public.training_data (carte_id);
CREATE INDEX IF NOT EXISTS idx_training_data_user_id ON public.training_data (user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON public.user_feedback (user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_user_id ON public.wishlist (user_id);
