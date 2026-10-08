'use client'
import { useState } from 'react'
import Link from 'next/link'
import { InstagramIcon, XIcon, DiscordIcon } from '@/components/SocialIcons'

// Aperçu de la nouvelle direction artistique -- voir page.tsx. Tout le style est
// ici, prefixe .dp-, et la page s'affiche en plein ecran par-dessus la navigation
// du site : rien ne fuit sur les vraies pages. Trois directions commutables
// (data-dir) qui ne different que par des variables CSS.
//
// Polices : Surfquest (fichiers dans /public). Regular pour titres/chiffres,
// Condensed pour les petites etiquettes. Les coins des CARTES ne sont jamais
// arrondis ; l'interface non plus (coins droits), sauf le cadre du telephone.

type Dir = 'A' | 'B' | 'C'

const SB = 'https://snnrkzbevjhdtviizfyp.supabase.co/storage/v1/object/public/avatars/cartes/eb730dee-414e-4fcb-89d8-4a7b3448c218/'
const CARDS = [
  { nom: 'Jared McCain', meta: '2024-25 · Panini · Contenders Optic', img: SB + '1787763372857_recto.jpg', tags: ['RC', 'AUTO'] },
  { nom: 'Anthony Edwards', meta: '2020-21 · Panini · Chronicles', img: SB + '1784235265864_recto.jpg', tags: ['RC'] },
  { nom: 'Michael Carter-Williams', meta: '2013-14 · Panini', img: SB + '1781875894817_recto.jpg', tags: ['RC', 'AUTO'] },
  { nom: 'Luwawu-Cabarrot', meta: '2016-17 · Panini · Gold Standard', img: SB + 'csv_1790632470730_4f41x1.jpg', tags: ['RC', 'AUTO', 'PATCH', '#038/149'] },
  { nom: 'Tyrese Maxey', meta: '2020-21 · Court Kings', img: SB + '1781291200820_recto.jpg', tags: ['RC'] },
  { nom: 'Hersey Hawkins', meta: '2018-19 · Panini · Prizm', img: SB + '1781534889963_recto.jpg', tags: ['AUTO'] },
  { nom: 'Tidjane Salaün', meta: '2024-25 · Panini · Totally Certified', img: SB + '1784216688323_recto.jpg', tags: ['RC'] },
  { nom: 'Carmelo Anthony', meta: '2012 · Nike · Olympics', img: SB + '1786023952939_recto.jpg', tags: ['AUTO'] },
  { nom: 'Jared McCain', meta: '2024-25 · Court Kings', img: SB + '1781291328026_recto.jpg', tags: ['RC'] },
]
const TABS = ['Collection', 'Classeurs', 'Objectifs', 'Badges', 'Commentaires']
const STATS = [
  { v: '577', l: 'Cartes' }, { v: '110', l: 'RC' }, { v: '29', l: 'Auto' }, { v: '85', l: 'Num' }, { v: '22', l: 'Patch' },
]

function Icon({ name, size = 26 }: { name: 'grid' | 'scan' | 'swap' | 'medal' | 'search' | 'user' | 'bell'; size?: number }) {
  const p: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7.5" height="7.5" /><rect x="13.5" y="3" width="7.5" height="7.5" /><rect x="3" y="13.5" width="7.5" height="7.5" /><rect x="13.5" y="13.5" width="7.5" height="7.5" /></>,
    scan: <><path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" /><path d="M7 12h10" /></>,
    swap: <><path d="M4 8h14l-3-3M20 16H6l3 3" /></>,
    medal: <><circle cx="12" cy="14" r="5.5" /><path d="M8.5 3h7l-2 6M10.5 9L8.5 3" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></>,
    bell: <><path d="M6 17V11a6 6 0 0112 0v6l2 2H4z" /><path d="M10 21h4" /></>,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" aria-hidden>
      {p[name]}
    </svg>
  )
}

// Logo actuel du site, inchange (version blanche : l'en-tete est toujours sur fond sombre)
function Wordmark({ height = 30 }: { height?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/memorabilius-logo-white.png" alt="Memorabilius" height={height} style={{ height, width: 'auto', display: 'block' }} />
}

function CardTile({ c }: { c: typeof CARDS[number] }) {
  return (
    <article className="dp-card">
      <div className="dp-tile">
        <div className="dp-tile-img">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.img} alt={c.nom} loading="lazy" />
          <div className="dp-tile-tags">{c.tags.map(t => <span key={t} className={`dp-tagchip dp-tagchip--${t.replace('#', 'n').toLowerCase()}`}>{t}</span>)}</div>
        </div>
        <div className="dp-tile-foot">
          <div className="dp-tile-row">
            <h4>{c.nom}</h4>
            <span className="dp-tile-ico" aria-hidden>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 5h16v11H9l-5 4z" /></svg>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20s-8-4.7-8-10.5A4.5 4.5 0 0112 7a4.5 4.5 0 018 2.5C20 15.300 12 20 12 20z" /></svg>
            </span>
          </div>
          <p>{c.meta}</p>
        </div>
      </div>
    </article>
  )
}

export default function DesignPreview() {
  const [dir, setDir] = useState<Dir>('A')
  const [tab, setTab] = useState('Collection')
  const [chip, setChip] = useState('Toutes')
  const ondark = dir === 'A' ? '' : ' dp-ondark'

  return (
    <div className="dp" data-dir={dir}>
      <style>{CSS}</style>
      {dir === 'A' && <div className="dp-grain-fixed" aria-hidden />}

      {/* Barre de controle de l'aperçu (pas partie de la DA) */}
      <div className="dp-ctl">
        <Link href="/" className="dp-ctl-back">← Quitter l’aperçu</Link>
        <div className="dp-ctl-title">Aperçu direction artistique</div>
        <div className="dp-ctl-sw" role="tablist" aria-label="Direction">
          {([['A', 'A · Sombre'], ['B', 'B · Hybride'], ['C', 'C · Clair']] as [Dir, string][]).map(([d, l]) => (
            <button key={d} role="tab" aria-selected={dir === d} className={dir === d ? 'on' : ''} onClick={() => setDir(d)}>{l}</button>
          ))}
        </div>
      </div>

      {/* 1 — Navigation */}
      <header className={`dp-nav${ondark}`}>
        <Wordmark />
        <div className="dp-links">
          <a>Communauté</a><a>Outils</a><a>Échanges</a><a>Tutoriel</a>
        </div>
        <div className="dp-nav-r">
          <button className="dp-iconbtn" aria-label="Notifications"><Icon name="bell" size={22} /></button>
          <button className="dp-btn dp-btn--sm">Connexion</button>
        </div>
      </header>

      {/* 2 — Accueil */}
      <section className={`dp-hero dp-grain${ondark}`}>
        <div className="dp-hero-txt">
          <div className="dp-kicker">La plateforme ultime pour les collectionneurs</div>
          <h1 className="dp-h1">Collectionne.<br />Identifie.<br />Échange.</h1>
          <p className="dp-lead">Galerie 3D interactive, scan par IA, prix eBay en direct et échanges entre passionnés. Gratuit.</p>
          <div className="dp-cta">
            <button className="dp-btn">Créer ma galerie</button>
            <button className="dp-btn dp-btn--ghost">Voir l’annuaire</button>
          </div>
        </div>
        <div className="dp-hero-cards" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={CARDS[2].img} alt="" className="c1" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={CARDS[0].img} alt="" className="c2" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={CARDS[3].img} alt="" className="c3" />
        </div>
      </section>
      <div className="dp-ticker" aria-hidden>
        <div>
          {Array.from({ length: 2 }).map((_, k) => (
            <span key={k}>Scan IA ✦ Galerie 3D ✦ Prix eBay en direct ✦ Échanges ✦ Badges ✦ Classeurs ✦ Gratuit ✦ </span>
          ))}
        </div>
      </div>

      {/* 3 — Profil + tableau de score */}
      <section className="dp-sec">
        <div className="dp-eyebrow"><span className="dp-frame">02 — Profil</span></div>
        <div className={`dp-profile${ondark}`}>
          <div className="dp-profile-id">
            <div className="dp-av">
              <div className="dp-av-ring"><span>G</span></div>
              <i className="dp-av-lvl">12</i>
              <i className="dp-av-on" />
            </div>
            <div className="dp-pmain">
              <div className="dp-pname">
                <h2 className="dp-h2">GKNNN_Cards</h2>
                <span className="dp-rep" title="Réputation d’échange">★ 100 % · 14 échanges</span>
                <span className="dp-team" title="Philadelphia 76ers">76</span>
                <span className="dp-team dp-team--b" title="San Jose Sharks">SJ</span>
              </div>
              <div className="dp-follow"><b>128</b> abonnés <span>·</span> <b>54</b> abonnements</div>
              <p className="dp-dim">Fondateur de Memorabilius.fr — PC 76ers et Iguodala Sixers Era</p>
              <div className="dp-pactions">
                <a className="dp-soc dp-soc--ig" title="Instagram"><InstagramIcon size={16} /></a>
                <a className="dp-soc dp-soc--x" title="X"><XIcon size={14} /></a>
                <a className="dp-soc dp-soc--dc" title="Discord"><DiscordIcon size={16} /></a>
                <button className="dp-btn dp-btn--sm">Message</button>
                <button className="dp-btn dp-btn--sm dp-btn--ghost">Suivre</button>
                <button className="dp-soc dp-soc--flag" title="Signaler" aria-label="Signaler">⚑</button>
              </div>
            </div>
            <div className="dp-pright">
              <span className="dp-badge">🏆 Top 4 % des collectionneurs</span>
              <div className="dp-pbtns">
                <button className="dp-btn dp-btn--sm dp-btn--ghost" aria-label="Plus d’actions">⋮</button>
                <button className="dp-btn dp-btn--sm">+ Ajouter</button>
              </div>
            </div>
          </div>
          <div className="dp-score">
            {STATS.map(s => (
              <div key={s.l}><b>{s.v}</b><span>{s.l}</span></div>
            ))}
          </div>
        </div>
      </section>

      {/* 4 — Galerie */}
      <section className="dp-sec">
        <div className="dp-eyebrow"><span className="dp-frame">03 — Galerie</span></div>
        <div className="dp-tabs">
          {TABS.map(t => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}
        </div>
        {tab === 'Collection' ? (
          <>
            <div className="dp-chips">
              {['Toutes', 'Rick Barry', 'Trade / vente', 'Sharks de San José', 'Auto joueurs Warriors'].map(t => <button key={t} className={chip === t ? 'on' : ''} onClick={() => setChip(t)}>{t}</button>)}
            </div>
            <div className="dp-vitrine">
              {(chip === 'Toutes' ? CARDS : chip === 'Trade / vente' ? CARDS.slice(0, 3) : chip === 'Auto joueurs Warriors' ? CARDS.filter(c => c.tags.includes('AUTO')) : CARDS.slice(3, 6)).map((c, i) => <CardTile key={chip + i} c={c} />)}
            </div>
          </>
        ) : (
          <div className="dp-vitrine dp-empty">
            <div className="dp-panel">
              <h3 className="dp-h2">{tab}</h3>
              <p className="dp-dim">Exemple de l’onglet « {tab} » dans la même direction : cadres, étiquettes et typographie identiques. Contenu réel inchangé sur le site.</p>
              <div className="dp-row"><span className="dp-tagchip dp-tagchip--rc">RC</span><span className="dp-tagchip dp-tagchip--auto">AUTO</span><span className="dp-tagchip dp-tagchip--patch">PATCH</span><span className="dp-badge">12 / 40</span></div>
            </div>
          </div>
        )}
      </section>

      {/* 5 — Composants */}
      <section className="dp-sec">
        <div className="dp-eyebrow"><span className="dp-frame">04 — Composants</span></div>
        <div className="dp-sheet">
          <div>
            <h5>Boutons</h5>
            <div className="dp-row">
              <button className="dp-btn">Principal</button>
              <button className="dp-btn dp-btn--ghost">Secondaire</button>
              <button className="dp-btn dp-btn--sm">Petit</button>
              <button className="dp-btn" disabled>Désactivé</button>
            </div>
          </div>
          <div>
            <h5>Étiquettes</h5>
            <div className="dp-row">
              <span className="dp-tagchip dp-tagchip--rc">RC</span><span className="dp-tagchip dp-tagchip--auto">AUTO</span>
              <span className="dp-tagchip dp-tagchip--patch">PATCH</span><span className="dp-tagchip dp-tagchip--n">#038/149</span>
              <span className="dp-badge">Nouveau</span>
            </div>
          </div>
          <div>
            <h5>Champ</h5>
            <label className="dp-field"><span>Nom du joueur</span><input placeholder="Ex : Jared McCain" /></label>
          </div>
          <div>
            <h5>Icônes</h5>
            <div className="dp-row dp-icons">
              {(['grid', 'scan', 'swap', 'medal', 'search', 'user'] as const).map(n => <span key={n} title={n}><Icon name={n} /></span>)}
            </div>
          </div>
          <div>
            <h5>Notification</h5>
            <div className="dp-toast"><b>Carte ajoutée</b><span>Jared McCain · 2024-25 · Panini</span></div>
          </div>
        </div>
      </section>

      {/* 6 — App */}
      <section className="dp-sec">
        <div className="dp-eyebrow"><span className="dp-frame">05 — Application</span></div>
        <div className="dp-phones">
          <div className="dp-notes">
            <h5>Dans l’app</h5>
            <ul>
              <li>L’interface de l’app mobile reste telle quelle (aucune modification de la navigation ni des écrans).</li>
              <li>Seul le visuel évolue : écran de lancement (dégradé + grain), couleurs, cadres de cartes, étiquettes.</li>
              <li>Captures Play Store dans le même style (titres Surfquest géants).</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 7 — Palette et typo */}
      <section className="dp-sec">
        <div className="dp-eyebrow"><span className="dp-frame">06 — Palette &amp; typographie</span></div>
        <div className="dp-swatches">
          {[['#050912', 'Nuit'], ['#08153B', 'Marine'], ['#003DA6', 'Bleu Memorabilius'], ['#2F6BFF', 'Bleu électrique'], ['#FFFFFF', 'Blanc'], ['#F1EFE8', 'Papier']].map(([h, n]) => (
            <div key={h}><i style={{ background: h }} /><b>{n}</b><span>{h}</span></div>
          ))}
        </div>
        <div className="dp-type">
          <div className="dp-t1">Surfquest Regular</div>
          <div className="dp-t2">Titres, chiffres, boutons</div>
          <div className="dp-t3">Surfquest Condensed — étiquettes, onglets, métadonnées</div>
          <p className="dp-body">Texte courant en police système, lisible et neutre : les descriptions, formulaires, messages. La personnalité vient des titres et des chiffres, pas du corps de texte.</p>
        </div>
      </section>

      <footer className="dp-foot">Aperçu de travail — non indexé, aucune donnée réelle modifiée.</footer>
    </div>
  )
}

const CSS = `
@font-face{font-family:'SQ';src:url('/Surfquest-3zVXL.otf') format('opentype');font-display:swap}
@font-face{font-family:'SQC';src:url('/SurfquestCondensed-ZVxOm.otf') format('opentype');font-display:swap}

.dp{position:fixed;inset:0;z-index:99999;overflow:auto;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;
  background:var(--bg);color:var(--text);transition:background .3s,color .3s;-webkit-font-smoothing:antialiased}
.dp *{box-sizing:border-box;border-radius:0}
:where(.dp) button{font:inherit;cursor:pointer;color:inherit}
:where(.dp) a{color:inherit;text-decoration:none}

/* ── Variables par direction ───────────────────────────────────────── */
.dp[data-dir=A]{--bg:linear-gradient(135deg,#050912 0%,#08153b 42%,#003da6 100%);--text:#fff;--dim:rgba(255,255,255,.62);
  --surface:rgba(255,255,255,.06);--line:rgba(255,255,255,.18);--frame:#fff;--btn-bg:#fff;--btn-text:#06122e;--accent:#fff;--vit:rgba(255,255,255,.04)}
.dp[data-dir=B]{--bg:#f1efe8;--text:#0a1228;--dim:rgba(10,18,40,.62);--surface:#fff;--line:#0a1228;--frame:#0a1228;
  --btn-bg:#003da6;--btn-text:#fff;--accent:#003da6;--vit:#e8e5db}
.dp[data-dir=C]{--bg:#f3f6fc;--text:#0a1228;--dim:rgba(10,18,40,.6);--surface:#fff;--line:rgba(10,18,40,.18);--frame:#003da6;
  --btn-bg:#003da6;--btn-text:#fff;--accent:#003da6;--vit:#e6ecf8}
/* Bloc sombre au sein d'une direction claire (en-tete, accueil, profil) */
.dp-ondark{--text:#fff;--dim:rgba(255,255,255,.66);--surface:rgba(255,255,255,.07);--line:rgba(255,255,255,.22);--frame:#fff;
  --btn-bg:#fff;--btn-text:#06122e;color:var(--text);background:linear-gradient(135deg,#050912 0%,#08153b 45%,#003da6 100%)}
.dp[data-dir=A] .dp-ondark{background:transparent}

/* Grain : bruit SVG leger, en surimpression */
.dp-grain{position:relative}
.dp-grain::after,.dp-grain-fixed{content:'';position:absolute;inset:0;pointer-events:none;opacity:.28;mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
.dp-grain-fixed{position:fixed;z-index:1;opacity:.22}
.dp > *:not(.dp-grain-fixed){position:relative;z-index:2}

/* ── Typographie ───────────────────────────────────────────────────── */
/* Surfquest uniquement pour les GROS titres et chiffres ; tout le reste (nav, onglets,
   boutons, etiquettes, noms de cartes) en police systeme grasse, lisible a toute taille. */
.dp-h1,.dp-h2,.dp-score b,.dp-t1,.dp-avatar{font-family:'SQ',Impact,sans-serif;text-transform:uppercase;font-weight:400}
.dp-btn,.dp-kicker,.dp-eyebrow,.dp-tabs button,.dp-chips button,.dp-tagchip,.dp-badge,.dp-score span,.dp-card h4,.dp-card p,.dp-links a,
.dp-ticker,.dp-sheet h5,.dp-notes h5,.dp-swatches b,.dp-t2,.dp-t3,.dp-field span,.dp-toast b,.dp-ctl{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;text-transform:uppercase;font-weight:800}
.dp-h1{font-size:clamp(54px,10.5vw,164px);line-height:.9;letter-spacing:-.005em;margin:.18em 0 .22em}
.dp-h2{font-size:clamp(40px,6vw,84px);line-height:.92;margin:0 0 8px}
.dp-kicker{font-size:clamp(17px,1.7vw,24px);letter-spacing:.12em;color:var(--dim)}
.dp-lead{font-size:clamp(16px,1.5vw,20px);line-height:1.55;max-width:34em;color:var(--dim);margin:0 0 28px;text-transform:none;font-family:system-ui,sans-serif}
.dp-dim{color:var(--dim);margin:0 0 12px;font-size:15px}

/* Cadre à double filet (signature du logo) */
.dp-frame{position:relative;display:inline-block;border:3px solid var(--frame);padding:6px 12px}
.dp-frame::after{content:'';position:absolute;inset:3px;border:1.5px solid var(--frame);pointer-events:none}
.dp-wordmark{line-height:1;letter-spacing:.02em;padding:.18em .5em}
.dp-eyebrow{margin:0 0 22px;font-size:21px;letter-spacing:.14em}
.dp-eyebrow .dp-frame{padding:5px 14px}

/* Boutons : angles droits, trait épais */
.dp-btn{display:inline-block;background:var(--btn-bg);color:var(--btn-text);border:3px solid var(--btn-bg);padding:14px 28px;font-size:22px;
  letter-spacing:.06em;transition:transform .15s,background .15s,color .15s;line-height:1}
.dp-btn:hover{background:transparent;color:var(--btn-bg);transform:translateY(-2px)}
.dp-btn--ghost{background:transparent;color:var(--text);border-color:var(--text)}
.dp-btn--ghost:hover{background:var(--text);color:var(--bg-contrast,var(--btn-text))}
.dp-btn--sm{padding:9px 16px;font-size:16px}
.dp-btn:disabled{opacity:.35;pointer-events:none}
.dp-iconbtn{background:none;border:0;padding:6px;display:grid;place-items:center}

/* ── Contrôle d'aperçu ─────────────────────────────────────────────── */
.dp-ctl{position:sticky!important;top:0;z-index:50!important;display:flex;align-items:center;gap:16px;padding:10px 20px;background:rgba(5,9,18,.88);
  backdrop-filter:blur(8px);color:#fff;font-size:15px;letter-spacing:.1em;flex-wrap:wrap}
.dp-ctl-title{flex:1;text-align:center;opacity:.6}
.dp-ctl-sw{display:flex;gap:6px}
.dp-ctl-sw button{background:transparent;border:2px solid rgba(255,255,255,.35);padding:6px 14px;font-family:'SQC',sans-serif;text-transform:uppercase;letter-spacing:.1em;font-size:14px;color:#fff}
.dp-ctl-sw button.on{background:#fff;color:#06122e;border-color:#fff}

/* ── Navigation ────────────────────────────────────────────────────── */
.dp-nav{display:flex;align-items:center;gap:32px;padding:18px clamp(16px,4vw,56px)}
.dp-links{display:flex;gap:28px;flex:1;font-size:21px;letter-spacing:.08em}
.dp-links a{opacity:.85;cursor:pointer;border-bottom:2px solid transparent;padding:4px 0}
.dp-links a:hover{opacity:1;border-color:var(--text)}
.dp-nav-r{display:flex;align-items:center;gap:14px}
@media(max-width:760px){.dp-links{display:none}.dp-nav{justify-content:space-between}}

/* ── Accueil ───────────────────────────────────────────────────────── */
.dp-hero{display:grid;grid-template-columns:1.25fr 1fr;gap:24px;align-items:center;padding:clamp(24px,5vw,72px) clamp(16px,4vw,56px) clamp(40px,6vw,96px);min-height:72vh;overflow:hidden}
.dp-hero-txt{position:relative;z-index:3}
.dp-cta{display:flex;gap:14px;flex-wrap:wrap}
.dp-hero-cards{position:relative;height:clamp(340px,46vw,640px);z-index:2}
.dp-hero-cards img{position:absolute;display:block;width:clamp(150px,19vw,290px);aspect-ratio:2.5/3.5;object-fit:cover;box-shadow:0 34px 70px rgba(0,0,0,.55),0 6px 0 rgba(255,255,255,.04);transition:transform .4s}
.dp-hero-cards .c1{left:2%;top:18%;transform:rotate(-9deg)}
.dp-hero-cards .c2{left:32%;top:2%;transform:rotate(5deg);z-index:2}
.dp-hero-cards .c3{right:0;top:30%;transform:rotate(-3deg)}
.dp-hero-cards:hover .c1{transform:rotate(-12deg) translateX(-8px)}
.dp-hero-cards:hover .c3{transform:rotate(1deg) translateX(8px)}
@media(max-width:860px){.dp-hero{grid-template-columns:1fr;min-height:0}.dp-hero-cards{height:360px}}

.dp-ticker{overflow:hidden;white-space:nowrap;border-block:3px solid var(--text);padding:10px 0;font-size:22px;letter-spacing:.12em;background:var(--btn-bg);color:var(--btn-text);
  border-color:var(--btn-bg)}
.dp[data-dir=A] .dp-ticker{background:#fff;color:#06122e;border-color:#fff}
.dp-ticker div{display:inline-block;animation:dpmq 28s linear infinite}
@keyframes dpmq{to{transform:translateX(-50%)}}

/* ── Sections ──────────────────────────────────────────────────────── */
.dp-sec{padding:clamp(32px,5vw,72px) clamp(16px,4vw,56px) 8px}

/* Profil / tableau de score */
.dp-profile{padding:clamp(20px,3vw,40px);border:3px solid var(--line)}
.dp:not([data-dir=A]) .dp-profile.dp-ondark{border-color:transparent}
.dp-profile-id{display:flex;gap:24px;align-items:center;margin-bottom:28px;flex-wrap:wrap}
.dp-profile-id{align-items:flex-start;flex-wrap:nowrap}
@media(max-width:860px){.dp-profile-id{flex-wrap:wrap}}
.dp-av{position:relative;flex-shrink:0;width:96px;height:96px}
.dp-av-ring{width:100%;height:100%;border-radius:50%!important;padding:4px;background:conic-gradient(#fff 0 62%,rgba(255,255,255,.22) 62% 100%)}
.dp-av-ring span{display:grid;place-items:center;width:100%;height:100%;border-radius:50%!important;background:#003da6;font-family:'SQ',sans-serif;font-size:44px;color:#fff;border:3px solid #08153b}
.dp-av-lvl{position:absolute;left:50%;bottom:-8px;transform:translateX(-50%);background:#fff;color:#06122e;font:800 12px system-ui;font-style:normal;padding:1px 8px}
.dp-av-on{position:absolute;right:4px;top:4px;width:16px;height:16px;background:#2fd072;border:3px solid #08153b;border-radius:50%!important}
.dp-pmain{flex:1;min-width:240px}
.dp-pname{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:6px}
.dp-pname .dp-h2{margin:0}
.dp-rep{font:800 12px system-ui;letter-spacing:.06em;text-transform:uppercase;background:#2fd072;color:#032612;padding:4px 9px}
.dp-team{display:grid;place-items:center;width:34px;height:34px;border-radius:50%!important;background:#fff;color:#c8102e;font:900 13px system-ui;border:2px solid #003da6}
.dp-team--b{color:#006d75}
.dp-follow{font-size:15px;color:var(--dim);margin-bottom:6px}
.dp-follow b{color:var(--text)}
.dp-pactions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}
.dp-soc{display:grid;place-items:center;width:34px;height:34px;border-radius:50%!important;border:0;padding:0;flex-shrink:0}
.dp-soc--ig{background:#fce4ec;color:#e1306c}.dp-soc--x{background:#f0f0f0;color:#121212}.dp-soc--dc{background:#eef0ff;color:#5865f2}
.dp-soc--flag{background:transparent;border:2px solid var(--line)!important;color:var(--dim);font-size:16px}
.dp-pright{display:flex;flex-direction:column;align-items:flex-end;gap:14px;margin-left:auto}
.dp-pbtns{display:flex;gap:8px}
.dp-avatar{font-family:'SQ',sans-serif;font-size:64px;padding:10px 26px;line-height:1.05}
.dp-badge{display:inline-block;border:2px solid var(--text);padding:3px 10px;font-size:15px;letter-spacing:.12em}
.dp-score{display:grid;grid-template-columns:repeat(5,1fr);border-top:3px solid var(--line)}
.dp-score>div{padding:18px 8px 6px;text-align:center;border-right:2px solid var(--line)}
.dp-score>div:last-child{border-right:0}
.dp-score b{display:block;font-size:clamp(40px,7vw,104px);line-height:1}
.dp-score span{font-size:clamp(16px,1.7vw,22px);letter-spacing:.14em;color:var(--dim)}

/* Galerie */
.dp-tabs{display:flex;gap:4px;border-bottom:3px solid var(--line);margin-bottom:18px;overflow-x:auto}
.dp-tabs button{background:none;border:0;padding:12px 18px;font-size:23px;letter-spacing:.1em;color:var(--dim);border-bottom:6px solid transparent;margin-bottom:-3px;white-space:nowrap}
.dp-tabs button.on{color:var(--text);border-bottom-color:var(--text)}
.dp-chips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:22px}
.dp-chips button{background:transparent;border:2px solid var(--line);padding:6px 14px;font-size:19px;letter-spacing:.06em;color:var(--dim)}
.dp-chips button.on{background:var(--text);color:var(--bg-solid,#fff);border-color:var(--text)}
.dp[data-dir=A] .dp-chips button.on{color:#06122e}
.dp-vitrine{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:26px 22px;padding:clamp(18px,3vw,36px);
  background:radial-gradient(120% 90% at 50% 0%,var(--vit),transparent 70%);border:3px solid var(--line)}
@media(max-width:600px){.dp-vitrine{grid-template-columns:repeat(2,1fr);gap:20px 12px;padding:12px}.dp-card h4{font-size:17px}.dp-score b{font-size:34px}}
.dp-card{cursor:pointer;transition:transform .25s}
.dp-empty{display:block;min-height:220px}
.dp-panel{max-width:36em}
.dp-card:hover{transform:translateY(-8px)}
/* Tuile : on garde l'esprit de la galerie actuelle (tuile blanche encadree + infos),
   en version DA : cadre bleu a double filet, angles droits, pastilles sur la carte. */
.dp-card{display:flex}
.dp-tile{flex:1;min-width:0;position:relative;background:#fff;color:#0a1228;border:3px solid #003da6;padding:8px;box-shadow:0 16px 30px rgba(0,0,0,.32);transition:box-shadow .25s}
.dp-tile::after{content:'';position:absolute;inset:3px;border:1.5px solid rgba(0,61,166,.45);pointer-events:none}
.dp-card:hover .dp-tile{box-shadow:0 28px 46px rgba(0,0,0,.42)}
.dp-tile-img{position:relative;background:#eef1f8}
.dp-tile-img img{display:block;width:100%;aspect-ratio:2.5/3.5;object-fit:cover}
.dp-tile-tags{position:absolute;left:6px;bottom:6px;right:6px;display:flex;gap:4px;flex-wrap:wrap}
.dp-tile-foot{padding:10px 4px 4px}
.dp-tile-row{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
.dp-tile-ico{display:flex;gap:7px;color:#7a86a3;flex-shrink:0;padding-top:1px}
.dp-card h4{margin:0 0 3px;font-size:15px;letter-spacing:.02em;line-height:1.2;color:#0a1228}
.dp-card p{margin:0;font-size:11.5px;letter-spacing:.04em;color:#5b6684;font-weight:600;line-height:1.35}
.dp-tags{display:flex;gap:6px;flex-wrap:wrap}
/* Etiquettes : pleines, texte fonce/clair a fort contraste, lisibles sur fond sombre comme clair */
.dp-tagchip{display:inline-block;padding:3px 9px;font-size:13px;letter-spacing:.09em;line-height:1.3;border:2px solid transparent}
.dp-tagchip--rc{background:#ffb02e;color:#241300}
.dp-tagchip--auto{background:#2fd072;color:#032612}
.dp-tagchip--patch{background:#2f6bff;color:#fff}
.dp-tagchip--n{background:#fff;color:#0a1228;border-color:#0a1228}
.dp-tile-tags .dp-tagchip{font-size:12px;padding:2px 7px;box-shadow:0 2px 6px rgba(0,0,0,.35)}

/* Composants */
.dp-sheet{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:22px}
.dp-sheet>div{border:3px solid var(--line);padding:20px;background:var(--surface)}
.dp-sheet h5,.dp-notes h5{margin:0 0 16px;font-size:16px;letter-spacing:.16em;color:var(--dim);font-weight:400}
.dp-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.dp-icons span{display:grid;place-items:center;width:48px;height:48px;border:2px solid var(--line)}
.dp-field{display:block}
.dp-field span{display:block;font-size:15px;letter-spacing:.14em;color:var(--dim);margin-bottom:6px}
.dp-field input{width:100%;background:transparent;border:0;border-bottom:3px solid var(--text);padding:10px 2px;font-size:18px;color:var(--text);outline:none;font-family:system-ui,sans-serif}
.dp-field input:focus{border-bottom-color:var(--accent);box-shadow:0 4px 0 -1px var(--accent)}
.dp-field input::placeholder{color:var(--dim)}
.dp-toast{border-left:8px solid var(--accent);padding:12px 16px;background:var(--surface);display:grid;gap:2px}
.dp-toast b{font-size:20px;letter-spacing:.1em;font-weight:400}
.dp-toast span{color:var(--dim);font-size:14px}

/* Application */
.dp-phones{display:flex;gap:40px;align-items:flex-start;flex-wrap:wrap}
.dp-phone{width:330px;border:10px solid #0b0b0f;border-radius:44px!important;background:#0b0b0f;box-shadow:0 40px 80px rgba(0,0,0,.4);flex-shrink:0}
.dp-phone-in{border-radius:34px!important;overflow:hidden;height:660px;display:flex;flex-direction:column;
  background:linear-gradient(160deg,#050912,#08153b 55%,#003da6);color:#fff;
  --text:#fff;--dim:rgba(255,255,255,.65);--frame:#fff;--line:rgba(255,255,255,.2)}
.dp[data-dir=B] .dp-phone-in,.dp[data-dir=C] .dp-phone-in{background:var(--bg);color:var(--text);--text:#0a1228;--dim:rgba(10,18,40,.62);--frame:#0a1228;--line:rgba(10,18,40,.2)}
.dp-phone *{border-radius:0}
.dp-app-top{display:flex;justify-content:space-between;align-items:center;padding:16px 16px 10px}
.dp-app-hero{margin:6px 16px 14px;padding:16px;border:3px solid var(--line);overflow:hidden}
.dp-app-hero .dp-kicker{font-size:13px}
.dp-app-num{font-size:84px;line-height:1}
.dp-app-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 16px;flex:1;overflow:hidden;align-content:start}
.dp-app-grid img{width:100%;aspect-ratio:2.5/3.5;object-fit:cover;display:block;box-shadow:0 10px 20px rgba(0,0,0,.35)}
.dp-app-nav{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;align-items:end;border-top:3px solid var(--line);padding:8px 6px 14px;background:rgba(0,0,0,.18)}
.dp[data-dir=B] .dp-app-nav,.dp[data-dir=C] .dp-app-nav{background:var(--surface)}
.dp-app-nav span{display:grid;justify-items:center;gap:3px;font-size:12px;letter-spacing:.1em;opacity:.65}
.dp-app-nav span.on{opacity:1}
.dp-app-nav span.scan{opacity:1;background:var(--btn-bg);color:var(--btn-text);padding:12px 0;margin-top:-26px;border:3px solid var(--bg-edge,transparent)}
.dp[data-dir=A] .dp-app-nav span.scan{background:#fff;color:#06122e}
.dp-notes{flex:1;min-width:260px}
.dp-notes ul{margin:0;padding-left:20px;line-height:1.8;color:var(--dim)}

/* Palette & typo */
.dp-swatches{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:28px}
.dp-swatches>div{display:grid;gap:3px}
.dp-swatches i{display:block;height:84px;border:3px solid var(--line)}
.dp-swatches b{font-size:16px;letter-spacing:.1em;font-weight:400}
.dp-swatches span{color:var(--dim);font-size:13px;font-family:ui-monospace,monospace}
.dp-type{border:3px solid var(--line);padding:clamp(18px,3vw,36px);background:var(--surface)}
.dp-t1{font-size:clamp(48px,9vw,128px);line-height:.95}
.dp-t2{font-size:clamp(24px,3.4vw,44px);color:var(--dim);margin:8px 0 18px}
.dp-t3{font-size:20px;letter-spacing:.1em;margin-bottom:14px}
.dp-body{max-width:44em;line-height:1.65;color:var(--dim);margin:0}
.dp-foot{padding:40px;text-align:center;color:var(--dim);font-size:13px}
`
