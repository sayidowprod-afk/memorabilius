require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function parseCsv(text) {
  const rows = text.split(/\r?\n/).slice(4);
  const out = [];
  rows.forEach(row => {
    const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    if (!c[0]?.includes('http')) return;
    out.push({
      img: c[0]?.trim(), back: (c[1]?.trim() || ''),
      name: (c[2] || '').replace(/^"|"$/g, ''), team: (c[3] || '').replace(/^"|"$/g, ''),
      year: (c[4] || '').replace(/^"|"$/g, ''), brand: (c[5] || '').replace(/^"|"$/g, ''),
      serie: (c[6] || '').replace(/^"|"$/g, ''), variant: (c[7] || '').replace(/^"|"$/g, ''),
      num: (c[8] || '').replace(/^"|"$/g, ''),
      auto: (c[9] || '').toLowerCase().includes('oui'), rc: (c[10] || '').toLowerCase().includes('oui'),
      patch: (c[11] || '').toLowerCase().includes('oui'),
    });
  });
  return out;
}

async function runPooled(items, workers, fn) {
  let i = 0, done = 0;
  await Promise.all(Array.from({ length: workers }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
      done++;
      if (done % 25 === 0) console.log(`${done}/${items.length}`);
    }
  }));
}

(async () => {
  const all = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('profiles').select('id, lien_csv').not('lien_csv', 'is', null).range(from, from + 999);
    if (error) { console.error(error); break; }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
  }
  const withCsv = all.filter(p => p.lien_csv);
  console.log('profiles to warm:', withCsv.length);

  const { data: cached } = await supabase.from('csv_cards_cache').select('profile_id, fetched_at');
  const freshIds = new Set((cached || []).filter(r => Date.now() - new Date(r.fetched_at).getTime() < 3600_000).map(r => r.profile_id));
  const todo = withCsv.filter(p => !freshIds.has(p.id));
  console.log('already fresh:', withCsv.length - todo.length, '| to fetch:', todo.length);

  let ok = 0, fail = 0;
  await runPooled(todo, 10, async p => {
    try {
      const r = await fetch(p.lien_csv, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) { fail++; return; }
      const cards = parseCsv(await r.text());
      const { error } = await supabase.from('csv_cards_cache').upsert({ profile_id: p.id, cards, fetched_at: new Date().toISOString() });
      if (error) { console.error('upsert error', p.id, error.message); fail++; } else ok++;
    } catch (e) {
      fail++;
    }
  });
  console.log('done. ok=', ok, 'fail=', fail);

  const { count } = await supabase.from('csv_cards_cache').select('profile_id', { count: 'exact', head: true });
  console.log('total cached rows now:', count);
})();
