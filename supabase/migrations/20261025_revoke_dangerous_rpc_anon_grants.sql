-- Audit securite (2026-10-25) : plusieurs fonctions SECURITY DEFINER
-- sensibles etaient accordees (GRANT EXECUTE) a anon ET authenticated, alors
-- qu'AUCUN appel legitime dans le code ne passe par ces roles -- toutes les
-- routes /api/admin/* les appellent via le role service (qui n'a pas besoin
-- de GRANT, il bypass les permissions) apres avoir verifie requireAdmin().
-- Le GRANT au niveau DB ne protegeait donc rien : n'importe quel visiteur
-- pouvait appeler ces RPC directement via l'API publique Supabase, en
-- contournant entierement la verification admin de l'application.
--
-- create_user_with_profile est le pire cas : n'est appelee NULLE PART dans
-- le code applicatif, mais permettait a n'importe qui de creer un compte
-- directement dans auth.users en contournant le flux d'inscription normal.
-- admin_get_recent_users / admin_stats / get_users_by_country /
-- get_users_without_cards exposaient emails et stats admin a tout visiteur
-- anonyme. match_donor_by_email permettait l'enumeration d'emails inscrits.
REVOKE EXECUTE ON FUNCTION create_user_with_profile FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION admin_get_recent_users FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION admin_stats FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION get_users_by_country FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION get_users_without_cards FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION match_donor_by_email FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION get_users_country_breakdown() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION get_users_country_breakdown(integer) FROM anon, authenticated;
