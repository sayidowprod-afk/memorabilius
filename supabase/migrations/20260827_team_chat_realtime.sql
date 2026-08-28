-- La publication supabase_realtime existe mais ne contenait AUCUNE table --
-- le chat de team s'inserait bien en base mais n'apparaissait jamais en
-- direct chez les autres membres (postgres_changes ne se declenchait jamais),
-- seul un rechargement complet le revelait. Ajoute les tables dont le
-- fonctionnement depend explicitement d'un abonnement postgres_changes
-- (team-chat, reactions) plutot que toutes les tables sans discernement.
ALTER PUBLICATION supabase_realtime ADD TABLE team_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE team_message_reactions;
