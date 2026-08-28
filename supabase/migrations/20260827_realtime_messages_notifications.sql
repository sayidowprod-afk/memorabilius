-- Meme cause que team_messages (voir 20260827_team_chat_realtime.sql) : ces
-- tables ont un vrai abonnement postgres_changes cote client (messages/page.tsx,
-- ChatBubble.tsx, MobileTopBar.tsx) mais n'etaient jamais ajoutees a la
-- publication supabase_realtime -- les messages/notifications s'inserent bien
-- en base mais n'apparaissent/ne se mettent a jour jamais en direct, seul un
-- rechargement complet les revele.
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
