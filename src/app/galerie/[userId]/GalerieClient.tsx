'use client'
import { toast } from '@/lib/toast'
import { useEffect, useState, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import dynamic from 'next/dynamic'
import OnlineIndicator from '@/components/OnlineIndicator'
const CommentsModal = dynamic(() => import('@/components/CommentsModal'), { ssr: false })
const GalerieExport = dynamic(() => import('@/components/GalerieExport'), { ssr: false })
const CollectionStats = dynamic(() => import('@/components/CollectionStats'), { ssr: false })
const PublicWishlist = dynamic(() => import('@/components/PublicWishlist'), { ssr: false })
const GalerieComments = dynamic(() => import('@/components/GalerieComments'), { ssr: false })
const TradeModal = dynamic(() => import('@/components/TradeModal'), { ssr: false })
const LikedCards = dynamic(() => import('@/components/LikedCards'), { ssr: false })
const BinderLibrary = dynamic(() => import('@/components/BinderLibrary'), { ssr: false })
const MesPCTab = dynamic(() => import('@/components/MesPCTab'), { ssr: false })
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors, type DragEndEvent
} from '@dnd-kit/core'
import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const Viewer3D = dynamic(() => import('@/components/Viewer3D'), { ssr: false })
import { useLang } from '@/lib/LangContext'
import { useTheme } from '@/lib/ThemeContext'
import { getSpeciality, getTeamById } from '@/lib/sportsTeams'
import { cardDisplayRatio, isHorizontalFormat, getFormat } from '@/lib/cardFormats'
import TeamBadge from '@/components/TeamBadge'

// ── Helpers numériques (module scope pour éviter re-création à chaque render) ──
const numValue = (num: string) => { const m = num.trim().match(/\/(\d+)$/); return m ? parseInt(m[1]) : null }
const cardNumValue = (cn?: string) => { if (!cn) return null; const m = cn.trim().match(/(\d+)/); return m ? parseInt(m[1]) : null }
const isOneOfOne = (num: string) => numValue(num) === 1
const isLowNum = (num: string) => { const v = numValue(num); return v !== null && v >= 2 && v <= 10 }
const isBronzeNum = (num: string) => { const v = numValue(num); return v !== null && v >= 11 && v <= 25 }

// ── Palettes onglets (static) ────────────────────────────────────────────────
const TAB_COLORS = [
  '#E53935','#C62828','#AD1457','#880E4F',
  '#F4511E','#E65100','#FF8F00','#F9A825',
  '#FDD835','#C8A23A','#A57C00','#FFD700',
  '#43A047','#2E7D32','#00796B','#006064',
  '#039BE5','#0288D1','#0277BD','#01579B',
  '#1565C0','#283593','#1A237E','#003DA6',
  '#7B1FA2','#6A1B9A','#4A148C','#512DA8',
  '#E91E63','#D81B60','#F06292','#F48FB1',
  '#37474F','#455A64','#546E7A','#000000',
  '#78909C','#90A4AE','#CFD8DC','#FFFFFF',
]
const TAB_GRADIENTS = [
  { label: 'Sunset', value: 'linear-gradient(135deg,#f97316,#ec4899)' },
  { label: 'Ocean', value: 'linear-gradient(135deg,#0ea5e9,#6366f1)' },
  { label: 'Forest', value: 'linear-gradient(135deg,#16a34a,#0d9488)' },
  { label: 'Galaxy', value: 'linear-gradient(135deg,#7c3aed,#db2777)' },
  { label: 'Gold', value: 'linear-gradient(135deg,#f59e0b,#b45309)' },
  { label: 'Ice', value: 'linear-gradient(135deg,#38bdf8,#818cf8)' },
  { label: 'Lava', value: 'linear-gradient(135deg,#dc2626,#f97316)' },
  { label: 'Midnight', value: 'linear-gradient(135deg,#1e3a5f,#7c3aed)' },
  { label: 'Rose', value: 'linear-gradient(135deg,#f43f5e,#fb923c)' },
  { label: 'Matrix', value: 'linear-gradient(135deg,#14532d,#22c55e)' },
  { label: 'Flame', value: 'linear-gradient(135deg,#ff6b00,#ffd700)' },
  { label: 'Arctic', value: 'linear-gradient(135deg,#a8edea,#4facfe)' },
  { label: 'Neon', value: 'linear-gradient(135deg,#00f2fe,#4facfe)' },
  { label: 'Dusk', value: 'linear-gradient(135deg,#a18cd1,#fbc2eb)' },
  { label: 'Chrome', value: 'linear-gradient(135deg,#868f96,#596164)' },
  { label: 'Coral', value: 'linear-gradient(135deg,#ff9a9e,#fad0c4)' },
  { label: 'Bronze', value: 'linear-gradient(135deg,#c97b4b,#f5d09c)' },
  { label: 'Cobalt', value: 'linear-gradient(135deg,#003166,#0057b8)' },
  { label: 'Jade', value: 'linear-gradient(135deg,#004d40,#1de9b6)' },
  { label: 'Crimson', value: 'linear-gradient(135deg,#6d0f0f,#c0392b)' },
]
const TEAM_THEMES: { label: string; value: string; sport: string }[] = [
  // NBA (30)
  { label: 'Hawks', value: 'linear-gradient(135deg,#E03A3E,#C1D32F)', sport: 'NBA' },
  { label: 'Celtics', value: 'linear-gradient(135deg,#007A33,#BA9653)', sport: 'NBA' },
  { label: 'Nets', value: 'linear-gradient(135deg,#000000,#FFFFFF)', sport: 'NBA' },
  { label: 'Hornets', value: 'linear-gradient(135deg,#1D1160,#00788C)', sport: 'NBA' },
  { label: 'Bulls', value: 'linear-gradient(135deg,#CE1141,#000000)', sport: 'NBA' },
  { label: 'Cavs', value: 'linear-gradient(135deg,#860038,#FDBB30)', sport: 'NBA' },
  { label: 'Mavs', value: 'linear-gradient(135deg,#00538C,#002B5E)', sport: 'NBA' },
  { label: 'Nuggets', value: 'linear-gradient(135deg,#0E2240,#FEC524)', sport: 'NBA' },
  { label: 'Pistons', value: 'linear-gradient(135deg,#C8102E,#006BB6)', sport: 'NBA' },
  { label: 'Warriors', value: 'linear-gradient(135deg,#1D428A,#FFC72C)', sport: 'NBA' },
  { label: 'Rockets', value: 'linear-gradient(135deg,#CE1141,#000000)', sport: 'NBA' },
  { label: 'Pacers', value: 'linear-gradient(135deg,#002D62,#FDBB30)', sport: 'NBA' },
  { label: 'Clippers', value: 'linear-gradient(135deg,#C8102E,#1D428A)', sport: 'NBA' },
  { label: 'Lakers', value: 'linear-gradient(135deg,#552583,#FDB927)', sport: 'NBA' },
  { label: 'Grizzlies', value: 'linear-gradient(135deg,#5D76A9,#12173F)', sport: 'NBA' },
  { label: 'Heat', value: 'linear-gradient(135deg,#98002E,#F9A01B)', sport: 'NBA' },
  { label: 'Bucks', value: 'linear-gradient(135deg,#00471B,#EEE1C6)', sport: 'NBA' },
  { label: 'Wolves', value: 'linear-gradient(135deg,#0C2340,#236192)', sport: 'NBA' },
  { label: 'Pelicans', value: 'linear-gradient(135deg,#0C2340,#C8102E)', sport: 'NBA' },
  { label: 'Knicks', value: 'linear-gradient(135deg,#006BB6,#F58426)', sport: 'NBA' },
  { label: 'Thunder', value: 'linear-gradient(135deg,#007AC1,#EF3B24)', sport: 'NBA' },
  { label: 'Magic', value: 'linear-gradient(135deg,#0077C0,#C4CED4)', sport: 'NBA' },
  { label: '76ers', value: 'linear-gradient(135deg,#006BB6,#ED174C)', sport: 'NBA' },
  { label: 'Suns', value: 'linear-gradient(135deg,#1D1160,#E56020)', sport: 'NBA' },
  { label: 'Blazers', value: 'linear-gradient(135deg,#E03A3E,#000000)', sport: 'NBA' },
  { label: 'Kings', value: 'linear-gradient(135deg,#5A2D81,#63727A)', sport: 'NBA' },
  { label: 'Spurs', value: 'linear-gradient(135deg,#000000,#C4CED4)', sport: 'NBA' },
  { label: 'Raptors', value: 'linear-gradient(135deg,#CE1141,#000000)', sport: 'NBA' },
  { label: 'Jazz', value: 'linear-gradient(135deg,#002B5C,#00471B)', sport: 'NBA' },
  { label: 'Wizards', value: 'linear-gradient(135deg,#002B5C,#E31837)', sport: 'NBA' },
  // NHL (32)
  { label: 'Ducks', value: 'linear-gradient(135deg,#B09967,#000000)', sport: 'NHL' },
  { label: 'Coyotes', value: 'linear-gradient(135deg,#8C2633,#E2D6B5)', sport: 'NHL' },
  { label: 'Bruins', value: 'linear-gradient(135deg,#000000,#FFB81C)', sport: 'NHL' },
  { label: 'Sabres', value: 'linear-gradient(135deg,#003399,#FFBE00)', sport: 'NHL' },
  { label: 'Flames', value: 'linear-gradient(135deg,#C8102E,#F1BE48)', sport: 'NHL' },
  { label: 'Hurricanes', value: 'linear-gradient(135deg,#CC0000,#000000)', sport: 'NHL' },
  { label: 'Blackhawks', value: 'linear-gradient(135deg,#CF0A2C,#000000)', sport: 'NHL' },
  { label: 'Avalanche', value: 'linear-gradient(135deg,#6F263D,#236192)', sport: 'NHL' },
  { label: 'Blue Jackets', value: 'linear-gradient(135deg,#002654,#CE1126)', sport: 'NHL' },
  { label: 'Stars', value: 'linear-gradient(135deg,#006847,#8F8F8C)', sport: 'NHL' },
  { label: 'Red Wings', value: 'linear-gradient(135deg,#CE1126,#FFFFFF)', sport: 'NHL' },
  { label: 'Oilers', value: 'linear-gradient(135deg,#FF4C00,#003777)', sport: 'NHL' },
  { label: 'Panthers', value: 'linear-gradient(135deg,#041E42,#C8102E)', sport: 'NHL' },
  { label: 'Kings', value: 'linear-gradient(135deg,#111111,#A2AAAD)', sport: 'NHL' },
  { label: 'Wild', value: 'linear-gradient(135deg,#154734,#A6192E)', sport: 'NHL' },
  { label: 'Canadiens', value: 'linear-gradient(135deg,#AF1E2D,#192168)', sport: 'NHL' },
  { label: 'Predators', value: 'linear-gradient(135deg,#FFB81C,#041E42)', sport: 'NHL' },
  { label: 'Devils', value: 'linear-gradient(135deg,#CE1126,#000000)', sport: 'NHL' },
  { label: 'Islanders', value: 'linear-gradient(135deg,#003087,#FC4C02)', sport: 'NHL' },
  { label: 'Rangers', value: 'linear-gradient(135deg,#0038A8,#CE1126)', sport: 'NHL' },
  { label: 'Senators', value: 'linear-gradient(135deg,#C52032,#C69214)', sport: 'NHL' },
  { label: 'Flyers', value: 'linear-gradient(135deg,#F74902,#000000)', sport: 'NHL' },
  { label: 'Penguins', value: 'linear-gradient(135deg,#000000,#FCB514)', sport: 'NHL' },
  { label: 'Sharks', value: 'linear-gradient(135deg,#006D75,#EA7200)', sport: 'NHL' },
  { label: 'Kraken', value: 'linear-gradient(135deg,#001628,#99D9D9)', sport: 'NHL' },
  { label: 'Blues', value: 'linear-gradient(135deg,#002F87,#FCB514)', sport: 'NHL' },
  { label: 'Lightning', value: 'linear-gradient(135deg,#002868,#FFFFFF)', sport: 'NHL' },
  { label: 'Maple Leafs', value: 'linear-gradient(135deg,#003E7E,#FFFFFF)', sport: 'NHL' },
  { label: 'Canucks', value: 'linear-gradient(135deg,#00205B,#00843D)', sport: 'NHL' },
  { label: 'Golden Kts', value: 'linear-gradient(135deg,#B4975A,#333F42)', sport: 'NHL' },
  { label: 'Capitals', value: 'linear-gradient(135deg,#041E42,#C8102E)', sport: 'NHL' },
  { label: 'Jets', value: 'linear-gradient(135deg,#041E42,#004C97)', sport: 'NHL' },
  // MLB (30)
  { label: 'D-backs', value: 'linear-gradient(135deg,#A71930,#E3D4AD)', sport: 'MLB' },
  { label: 'Braves', value: 'linear-gradient(135deg,#13274F,#CE1141)', sport: 'MLB' },
  { label: 'Orioles', value: 'linear-gradient(135deg,#DF4601,#000000)', sport: 'MLB' },
  { label: 'Red Sox', value: 'linear-gradient(135deg,#BD3039,#0C2340)', sport: 'MLB' },
  { label: 'Cubs', value: 'linear-gradient(135deg,#0E3386,#CC3433)', sport: 'MLB' },
  { label: 'White Sox', value: 'linear-gradient(135deg,#27251F,#C4CED3)', sport: 'MLB' },
  { label: 'Reds', value: 'linear-gradient(135deg,#C6011F,#000000)', sport: 'MLB' },
  { label: 'Guardians', value: 'linear-gradient(135deg,#00385D,#E50022)', sport: 'MLB' },
  { label: 'Rockies', value: 'linear-gradient(135deg,#333366,#C4CED4)', sport: 'MLB' },
  { label: 'Tigers', value: 'linear-gradient(135deg,#0C2340,#FA4616)', sport: 'MLB' },
  { label: 'Astros', value: 'linear-gradient(135deg,#002D62,#EB6E1F)', sport: 'MLB' },
  { label: 'Royals', value: 'linear-gradient(135deg,#004687,#BD9B60)', sport: 'MLB' },
  { label: 'Angels', value: 'linear-gradient(135deg,#BA0021,#003263)', sport: 'MLB' },
  { label: 'Dodgers', value: 'linear-gradient(135deg,#005A9C,#EF3E42)', sport: 'MLB' },
  { label: 'Marlins', value: 'linear-gradient(135deg,#00A3E0,#FF6600)', sport: 'MLB' },
  { label: 'Brewers', value: 'linear-gradient(135deg,#0A2351,#B6922E)', sport: 'MLB' },
  { label: 'Twins', value: 'linear-gradient(135deg,#002B5C,#D31145)', sport: 'MLB' },
  { label: 'Mets', value: 'linear-gradient(135deg,#002D72,#FF5910)', sport: 'MLB' },
  { label: 'Yankees', value: 'linear-gradient(135deg,#003087,#E4002C)', sport: 'MLB' },
  { label: "A's", value: 'linear-gradient(135deg,#003831,#EFB21E)', sport: 'MLB' },
  { label: 'Phillies', value: 'linear-gradient(135deg,#E81828,#002D72)', sport: 'MLB' },
  { label: 'Pirates', value: 'linear-gradient(135deg,#27251F,#FDB827)', sport: 'MLB' },
  { label: 'Padres', value: 'linear-gradient(135deg,#2F241D,#FFC425)', sport: 'MLB' },
  { label: 'Giants SF', value: 'linear-gradient(135deg,#FD5A1E,#27251F)', sport: 'MLB' },
  { label: 'Mariners', value: 'linear-gradient(135deg,#0C2C56,#005C5C)', sport: 'MLB' },
  { label: 'Cardinals', value: 'linear-gradient(135deg,#C41E3A,#0C2340)', sport: 'MLB' },
  { label: 'Rays', value: 'linear-gradient(135deg,#092C5C,#8FBCE6)', sport: 'MLB' },
  { label: 'Rangers', value: 'linear-gradient(135deg,#003278,#C0111F)', sport: 'MLB' },
  { label: 'Blue Jays', value: 'linear-gradient(135deg,#134A8E,#E8291C)', sport: 'MLB' },
  { label: 'Nationals', value: 'linear-gradient(135deg,#AB0003,#14225A)', sport: 'MLB' },
  // NFL (32)
  { label: 'Cardinals', value: 'linear-gradient(135deg,#97233F,#000000)', sport: 'NFL' },
  { label: 'Falcons', value: 'linear-gradient(135deg,#A71930,#000000)', sport: 'NFL' },
  { label: 'Ravens', value: 'linear-gradient(135deg,#241773,#000000)', sport: 'NFL' },
  { label: 'Bills', value: 'linear-gradient(135deg,#00338D,#C60C30)', sport: 'NFL' },
  { label: 'Panthers', value: 'linear-gradient(135deg,#0085CA,#101820)', sport: 'NFL' },
  { label: 'Bears', value: 'linear-gradient(135deg,#0B162A,#C83803)', sport: 'NFL' },
  { label: 'Bengals', value: 'linear-gradient(135deg,#FB4F14,#000000)', sport: 'NFL' },
  { label: 'Browns', value: 'linear-gradient(135deg,#311D00,#FF3C00)', sport: 'NFL' },
  { label: 'Cowboys', value: 'linear-gradient(135deg,#003594,#869397)', sport: 'NFL' },
  { label: 'Broncos', value: 'linear-gradient(135deg,#FB4F14,#002244)', sport: 'NFL' },
  { label: 'Lions', value: 'linear-gradient(135deg,#0076B6,#B0B7BC)', sport: 'NFL' },
  { label: 'Packers', value: 'linear-gradient(135deg,#203731,#FFB612)', sport: 'NFL' },
  { label: 'Texans', value: 'linear-gradient(135deg,#03202F,#A71930)', sport: 'NFL' },
  { label: 'Colts', value: 'linear-gradient(135deg,#002C5F,#A2AAAD)', sport: 'NFL' },
  { label: 'Jaguars', value: 'linear-gradient(135deg,#101820,#D7A22A)', sport: 'NFL' },
  { label: 'Chiefs', value: 'linear-gradient(135deg,#E31837,#FFB81C)', sport: 'NFL' },
  { label: 'Raiders', value: 'linear-gradient(135deg,#000000,#A5ACAF)', sport: 'NFL' },
  { label: 'Chargers', value: 'linear-gradient(135deg,#0080C6,#FFC20E)', sport: 'NFL' },
  { label: 'Rams', value: 'linear-gradient(135deg,#003594,#FFA300)', sport: 'NFL' },
  { label: 'Dolphins', value: 'linear-gradient(135deg,#008E97,#FC4C02)', sport: 'NFL' },
  { label: 'Vikings', value: 'linear-gradient(135deg,#4F2683,#FFC62F)', sport: 'NFL' },
  { label: 'Patriots', value: 'linear-gradient(135deg,#002244,#C60C30)', sport: 'NFL' },
  { label: 'Saints', value: 'linear-gradient(135deg,#101820,#D3BC8D)', sport: 'NFL' },
  { label: 'Giants NY', value: 'linear-gradient(135deg,#0B2265,#A71930)', sport: 'NFL' },
  { label: 'Jets', value: 'linear-gradient(135deg,#125740,#000000)', sport: 'NFL' },
  { label: 'Eagles', value: 'linear-gradient(135deg,#004C54,#A5ACAF)', sport: 'NFL' },
  { label: 'Steelers', value: 'linear-gradient(135deg,#101820,#FFB612)', sport: 'NFL' },
  { label: '49ers', value: 'linear-gradient(135deg,#AA0000,#B3995D)', sport: 'NFL' },
  { label: 'Seahawks', value: 'linear-gradient(135deg,#002244,#69BE28)', sport: 'NFL' },
  { label: 'Buccaneers', value: 'linear-gradient(135deg,#D50A0A,#FF7900)', sport: 'NFL' },
  { label: 'Titans', value: 'linear-gradient(135deg,#0C2340,#4B92DB)', sport: 'NFL' },
  { label: 'Commanders', value: 'linear-gradient(135deg,#5A1414,#FFB612)', sport: 'NFL' },
]

function SortableCard({ id, disabled, children, className, style, onClick }: {
  id: string; disabled: boolean; children: React.ReactNode
  className?: string; style?: React.CSSProperties; onClick?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
  return (
    <div
      ref={setNodeRef}
      className={className}
      style={{ ...style, transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 999 : undefined }}
      onClick={onClick}
      {...attributes}
    >
      {!disabled && (
        <div
          {...listeners}
          style={{
            position: 'absolute', bottom: 6, right: 6, zIndex: 10,
            width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.45)', borderRadius: 6, cursor: 'grab',
            touchAction: 'none', color: 'white', fontSize: 16, lineHeight: 1,
            userSelect: 'none',
          }}
        >
          ⠿
        </div>
      )}
      {children}
    </div>
  )
}

const PAGE_SIZE = 24

function cardThumb(url: string): string {
  if (!url || !url.includes('.supabase.co/storage/v1/object/public/')) return url
  return url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') + '?width=300&quality=70&resize=contain'
}

function renderCardImage(card: { f: string; n: string; format?: string; is_horizontal?: boolean }) {
  const src = cardThumb(card.f)
  const fmt = getFormat(card.format)
  const horiz = isHorizontalFormat(card.format, card.is_horizontal)
  // La grille utilise des emplacements uniformément portrait (2.5/3.5) pour
  // garder l'alignement des colonnes ; les cartes horizontales sont pivotées
  // à l'intérieur plutôt que d'élargir leur emplacement (sinon incohérent
  // avec la rotation ci-dessous, qui est calculée pour un cadre portrait fixe)
  const ratio = fmt.isSlab ? cardDisplayRatio(card.format, card.is_horizontal) : '2.5/3.5'

  if (fmt.isSlab) {
    return (
      <div style={{ aspectRatio: ratio, overflow: 'hidden', position: 'relative', background: '#111' }}>
        <img src={src} alt={card.n} loading="lazy" decoding="async"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
    )
  }

  return (
    <div style={{ aspectRatio: ratio, overflow: 'hidden', position: 'relative' }}>
      {horiz ? (
        <img src={src} alt={card.n} loading="lazy" decoding="async"
          style={{ position: 'absolute', width: '140%', height: '71.43%', left: '-20%', top: '14.286%', transform: 'rotate(90deg)', objectFit: 'cover', display: 'block' }} />
      ) : (
        <img src={src} alt={card.n} loading="lazy" decoding="async"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      )}
    </div>
  )
}

interface Card {
  id_manuelle?: string;
  f: string; b: string; n: string; t: string; y: string
  br: string; s: string; v: string; num: string; card_number?: string; cert_number?: string
  auto: boolean; rc: boolean; patch: boolean; printing_plate?: boolean; g: string
  booklet?: boolean; is_horizontal?: boolean; verso_is_horizontal?: boolean | null; format?: string; il?: string; ir?: string
  isManuelle?: boolean; disponible_vente?: boolean; beckett_designation?: string; item_type?: string
  storage_binder?: string; storage_page?: number | null; storage_slot?: string;
  created_at?: string; position?: number; collection_tag?: string; collections?: string[];
}

export default function GalerieClient({ userId, initialCardUrl }: { userId: string; initialCardUrl?: string }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [cardsLoaded, setCardsLoaded] = useState(false)
  const [displayed, setDisplayed] = useState<Card[]>([])
  const [page, setPage] = useState(1)
  const [activeFilters, setActiveFilters] = useState({ rc: false, auto: false, num: false, patch: false })
  const [filterPrivate, setFilterPrivate] = useState(false)
  const [filterVente, setFilterVente] = useState(searchParams.get('vente') === '1')
  const [filterMemo, setFilterMemo] = useState(false)
  const [sortBy, setSortBy] = useState<'default' | 'n' | 'n_desc' | 't' | 'y' | 'y_desc' | 's' | 'v' | 'g' | 'valeur' | 'valeur_desc' | 'num_asc' | 'card_num_asc' | 'card_num_desc' | 'date_desc' | 'date_asc'>(searchParams.get('sort') as any || 'default')
  const [sortBy2, setSortBy2] = useState<'none' | 'n' | 'n_desc' | 't' | 'y' | 'y_desc' | 's' | 'v' | 'num_asc' | 'card_num_asc' | 'card_num_desc' | 'date_desc' | 'date_asc'>(searchParams.get('sort2') as any || 'none')
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '')
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [fTeam, setFTeam] = useState(searchParams.get('team') || '')
  const [fBrand, setFBrand] = useState(searchParams.get('brand') || '')
  const [fYear, setFYear] = useState(searchParams.get('year') || '')
  const [fCollectionTag, setFCollectionTag] = useState(searchParams.get('tag') || '')
  const [pinTeam, setPinTeam] = useState(searchParams.get('pin') || '')
  const [teams, setTeams] = useState<string[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [years, setYears] = useState<string[]>([])
  const [collectionTags, setCollectionTags] = useState<string[]>([])
  const [tabSettings, setTabSettings] = useState<Map<string, { color: string; position: number; parent?: string | null }>>(new Map())
  const [draggedTag, setDraggedTag] = useState<string | null>(null)
  const dragLastOverRef = useRef<string | null>(null)
  const [colorPickerTag, setColorPickerTag] = useState<string | null>(null)
  const [teamThemeSport, setTeamThemeSport] = useState<'NBA' | 'NHL' | 'MLB' | 'NFL'>('NBA')
  const [cardLikes, setCardLikes] = useState<Map<string, { count: number; liked: boolean }>>(new Map())
  const [commentCard, setCommentCard] = useState<Card | null>(null)
  const [commentCounts, setCommentCounts] = useState<Map<string, number>>(new Map())
  const [deleteTagConfirm, setDeleteTagConfirm] = useState<string | null>(null)
  const [deleteCardConfirm, setDeleteCardConfirm] = useState<string | null>(null)
  const [deleteGrailConfirm, setDeleteGrailConfirm] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const isGradient = (c: string) => c.startsWith('linear-gradient')
  // Retourne les styles de bordure corrects pour couleur unie ou dégradé
  const coloredBorder = (color: string, width = 2): React.CSSProperties => {
    if (!color) return { border: `${width}px solid ${accent}` }
    if (isGradient(color)) return {
      background: color,
      border: 'none',
    }
    return { border: `${width}px solid ${color}` }
  }
  const [popup, setPopup] = useState<Card | null>(null)
  const [tradeCard, setTradeCard] = useState<Card | null>(null)
  const [tradeSent, setTradeSent] = useState(false)
  const [showConversionBanner, setShowConversionBanner] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [privateCards, setPrivateCards] = useState<Set<string>>(new Set())
  const [cardValues, setCardValues] = useState<Map<string, number>>(new Map())
  const [editMode, setEditMode] = useState(false)
  const [qrMode, setQrMode] = useState(false)
  const [qrSelected, setQrSelected] = useState<Map<string, { url: string; title: string; subtitle: string }>>(new Map())
  const [qrDownloading, setQrDownloading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<'collection' | 'objectifs' | 'comments' | 'library' | 'likes'>(() => {
    const t = searchParams.get('tab')
    if (t === 'wishlist' || t === 'pc') return 'objectifs'
    return (t as any) || 'collection'
  })
  const [objectifsSubTab, setObjectifsSubTab] = useState<'pc' | 'wishlist'>(
    searchParams.get('tab') === 'wishlist' ? 'wishlist' : 'pc'
  )
  const initialBinderId = searchParams.get('binder') ? parseInt(searchParams.get('binder')!, 10) : null
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set())
  const [shareCopied, setShareCopied] = useState(false)
  const [bulkNewTag, setBulkNewTag] = useState('')
  const [showBulkNewTag, setShowBulkNewTag] = useState(false)
  const [monthlyBadges, setMonthlyBadges] = useState<string[]>([])
  const [csvTags, setCsvTags] = useState<Map<string, string>>(new Map())
  const [grailCards, setGrailCards] = useState<{ card_key: string; position: number }[]>([])
  const [grailSearch, setGrailSearch] = useState('')
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set())
  const [grailPickerOpen, setGrailPickerOpen] = useState(false)
  const [addedCards, setAddedCards] = useState<Set<string>>(new Set())
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [actionMenuOpen, setActionMenuOpen] = useState(false)
  const loaderRef = useRef<HTMLDivElement>(null)

  const isOwner = currentUser === userId
  const { t, lang } = useLang()
  const { dark } = useTheme()
  const cardParam = searchParams.get('card')

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const init = async () => {
      try {
        let resolvedId = userId
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(userId)) {
          const { data: p } = await supabase.from('profiles').select('id').eq('slug', userId).single()
          if (p) resolvedId = p.id
          else { setLoaded(true); return }
        }

        // Session + tags + profil en parallèle — getSession mutualisé pour éviter un 2e appel plus bas
        const [{ data: { session } }, { data: tagsData }, { data: profileData }] = await Promise.all([
          supabase.auth.getSession(),
          supabase.from('carte_tags').select('card_key, collection_tag').eq('user_id', resolvedId),
          supabase.from('profiles').select('*').eq('id', resolvedId).single(),
        ])
        const uid = session?.user?.id || null
        setCurrentUser(uid)
        const tagsMap = new Map((tagsData || []).map((r: any) => [r.card_key, r.collection_tag]))
        setCsvTags(tagsMap)

        if (profileData) { setProfile(profileData); loadCSV(profileData.lien_csv ?? null, tagsMap, profileData.gallery_order || []) }
        else setLoaded(true)
        supabase.from('badges').select('mois').eq('user_id', resolvedId).eq('type', 'collectionneur_du_mois').order('mois', { ascending: false }).limit(6).then(({ data }) => {
          if (data) setMonthlyBadges(data.map((b: any) => b.mois))
        })
        supabase.from('collection_tab_settings').select('tag, color, position, parent').eq('user_id', resolvedId).then(({ data }) => {
          if (data) setTabSettings(new Map(data.map((r: any) => [r.tag, { color: r.color, position: r.position, parent: r.parent ?? null }])))
        })
        supabase.from('grail_cards').select('card_key, position').eq('user_id', resolvedId).order('position').then(({ data }) => {
          if (data) setGrailCards(data)
        })
        // Charger les likes — uid déjà connu, pas de 2e getSession
        supabase.from('card_likes').select('card_key, liker_user_id').eq('gallery_user_id', resolvedId).limit(2000)
          .then(({ data: likesData }) => {
            if (!likesData) return
            const map = new Map<string, { count: number; liked: boolean }>()
            for (const l of likesData) {
              const prev = map.get(l.card_key) || { count: 0, liked: false }
              map.set(l.card_key, { count: prev.count + 1, liked: prev.liked || l.liker_user_id === uid })
            }
            setCardLikes(map)
          })
        loadCommentCounts(resolvedId)
      } catch (e) {
        console.error('Gallery init error', e)
        setLoaded(true)
      }
    }
    init()
  }, [userId])

  useEffect(() => {
    supabase.from('cartes_privees').select('card_key').eq('user_id', userId)
      .then(({ data }) => {
        if (data) setPrivateCards(new Set(data.map((d: any) => d.card_key)))
      })
    supabase.from('card_values').select('card_key,valeur').eq('user_id', userId)
      .then(({ data }) => {
        if (data) setCardValues(new Map(data.map((d: any) => [d.card_key, d.valeur])))
      })
  }, [userId])

  const loadCommentCounts = async (galleryUserId: string) => {
    const { data } = await supabase.from('galerie_comments').select('card_key').eq('galerie_user_id', galleryUserId).not('card_key', 'is', null).limit(2000)
    const map = new Map<string, number>()
    for (const row of data || []) map.set(row.card_key, (map.get(row.card_key) || 0) + 1)
    setCommentCounts(map)
  }

  const togglePrivate = async (cardKey: string) => {
    if (!currentUser || currentUser !== userId) return
    if (privateCards.has(cardKey)) {
      await supabase.from('cartes_privees').delete().eq('user_id', userId).eq('card_key', cardKey)
      setPrivateCards(prev => { const s = new Set(prev); s.delete(cardKey); return s })
    } else {
      await supabase.from('cartes_privees').insert({ user_id: userId, card_key: cardKey })
      setPrivateCards(prev => new Set([...prev, cardKey]))
    }
  }

  // Nouvelle fonction pour supprimer définitivement une carte ajoutée à la main
  const handleDeleteCard = async (idManuelle: string, cardKey: string) => {
    if (!currentUser || currentUser !== userId) return

    try {
      // 1. Mise à jour classement mensuel + stats_total (avant suppression pour lire created_at)
      const { data: { session } } = await supabase.auth.getSession()
      fetch('/api/card-added', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ userId, cardId: idManuelle }),
      }).catch(e => console.error('[card-added DELETE] stats divergence:', e))

      // 2. Suppression de la table des cartes manuelles
      const { error } = await supabase.from('cartes_manuelles').delete().eq('id', idManuelle).eq('user_id', userId)
      if (error) throw error

      // 3. Nettoyage de sa visibilité si elle était en mode privé
      await supabase.from('cartes_privees').delete().eq('user_id', userId).eq('card_key', cardKey)
      
      // 3. Mise à jour de l'état local pour faire disparaître l'élément instantanément
      setCards(prev => prev.filter(c => c.id_manuelle !== idManuelle))
      setPrivateCards(prev => { const s = new Set(prev); s.delete(cardKey); return s })
    } catch (e: any) {
      toast.error('Erreur lors de la suppression : ' + e.message)
    }
  }

  // Ajoute les cartes sélectionnées à une collection (appartenance multiple)
  const addSelectedToCollection = async (tag: string) => {
    if (!currentUser || !tag) return
    const rows: { user_id: string; card_key: string; collection: string }[] = []
    for (const id of selectedCards) {
      const card = cards.find(c => (c.isManuelle ? c.id_manuelle : c.f) === id)
      if (card) rows.push({ user_id: currentUser, card_key: card.f, collection: tag })
    }
    if (rows.length === 0) return
    await supabase.from('card_collections').upsert(rows, { onConflict: 'user_id,card_key,collection' })
    setCards(prev => prev.map(c => {
      const id = c.isManuelle ? c.id_manuelle : c.f
      if (!id || !selectedCards.has(id)) return c
      const cols = [...new Set([...(c.collections || []), tag])]
      return { ...c, collections: cols, collection_tag: cols[0] || '' }
    }))
    if (!collectionTags.includes(tag)) setCollectionTags(prev => [...prev, tag].sort())
  }

  // Retire les cartes sélectionnées de TOUTES leurs collections
  const removeSelectedFromAllCollections = async () => {
    if (!currentUser) return
    const keys: string[] = []
    for (const id of selectedCards) {
      const card = cards.find(c => (c.isManuelle ? c.id_manuelle : c.f) === id)
      if (card) keys.push(card.f)
    }
    if (keys.length === 0) return
    await supabase.from('card_collections').delete().eq('user_id', currentUser).in('card_key', keys)
    // Nettoie aussi l'ancien champ (cartes manuelles + carte_tags) pour éviter la ré-union au reload
    for (const id of selectedCards) {
      const card = cards.find(c => (c.isManuelle ? c.id_manuelle : c.f) === id)
      if (!card) continue
      if (card.isManuelle && card.id_manuelle) await supabase.from('cartes_manuelles').update({ collection_tag: null }).eq('id', card.id_manuelle)
      else await supabase.from('carte_tags').delete().eq('user_id', currentUser).eq('card_key', card.f)
    }
    setCards(prev => prev.map(c => {
      const id = c.isManuelle ? c.id_manuelle : c.f
      return id && selectedCards.has(id) ? { ...c, collections: [], collection_tag: '' } : c
    }))
  }

  const startBulkEdit = () => {
    const manualIds = [...selectedCards].filter(id => cards.some(c => c.id_manuelle === id))
    if (!manualIds.length) { toast.error('Aucune carte modifiable sélectionnée (cartes CSV non supportées)'); return }
    const queue = manualIds.join(',')
    router.push(`/galerie/${userId}/editer/${manualIds[0]}?queue=${queue}&qidx=0`)
  }

  const loadCSV = async (url: string | null, tagsMap?: Map<string, string>, galleryOrder: string[] = []) => {
    try {
      let parsed: Card[] = []
      if (url) {
        const r = await fetch(url + '&t=' + Math.floor(Date.now() / 300000))
        const t = await r.text()
        const rows = t.split(/\r?\n/).slice(4)
        parsed = rows.map(row => {
          const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
          if (!c[0] || !c[0].includes('http')) return null
          return {
            f: c[0]?.trim(), b: c[1]?.trim() || c[0]?.trim(),
            n: c[2] || '', t: c[3] || '', y: c[4] || '',
            br: c[5] || '', s: c[6] || '', v: c[7] || '',
            num: c[8] || '', auto: c[9]?.toLowerCase().includes('oui') || false,
            rc: c[10]?.toLowerCase().includes('oui') || false,
            patch: c[11]?.toLowerCase().includes('oui') || false,
            g: c[12] || 'Raw', card_number: c[13]?.trim() || '', isManuelle: false,
            collection_tag: (tagsMap || csvTags).get(c[0]?.trim()) || ''
          }
        }).filter(Boolean) as Card[]
      }

      const { count: manuellesCount } = await supabase.from('cartes_manuelles').select('*', { count: 'exact', head: true }).eq('user_id', userId)
      const pageCount = Math.ceil((manuellesCount || 0) / 1000) || 1
      const manuelleBatches = await Promise.all(
        Array.from({ length: pageCount }, (_, i) =>
          supabase.from('cartes_manuelles').select('*').eq('user_id', userId).order('created_at', { ascending: true }).range(i * 1000, i * 1000 + 999).then(r => r.data || [])
        )
      )
      const manuelles = manuelleBatches.flat()
      const cartesM: Card[] = (manuelles || []).map((m: any) => ({
        id_manuelle: m.id,
        f: m.image_recto || 'https://placehold.co/300x420?text=No+Image',
        b: m.image_verso || m.image_recto || 'https://placehold.co/300x420?text=No+Image',
        n: m.nom || '', t: m.equipe || '', y: m.annee || '',
        br: m.marque || '', s: m.collection || '', v: m.variation || '',
        num: m.num || '', card_number: m.card_number || '', cert_number: m.cert_number || '', auto: m.auto || false, rc: m.rc || false,
        patch: m.patch || false, printing_plate: m.printing_plate || false, g: m.grade || 'Raw', isManuelle: true, beckett_designation: m.beckett_designation || '',
        booklet: m.booklet || false, is_horizontal: m.is_horizontal || false, verso_is_horizontal: m.verso_is_horizontal ?? null, format: m.format || (m.is_horizontal ? 'horizontal' : 'standard'),
        il: m.image_interieur_gauche || '', ir: m.image_interieur_droite || '',
        created_at: m.created_at || '', position: m.position ?? 9999,
        collection_tag: m.collection_tag || '', disponible_vente: m.disponible_vente || false, item_type: m.item_type || 'card',
        storage_binder: m.storage_binder || '', storage_page: m.storage_page ?? null, storage_slot: m.storage_slot || '',
      }))

      // Appartenance multi-collections (table card_collections) → Map<card_key, string[]>
      const { data: ccData } = await supabase.from('card_collections').select('card_key, collection').eq('user_id', userId)
      const ccMap = new Map<string, string[]>()
      for (const r of ccData || []) {
        const arr = ccMap.get(r.card_key) || []
        arr.push(r.collection); ccMap.set(r.card_key, arr)
      }
      // Attache collections[] (union card_collections + ancien collection_tag) et
      // fixe collection_tag = 1re collection (utilisé pour la couleur de bordure)
      const attachCollections = (card: Card) => {
        const legacy = card.collection_tag ? [card.collection_tag] : []
        const cols = [...new Set([...(ccMap.get(card.f) || []), ...legacy])]
        card.collections = cols
        card.collection_tag = cols[0] || ''
      }
      parsed.forEach(attachCollections)
      cartesM.forEach(attachCollections)

      // Trier les cartes manuelles par position sauvegardée (fallback sans gallery_order)
      cartesM.sort((a, b) => (a.position ?? 9999) - (b.position ?? 9999))
      const allCards = [...parsed, ...cartesM]

      // Appliquer l'ordre personnalisé global si défini
      if (galleryOrder.length > 0) {
        const orderMap = new Map(galleryOrder.map((key, idx) => [key, idx]))
        allCards.sort((a, b) => {
          const pa = orderMap.get(a.id_manuelle || a.f) ?? 99999
          const pb = orderMap.get(b.id_manuelle || b.f) ?? 99999
          return pa - pb
        })
      }
      setCards(allCards)
      setCardsLoaded(true)
      setTeams([...new Set(allCards.map(d => d.t).filter(Boolean))].sort())
      setBrands([...new Set(allCards.map(d => d.s).filter(Boolean))].sort())
      setYears([...new Set(allCards.map(d => d.y).filter(Boolean))].sort())
      setCollectionTags([...new Set(allCards.flatMap(d => d.collections || []).filter(Boolean) as string[])].sort())
      setLoaded(true)
      // Auto-ouvre la carte depuis ?card= ou depuis initialCardUrl (route /[cardSlug])
      const target = initialCardUrl || (cardParam ? decodeURIComponent(cardParam) : null)
      if (target) {
        const match = allCards.find(c => c.f === target)
        if (match) setPopup(match)
      }
    } catch (e) { console.error('CSV error', e); setLoaded(true) }
  }

  const filtered = useMemo(() => {
    const matchCols = new Set<string>()
    if (fCollectionTag) {
      matchCols.add(fCollectionTag)
      for (const [tag, s] of tabSettings) if (s.parent === fCollectionTag) matchCols.add(tag)
    }
    const f = cards.filter(d => {
      if (!isOwner && privateCards.has(d.f)) return false
      return (
        (d.n.toLowerCase().includes(search.toLowerCase()) || d.v.toLowerCase().includes(search.toLowerCase())) &&
        (!fTeam || d.t.toLowerCase().includes(fTeam.toLowerCase())) &&
        (!fBrand || d.s.toLowerCase().includes(fBrand.toLowerCase())) &&
        (!fYear || d.y === fYear) &&
        (!fCollectionTag || (d.collections || []).some(c => matchCols.has(c))) &&
        (!activeFilters.rc || d.rc) &&
        (!activeFilters.auto || d.auto) &&
        (!activeFilters.patch || d.patch) &&
        (!activeFilters.num || d.num !== '') &&
        (!filterPrivate || privateCards.has(d.f)) &&
        (!filterVente || d.disponible_vente) &&
        (!filterMemo || (d.item_type && d.item_type !== 'card'))
      )
    })
    const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' })
    const lastName = (n: string) => n.trim().split(' ').slice(-1)[0] || n
    const val = (d: Card) => cardValues.get(d.f) ?? -Infinity
    const applySort = (key: string, a: Card, b: Card): number => {
      switch (key) {
        case 'n':          return cmp(lastName(a.n), lastName(b.n)) || cmp(a.n, b.n)
        case 'n_desc':     return cmp(lastName(b.n), lastName(a.n)) || cmp(b.n, a.n)
        case 't':          return cmp(a.t, b.t)
        case 'y':          return cmp(a.y, b.y)
        case 'y_desc':     return cmp(b.y, a.y)
        case 's':          return cmp(a.s, b.s)
        case 'v':          return cmp(a.v, b.v)
        case 'g':          return cmp(a.g, b.g)
        case 'valeur':     return val(b) - val(a)
        case 'valeur_desc':return val(a) - val(b)
        case 'num_asc': {
          const na = numValue(a.num) ?? Infinity
          const nb = numValue(b.num) ?? Infinity
          return na - nb
        }
        case 'card_num_asc': {
          const na = cardNumValue(a.card_number) ?? Infinity
          const nb = cardNumValue(b.card_number) ?? Infinity
          return na !== nb ? na - nb : cmp(a.card_number || '', b.card_number || '')
        }
        case 'card_num_desc': {
          const na = cardNumValue(a.card_number) ?? Infinity
          const nb = cardNumValue(b.card_number) ?? Infinity
          return na !== nb ? nb - na : cmp(b.card_number || '', a.card_number || '')
        }
        case 'date_desc': return (b.created_at || '').localeCompare(a.created_at || '')
        case 'date_asc':  return (a.created_at || '').localeCompare(b.created_at || '')
        default:           return 0
      }
    }
    return [...f].sort((a, b) => {
      if (pinTeam) {
        const aPin = a.t === pinTeam
        const bPin = b.t === pinTeam
        if (aPin && !bPin) return -1
        if (!aPin && bPin) return 1
      }
      const primary = applySort(sortBy, a, b)
      if (primary !== 0 || sortBy2 === 'none') return primary
      return applySort(sortBy2, a, b)
    })
  }, [cards, search, fTeam, fBrand, fYear, fCollectionTag, activeFilters, filterPrivate, filterVente, filterMemo, privateCards, isOwner, sortBy, sortBy2, pinTeam, cardValues, tabSettings])

  const filteredStats = useMemo(() => ({
    rc:   filtered.filter(c => c.rc).length,
    auto: filtered.filter(c => c.auto).length,
    num:  filtered.filter(c => c.num !== '').length,
    patch: filtered.filter(c => c.patch).length,
  }), [filtered])

  useEffect(() => { setPage(1) }, [filtered])

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && displayed.length < filtered.length) {
        setPage(p => p + 1)
      }
    }, { threshold: 0.1 })
    if (loaderRef.current) observer.observe(loaderRef.current)
    return () => observer.disconnect()
  }, [displayed, filtered])

  useEffect(() => {
    setDisplayed(filtered.slice(0, page * PAGE_SIZE))
  }, [page, filtered])

  useEffect(() => {
    if (!loaded) return
    const sp = new URLSearchParams()
    if (search) sp.set('q', search)
    if (fTeam) sp.set('team', fTeam)
    if (fBrand) sp.set('brand', fBrand)
    if (fYear) sp.set('year', fYear)
    if (fCollectionTag) sp.set('tag', fCollectionTag)
    if (sortBy !== 'default') sp.set('sort', sortBy)
    if (sortBy2 !== 'none') sp.set('sort2', sortBy2)
    if (pinTeam) sp.set('pin', pinTeam)
    if (filterVente) sp.set('vente', '1')
    if (popup?.f) sp.set('card', encodeURIComponent(popup.f))
    const str = sp.toString()
    router.replace(str ? `?${str}` : window.location.pathname, { scroll: false })
  }, [loaded, search, fTeam, fBrand, fYear, fCollectionTag, sortBy, sortBy2, pinTeam, filterVente, popup])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!popup) return
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
      // Don't steal arrows from inputs
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return
      e.preventDefault()
      const idx = filtered.findIndex(c => c.f === popup.f)
      if (idx === -1) return
      const next = e.key === 'ArrowRight' ? idx + 1 : idx - 1
      if (next >= 0 && next < filtered.length) setPopup(filtered[next])
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [popup, filtered])

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 500)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const toggleFilter = (k: keyof typeof activeFilters) => setActiveFilters(p => ({ ...p, [k]: !p[k] }))

  const getCardId = (c: Card) => c.id_manuelle || c.f

  const toggleQrCard = (d: Card) => {
    const cardId = getCardId(d)
    setQrSelected(prev => {
      const next = new Map(prev)
      if (next.has(cardId)) {
        next.delete(cardId)
      } else {
        next.set(cardId, {
          url: d.id_manuelle ? `/s/${d.id_manuelle}` : `/galerie/${userId}?card=${encodeURIComponent(d.f)}`,
          title: d.n,
          subtitle: [d.y, d.br, d.s].filter(Boolean).join(' · '),
        })
      }
      return next
    })
  }

  const downloadQrCodes = async () => {
    if (qrSelected.size === 0 || qrDownloading) return
    setQrDownloading(true)
    try {
      const [{ default: QRCode }, { default: JSZip }] = await Promise.all([
        import('qrcode'),
        import('jszip'),
      ])
      const BRAND = '#003DA6'
      const phys = 880
      const lgW = 640, lgH = 144, lpad = 12, bR = 32

      const logo = new Image()
      logo.src = '/memorabilius-logo-qr-hd.png'
      await logo.decode().catch(() => {})

      function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
        ctx.beginPath()
        ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
        ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r)
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h)
        ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r)
        ctx.arcTo(x, y, x + r, y, r); ctx.closePath()
      }

      const zip = new JSZip()
      for (const [, { url, title, subtitle }] of qrSelected.entries()) {
        const fullUrl = `https://www.memorabilius.fr${url.startsWith('/') ? url : '/' + url}`

        const qrCanvas = document.createElement('canvas')
        await QRCode.toCanvas(qrCanvas, fullUrl, {
          width: phys, margin: 2, errorCorrectionLevel: 'H' as const,
          color: { dark: BRAND, light: '#ffffff' },
        })

        const ctx = qrCanvas.getContext('2d')!
        const cx = phys / 2, cy = phys / 2
        ctx.fillStyle = 'white'
        rrect(ctx, cx - lgW / 2 - lpad, cy - lgH / 2 - lpad, lgW + lpad * 2, lgH + lpad * 2, bR + lpad)
        ctx.fill()
        ctx.fillStyle = BRAND
        rrect(ctx, cx - lgW / 2, cy - lgH / 2, lgW, lgH, bR)
        ctx.fill()
        if (logo.complete && logo.naturalWidth > 0) {
          ctx.save()
          rrect(ctx, cx - lgW / 2, cy - lgH / 2, lgW, lgH, bR)
          ctx.clip()
          ctx.drawImage(logo, cx - lgW / 2, cy - lgH / 2, lgW, lgH)
          ctx.restore()
        }

        const lines: { text: string; size: number; weight: string; color: string }[] = [
          { text: title, size: 38, weight: '800', color: '#111111' },
          ...(subtitle ? [{ text: subtitle, size: 28, weight: '600', color: '#555555' }] : []),
        ]
        const lineH = 52, topPad = 32, botPad = 40
        const out = document.createElement('canvas')
        out.width = phys
        out.height = phys + topPad + lines.length * lineH + botPad
        const octx = out.getContext('2d')!
        octx.fillStyle = '#ffffff'; octx.fillRect(0, 0, out.width, out.height)
        octx.drawImage(qrCanvas, 0, 0)
        octx.textAlign = 'center'; octx.textBaseline = 'top'
        let ty = phys + topPad
        for (const l of lines) {
          octx.font = `${l.weight} ${l.size}px -apple-system, BlinkMacSystemFont, sans-serif`
          octx.fillStyle = l.color
          octx.fillText(l.text, phys / 2, ty, phys - 40)
          ty += lineH
        }

        const blob = await new Promise<Blob>(resolve => out.toBlob(b => resolve(b!), 'image/png'))
        const filename = `qr-${(title || 'carte').replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`
        zip.file(filename, blob)
      }

      const content = await zip.generateAsync({ type: 'blob' })
      const link = document.createElement('a')
      link.download = 'qr-codes.zip'
      link.href = URL.createObjectURL(content)
      link.click()
      URL.revokeObjectURL(link.href)
    } finally {
      setQrDownloading(false)
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const saveGalleryOrder = async (cardList: Card[]) => {
    if (!isOwner) return
    const order = cardList.map(getCardId)
    await supabase.from('profiles').update({ gallery_order: order }).eq('id', userId)
  }

  const applyCurrentSortAsDefault = async () => {
    const filteredIds = new Set(filtered.map(getCardId))
    const rest = cards.filter(c => !filteredIds.has(getCardId(c)))
    const newCards = [...filtered, ...rest]
    setCards(newCards)
    setSortBy('default')
    setSortBy2('none')
    await saveGalleryOrder(newCards)
  }

  const toggleCardSelection = (cardId: string) => {
    setSelectedCards(prev => {
      const next = new Set(prev)
      if (next.has(cardId)) next.delete(cardId); else next.add(cardId)
      return next
    })
  }

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragId(null)
    if (!over || active.id === over.id) return

    const movedId = active.id as string
    const targetId = over.id as string
    const isMulti = selectedCards.has(movedId) && selectedCards.size > 1

    if (isMulti) {
      // Retire toutes les cartes sélectionnées puis les réinsère après la cible
      const sel = new Set(selectedCards)
      const selList = cards.filter(c => sel.has(getCardId(c)))
      const rest = cards.filter(c => !sel.has(getCardId(c)))
      const insertAfter = rest.findIndex(c => getCardId(c) === targetId)
      const pos = insertAfter === -1 ? rest.length : insertAfter + 1
      const newCards = [...rest.slice(0, pos), ...selList, ...rest.slice(pos)]
      setCards(newCards)
      saveGalleryOrder(newCards)
      setSelectedCards(new Set())
    } else {
      const movedIdx = cards.findIndex(c => getCardId(c) === movedId)
      const targetIdx = cards.findIndex(c => getCardId(c) === targetId)
      if (movedIdx === -1 || targetIdx === -1) return
      const newCards = arrayMove(cards, movedIdx, targetIdx)
      setCards(newCards)
      saveGalleryOrder(newCards)
    }
  }

  const grailSearchResults = useMemo(() => {
    if (grailSearch.trim().length === 0) return []
    const q = grailSearch.toLowerCase()
    return cards.filter(c => {
      if (grailCards.some(g => g.card_key === c.f)) return false
      return c.n.toLowerCase().includes(q) || c.v.toLowerCase().includes(q) ||
             c.s.toLowerCase().includes(q) || (c.t || '').toLowerCase().includes(q) ||
             (c.br || '').toLowerCase().includes(q)
    })
  }, [grailSearch, cards, grailCards])

  const gridRef = useRef<HTMLDivElement>(null)


  const getTags = (d: Card) => {
    const oon = d.num && isOneOfOne(d.num)
    const low = d.num && !oon && isLowNum(d.num)
    const bronze = d.num && !oon && !low && isBronzeNum(d.num)
    return (
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', minHeight: 18 }}>
        {d.item_type && d.item_type !== 'card' && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#7b1fa2', color: 'white' }}>🏆 MÉMO</span>}
        {d.rc && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#e67e22', color: 'white' }}>RC</span>}
        {d.auto && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#2e7d32', color: 'white' }}>AUTO</span>}
        {d.num && !oon && !low && !bronze && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#7b1fa2', color: 'white' }}>{d.num}</span>}
        {bronze && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: 'linear-gradient(135deg,#6d3a00,#cd7f32,#f5cba7,#cd7f32,#6d3a00)', color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.6)', display: 'inline-block', animation: 'bro-anim 2.6s ease-in-out infinite' }}>{d.num}</span>}
        {oon && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: 'linear-gradient(135deg,#b8860b,#ffd700,#fffacd,#ffd700,#b8860b)', color: '#3d2800', textShadow: '0 1px 0 rgba(255,255,255,0.4)', display: 'inline-block', animation: 'oon-anim 1.8s ease-in-out infinite' }}>{d.num}</span>}
        {low && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: 'linear-gradient(135deg,#555,#c0c0c0,#fff,#c0c0c0,#555)', color: '#111', display: 'inline-block', animation: 'low-anim 2.2s ease-in-out infinite' }}>{d.num}</span>}
        {d.patch && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#1976d2', color: 'white' }}>PATCH</span>}
        {d.printing_plate && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#111827', color: 'white' }}>PLATE</span>}
      </div>
    )
  }

  const accent = profile?.couleur_bordure || '#003DA6'

  const resolveColor = (c: string) => isGradient(c) ? c.match(/#[0-9a-fA-F]{6}/)?.[0] || accent : c
  const byPos = (a: string, b: string) => {
    const pa = tabSettings.get(a)?.position ?? 999
    const pb = tabSettings.get(b)?.position ?? 999
    return pa !== pb ? pa - pb : a.localeCompare(b)
  }
  const parentOf = (t: string) => tabSettings.get(t)?.parent || null
  const isSub = (t: string) => { const p = parentOf(t); return !!p && collectionTags.includes(p) }
  const principals = collectionTags.filter(t => !isSub(t)).sort(byPos)
  const getChildren = (tag: string) => collectionTags.filter(t => parentOf(t) === tag).sort(byPos)
  const getDescendants = (tag: string): string[] => { const ch = getChildren(tag); return [...ch, ...ch.flatMap(c => getDescendants(c))] }
  const saveTabSetting = async (tag: string, patch: { color?: string; position?: number; parent?: string | null }) => {
    const cur = tabSettings.get(tag) || { color: accent, position: 0 }
    const next = { ...cur, ...patch }
    setTabSettings(prev => new Map(prev).set(tag, next))
    await supabase.from('collection_tab_settings').upsert({ user_id: userId, tag, color: next.color, position: next.position, parent: next.parent ?? null }, { onConflict: 'user_id,tag' })
  }
  const handleDragOver = (e: React.DragEvent, overTag: string) => {
    e.preventDefault()
    if (!draggedTag || draggedTag === overTag) return
    if (dragLastOverRef.current === overTag) return
    dragLastOverRef.current = overTag
    const dragParent = parentOf(draggedTag)
    const overParent = parentOf(overTag)
    const newMap = new Map(tabSettings)
    if (!dragParent && !overParent) {
      const order = principals.map(t => t)
      const fromIdx = order.indexOf(draggedTag)
      const toIdx = order.indexOf(overTag)
      if (fromIdx === -1 || toIdx === -1) return
      order.splice(fromIdx, 1)
      order.splice(toIdx, 0, draggedTag)
      order.forEach((tag, i) => {
        newMap.set(tag, { ...(newMap.get(tag) || { color: accent }), position: i })
      })
    } else if (dragParent && dragParent === overParent) {
      const siblings = getChildren(dragParent)
      const order = siblings.map(t => t)
      const fromIdx = order.indexOf(draggedTag)
      const toIdx = order.indexOf(overTag)
      if (fromIdx === -1 || toIdx === -1) return
      order.splice(fromIdx, 1)
      order.splice(toIdx, 0, draggedTag)
      order.forEach((tag, i) => {
        newMap.set(tag, { ...(newMap.get(tag) || { color: accent }), position: i })
      })
    } else {
      return
    }
    setTabSettings(newMap)
  }
  const handleDragEnd = async () => {
    dragLastOverRef.current = null
    if (!draggedTag) return
    const dragParent = parentOf(draggedTag)
    if (!dragParent) {
      const allUpdates = principals.map((tag, i) => ({
        user_id: userId, tag,
        color: tabSettings.get(tag)?.color || accent,
        position: tabSettings.get(tag)?.position ?? i,
      }))
      await supabase.from('collection_tab_settings').upsert(allUpdates, { onConflict: 'user_id,tag' })
    } else {
      const siblings = getChildren(dragParent)
      const allUpdates = siblings.map((tag, i) => ({
        user_id: userId, tag,
        color: tabSettings.get(tag)?.color || accent,
        position: tabSettings.get(tag)?.position ?? i,
        parent: dragParent,
      }))
      await supabase.from('collection_tab_settings').upsert(allUpdates, { onConflict: 'user_id,tag' })
    }
    setDraggedTag(null)
  }
  const renderTagPill = (tag: string, depth: number): React.ReactNode => {
    const settings = tabSettings.get(tag)
    const tabColor = settings?.color || accent
    const children = getChildren(tag)
    const hasChildren = children.length > 0
    const isActive = fCollectionTag === tag
    const isChildActive = children.includes(fCollectionTag)
    const highlighted = isActive || isChildActive
    const isDragging = draggedTag === tag
    const forbidden = new Set([tag, ...getDescendants(tag)])
    const candidates = collectionTags.filter(t => !forbidden.has(t))
    return (
      <div key={tag}>
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setFCollectionTag(isActive ? '' : tag)
              setColorPickerTag(null)
            }}
            draggable={isOwner}
            onDragStart={() => { dragLastOverRef.current = null; setDraggedTag(tag) }}
            onDragOver={(e) => handleDragOver(e, tag)}
            onDragEnd={handleDragEnd}
            style={{
              padding: depth > 0 ? '4px 9px' : '5px 10px', borderRadius: 20,
              cursor: isOwner && depth === 0 ? 'grab' : 'pointer',
              fontSize: depth > 0 ? 10 : 11, fontWeight: 700, transition: '0.15s',
              opacity: isDragging ? 0.4 : 1,
              background: highlighted ? tabColor : (dark ? '#2a2a2a' : '#f0f0f0'),
              color: highlighted ? 'white' : (dark ? '#ccc' : '#555'),
              border: `2px solid ${highlighted ? tabColor : resolveColor(tabColor) + '55'}`,
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}
          >
            {!highlighted && <span style={{ width: 8, height: 8, borderRadius: '50%', background: tabColor, flexShrink: 0 }} />}
            {tag}
            {hasChildren && depth === 0 && (
              <span style={{ fontSize: 9, opacity: 0.8, marginLeft: 1 }}>{isChildActive ? '▾' : '▸'}</span>
            )}
            {isOwner && (
              <span
                onClick={(e) => { e.stopPropagation(); setColorPickerTag(colorPickerTag === tag ? null : tag); setRenameValue(tag); setDeleteTagConfirm(null) }}
                title="Modifier cette collection"
                style={{
                  width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                  background: highlighted ? 'rgba(255,255,255,0.3)' : tabColor,
                  color: 'white', fontSize: 9, fontWeight: 900,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', lineHeight: 1, transition: 'background 0.15s',
                  marginLeft: 2,
                }}
              >✎</span>
            )}
          </button>
          {colorPickerTag === tag && (
            <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '110%', left: 0, background: dark ? '#1e1e1e' : 'white', borderRadius: 12, padding: 10, boxShadow: dark ? '0 8px 30px rgba(0,0,0,0.5)' : '0 8px 30px rgba(0,0,0,0.18)', border: dark ? '1px solid #333' : 'none', zIndex: 100, width: 220 }}>
              <input
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === 'Escape') { setColorPickerTag(null); return }
                  if (e.key !== 'Enter') return
                  const newName = renameValue.trim()
                  if (!newName || newName === tag) { setColorPickerTag(null); return }
                  await Promise.all([
                    supabase.from('card_collections').update({ collection: newName }).eq('user_id', userId).eq('collection', tag),
                    supabase.from('cartes_manuelles').update({ collection_tag: newName }).eq('user_id', userId).eq('collection_tag', tag),
                    supabase.from('carte_tags').update({ collection_tag: newName }).eq('user_id', userId).eq('collection_tag', tag),
                  ])
                  const cur = tabSettings.get(tag)
                  await supabase.from('collection_tab_settings').delete().eq('user_id', userId).eq('tag', tag)
                  if (cur) await supabase.from('collection_tab_settings').upsert({ user_id: userId, tag: newName, color: cur.color, position: cur.position, parent: cur.parent ?? null }, { onConflict: 'user_id,tag' })
                  await supabase.from('collection_tab_settings').update({ parent: newName }).eq('user_id', userId).eq('parent', tag)
                  setTabSettings(prev => {
                    const m = new Map(prev)
                    if (cur) m.set(newName, cur); m.delete(tag)
                    for (const [k, v] of m) if (v.parent === tag) m.set(k, { ...v, parent: newName })
                    return m
                  })
                  setCollectionTags(prev => [...new Set(prev.map(t => t === tag ? newName : t))].sort())
                  setCards(prev => prev.map(c => {
                    if (!(c.collections || []).includes(tag)) return c
                    const cols = [...new Set((c.collections || []).map(t => t === tag ? newName : t))]
                    return { ...c, collections: cols, collection_tag: cols[0] || '' }
                  }))
                  if (fCollectionTag === tag) setFCollectionTag(newName)
                  setColorPickerTag(null)
                }}
                style={{ width: '100%', marginBottom: 8, padding: '5px 10px', borderRadius: 8, border: `2.5px solid ${isGradient(tabColor) ? 'transparent' : tabColor}`, fontSize: 11, fontWeight: 700, color: dark ? '#eee' : '#333', textAlign: 'center', outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif', background: dark ? '#2a2a2a' : 'white' }}
              />
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                {TAB_COLORS.map(c => (
                  <button key={c} onClick={() => { saveTabSetting(tag, { color: c }); setColorPickerTag(null) }}
                    style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: tabColor === c ? '2.5px solid #111' : '2px solid transparent', cursor: 'pointer', padding: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                ))}
              </div>
              <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#aaa', marginBottom: 5 }}>Dégradés</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                {TAB_GRADIENTS.map(g => (
                  <button key={g.value} onClick={() => { saveTabSetting(tag, { color: g.value }); setColorPickerTag(null) }}
                    title={g.label}
                    style={{ width: 36, height: 20, borderRadius: 4, background: g.value, border: tabColor === g.value ? '2.5px solid #111' : '2px solid transparent', cursor: 'pointer', padding: 0 }} />
                ))}
              </div>
              <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#aaa', marginBottom: 5 }}>Thèmes équipe</div>
              <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
                {(['NBA', 'NHL', 'MLB', 'NFL'] as const).map(s => (
                  <button key={s} onClick={() => setTeamThemeSport(s)} style={{
                    fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                    background: teamThemeSport === s ? '#003DA6' : (dark ? '#333' : '#eee'),
                    color: teamThemeSport === s ? 'white' : (dark ? '#aaa' : '#555'),
                    border: 'none', cursor: 'pointer',
                  }}>{s}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                {TEAM_THEMES.filter(t => t.sport === teamThemeSport).map(t => (
                  <button key={t.label} onClick={() => { saveTabSetting(tag, { color: t.value }); setColorPickerTag(null) }}
                    title={t.label}
                    style={{ width: 44, height: 20, borderRadius: 4, background: t.value, border: tabColor === t.value ? '2.5px solid #111' : '2px solid transparent', cursor: 'pointer', padding: 0, position: 'relative', overflow: 'hidden' }}>
                    <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 6, fontWeight: 900, color: 'rgba(255,255,255,0.9)', textShadow: '0 1px 2px rgba(0,0,0,0.6)', letterSpacing: 0 }}>{t.label}</span>
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#aaa', marginBottom: 5 }}>Collection parente</div>
              <select
                value={parentOf(tag) || ''}
                onChange={e => saveTabSetting(tag, { parent: e.target.value || null })}
                style={{ width: '100%', marginBottom: 8, padding: '5px 8px', borderRadius: 8, border: dark ? '1.5px solid #444' : '1.5px solid #ddd', fontSize: 11, fontWeight: 700, color: dark ? '#eee' : '#333', background: dark ? '#2a2a2a' : 'white', outline: 'none', boxSizing: 'border-box' }}
              >
                <option value="">— Aucune (principale) —</option>
                {candidates.map(p => (
                  <option key={p} value={p}>↳ dans « {p} »</option>
                ))}
              </select>
              {deleteTagConfirm === tag ? (
                <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
                  <p style={{ fontSize: 10, color: '#e53935', fontWeight: 700, margin: '0 0 6px' }}>Supprimer "{tag}" ? Les cartes ne seront pas supprimées.</p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={async () => {
                      await supabase.from('card_collections').delete().eq('user_id', userId).eq('collection', tag)
                      await supabase.from('cartes_manuelles').update({ collection_tag: null }).eq('user_id', userId).eq('collection_tag', tag)
                      await supabase.from('carte_tags').update({ collection_tag: null }).eq('user_id', userId).eq('collection_tag', tag)
                      await supabase.from('collection_tab_settings').delete().eq('user_id', userId).eq('tag', tag)
                      setTabSettings(prev => { const m = new Map(prev); m.delete(tag); return m })
                      setCollectionTags(prev => prev.filter(t => t !== tag))
                      setCards(prev => prev.map(c => {
                        if (!(c.collections || []).includes(tag)) return c
                        const cols = (c.collections || []).filter(t => t !== tag)
                        return { ...c, collections: cols, collection_tag: cols[0] || '' }
                      }))
                      if (fCollectionTag === tag) setFCollectionTag('')
                      setColorPickerTag(null); setDeleteTagConfirm(null)
                    }} style={{ flex: 1, background: '#e53935', color: 'white', border: 'none', borderRadius: 6, padding: '5px 0', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>
                      Confirmer
                    </button>
                    <button onClick={() => setDeleteTagConfirm(null)} style={{ flex: 1, background: dark ? '#2a2a2a' : '#f0f0f0', color: dark ? '#ccc' : '#555', border: 'none', borderRadius: 6, padding: '5px 0', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setDeleteTagConfirm(tag)} style={{ width: '100%', border: 'none', background: 'none', color: '#e53935', fontSize: 10, fontWeight: 700, cursor: 'pointer', paddingTop: 6, borderTop: '1px solid #f5f5f5', textAlign: 'left' }}>
                  🗑 Supprimer cette collection
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }
  const activeParent = fCollectionTag
    ? principals.find(p => p === fCollectionTag || getChildren(p).includes(fCollectionTag))
    : null
  const activeChildren = activeParent ? getChildren(activeParent) : []
  const activeParentColor = activeParent ? resolveColor(tabSettings.get(activeParent)?.color || accent) : accent

  return (
    <>
      <div style={{ maxWidth: 1400, margin: '0 auto', fontFamily: 'Inter, sans-serif', padding: '0 10px', paddingBottom: (editMode && isOwner && selectedCards.size > 0) || qrMode ? 80 : 0 }}>

        {/* Header profil */}
        <div style={{ background: dark ? '#1e1e1e' : 'white', borderRadius: 16, padding: '24px 30px', marginBottom: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', flex: '1 1 300px' }}>
            <img
              src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.display_name || 'U')}&background=003DA6&color=fff&size=128`}
              style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${accent}`, flexShrink: 0 }}
              alt={profile?.display_name}
            />
            <div style={{ minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                <h1 className={profile?.is_donor ? 'holo-name' : ''} style={{ fontSize: 24, fontWeight: 900, margin: 0, color: profile?.is_donor ? undefined : undefined }}>{profile?.display_name || 'Collectionneur'}</h1>
                <OnlineIndicator lastSeen={profile?.last_seen} size={12} />
                {monthlyBadges.length > 0 && (
                  <span className="sticker-badge" data-label={`Collectionneur du mois : ${monthlyBadges.join(', ')}`} style={{ fontSize: 26 }}>🏆</span>
                )}
                {profile?.is_donor && (
                  <span className="sticker-holo" data-label="Donateur Ko-fi" style={{ fontSize: 26 }}>☕</span>
                )}

                {(() => {
                  const teams: string[] = Array.isArray(profile?.favorite_teams) ? profile.favorite_teams : []
                  const stats = profile ? { total: profile.stats_total || 0, rc: profile.stats_rc || 0, auto: profile.stats_auto || 0, patch: profile.stats_patch || 0, num: profile.stats_num || 0 } : undefined
                  const spec = getSpeciality(stats)
                  return (<>
                    {teams.map(id => {
                      const team = getTeamById(id)
                      return (
                        <span key={id} className="sticker-team" data-label={team?.name ?? id}>
                          <TeamBadge teamId={id} size={28} />
                        </span>
                      )
                    })}
                    {spec.map((s, i) => (
                      <span key={i} className="sticker-badge" data-label={s.label.replace(/^\S+\s*/, '')} style={{ fontSize: 26 }}>
                        {s.label.match(/^\S+/)?.[0] ?? '⭐'}
                      </span>
                    ))}
                  </>)
                })()}
              </div>

              {profile?.bio && (
                <p style={{ fontSize: 13, color: dark ? '#aaa' : '#555', margin: '0 0 10px', lineHeight: 1.5, maxWidth: 400 }}>{profile.bio}</p>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {profile?.instagram && (
                  <a href={`https://instagram.com/${profile.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: '#E1306C', textDecoration: 'none', background: '#fce4ec', padding: '4px 10px', borderRadius: 20 }}>
                    <span>📸</span> {profile.instagram.startsWith('@') ? profile.instagram : `@${profile.instagram}`}
                  </a>
                )}
                {profile?.twitter && (
                  <a href={`https://x.com/${profile.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: dark ? '#e0e0e0' : '#121212', textDecoration: 'none', background: dark ? '#1a1a1a' : '#f0f0f0', border: dark ? '1px solid #333' : 'none', padding: '4px 10px', borderRadius: 20 }}>
                    <span>𝕏</span> {profile.twitter.startsWith('@') ? profile.twitter : `@${profile.twitter}`}
                  </a>
                )}
                {profile?.discord && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: '#5865F2', background: '#eef0ff', padding: '4px 10px', borderRadius: 20 }}>
                    <span>🎮</span> {profile.discord}
                  </span>
                )}
                {currentUser && currentUser !== userId && (
                  <Link href={`/messages?to=${userId}`} style={{
                    display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700,
                    color: 'white', background: accent, padding: '5px 12px', borderRadius: 20, textDecoration: 'none'
                  }}>
                    {t('gallery_message')}
                  </Link>
                )}
              </div>
            </div>
          </div>

          {loaded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-end', flexShrink: 0, minWidth: 260, marginLeft: 'auto' }} className="header-stats-block">
              <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end', width: '100%' }}>
                {[
                  { val: filtered.length, label: t('gallery_cards') },
                  { val: filteredStats.rc, label: 'RC', color: '#e67e22' },
                  { val: filteredStats.auto, label: 'Auto', color: '#2e7d32' },
                  { val: filteredStats.num, label: 'Num', color: '#7b1fa2' },
                  { val: filteredStats.patch, label: 'Patch', color: '#1976d2' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center', minWidth: 45 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: s.color || accent }}>{s.val}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="galerie-actions" style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>

                {/* Bouton Terminé — visible uniquement en mode édition */}
                {isOwner && editMode && (
                  <button
                    onClick={() => { setEditMode(false); setSelectedCards(new Set()) }}
                    className="btn-ajouter"
                    style={{ background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 28px', fontWeight: 800, fontSize: 15, cursor: 'pointer', textAlign: 'center', whiteSpace: 'nowrap' }}
                  >
                    ✓ Terminé
                  </button>
                )}

                {/* Bouton "..." — actions secondaires */}
                {!editMode && (
                  <div className="btn-menu" style={{ position: 'relative' }}>
                    <button
                      onClick={() => setActionMenuOpen(v => !v)}
                      style={{ background: dark ? '#2a2a2a' : '#f0f0f0', color: dark ? '#ddd' : '#333', border: 'none', borderRadius: 8, padding: '10px 14px', fontWeight: 700, fontSize: 15, cursor: 'pointer', lineHeight: 1 }}
                    >
                      ···
                    </button>
                    {actionMenuOpen && (
                      <>
                        {/* Overlay invisible pour fermer */}
                        <div onClick={() => setActionMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
                        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: dark ? '#1e1e1e' : '#fff', borderRadius: 12, boxShadow: dark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.15)', border: dark ? '1px solid #333' : 'none', padding: 6, zIndex: 100, minWidth: 190, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {isOwner && (
                            <button onClick={() => { setEditMode(m => !m); setSelectedCards(new Set()); setActionMenuOpen(false) }}
                              style={{ background: 'none', border: 'none', borderRadius: 8, padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'left', color: dark ? '#ddd' : '#333', width: '100%' }}>
                              {editMode ? t('gallery_done') : t('gallery_privacy')}
                            </button>
                          )}
                          <button onClick={() => {
                            setActionMenuOpen(false)
                            const url = window.location.href
                            if (navigator.share) navigator.share({ title: `Galerie de ${profile?.display_name || 'Collectionneur'}`, url })
                            else navigator.clipboard.writeText(url).then(() => { setShareCopied(true); setTimeout(() => setShareCopied(false), 2000) })
                          }} style={{ background: 'none', border: 'none', borderRadius: 8, padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'left', color: dark ? '#ddd' : '#333', width: '100%' }}>
                            {shareCopied ? '✓ Lien copié' : '↗ Partager'}
                          </button>
                          <button onClick={() => { setActionMenuOpen(false); router.push(`/galerie/${userId}/expo`) }}
                            style={{ background: 'none', border: 'none', borderRadius: 8, padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'left', color: dark ? '#ddd' : '#333', width: '100%' }}>
                            ⊞ Mode expo
                          </button>
                          <div style={{ padding: '0 4px' }}>
                            <GalerieExport
                              cards={cards}
                              profileName={profile?.display_name || ''}
                              avatarUrl={profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.display_name || 'U')}&background=003DA6&color=fff&size=128`}
                              accent={accent}
                              lang={lang}
                              cardValues={cardValues}
                              isOwner={isOwner}
                            />
                          </div>
                          <button onClick={() => { setShowStats(s => !s); setActionMenuOpen(false) }}
                            style={{ background: 'none', border: 'none', borderRadius: 8, padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'left', color: dark ? '#ddd' : '#333', width: '100%' }}>
                            📊 {showStats ? 'Masquer les stats' : 'Voir les stats'}
                          </button>
                          <button onClick={() => { setQrMode(m => !m); setQrSelected(new Map()); setActionMenuOpen(false) }}
                            style={{ background: 'none', border: 'none', borderRadius: 8, padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'left', color: dark ? '#ddd' : '#333', width: '100%' }}>
                            ▦ {qrMode ? 'Quitter Multi-QR' : 'Multi-QR'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* CTA principal */}
                {isOwner && !editMode && (
                  <Link href={`/galerie/${userId}/ajouter`} className="btn-ajouter" style={{
                    background: '#003DA6', color: 'white',
                    border: 'none', borderRadius: 10, padding: '12px 28px',
                    fontWeight: 800, fontSize: 15, cursor: 'pointer',
                    textDecoration: 'none', display: 'inline-block', textAlign: 'center', whiteSpace: 'nowrap',
                  }}>
                    + {t('gallery_add')}
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Stats de collection */}
        {showStats && loaded && (
          <CollectionStats cards={cards} accent={accent} />
        )}

        {/* Grail Wall */}
        {(isOwner || grailCards.length > 0) && (() => {
          const grailMap = new Map(cards.map(c => [c.f, c]))
          const grailItems = grailCards.map(g => grailMap.get(g.card_key)).filter(Boolean) as Card[]
          const grailLoading = grailCards.length > 0 && !cardsLoaded
          const emptySlots = grailLoading ? (5 - grailCards.length) : (5 - grailItems.length)

          return (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 18 }}>💎</span>
                <span style={{ fontWeight: 900, fontSize: 15, color: '#121212', letterSpacing: 0.5 }}>Grail Wall</span>
                <span style={{ fontSize: 11, color: '#bbb', fontWeight: 600 }}>— {t('gallery_jewels')}</span>
              </div>

              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
                {/* Skeleton placeholders while gallery loads */}
                {grailLoading && Array.from({ length: grailCards.length }).map((_, i) => (
                  <div key={`sk-${i}`} style={{
                    flexShrink: 0, width: 120, borderRadius: 10, aspectRatio: '2.5/3.5',
                    background: dark
                      ? 'linear-gradient(90deg,#2a2a2a 25%,#333 50%,#2a2a2a 75%)'
                      : 'linear-gradient(90deg,#f0f0f0 25%,#e4e4e4 50%,#f0f0f0 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s infinite',
                  }} />
                ))}
                {!grailLoading && grailItems.map((card, i) => {
                  const tabColor = (card.collection_tag && tabSettings.get(card.collection_tag)?.color) || accent
                  const resolvedColor = isGradient(tabColor) ? (tabColor.match(/#[0-9a-fA-F]{6}/)?.[0] || accent) : tabColor
                  return (
                    <div key={i} onClick={() => setPopup(card)} style={{
                      flexShrink: 0, width: 120, cursor: 'pointer', position: 'relative',
                      background: tabColor, padding: 3, borderRadius: 10,
                      boxShadow: `0 4px 16px ${resolvedColor}44`, transition: 'transform 0.2s',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')}
                      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                    >
                      <div style={{ borderRadius: 8, overflow: 'hidden', background: 'white', position: 'relative' }}>
                      {isOwner && (
                        deleteGrailConfirm === card.f ? (
                          <div style={{ position: 'absolute', top: 4, right: 4, zIndex: 3, display: 'flex', gap: 2 }}>
                            <button onClick={async e => { e.stopPropagation(); await supabase.from('grail_cards').delete().eq('user_id', userId).eq('card_key', card.f); setGrailCards(prev => prev.filter(g => g.card_key !== card.f)); setDeleteGrailConfirm(null) }} style={{ background: '#e74c3c', border: 'none', borderRadius: 4, width: 18, height: 18, color: 'white', fontSize: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>✓</button>
                            <button onClick={e => { e.stopPropagation(); setDeleteGrailConfirm(null) }} style={{ background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 4, width: 18, height: 18, color: 'white', fontSize: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>✕</button>
                          </div>
                        ) : (
                          <button onClick={e => { e.stopPropagation(); setDeleteGrailConfirm(card.f) }} style={{
                            position: 'absolute', top: 4, right: 4, zIndex: 3,
                            background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%',
                            width: 20, height: 20, color: 'white', fontSize: 10, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900,
                          }}>✕</button>
                        )
                      )}
                      {renderCardImage(card)}
                      <div style={{ padding: '6px 8px' }}>
                        <p style={{ fontWeight: 800, fontSize: 10, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.n}</p>
                        <p style={{ fontSize: 9, color: resolvedColor, fontWeight: 700, margin: '1px 0 0', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.v || card.s}</p>
                      </div>
                      </div>
                    </div>
                  )
                })}

                {/* Slots vides */}
                {isOwner && Array.from({ length: emptySlots }).map((_, i) => (
                  <div key={`empty-${i}`}
                    onClick={() => { setGrailPickerOpen(true); setGrailSearch('') }}
                    style={{
                      flexShrink: 0, width: 120, border: `2px dashed ${accent}44`, borderRadius: 10,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: 6, cursor: 'pointer', transition: '0.15s',
                      aspectRatio: '2.5/3.5',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = accent; (e.currentTarget as HTMLDivElement).style.background = accent + '08' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = accent + '44'; (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                  >
                    <span style={{ fontSize: 28, opacity: 0.3 }}>+</span>
                    <span style={{ fontSize: 10, color: '#bbb', fontWeight: 700, textAlign: 'center', lineHeight: 1.3, padding: '0 8px' }}>
                      {t('gallery_add_card')}
                    </span>
                  </div>
                ))}

                {!isOwner && Array.from({ length: emptySlots }).map((_, i) => (
                  <div key={`empty-${i}`} style={{
                    flexShrink: 0, width: 120, border: `2px dashed #eee`, borderRadius: 10,
                    aspectRatio: '2.5/3.5',
                  }} />
                ))}
              </div>

              {/* Modal de recherche pour ajouter au grail */}
              {grailPickerOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                  onClick={() => setGrailPickerOpen(false)}>
                  <div onClick={e => e.stopPropagation()} style={{ background: dark ? '#1e1e1e' : 'white', borderRadius: 16, padding: 20, width: '100%', maxWidth: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h3 style={{ margin: 0, fontWeight: 900, fontSize: 16 }}>💎 {t('gallery_choose_card')}</h3>
                      <button onClick={() => setGrailPickerOpen(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999' }}>✕</button>
                    </div>
                    <input
                      autoFocus
                      value={grailSearch}
                      onChange={e => setGrailSearch(e.target.value)}
                      placeholder={t('gallery_search_collection')}
                      style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, outline: 'none' }}
                    />
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                      {grailSearch.trim().length === 0 ? (
                        <p style={{ color: '#bbb', textAlign: 'center', marginTop: 24, fontSize: 13 }}>
                          {t('gallery_type_hint')}
                        </p>
                      ) : grailSearchResults.length === 0 ? (
                        <p style={{ color: '#bbb', textAlign: 'center', marginTop: 24, fontSize: 13 }}>
                          {t('gallery_no_results')}
                        </p>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                          {grailSearchResults.map((card, i) => {
                            const tabColor = (card.collection_tag && tabSettings.get(card.collection_tag)?.color) || accent
                            return (
                              <div key={i} onClick={async () => {
                                const pos = grailCards.length
                                await supabase.from('grail_cards').upsert({ user_id: userId, card_key: card.f, position: pos }, { onConflict: 'user_id,card_key' })
                                setGrailCards(prev => [...prev, { card_key: card.f, position: pos }])
                                if (grailCards.length + 1 >= 5) setGrailPickerOpen(false)
                                setGrailSearch('')
                              }} style={{ cursor: 'pointer', ...coloredBorder(tabColor), borderRadius: 8, overflow: 'hidden', transition: '0.15s' }}
                                onMouseEnter={e => { if (!isGradient(tabColor)) e.currentTarget.style.borderColor = tabColor }}
                                onMouseLeave={e => { if (!isGradient(tabColor)) e.currentTarget.style.borderColor = tabColor + '55' }}
                              >
                                {renderCardImage(card)}
                                <div style={{ padding: '4px 6px', background: dark ? '#2a2a2a' : 'white' }}>
                                  <p style={{ fontWeight: 800, fontSize: 10, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.n}</p>
                                  <p style={{ fontSize: 9, color: '#999', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.s}</p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* Onglets Collection / Wishlist / Commentaires / Bibliothèque — scrollable sur mobile */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: dark ? '#2a2a2a' : '#f0f0f0', borderRadius: 10, padding: 4, maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {(['collection', 'library', 'objectifs', 'comments', ...(isOwner ? ['likes'] as const : [])] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab as any)} style={{
              padding: '8px 16px', border: 'none', borderRadius: 8, cursor: 'pointer',
              fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0,
              background: activeTab === tab ? (dark ? '#121212' : 'white') : 'transparent',
              color: activeTab === tab ? accent : (dark ? '#666' : '#999'),
              boxShadow: activeTab === tab ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
              transition: '0.15s',
            }}>
              {tab === 'collection' ? '🃏 Collection' : tab === 'library' ? t('gallery_tab_library') : tab === 'objectifs' ? t('gallery_tab_objectifs') : tab === 'comments' ? t('gallery_tab_comments') : t('gallery_tab_liked')}
            </button>
          ))}
        </div>

        {activeTab === 'objectifs' && (
          <div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
              {(['pc', 'wishlist'] as const).map(sub => (
                <button key={sub} onClick={() => setObjectifsSubTab(sub)} style={{
                  padding: '6px 16px', border: `1.5px solid ${objectifsSubTab === sub ? accent : (dark ? '#333' : '#e0e0e0')}`,
                  borderRadius: 20, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                  background: objectifsSubTab === sub ? accent : 'transparent',
                  color: objectifsSubTab === sub ? 'white' : (dark ? '#888' : '#666'),
                  transition: '0.15s',
                }}>
                  {sub === 'pc' ? '⭐ PCs' : '🎯 Wishlist'}
                </button>
              ))}
            </div>
            {objectifsSubTab === 'pc' && <MesPCTab cards={cards} cardsLoaded={cardsLoaded} userId={userId} accent={accent} dark={dark} isOwner={isOwner} initialPCs={profile?.pcs} />}
            {objectifsSubTab === 'wishlist' && <PublicWishlist userId={userId} accent={accent} isOwner={isOwner} />}
          </div>
        )}
        {activeTab === 'comments' && <GalerieComments galerieUserId={userId} accent={accent} isOwner={isOwner} />}
        {activeTab === 'likes' && isOwner && <LikedCards userId={userId} />}
        {activeTab === 'library' && <BinderLibrary userId={userId} isOwner={isOwner} accent={accent} initialBinderId={initialBinderId}
          onOpenCard={(img) => {
            // Retrouve la carte complète de la collection par son image, pour ouvrir
            // le vrai Viewer3D de la galerie (toutes les infos + tags), pas une version minimale
            const match = cards.find(c => c.f === img || c.b === img)
            if (match) { setPopup(match); return true }
            return false
          }}
        />}

        {activeTab === 'collection' && <>
        {/* Filtres de recherche */}
        <div style={{ background: dark ? '#1e1e1e' : '#fff', padding: 10, borderRadius: 8, marginBottom: 15, border: dark ? '1px solid #333' : '1px solid #eee' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 10 }}>
            <div><label style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 3 }}>{t('gallery_search_label')}</label>
              <input value={searchInput} onChange={e => { setSearchInput(e.target.value); if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); searchDebounceRef.current = setTimeout(() => setSearch(e.target.value), 200) }} placeholder={t('gallery_search')} /></div>
            <div><label style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 3 }}>{t('gallery_team_label')}</label>
              <input value={fTeam} onChange={e => setFTeam(e.target.value)} placeholder={t('gallery_all')} list="gallery-teams" style={{ width: '100%', boxSizing: 'border-box' }} />
              <datalist id="gallery-teams">{teams.map(team => <option key={team} value={team} />)}</datalist>
            </div>
            <div><label style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 3 }}>{t('gallery_collection_label')}</label>
              <input value={fBrand} onChange={e => setFBrand(e.target.value)} placeholder={t('gallery_all')} list="gallery-brands" style={{ width: '100%', boxSizing: 'border-box' }} />
              <datalist id="gallery-brands">{brands.map(brand => <option key={brand} value={brand} />)}</datalist>
            </div>
            <div><label style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 3 }}>{t('gallery_year_label')}</label>
              <select value={fYear} onChange={e => setFYear(e.target.value)}>
                <option value="">{t('gallery_all')}</option>{years.map(year => <option key={year}>{year}</option>)}
              </select></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5, marginBottom: 4 }}>
            {(['rc', 'auto', 'num', 'patch'] as const).map(k => (
              <button key={k} onClick={() => toggleFilter(k)} style={{
                padding: '8px 2px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                background: activeFilters[k] ? accent : (dark ? '#2a2a2a' : '#f0f0f0'), color: activeFilters[k] ? 'white' : (dark ? '#bbb' : '#333')
              }}>{k === 'num' ? '# NUM' : k.toUpperCase()}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isOwner ? 'repeat(3,1fr)' : 'repeat(2,1fr)', gap: 5, marginBottom: 8 }}>
            <button onClick={() => setFilterMemo(p => !p)} style={{
              padding: '8px 2px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
              background: filterMemo ? '#7b1fa2' : (dark ? '#2a2a2a' : '#f0f0f0'), color: filterMemo ? 'white' : (dark ? '#bbb' : '#333')
            }}>🏆 {t('gallery_filter_memo')}</button>
            <button onClick={() => setFilterVente(p => !p)} style={{
              padding: '8px 2px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
              background: filterVente ? '#2e7d32' : (dark ? '#2a2a2a' : '#f0f0f0'), color: filterVente ? 'white' : (dark ? '#bbb' : '#333')
            }}>🏷️ {t('gallery_filter_sale')}</button>
            {isOwner && (
              <button onClick={() => setFilterPrivate(p => !p)} style={{
                padding: '8px 2px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                background: filterPrivate ? '#555' : (dark ? '#2a2a2a' : '#f0f0f0'), color: filterPrivate ? 'white' : (dark ? '#bbb' : '#333')
              }}>🔒 {t('gallery_filter_private')}</button>
            )}
          </div>
          <div>
            <label style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 3 }}>
              {t('gallery_sort_by')}
            </label>
            <select value={sortBy} onChange={e => { setSortBy(e.target.value as typeof sortBy); if (e.target.value === 'default') setSortBy2('none') }}
              style={{ background: sortBy !== 'default' ? (dark ? '#1a2240' : '#f0f4ff') : undefined, borderColor: sortBy !== 'default' ? '#003DA6' : undefined, color: sortBy !== 'default' ? (dark ? '#7aabf7' : '#003DA6') : undefined, fontWeight: sortBy !== 'default' ? 700 : undefined }}>
              <option value="default">{t('gallery_sort_default')}</option>
              <optgroup label={t('gallery_sort_player_group')}>
                <option value="n">{t('gallery_sort_player_az')}</option>
                <option value="n_desc">{t('gallery_sort_player_za')}</option>
              </optgroup>
              <optgroup label={t('gallery_sort_year_group')}>
                <option value="y">{t('gallery_sort_year_asc')}</option>
                <option value="y_desc">{t('gallery_sort_year_desc')}</option>
              </optgroup>
              <optgroup label={t('gallery_sort_team_group')}>
                <option value="t">{t('gallery_sort_team_az')}</option>
              </optgroup>
              <optgroup label={t('gallery_sort_brand_group')}>
                <option value="s">{t('gallery_sort_brand_az')}</option>
              </optgroup>
              <optgroup label={t('gallery_sort_num_group')}>
                <option value="num_asc">{t('gallery_sort_num_asc')}</option>
              </optgroup>
              <optgroup label={t('gallery_sort_cardnum_group')}>
                <option value="card_num_asc">{t('gallery_sort_cardnum_asc')}</option>
                <option value="card_num_desc">{t('gallery_sort_cardnum_desc')}</option>
              </optgroup>
              <optgroup label={t('gallery_sort_date_group')}>
                <option value="date_desc">{t('gallery_sort_newest')}</option>
                <option value="date_asc">{t('gallery_sort_oldest')}</option>
              </optgroup>
              {cardValues.size > 0 && <>
                <option value="valeur">{t('gallery_sort_value_desc')}</option>
                <option value="valeur_desc">{t('gallery_sort_value_asc')}</option>
              </>}
            </select>
            {sortBy !== 'default' && (
              <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 3 }}>
                  {t('gallery_then_by')}
                </label>
                <select value={sortBy2} onChange={e => setSortBy2(e.target.value as typeof sortBy2)}
                  style={{ background: sortBy2 !== 'none' ? (dark ? '#1a2240' : '#f0f4ff') : undefined, borderColor: sortBy2 !== 'none' ? '#003DA6' : undefined, color: sortBy2 !== 'none' ? (dark ? '#7aabf7' : '#003DA6') : undefined, fontWeight: sortBy2 !== 'none' ? 700 : undefined }}>
                  <option value="none">{t('gallery_sort_none')}</option>
                  <optgroup label={t('gallery_sort_player_group')}>
                    <option value="n">{t('gallery_sort_player_az')}</option>
                    <option value="n_desc">{t('gallery_sort_player_za')}</option>
                  </optgroup>
                  <optgroup label={t('gallery_sort_year_group')}>
                    <option value="y">{t('gallery_sort_year_asc')}</option>
                    <option value="y_desc">{t('gallery_sort_year_desc')}</option>
                  </optgroup>
                  <optgroup label={t('gallery_sort_team_group')}>
                    <option value="t">{t('gallery_sort_team_az')}</option>
                  </optgroup>
                  <optgroup label={t('gallery_sort_brand_group')}>
                    <option value="s">{t('gallery_sort_brand_az')}</option>
                  </optgroup>
                  <optgroup label={t('gallery_sort_num_group')}>
                    <option value="num_asc">{t('gallery_sort_num_asc')}</option>
                  </optgroup>
                  <optgroup label={t('gallery_sort_cardnum_group')}>
                    <option value="card_num_asc">{t('gallery_sort_cardnum_asc')}</option>
                    <option value="card_num_desc">{t('gallery_sort_cardnum_desc')}</option>
                  </optgroup>
                  <optgroup label={t('gallery_sort_date_group')}>
                    <option value="date_desc">{t('gallery_sort_newest')}</option>
                    <option value="date_asc">{t('gallery_sort_oldest')}</option>
                  </optgroup>
                </select>
              </div>
            )}
            {teams.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 3 }}>
                  {t('gallery_team_first')}
                </label>
                <select value={pinTeam} onChange={e => setPinTeam(e.target.value)}
                  style={{ background: pinTeam ? (dark ? '#1a2240' : '#f0f4ff') : undefined, borderColor: pinTeam ? '#003DA6' : undefined, color: pinTeam ? (dark ? '#7aabf7' : '#003DA6') : undefined, fontWeight: pinTeam ? 700 : undefined }}>
                  <option value="">{t('gallery_no_team')}</option>
                  {teams.map(team => <option key={team} value={team}>{team}</option>)}
                </select>
              </div>
            )}
            {isOwner && sortBy !== 'default' && (
              <button onClick={applyCurrentSortAsDefault} title="Sauvegarder cet ordre et activer le drag & drop" style={{
                marginTop: 4, width: '100%', padding: '5px 8px', fontSize: 10, fontWeight: 800,
                background: '#003DA6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
              }}>
                {t('gallery_fix_order')}
              </button>
            )}
          </div>
          {collectionTags.length > 0 && (
            <div style={{ marginTop: 8 }} onClick={() => colorPickerTag && setColorPickerTag(null)}>
              <label style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 5 }}>
                {t('gallery_my_collection')}
                {isOwner && <span style={{ fontSize: 8, color: '#bbb', marginLeft: 6, fontWeight: 600 }}>
                  {t('gallery_drag_reorder')}
                </span>}
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <button onClick={() => setFCollectionTag('')} style={{
                  padding: '5px 12px', border: 'none', borderRadius: 20, cursor: 'pointer',
                  fontSize: 11, fontWeight: 700,
                  background: !fCollectionTag ? accent : (dark ? '#2a2a2a' : '#f0f0f0'),
                  color: !fCollectionTag ? 'white' : (dark ? '#ccc' : '#555'),
                }}>
                  {t('gallery_all')}
                </button>
                {principals.map(tag => renderTagPill(tag, 0))}
              </div>
              {activeChildren.length > 0 && (
                <div style={{ marginTop: 6, paddingLeft: 10, borderLeft: `3px solid ${activeParentColor}`, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    onClick={() => setFCollectionTag(activeParent!)}
                    style={{
                      padding: '3px 9px', border: 'none', borderRadius: 20, cursor: 'pointer',
                      fontSize: 10, fontWeight: 700,
                      background: fCollectionTag === activeParent ? activeParentColor : (dark ? '#2a2a2a' : '#f0f0f0'),
                      color: fCollectionTag === activeParent ? 'white' : (dark ? '#ccc' : '#555'),
                    }}
                  >
                    {t('gallery_all')}
                  </button>
                  {activeChildren.map(child => renderTagPill(child, 1))}
                </div>
              )}
            </div>
          )}
        </div>

        {!loaded && (
          <div className="card-grid">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="card-item" style={{ borderRadius: 8, overflow: 'hidden', background: dark ? '#2a2a2a' : '#f0f0f0' }}>
                <div style={{ width: '100%', aspectRatio: '2.5/3.5', background: dark ? 'linear-gradient(90deg, #2a2a2a 25%, #222 50%, #2a2a2a 75%)' : 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                <div style={{ padding: 8 }}>
                  <div style={{ height: 10, background: dark ? '#222' : '#e0e0e0', borderRadius: 4, marginBottom: 6, width: '80%' }} />
                  <div style={{ height: 8, background: dark ? '#252525' : '#e8e8e8', borderRadius: 4, width: '60%' }} />
                </div>
              </div>
            ))}
            <style>{`@keyframes shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }`}</style>
          </div>
        )}

        <style>{`
          .card-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
          .card-item { flex: 0 0 calc(50% - 5px); max-width: calc(50% - 5px); }
          @media (max-width: 768px) {
            .header-stats-block { width: 100% !important; align-items: center !important; }
            .galerie-actions { flex-direction: column !important; align-items: stretch !important; }
            .galerie-actions .btn-ajouter { font-size: 17px !important; padding: 14px 20px !important; text-align: center; width: 100%; box-sizing: border-box; }
            .galerie-actions .btn-menu { width: 100%; }
            .galerie-actions .btn-menu > button { width: 100% !important; }
          }
          @media (min-width: 900px) { .card-item { flex: 0 0 calc(20% - 10px); max-width: calc(20% - 10px); } }

          .sticker-badge {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: default;
            line-height: 1;
            transition: transform 0.15s;
          }
          .sticker-badge:hover { transform: scale(1.15); }
          .sticker-badge::after {
            content: attr(data-label);
            position: absolute;
            bottom: calc(100% + 8px);
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.82);
            color: white;
            font-size: 12px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 8px;
            white-space: nowrap;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.15s;
            z-index: 20;
            font-family: inherit;
          }
          .sticker-badge:hover::after { opacity: 1; }

          .sticker-team {
            position: relative;
            display: inline-flex;
            cursor: default;
            transition: transform 0.15s;
          }
          .sticker-team:hover { transform: scale(1.15); }
          .sticker-team::after {
            content: attr(data-label);
            position: absolute;
            bottom: calc(100% + 8px);
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.82);
            color: white;
            font-size: 12px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 8px;
            white-space: nowrap;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.15s;
            z-index: 20;
            font-family: inherit;
          }
          .sticker-team:hover::after { opacity: 1; }

          .sticker-holo {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: default;
            line-height: 1;
            transition: transform 0.15s;
            animation: holo-glow 3s linear infinite;
          }
          .sticker-holo:hover { transform: scale(1.15); }
          .sticker-holo::after {
            content: attr(data-label);
            position: absolute;
            bottom: calc(100% + 8px);
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.82);
            color: white;
            font-size: 12px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 8px;
            white-space: nowrap;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.15s;
            z-index: 20;
            font-family: inherit;
          }
          .sticker-holo:hover::after { opacity: 1; }
          @keyframes holo-glow {
            0%   { filter: drop-shadow(0 0 0 white) drop-shadow(0 0 3px white) drop-shadow(0 0 8px #ff6b6b) drop-shadow(0 0 14px #ff6b6b); }
            16%  { filter: drop-shadow(0 0 0 white) drop-shadow(0 0 3px white) drop-shadow(0 0 8px #ffd93d) drop-shadow(0 0 14px #ffd93d); }
            33%  { filter: drop-shadow(0 0 0 white) drop-shadow(0 0 3px white) drop-shadow(0 0 8px #6bcb77) drop-shadow(0 0 14px #6bcb77); }
            50%  { filter: drop-shadow(0 0 0 white) drop-shadow(0 0 3px white) drop-shadow(0 0 8px #4d96ff) drop-shadow(0 0 14px #4d96ff); }
            66%  { filter: drop-shadow(0 0 0 white) drop-shadow(0 0 3px white) drop-shadow(0 0 8px #c77dff) drop-shadow(0 0 14px #c77dff); }
            83%  { filter: drop-shadow(0 0 0 white) drop-shadow(0 0 3px white) drop-shadow(0 0 8px #ff6b9d) drop-shadow(0 0 14px #ff6b9d); }
            100% { filter: drop-shadow(0 0 0 white) drop-shadow(0 0 3px white) drop-shadow(0 0 8px #ff6b6b) drop-shadow(0 0 14px #ff6b6b); }
          }
          .holo-name {
            background: linear-gradient(90deg,#ff0080,#ff8c00,#ffee00,#00e676,#00b0ff,#e040fb,#ff0080);
            background-size: 300% 100%;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            animation: holo-text 10s linear infinite;
          }
          @keyframes holo-text {
            0%   { background-position: 0% 50%; }
            100% { background-position: 300% 50%; }
          }
          @media (max-width: 600px) {
            .holo-name { animation: none; background-position: 30% 50%; }
          }
        `}</style>
        
        {mounted && editMode && isOwner && selectedCards.size > 0 && createPortal(
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10, background: '#003DA6', color: 'white', borderRadius: '12px 12px 0 0', padding: '12px 24px', fontSize: 13, fontWeight: 700, flexWrap: 'wrap', boxShadow: '0 -4px 24px rgba(0,61,166,0.35)' }}>
            <span style={{ flex: '1 1 120px' }}>{selectedCards.size} carte{selectedCards.size > 1 ? 's' : ''} sélectionnée{selectedCards.size > 1 ? 's' : ''}</span>
            {/* Assigner collection tag en masse */}
            {showBulkNewTag ? (
              <>
              <input
                autoFocus
                value={bulkNewTag}
                onChange={e => setBulkNewTag(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Escape') { setShowBulkNewTag(false); setBulkNewTag(''); return }
                  if (e.key !== 'Enter') return
                  const tag = bulkNewTag.trim()
                  if (!tag) { setShowBulkNewTag(false); return }
                  await addSelectedToCollection(tag)
                  setBulkNewTag(''); setShowBulkNewTag(false)
                }}
                placeholder="Nom de la collection… (Entrée)"
                style={{ background: 'white', border: 'none', borderRadius: 6, color: '#111', padding: '5px 10px', fontSize: 12, fontWeight: 700, flexShrink: 0, width: 180, outline: 'none' }}
              />
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={() => { setShowBulkNewTag(false); setBulkNewTag('') }}
                style={{ background: 'rgba(255,255,255,0.25)', border: 'none', borderRadius: 4, color: 'white', padding: '4px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
              >✕</button>
              </>
            ) : (
              <select
                value=""
                onChange={async (e) => {
                  const tag = e.target.value
                  if (!tag) return
                  if (tag === '__new__') { setShowBulkNewTag(true); return }
                  if (tag === '__none__') { await removeSelectedFromAllCollections(); return }
                  await addSelectedToCollection(tag)
                }}
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, color: 'white', padding: '4px 8px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
              >
                <option value="" style={{ color: '#333' }}>🏷 Ajouter à une collection…</option>
                <option value="__new__" style={{ color: '#003DA6', fontWeight: 900 }}>✚ Créer une nouvelle…</option>
                <option value="__none__" style={{ color: '#333' }}>— Retirer de toutes —</option>
                {collectionTags.map(tag => (
                  <option key={tag} value={tag} style={{ color: '#333' }}>{tag}</option>
                ))}
              </select>
            )}
            <button
              onClick={startBulkEdit}
              style={{ background: 'rgba(255,255,255,0.2)', border: '1.5px solid rgba(255,255,255,0.5)', borderRadius: 6, color: 'white', padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              ✏️ Modifier en groupe
            </button>
            <button onClick={() => setSelectedCards(new Set())} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, color: 'white', padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              ✕ Désélectionner
            </button>
          </div>,
          document.body
        )}

        {mounted && qrMode && createPortal(
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10, background: '#7c3aed', color: 'white', borderRadius: '12px 12px 0 0', padding: '12px 24px', fontSize: 13, fontWeight: 700, flexWrap: 'wrap', boxShadow: '0 -4px 24px rgba(124,58,237,0.35)' }}>
            <span style={{ flex: '1 1 160px' }}>
              {qrSelected.size === 0
                ? '▦ Clique sur des cartes pour les sélectionner'
                : `▦ ${qrSelected.size} carte${qrSelected.size > 1 ? 's' : ''} sélectionnée${qrSelected.size > 1 ? 's' : ''}`}
            </span>
            {qrSelected.size > 0 && (
              <button onClick={() => setQrSelected(new Map())}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, color: 'white', padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                Désélectionner tout
              </button>
            )}
            <button onClick={downloadQrCodes} disabled={qrSelected.size === 0 || qrDownloading}
              style={{ background: qrSelected.size > 0 && !qrDownloading ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.5)', borderRadius: 6, color: 'white', padding: '6px 14px', cursor: qrSelected.size > 0 && !qrDownloading ? 'pointer' : 'default', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
              {qrDownloading ? '⏳ Génération...' : `⬇ Télécharger${qrSelected.size > 0 ? ` ${qrSelected.size} QR` : ''}`}
            </button>
            <button onClick={() => { setQrMode(false); setQrSelected(new Map()) }}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, color: 'white', padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              ✕ Quitter
            </button>
          </div>,
          document.body
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={e => setActiveDragId(e.active.id as string)}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={displayed.map(getCardId)} strategy={rectSortingStrategy}>
          <div ref={gridRef} className="card-grid">
          {displayed.map((d) => (
            <SortableCard
              key={getCardId(d)}
              id={getCardId(d)}
              disabled={!editMode || !isOwner || sortBy !== 'default'}
              className="card-item"
              onClick={() => {
                if (qrMode) { toggleQrCard(d); return }
                if (editMode && isOwner) { toggleCardSelection(getCardId(d)); return }
                if (!editMode) setPopup(d)
              }}
              style={{
              borderRadius: 8, padding: 8,
              background: qrSelected.has(getCardId(d)) ? '#f5f3ff' : selectedCards.has(getCardId(d)) ? '#e8f0fe' : 'white',
              outline: qrSelected.has(getCardId(d)) ? '2px solid #7c3aed' : selectedCards.has(getCardId(d)) ? '2px solid #003DA6' : 'none',
              cursor: qrMode ? 'pointer' : (editMode && isOwner && sortBy === 'default' ? 'pointer' : editMode ? 'default' : 'pointer'),
              ...((privateCards.has(d.f) && isOwner)
                ? { border: '2px solid #e74c3c' }
                : coloredBorder((d.collection_tag && tabSettings.get(d.collection_tag)?.color) || accent)),
              boxSizing: 'border-box',
              opacity: activeDragId === getCardId(d) ? 0.4 : privateCards.has(d.f) && isOwner ? 0.7 : 1,
              position: 'relative',
              transition: 'opacity 0.15s',
              overflow: 'visible',
            }}>
              {isOwner && privateCards.has(d.f) && (
                <div style={{ position: 'absolute', top: 6, left: 6, background: '#e74c3c', color: 'white', fontSize: 9, fontWeight: 900, padding: '2px 6px', borderRadius: 4, zIndex: 2 }}>
                  {t('gallery_private')}
                </div>
              )}
              {d.disponible_vente && (
                <div title={t('gallery_for_sale_title')} style={{ position: 'absolute', top: 6, right: 6, background: '#2e7d32', color: 'white', fontSize: 9, fontWeight: 900, padding: '2px 6px', borderRadius: 4, zIndex: 2, letterSpacing: 0.3 }}>
                  🏷️ {t('gallery_for_sale_label')}
                </div>
              )}
              {editMode && isOwner && selectedCards.has(getCardId(d)) && (
                <div style={{ position: 'absolute', top: 6, left: 6, background: '#003DA6', color: 'white', fontSize: 13, width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3, fontWeight: 900 }}>
                  ✓
                </div>
              )}
              {qrMode && qrSelected.has(getCardId(d)) && (
                <div style={{ position: 'absolute', top: 6, left: 6, background: '#7c3aed', color: 'white', fontSize: 11, width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3, fontWeight: 900 }}>
                  ▦
                </div>
              )}

              {/* Actions du mode édition (Confidentialité + Suppression) */}
              {editMode && isOwner && (
                <div style={{ position: 'absolute', top: 4, left: 0, right: 0, zIndex: 2, display: 'flex', flexDirection: 'column', gap: 4, padding: '0 4px' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={e => { e.stopPropagation(); togglePrivate(d.f) }} style={{
                      flex: 1, background: privateCards.has(d.f) ? '#e74c3c' : '#003DA6',
                      color: 'white', border: 'none', borderRadius: 6,
                      padding: '4px 4px', fontSize: 9, fontWeight: 900, cursor: 'pointer',
                    }}>
                      {privateCards.has(d.f) ? t('gallery_make_public') : t('gallery_make_private')}
                    </button>
                    {d.isManuelle && d.id_manuelle && (<>
                      <button onClick={e => { e.stopPropagation(); router.push(`/galerie/${userId}/editer/${d.id_manuelle}`) }} style={{
                        background: '#f59e0b', color: 'white', border: 'none', borderRadius: 6,
                        padding: '4px 6px', fontSize: 10, fontWeight: 900, cursor: 'pointer',
                      }} title={t('gallery_edit_card')}>
                        ✏️
                      </button>
                      {deleteCardConfirm === d.id_manuelle ? (
                        <>
                          <button onClick={e => { e.stopPropagation(); handleDeleteCard(d.id_manuelle!, d.f); setDeleteCardConfirm(null) }} style={{ background: '#e74c3c', color: 'white', border: 'none', borderRadius: 6, padding: '4px 5px', fontSize: 9, fontWeight: 900, cursor: 'pointer' }}>✓</button>
                          <button onClick={e => { e.stopPropagation(); setDeleteCardConfirm(null) }} style={{ background: '#555', color: 'white', border: 'none', borderRadius: 6, padding: '4px 5px', fontSize: 9, fontWeight: 900, cursor: 'pointer' }}>✕</button>
                        </>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); setDeleteCardConfirm(d.id_manuelle!) }} style={{
                          background: '#e74c3c', color: 'white', border: 'none', borderRadius: 6,
                          padding: '4px 6px', fontSize: 10, fontWeight: 900, cursor: 'pointer',
                        }} title={t('gallery_delete_card')}>
                          🗑️
                        </button>
                      )}
                    </>)}
                  </div>
                </div>
              )}
              <div style={{ width: '100%', marginBottom: 8 }}>{renderCardImage(d)}</div>
              {getTags(d)}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4, marginTop: 4 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 800, fontSize: 13, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.n}</p>
                  <p style={{ fontSize: 10, color: accent, fontWeight: 700, margin: '2px 0', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.v}</p>
                  <p style={{ fontSize: 10, color: '#999', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.y} {d.br} {d.s}</span>
                    {d.card_number && <span style={{ flexShrink: 0, fontWeight: 800, color: '#555', background: '#f0f0f0', borderRadius: 4, padding: '1px 5px', fontSize: 9 }}>#{d.card_number}</span>}
                  </p>
                </div>
                {/* Boutons like + commentaires */}
                {!editMode && (() => {
                  const likeInfo = cardLikes.get(d.f) || { count: 0, liked: false }
                  return (
                  <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <button
                      onClick={e => { e.stopPropagation(); setCommentCard(d) }}
                      title="Commenter"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, padding: '2px 4px', flexShrink: 0 }}
                    >
                      <span style={{ fontSize: 16, lineHeight: 1 }}>💬</span>
                      {(commentCounts.get(d.f) || 0) > 0 && <span style={{ fontSize: 9, fontWeight: 800, color: '#bbb' }}>{commentCounts.get(d.f)}</span>}
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        if (!currentUser) return
                        const isLiked = likeInfo.liked
                        setCardLikes(prev => {
                          const m = new Map(prev)
                          m.set(d.f, { count: likeInfo.count + (isLiked ? -1 : 1), liked: !isLiked })
                          return m
                        })
                        if (isLiked) {
                          await supabase.from('card_likes').delete().eq('card_key', d.f).eq('gallery_user_id', userId).eq('liker_user_id', currentUser)
                        } else {
                          await supabase.from('card_likes').upsert({ card_key: d.f, gallery_user_id: userId, liker_user_id: currentUser }, { onConflict: 'card_key,gallery_user_id,liker_user_id' })
                          // Notifier le propriétaire de la carte (pas soi-même)
                          if (currentUser !== userId) {
                            const { data: liker } = await supabase.from('profiles').select('display_name').eq('id', currentUser).single()
                            const likerName = liker?.display_name || 'Quelqu\'un'
                            await supabase.from('notifications').insert({
                              user_id: userId,
                              type: 'like',
                              message: `${likerName} a aimé votre carte`,
                              lien: `/galerie/${userId}?card=${encodeURIComponent(d.f)}`,
                              lu: false,
                            })
                            const { data: { session } } = await supabase.auth.getSession()
                            if (session?.access_token) {
                              fetch('/api/like-notify', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                                body: JSON.stringify({ toUserId: userId, likerName }),
                              }).catch(() => {})
                            }
                          }
                        }
                      }}
                      title="J'aime"
                      style={{
                        background: 'none', border: 'none', cursor: currentUser ? 'pointer' : 'default',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                        padding: '2px 4px', flexShrink: 0,
                      }}
                    >
                      <span style={{ fontSize: 16, lineHeight: 1, transition: '0.15s', transform: likeInfo.liked ? 'scale(1.2)' : 'scale(1)' }}>
                        {likeInfo.liked ? '❤️' : '🤍'}
                      </span>
                      {likeInfo.count > 0 && <span style={{ fontSize: 9, fontWeight: 800, color: likeInfo.liked ? '#e53935' : '#bbb' }}>{likeInfo.count}</span>}
                    </button>
                  </div>
                  )
                })()}
              </div>
          </SortableCard>
          ))}
          </div>
          </SortableContext>
        </DndContext>

        {/* Scroll infini */}
        {loaded && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#999', fontSize: 13 }}>
            {displayed.length < filtered.length ? (
              <div ref={loaderRef} style={{ padding: 20 }}>
                <div style={{ display: 'inline-block', width: 24, height: 24, border: '3px solid #eee', borderTopColor: '#003DA6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              </div>
            ) : filtered.length > 0 ? (
              <p style={{ color: '#bbb', fontSize: 12 }}>{filtered.length} {t('gallery_total')}</p>
            ) : cards.length > 0 && filtered.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
                <p style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>{t('gallery_no_match_title')}</p>
                <p style={{ color: '#999', fontSize: 13, marginBottom: 16 }}>{t('gallery_no_match_sub')}</p>
                <button onClick={() => { setSearchInput(''); setSearch(''); setFTeam(''); setFBrand(''); setFYear(''); setFCollectionTag(''); setPinTeam(''); setActiveFilters({ rc: false, auto: false, num: false, patch: false }); setFilterVente(false) }} style={{ background: '#003DA6', color: 'white', padding: '10px 20px', borderRadius: 50, fontWeight: 800, fontSize: 13, border: 'none', cursor: 'pointer' }}>
                  {t('gallery_clear_filters')}
                </button>
              </div>
            ) : cards.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🃏</div>
                {isOwner ? (
                  <>
                    <p style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>Ta galerie est vide</p>
                    <p style={{ color: '#999', fontSize: 13, marginBottom: 20 }}>Ajoute ta première carte ou connecte ton Google Sheets depuis le profil.</p>
                    <Link href={`/galerie/${userId}/ajouter`} style={{ background: '#003DA6', color: 'white', padding: '12px 24px', borderRadius: 50, fontWeight: 800, fontSize: 14, textDecoration: 'none', display: 'inline-block' }}>+ Ajouter une carte</Link>
                  </>
                ) : (
                  <>
                    <p style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>Galerie vide</p>
                    <p style={{ color: '#999', fontSize: 13 }}>Ce collectionneur n'a pas encore ajouté de cartes.</p>
                  </>
                )}
              </div>
            ) : null}
          </div>
        )}
        </>}
      </div>

      {commentCard && (
        <CommentsModal
          title={commentCard.n}
          onClose={() => { setCommentCard(null); loadCommentCounts(userId) }}
          galerieUserId={userId}
          cardKey={commentCard.f}
          accent={accent}
          isOwner={isOwner}
          emptyLabel="Soyez le premier à commenter cette carte"
        />
      )}

      {popup && (
        <Viewer3D popup={popup} accent={accent} onClose={() => setPopup(null)} getTags={getTags} userId={userId} userSlug={profile?.slug || userId}
          isOwner={isOwner} currentUserId={currentUser ?? undefined}
          onProposeTrade={!isOwner && currentUser && popup.id_manuelle ? () => setTradeCard(popup) : undefined}
          onNext={() => {
            if (!popup) return
            const idx = filtered.findIndex(c => c.f === popup.f)
            if (idx < filtered.length - 1) setPopup(filtered[idx + 1])
          }}
          onPrev={() => {
            if (!popup) return
            const idx = filtered.findIndex(c => c.f === popup.f)
            if (idx > 0) setPopup(filtered[idx - 1])
          }}
          onAddToMyGallery={!isOwner && currentUser ? async () => {
            if (addedCards.has(popup.f)) return 'duplicate'
            let dupQuery = supabase.from('cartes_manuelles')
              .select('id').eq('user_id', currentUser).eq('nom', popup.n).eq('collection', popup.s || '')
            if (popup.v) dupQuery = dupQuery.eq('variation', popup.v)
            else dupQuery = (dupQuery as any).is('variation', null)
            const { data: existing } = await dupQuery.limit(1)
            if (existing && existing.length > 0) {
              setAddedCards(prev => new Set(prev).add(popup.f))
              return 'duplicate'
            }
            const verso = popup.b !== popup.f ? popup.b : null
            await supabase.from('cartes_manuelles').insert({
              user_id: currentUser,
              nom: popup.n || null, equipe: popup.t || null, annee: popup.y || null,
              marque: popup.br || null, collection: popup.s || null, variation: popup.v || null,
              num: popup.num || null, card_number: popup.card_number || null,
              auto: popup.auto, rc: popup.rc, patch: popup.patch, booklet: popup.booklet || false,
              grade: popup.g || 'Raw',
              image_recto: popup.f || null, image_verso: verso,
            })
            setAddedCards(prev => new Set(prev).add(popup.f))
            return 'added'
          } : undefined}
          initialAddState={addedCards.has(popup.f) ? 'added' : 'idle'}
          allCollectionTags={collectionTags}
          onCollectionsChange={(card, next) => {
            // Les écritures DB sont faites par CollectionMultiSelect ; on met à jour l'état local
            const cols = [...new Set(next)]
            setCards(prev => prev.map(c => c.f === card.f ? { ...c, collections: cols, collection_tag: cols[0] || '' } : c))
            setPopup(prev => prev ? { ...prev, collections: cols, collection_tag: cols[0] || '' } : null)
            setCollectionTags(prev => [...new Set([...prev, ...cols])].sort())
          }}
        />
      )}

      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{
            position: 'fixed', bottom: 88, right: 24, zIndex: 9000,
            width: 44, height: 44, borderRadius: '50%',
            background: accent, color: 'white', border: 'none',
            fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            transition: 'opacity 0.2s',
          }}
          aria-label="Retour en haut"
        >↑</button>
      )}

      {tradeCard && tradeCard.id_manuelle && (
        <TradeModal
          targetCard={{
            id: tradeCard.id_manuelle,
            nom: tradeCard.n,
            annee: tradeCard.y,
            marque: tradeCard.br,
            image_recto: tradeCard.f,
          }}
          targetUserId={userId}
          targetUserName={profile?.display_name || 'Collector'}
          onClose={() => setTradeCard(null)}
          onSuccess={() => { setTradeCard(null); setTradeSent(true) }}
        />
      )}

      {tradeSent && (
        <div
          onClick={() => setTradeSent(false)}
          style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#003DA6', color: '#fff', borderRadius: 50, padding: '12px 24px', fontWeight: 700, fontSize: 14, zIndex: 9999, cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,61,0.3)' }}
        >
          🔄 Offre d&apos;échange envoyée !
        </div>
      )}

      {showConversionBanner && loaded && !currentUser && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 8500,
          background: dark ? '#0d1432' : 'white',
          borderTop: dark ? '1px solid rgba(0,120,255,0.2)' : '1px solid rgba(0,61,166,0.12)',
          padding: '14px 20px',
          display: 'flex', alignItems: 'center', gap: 14,
          boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
        }}>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: dark ? '#e8eeff' : '#0a2a6b', lineHeight: 1.4 }}>
            {lang === 'fr'
              ? "✦ Crée ta galerie gratuitement — l'IA identifie tes cartes en 1 photo."
              : lang === 'de'
              ? "✦ Erstelle deine Galerie kostenlos — die KI erkennt deine Karten in 1 Foto."
              : "✦ Create your free gallery — AI identifies your cards in 1 photo."}
          </span>
          <Link
            href="/sinscrire"
            style={{
              background: '#003DA6', color: 'white', borderRadius: 10,
              padding: '10px 18px', fontWeight: 700, fontSize: 13,
              textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            {t('gallery_get_started')}
          </Link>
          <button
            onClick={() => setShowConversionBanner(false)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: dark ? 'rgba(255,255,255,0.4)' : '#aab0c0',
              fontSize: 22, padding: '0 4px', flexShrink: 0, lineHeight: 1,
            }}
            aria-label={t('gallery_close')}
          >×</button>
        </div>
      )}
    </>
  )
}