-- Snapshots quotidiens des métriques clés — admin only
CREATE TABLE IF NOT EXISTS public.stats_snapshots (
  day            date PRIMARY KEY DEFAULT CURRENT_DATE,
  total_users    int  NOT NULL DEFAULT 0,
  total_cards    int  NOT NULL DEFAULT 0,
  active_users   int  NOT NULL DEFAULT 0,  -- actifs 30j
  total_scans    int  NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stats_snapshots ENABLE ROW LEVEL SECURITY;
-- Aucune policy = inaccessible via anon/authenticated key
