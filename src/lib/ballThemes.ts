// Fonds de galerie inspirés de la matière de chaque balle (cuir granuleux, coutures, feutre, alvéoles), dessinés en CSS / SVG : aucune image hébergée.
const uri = (svg: string) => `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`

const basketSeams = uri(`<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><g fill='none' stroke='#1a0d05' stroke-width='7' stroke-linecap='round'><path d='M200 0V400'/><path d='M0 200H400'/><path d='M70 0Q150 200 70 400'/><path d='M330 0Q250 200 330 400'/></g></svg>`)
const baseSeams = uri(`<svg xmlns='http://www.w3.org/2000/svg' width='360' height='360'><g fill='none' stroke='#c0262d' stroke-linecap='round'><path d='M60 -20Q150 180 60 380' stroke-width='4' stroke-dasharray='3 9'/><path d='M76 -20Q166 180 76 380' stroke-width='4' stroke-dasharray='3 9'/><path d='M300 -20Q210 180 300 380' stroke-width='4' stroke-dasharray='3 9'/><path d='M284 -20Q194 180 284 380' stroke-width='4' stroke-dasharray='3 9'/><path d='M60 -20Q150 180 60 380' stroke='#b9b19a' stroke-width='1.5' stroke-opacity='.5'/><path d='M300 -20Q210 180 300 380' stroke='#b9b19a' stroke-width='1.5' stroke-opacity='.5'/></g></svg>`)
const tennisSeam = uri(`<svg xmlns='http://www.w3.org/2000/svg' width='520' height='520'><g fill='none' stroke='#f7faf0' stroke-linecap='round'><path d='M-20 130C110 10 230 250 360 110S500 30 540 70' stroke-width='14' stroke-opacity='.85'/><path d='M-20 390C110 270 230 510 360 370S500 290 540 330' stroke-width='14' stroke-opacity='.85'/></g></svg>`)
const footballLaces = uri(`<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'><g stroke='#f4f1e8' stroke-linecap='round'><rect x='96' y='0' width='14' height='320' fill='#f4f1e8' stroke='none'/><rect x='210' y='0' width='14' height='320' fill='#f4f1e8' stroke='none'/><path d='M160 15V305' stroke-width='5'/>${Array.from({ length: 7 }, (_, i) => `<path d='M142 ${40 + i * 40}H178' stroke-width='5'/>`).join('')}</g></svg>`)
const volleySeams = uri(`<svg xmlns='http://www.w3.org/2000/svg' width='420' height='420'><g fill='none' stroke='#16224a' stroke-width='5' stroke-linecap='round' stroke-opacity='.85'><path d='M0 120Q210 40 420 120'/><path d='M0 300Q210 220 420 300'/><path d='M140 0Q90 210 140 420'/><path d='M280 0Q330 210 280 420'/></g></svg>`)

const noise = (freq: string, matrix: string, size = 220, octaves = 3) => uri(`<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='${octaves}' stitchTiles='stitch'/><feColorMatrix values='${matrix}'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`)
const grainD = noise('.85', '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .7 -.12')
const fuzz = noise('1.4', '0 0 0 0 .95 0 0 0 0 1 0 0 0 0 .5 0 0 0 1 -.35', 160, 2)
const pebble = 'radial-gradient(circle at 50% 50%, rgba(0,0,0,.24) 0 1.3px, transparent 1.8px) 0 0/7px 7px, radial-gradient(circle at 50% 50%, rgba(255,210,150,.16) 0 1.3px, transparent 1.8px) 3.5px 3.5px/7px 7px'
const veil = 'linear-gradient(rgba(0,0,0,.38), rgba(0,0,0,.38))'
const vig = 'radial-gradient(ellipse at 50% 40%, transparent 45%, rgba(0,0,0,.5) 100%)'
const dimple = 'radial-gradient(circle at 35% 35%, rgba(255,255,255,.95) 0 2px, rgba(0,0,0,.2) 5px, transparent 6.5px)'

export const BALL_THEMES = [
  { id: 'balle-basket', label: 'Ballon de basket' },
  { id: 'balle-baseball', label: 'Balle de baseball' },
  { id: 'balle-tennis', label: 'Balle de tennis' },
  { id: 'balle-football', label: 'Ballon de foot US' },
  { id: 'balle-hockey', label: 'Rondelle de hockey' },
  { id: 'balle-golf', label: 'Balle de golf' },
  { id: 'balle-volley', label: 'Ballon de volley' },
] as const

const BG: Record<string, string> = {
  'balle-basket': `${vig}, ${basketSeams} 0 0/400px 400px, ${pebble}, ${grainD}, linear-gradient(135deg,#d96a1b,#b4500f)`,
  'balle-baseball': `${vig}, ${baseSeams} 0 0/360px 360px, ${grainD}, linear-gradient(160deg,#ebe5d3,#d8d0b8)`,
  'balle-tennis': `${vig}, ${tennisSeam} 0 0/520px 520px, ${fuzz}, ${fuzz} 60px 60px, linear-gradient(160deg,#b9d11f,#98ad12)`,
  'balle-football': `${vig}, ${footballLaces} 0 0/320px 320px, ${pebble}, ${grainD}, linear-gradient(135deg,#7a4423,#54290f)`,
  'balle-hockey': `${vig}, repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,.04) 0 2px, transparent 2px 26px), ${grainD}, radial-gradient(ellipse at 30% 10%, rgba(255,255,255,.13), transparent 55%), #17181c`,
  'balle-golf': `${veil}, ${vig}, ${dimple} 0 0/16px 16px, ${dimple} 8px 8px/16px 16px, #e9e9ee`,
  'balle-volley': `${vig}, ${volleySeams} 0 0/420px 420px, ${grainD}, repeating-linear-gradient(60deg, #f2cf3b 0 80px, #f6f4ee 80px 160px, #2a62c9 160px 240px)`,
}

// Style inline (fond) d'un thème « balle » ; objet vide si l'identifiant n'en est pas un.
export const ballStyle = (id: string | null | undefined): { background?: string } => (id && BG[id] ? { background: BG[id] } : {})
