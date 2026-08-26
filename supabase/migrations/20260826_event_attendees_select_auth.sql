-- event_attendees SELECT était ouvert à "true" (y compris aux visiteurs non
-- connectés) — combiné au fait que la page publique /evenements affiche la
-- liste (nom, avatar, lien de profil) des participants inscrits à un
-- événement physique précis, n'importe qui sans compte pouvait scraper qui
-- assiste à quel événement, où et quand. Restreint aux utilisateurs
-- authentifiés — reste un affichage social normal entre collectionneurs
-- connectés, mais plus accessible sans aucun compte.
DROP POLICY IF EXISTS "attendees_select" ON event_attendees;
CREATE POLICY "attendees_select" ON event_attendees FOR SELECT TO authenticated USING (true);
