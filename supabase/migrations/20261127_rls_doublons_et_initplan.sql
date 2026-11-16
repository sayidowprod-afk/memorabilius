-- Perf (2026-11-16) : suite du ménage des règles de sécurité (RLS) signalées par le Performance Advisor de Supabase.
-- Aucun droit d'accès ne change : les règles sont réécrites à l'identique, seule leur forme est optimisée.
--
-- 1) DOUBLONS « SELECT » : sur plusieurs tables, une règle « tout faire sur ses propres lignes » (FOR ALL) cohabite avec une règle de
--    lecture publique « USING (true) ». Pour la lecture, la base évalue les deux règles sur chaque ligne alors que la lecture publique
--    autorise déjà tout. On remplace la règle FOR ALL par trois règles INSERT / UPDATE / DELETE (mêmes conditions) : la lecture n'est
--    plus évaluée en double, et les écritures sont exactement les mêmes qu'avant.
--    Le script ne touche une table QUE si la règle de lecture est littéralement « true » (vérifié à l'exécution) : sinon il ne fait rien.
-- 2) INITPLAN : dans les règles ci-dessous, auth.uid() est recalculé pour CHAQUE ligne ; (select auth.uid()) ne l'est qu'une fois par requête.
--    Même résultat, bien moins de travail. Les règles déjà écrites ainsi sont ignorées.
--
-- Retour en arrière : voir 20261025c_fix_rls_auth_uid_perf.sql pour les formes d'origine.

do $$
declare
  r record;
  tbls text[] := array['card_likes','collection_tab_settings','grail_cards','user_set_completion','wishlist','profiles','team_contests'];
  rolelist text;
  expr_using text;
  expr_check text;
begin
  -- 1) FOR ALL + lecture publique « true » => INSERT / UPDATE / DELETE séparés
  for r in
    select p.*
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = any(tbls)
      and p.cmd = 'ALL'
      and p.permissive = 'PERMISSIVE'
      and exists (
        select 1 from pg_policies s
        where s.schemaname = p.schemaname and s.tablename = p.tablename
          and s.cmd = 'SELECT' and s.permissive = 'PERMISSIVE'
          and s.qual = 'true'
          and (s.roles = '{public}' or s.roles @> p.roles)
      )
  loop
    expr_using := coalesce(r.qual, r.with_check);
    expr_check := coalesce(r.with_check, r.qual);
    if expr_using is null then continue; end if;
    rolelist := array_to_string(r.roles, ', ');
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
    execute format('create policy %I on public.%I for insert to %s with check (%s)', r.policyname || ' (insert)', r.tablename, rolelist, expr_check);
    execute format('create policy %I on public.%I for update to %s using (%s) with check (%s)', r.policyname || ' (update)', r.tablename, rolelist, expr_using, expr_check);
    execute format('create policy %I on public.%I for delete to %s using (%s)', r.policyname || ' (delete)', r.tablename, rolelist, expr_using);
    raise notice 'séparé : %.% (%)', r.tablename, r.policyname, r.roles;
  end loop;

  -- 2) auth.uid() recalculé par ligne => (select auth.uid()) (règles signalées par le Performance Advisor)
  for r in
    select p.*
    from pg_policies p
    where p.schemaname = 'public'
      and (p.tablename, p.policyname) in (
        ('player_sheet_market_teams', 'admins manage market teams'),
        ('ebay_annonces', 'annonces eBay : lecture par leur auteur'),
        ('tcg_decks', 'decks : lecture par le propriétaire'),
        ('tcg_decks', 'decks : ajout par le propriétaire'),
        ('tcg_decks', 'decks : modification par le propriétaire'),
        ('tcg_decks', 'decks : suppression par le propriétaire'),
        ('trade_swipes', 'swipes : lecture de ses propres glissements'),
        ('ai_scan_events', 'ai_scan_events_select_own'),
        ('ai_scan_events', 'ai_scan_events_insert_own'),
        ('ai_scan_events', 'ai_scan_events_delete_own'),
        ('setlist_requests', 'demandes setlist : lecture'),
        ('setlist_request_votes', 'votes setlist : lecture des siens')
      )
  loop
    expr_using := r.qual;
    expr_check := r.with_check;
    if expr_using is not null and expr_using !~* 'select auth\.' then
      expr_using := regexp_replace(expr_using, 'auth\.(uid|jwt|role|email)\(\)', '(select auth.\1())', 'g');
    else
      expr_using := null;
    end if;
    if expr_check is not null and expr_check !~* 'select auth\.' then
      expr_check := regexp_replace(expr_check, 'auth\.(uid|jwt|role|email)\(\)', '(select auth.\1())', 'g');
    else
      expr_check := null;
    end if;
    if expr_using is not null and expr_check is not null then
      execute format('alter policy %I on public.%I using (%s) with check (%s)', r.policyname, r.tablename, expr_using, expr_check);
    elsif expr_using is not null then
      execute format('alter policy %I on public.%I using (%s)', r.policyname, r.tablename, expr_using);
    elsif expr_check is not null then
      execute format('alter policy %I on public.%I with check (%s)', r.policyname, r.tablename, expr_check);
    end if;
  end loop;
end $$;

analyze public.profiles;
analyze public.wishlist;
