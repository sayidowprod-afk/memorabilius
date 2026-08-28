'use client'
import { toast } from '@/lib/toast'
import { useEffect, useLayoutEffect, useState, useRef, useMemo, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { updateGalleryWidget } from '@/lib/widgetBridge'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import dynamic from 'next/dynamic'
import NextImage from 'next/image'
import OnlineIndicator from '@/components/OnlineIndicator'
import FollowButton from '@/components/FollowButton'
import FollowCounts from '@/components/FollowCounts'
import FollowListModal from '@/components/FollowListModal'
import LevelBadge from '@/components/LevelBadge'
import { InstagramIcon, XIcon, DiscordIcon } from '@/components/SocialIcons'
import CollectorCard from '@/components/CollectorCard'
import { hapticTap } from '@/lib/haptics'
import { saveOrShareFile } from '@/lib/saveOrShare'
import { useIsNative } from '@/lib/useIsNative'
import { NAV_TOTAL_HEIGHT_CSS } from '@/lib/nativeLayout'
import { getCsvCardSharePath } from '@/lib/csvCardShortLink'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { fireConfetti } from '@/components/Confetti'
import { useFlashOnChange } from '@/lib/useFlashOnChange'
import { useCountUp } from '@/lib/useCountUp'
import { useScrollReveal } from '@/lib/useScrollReveal'
import CardTagBadges, { TAG_COLORS } from '@/components/CardTagBadges'
import ModalCloseButton from '@/components/ModalCloseButton'
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
import { useAuth } from '@/lib/AuthContext'
import { getTeamById, SPORT_LABELS, Sport, inferSportFromTeamName } from '@/lib/sportsTeams'
import { parseNaturalQuery } from '@/lib/parseNaturalQuery'
import BadgeBox from '@/components/BadgeBox'
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

function SortableCard({ id, disabled, children, className, style, onClick, onLongPress, onPaintMove, onPaintEnd }: {
  id: string; disabled: boolean; children: React.ReactNode
  className?: string; style?: React.CSSProperties; onClick?: () => void; onLongPress?: () => void
  onPaintMove?: (x: number, y: number) => void; onPaintEnd?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressClick = useRef(false)
  const touchStart = useRef({ x: 0, y: 0 })

  const clearLongPress = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
  }
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!onLongPress) return
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    suppressClick.current = false
    longPressTimer.current = setTimeout(() => {
      suppressClick.current = true
      onLongPress()
    }, 500)
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    if (longPressTimer.current) {
      const dx = Math.abs(e.touches[0].clientX - touchStart.current.x)
      const dy = Math.abs(e.touches[0].clientY - touchStart.current.y)
      if (dx > 10 || dy > 10) clearLongPress()
      return
    }
    // Après un appui long qui a déjà déclenché onLongPress (sélection démarrée),
    // continuer à glisser le doigt "peint" les cartes survolées — permet de
    // sélectionner plusieurs cartes d'un seul geste plutôt qu'un tap par carte.
    if (suppressClick.current && onPaintMove) onPaintMove(e.touches[0].clientX, e.touches[0].clientY)
  }
  const handleTouchEnd = () => {
    clearLongPress()
    if (suppressClick.current) onPaintEnd?.()
  }
  const handleClickCapture = (e: React.MouseEvent) => {
    if (suppressClick.current) { e.stopPropagation(); e.preventDefault(); suppressClick.current = false }
  }

  return (
    <div
      ref={setNodeRef}
      data-card-id={id}
      className={`${className || ''}${isDragging ? ' card-item-dragging' : ''}`}
      style={{
        ...style,
        transform: isDragging
          ? `${CSS.Transform.toString(transform)} rotate(-4deg) scale(1.04)`
          : CSS.Transform.toString(transform),
        transition, zIndex: isDragging ? 999 : undefined,
      }}
      onClick={onClick}
      onClickCapture={handleClickCapture}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      {...attributes}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        // {...attributes} peut fixer tabIndex=-1 quand le drag est désactivé
        // (dnd-kit, voir `disabled` ci-dessus) — sans ceci, la carte ne serait
        // plus du tout activable au clavier hors du mode édition/réordonnement,
        // qui est le cas le plus courant (simple navigation).
        // e.target !== e.currentTarget : un bouton imbriqué (supprimer, like...)
        // arrête bien le clic à la souris (stopPropagation dans son onClick),
        // mais un `keydown` Entrée/Espace sur ce bouton continue de remonter
        // jusqu'ici (c'est un événement différent du clic) — sans cette garde,
        // valider un bouton imbriqué au clavier déclenchait AUSSI l'action de
        // la carte (ex: supprimer une carte ouvrait son popup dans la foulée).
        if ((e.key === 'Enter' || e.key === ' ') && onClick && e.target === e.currentTarget) { e.preventDefault(); onClick() }
      }}
    >
      {!disabled && (
        <div
          {...listeners}
          style={{
            position: 'absolute', bottom: 4, right: 4, zIndex: 10,
            width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.45)', borderRadius: 8, cursor: 'grab',
            touchAction: 'none', color: 'white', fontSize: 18, lineHeight: 1,
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
  return url
}

// Fallback quand une image externe (lien CSV vers un hébergeur tiers —
// ibb.co, Google Drive, eBay...) est morte ou temporairement indisponible :
// mieux vaut une image de remplacement propre qu'une icône cassée.
const BROKEN_IMAGE_FALLBACK = 'https://placehold.co/300x420?text=Image+indisponible'

function renderCardImage(card: { f: string; n: string; format?: string; is_horizontal?: boolean }) {
  const src = cardThumb(card.f)
  const fmt = getFormat(card.format)
  const horiz = isHorizontalFormat(card.format, card.is_horizontal)
  const ratio = fmt.isSlab ? cardDisplayRatio(card.format, card.is_horizontal) : '2.5/3.5'

  // unoptimized inconditionnel : les photos sont déjà compressées à l'upload (max
  // 1600px, voir downscaleToDataURL dans ajouter/page.tsx), donc le gain à les
  // repasser par l'optimiseur d'images Vercel (redimensionnement + conversion
  // webp/avif à la volée) est marginal — mais c'était le premier poste de coût
  // du plan (facturé par combinaison image×taille rencontrée, "Image Optimization
  // Transformation"). Retire ce passage payant plutôt que le laisser scaler avec
  // la croissance du site ; on paie un peu plus de bande passante à la place.
  if (fmt.isSlab || horiz) {
    return (
      <div style={{ aspectRatio: ratio, overflow: 'hidden', position: 'relative', background: fmt.isSlab ? '#111' : undefined }}>
        <NextImage
          src={src} alt={card.n} fill
          sizes="(max-width: 640px) 150px, 220px"
          unoptimized
          onError={e => { const img = e.currentTarget; if (img.src !== BROKEN_IMAGE_FALLBACK) img.src = BROKEN_IMAGE_FALLBACK }}
          style={horiz
            ? { width: '140%', height: '71.43%', left: '-20%', top: '14.286%', transform: 'rotate(90deg)', objectFit: 'cover' }
            : { objectFit: 'cover' }
          } />
      </div>
    )
  }

  return (
    <div style={{ aspectRatio: ratio, overflow: 'hidden', position: 'relative' }}>
      <NextImage
        src={src} alt={card.n} fill
        sizes="(max-width: 640px) 150px, 220px"
        style={{ objectFit: 'cover' }}
        unoptimized
        onError={e => { const img = e.currentTarget; if (img.src !== BROKEN_IMAGE_FALLBACK) img.src = BROKEN_IMAGE_FALLBACK }}
      />
    </div>
  )
}

interface Card {
  id_manuelle?: string;
  f: string; b: string; n: string; t: string; y: string
  br: string; s: string; v: string; num: string; card_number?: string; cert_number?: string
  auto: boolean; rc: boolean; patch: boolean; printing_plate?: boolean; g: string
  booklet?: boolean; is_horizontal?: boolean; verso_is_horizontal?: boolean | null; format?: string; il?: string; ir?: string
  isManuelle?: boolean; disponible_vente?: boolean; vendue?: boolean; beckett_designation?: string; item_type?: string
  storage_binder?: string; storage_page?: number | null; storage_slot?: string;
  lien_vinted?: string; lien_ebay?: string;
  created_at?: string; position?: number; collection_tag?: string; collections?: string[];
}

interface PreviewCard { id: string; image_recto: string; is_horizontal: boolean }

export default function GalerieClient({ userId, initialCardUrl, initialCards, initialGrailCards }: {
  userId: string; initialCardUrl?: string; initialCards?: PreviewCard[]; initialGrailCards?: PreviewCard[]
}) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  // userId (prop) est le paramètre de route brut — peut être un slug, pas
  // forcément l'UUID. Toutes les requêtes filtrant par user_id doivent
  // utiliser l'UUID résolu (profile.id une fois chargé), sinon elles ne
  // matchent aucune ligne pour les URLs en slug (galerie vide, actions
  // silencieusement no-op).
  const uid = profile?.id || userId
  const [cards, setCards] = useState<Card[]>([])
  // Liseré lumineux bref sur les cartes qui viennent d'apparaitre dans `cards`
  // (nouvel ajout, retour de la page "ajouter") — ignore le tout premier
  // chargement (rien ne doit clignoter a l'ouverture de la galerie).
  const prevCardIdsRef = useRef<Set<string> | null>(null)
  const [justAddedIds, setJustAddedIds] = useState<Set<string>>(new Set())
  const [cardsLoaded, setCardsLoaded] = useState(false)
  const [displayed, setDisplayed] = useState<Card[]>([])
  const [page, setPage] = useState(1)
  // Le param `q` de l'URL (lien partage, retour arriere, actualisation de page)
  // doit passer par le meme parseur en langage naturel que la saisie live,
  // sinon "iguodala rc" se retrouve utilise tel quel comme texte de recherche
  // (aucune carte ne contient litteralement "rc" dans son nom) au lieu
  // d'activer le filtre RC et de chercher juste "iguodala".
  const initialParsedSearch = parseNaturalQuery(searchParams.get('q') || '')
  const [activeFilters, setActiveFilters] = useState({ rc: initialParsedSearch.rc, auto: initialParsedSearch.auto, num: initialParsedSearch.num, patch: initialParsedSearch.patch })
  const [numMax, setNumMax] = useState<number | null>(initialParsedSearch.numMax)
  const [nlpHint, setNlpHint] = useState<string[]>(() => {
    const hints: string[] = []
    if (initialParsedSearch.rc) hints.push('RC')
    if (initialParsedSearch.auto) hints.push('Auto')
    if (initialParsedSearch.patch) hints.push('Patch')
    if (initialParsedSearch.year) hints.push(initialParsedSearch.year)
    if (initialParsedSearch.num) hints.push(initialParsedSearch.numMax != null ? `≤ /${initialParsedSearch.numMax}` : 'numérotée')
    return hints
  })
  const [filterPrivate, setFilterPrivate] = useState(false)
  const [filterVente, setFilterVente] = useState(searchParams.get('vente') === '1')
  const [filterMemo, setFilterMemo] = useState(false)
  const [sortBy, setSortBy] = useState<'default' | 'n' | 'n_desc' | 't' | 'y' | 'y_desc' | 's' | 'v' | 'g' | 'valeur' | 'valeur_desc' | 'num_asc' | 'card_num_asc' | 'card_num_desc' | 'date_desc' | 'date_asc'>(searchParams.get('sort') as any || 'default')
  const [sortBy2, setSortBy2] = useState<'none' | 'n' | 'n_desc' | 't' | 'y' | 'y_desc' | 's' | 'v' | 'num_asc' | 'card_num_asc' | 'card_num_desc' | 'date_desc' | 'date_asc'>(searchParams.get('sort2') as any || 'none')
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState(initialParsedSearch.text)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [fSport, setFSport] = useState(searchParams.get('sport') || '')
  const [fTeam, setFTeam] = useState(searchParams.get('team') || '')
  const [fBrand, setFBrand] = useState(searchParams.get('brand') || '')
  const fTeamDebounced = useDebouncedValue(fTeam, 200)
  const fBrandDebounced = useDebouncedValue(fBrand, 200)
  const [fYear, setFYear] = useState(initialParsedSearch.year || searchParams.get('year') || '')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [showAllCollectionTags, setShowAllCollectionTags] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid')
  const [compactView, setCompactView] = useState(false)
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
  const [followModalTab, setFollowModalTab] = useState<'followers' | 'following' | null>(null)
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
  const [popup, setPopupRaw] = useState<Card | null>(null)
  // Ouverture/fermeture/navigation du viewer via l'API View Transitions quand
  // le navigateur la supporte : un fondu-enchaîné natif remplace le cut sec.
  const setPopup = useCallback((next: Card | null | ((prev: Card | null) => Card | null)) => {
    const apply = () => flushSync(() => setPopupRaw(next))
    const startVT = (document as any).startViewTransition?.bind(document)
    if (!startVT) { apply(); return }
    const vt = startVT(apply)
    // Une transition en cours peut être avortée par la suivante (ex: clics rapides
    // suivant/précédent) — chaque promesse doit être catchée séparément.
    vt?.ready?.catch(() => {})
    vt?.updateCallbackDone?.catch(() => {})
    vt?.finished?.catch(() => {})
  }, [])
  const [tradeCard, setTradeCard] = useState<Card | null>(null)
  const [tradeSent, setTradeSent] = useState(false)
  const [showConversionBanner, setShowConversionBanner] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [usingOfflineCache, setUsingOfflineCache] = useState(false)
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [privateCards, setPrivateCards] = useState<Set<string>>(new Set())
  const [cardValues, setCardValues] = useState<Map<string, number>>(new Map())
  const [editMode, setEditMode] = useState(false)
  const [qrMode, setQrMode] = useState(false)
  const [qrSelected, setQrSelected] = useState<Map<string, { url: string; title: string; subtitle: string }>>(new Map())
  const [qrDownloading, setQrDownloading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<'collection' | 'objectifs' | 'comments' | 'library' | 'likes' | 'badges'>(() => {
    const t = searchParams.get('tab')
    if (t === 'wishlist' || t === 'pc') return 'objectifs'
    return (t as any) || 'collection'
  })
  const [objectifsSubTab, setObjectifsSubTab] = useState<'pc' | 'wishlist'>(
    searchParams.get('tab') === 'wishlist' ? 'wishlist' : 'pc'
  )
  // Indicateur "pilule" anime qui glisse vers l'onglet actif au lieu de
  // chaque bouton gerant seul son propre fond/ombre.
  const tabBtnRefs = useRef<Partial<Record<string, HTMLButtonElement>>>({})
  const tabBarRef = useRef<HTMLDivElement>(null)
  const [tabIndicator, setTabIndicator] = useState<{ left: number; width: number } | null>(null)
  const grailReveal = useScrollReveal<HTMLDivElement>()
  const cardGridReveal = useScrollReveal<HTMLDivElement>()
  const initialBinderId = searchParams.get('binder') ? parseInt(searchParams.get('binder')!, 10) : null
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set())
  // Aperçu agrandi au survol (desktop uniquement) : les infos texte sont déjà
  // affichées sous chaque vignette, mais dans une grille dense les miniatures
  // restent trop petites pour juger du visuel — pas besoin d'ouvrir le viewer
  // complet juste pour ça.
  // Partage d'une sélection multiple en une seule image (bouton "📤 Partager"
  // de la barre d'actions groupées) — réutilise GalerieExport en le pré-
  // restreignant aux cartes sélectionnées plutôt que toute la galerie.
  const [exportSelectionOpen, setExportSelectionOpen] = useState(false)
  const [exportSelectionKeys, setExportSelectionKeys] = useState<Set<string>>(new Set())
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [bulkNewTag, setBulkNewTag] = useState('')
  const [showBulkNewTag, setShowBulkNewTag] = useState(false)
  // monthlyBadges retired — remplacé par BadgeBox
  const [csvTags, setCsvTags] = useState<Map<string, string>>(new Map())
  // Cartes CSV : disponible_vente n'existe pas sur le CSV lui-même (source externe
  // en lecture seule) - même mécanisme de surcharge que collection_tag, stocké dans
  // carte_tags par (user_id, card_key).
  const [csvVente, setCsvVente] = useState<Map<string, boolean>>(new Map())
  const [grailCards, setGrailCards] = useState<{ card_key: string; position: number }[]>([])
  const [grailSearch, setGrailSearch] = useState('')
  const grailSearchDebounced = useDebouncedValue(grailSearch, 200)
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set())
  const [grailPickerOpen, setGrailPickerOpen] = useState(false)
  const [addedCards, setAddedCards] = useState<Set<string>>(new Set())
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [actionMenuOpen, setActionMenuOpen] = useState(false)
  const [actionMenuUp, setActionMenuUp] = useState(false)
  const [actionMenuRect, setActionMenuRect] = useState<{ top: number; bottom: number; right: number } | null>(null)
  const [colorPickerUp, setColorPickerUp] = useState(false)
  const [colorPickerLeft, setColorPickerLeft] = useState(false)
  const loaderRef = useRef<HTMLDivElement>(null)

  const { user: authUser } = useAuth()
  const isOwner = currentUser === userId
  const { t, lang } = useLang()
  const { dark } = useTheme()
  const isNative = useIsNative()
  const cardParam = searchParams.get('card')

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    try { if (localStorage.getItem('gallery_compact_view') === '1') setCompactView(true) } catch {}
  }, [])
  const toggleCompactView = () => {
    setCompactView(p => {
      const next = !p
      try { localStorage.setItem('gallery_compact_view', next ? '1' : '0') } catch {}
      return next
    })
  }

  // Sync currentUser avec l'état auth global (AuthProvider) — sans appel réseau
  useEffect(() => {
    setCurrentUser(authUser?.id || null)
  }, [authUser])

  useEffect(() => {
    let cancelled = false
    // Juste après un cold start (Android surtout), le réseau peut ne pas être
    // vraiment prêt : ces requêtes peuvent alors rester bloquées en attente
    // indéfiniment (ni resolve ni reject). Sans filet, la galerie reste
    // figée sur le squelette de chargement pour toujours. On retente donc
    // automatiquement, avec un timeout pour ne pas dépendre d'un rejet
    // explicite (même filet que NativeHomeDashboard).
    const init = async (attempt: number) => {
      try {
        let resolvedId = userId
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))

        if (!uuidRegex.test(userId)) {
          const { data: p } = await Promise.race([
            supabase.from('profiles').select('id').eq('slug', userId).single(),
            timeout,
          ])
          if (cancelled) return
          if (p) resolvedId = p.id
          else { setLoaded(true); return }
        }

        // Tags + profil en parallèle — pas de getSession() qui peut bloquer/pendre
        const [{ data: tagsData }, { data: profileData }] = await Promise.race([
          Promise.all([
            supabase.from('carte_tags').select('card_key, collection_tag, disponible_vente').eq('user_id', resolvedId),
            supabase.from('profiles').select('*').eq('id', resolvedId).single(),
          ]),
          timeout,
        ])
        if (cancelled) return
        const tagsMap = new Map((tagsData || []).map((r: any) => [r.card_key, r.collection_tag]))
        setCsvTags(tagsMap)
        const venteMap = new Map((tagsData || []).map((r: any) => [r.card_key, r.disponible_vente || false]))
        setCsvVente(venteMap)

        if (profileData) { setProfile(profileData); loadCSV(profileData.lien_csv ?? null, tagsMap, profileData.gallery_order || [], venteMap) }
        else setLoaded(true)
        // badges chargés dans BadgeBox à la demande
        supabase.from('collection_tab_settings').select('tag, color, position, parent').eq('user_id', resolvedId).then(({ data }) => {
          if (data) setTabSettings(new Map(data.map((r: any) => [r.tag, { color: r.color, position: r.position, parent: r.parent ?? null }])))
        })
        supabase.from('grail_cards').select('card_key, position').eq('user_id', resolvedId).order('position').then(({ data }) => {
          if (data) setGrailCards(data)
        })
        ;(async () => {
          // PostgREST plafonne chaque réponse à 1000 lignes (max_rows) même avec un
          // .limit() plus élevé — une galerie populaire dépassant 1000 likes cumulés
          // se faisait tronquer silencieusement, ce qui faisait disparaître le coeur
          // "aimé" sur les cartes likées les plus récemment (celles hors des 1000
          // premières lignes renvoyées, sans tri garanti). Pagination réelle nécessaire,
          // comme pour binder_slots/cartes_manuelles/card_set_entries ailleurs.
          const likesData: { card_key: string; liker_user_id: string }[] = []
          for (let from = 0; ; from += 1000) {
            const { data, error } = await supabase
              .from('card_likes').select('card_key, liker_user_id')
              .eq('gallery_user_id', resolvedId).range(from, from + 999)
            if (error || !data || data.length === 0) break
            likesData.push(...data)
            if (data.length < 1000) break
          }
          // authUser?.id peut être null si l'auth n'est pas encore résolue — liked sera recalculé à la prochaine visite
          const myId = authUser?.id || null
          const map = new Map<string, { count: number; liked: boolean }>()
          for (const l of likesData) {
            const prev = map.get(l.card_key) || { count: 0, liked: false }
            map.set(l.card_key, { count: prev.count + 1, liked: prev.liked || l.liker_user_id === myId })
          }
          setCardLikes(map)
        })()
        loadCommentCounts(resolvedId)
      } catch (e) {
        if (cancelled) return
        if (attempt < 2) { setTimeout(() => { if (!cancelled) init(attempt + 1) }, 1000); return }
        console.error('Gallery init error', e)
        setLoaded(true)
      }
    }
    init(1)
    return () => { cancelled = true }
  }, [userId])

  useEffect(() => {
    supabase.from('cartes_privees').select('card_key').eq('user_id', uid)
      .then(({ data }) => {
        if (data) setPrivateCards(new Set(data.map((d: any) => d.card_key)))
      })
    supabase.from('card_values').select('card_key,valeur').eq('user_id', uid)
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
      await supabase.from('cartes_privees').delete().eq('user_id', uid).eq('card_key', cardKey)
      setPrivateCards(prev => { const s = new Set(prev); s.delete(cardKey); return s })
    } else {
      await supabase.from('cartes_privees').insert({ user_id: userId, card_key: cardKey })
      setPrivateCards(prev => new Set([...prev, cardKey]))
    }
  }

  // Suppression avec délai d'annulation (5s) : la carte disparaît immédiatement de
  // l'UI, mais la suppression réelle en base n'est déclenchée qu'après le délai
  // (sauf annulation) — évite le côté définitif/anxiogène d'un clic malheureux
  // (surtout avec la confirmation à 2 taps déjà en place). Volontairement pas de
  // "vraie" annulation après coup (delete + reinsert) : ça créerait une nouvelle
  // ligne (nouvel id) et casserait les likes/commentaires déjà liés à l'ancienne.
  const UNDO_DELETE_DELAY_MS = 5000
  const pendingDeletesRef = useRef<Map<string, { card: Card; index: number; timeoutId: ReturnType<typeof setTimeout> }>>(new Map())
  const [undoBanner, setUndoBanner] = useState<{ id: string; nom: string; ids?: string[] } | null>(null)

  const finalizeDeleteCard = async (idManuelle: string, cardKey: string) => {
    const pending = pendingDeletesRef.current.get(idManuelle)
    pendingDeletesRef.current.delete(idManuelle)
    // Le bandeau "Annuler" est effacé ici plutôt que par un 2e minuteur
    // indépendant — les deux étaient réglés sur la même durée à la main,
    // et un changement du délai dans un seul des deux aurait fait
    // disparaître le bouton Annuler avant que la suppression réelle
    // n'ait lieu (ou l'inverse), sans lien garanti entre les deux.
    setUndoBanner(cur => cur?.id === idManuelle ? null : cur)
    try {
      // 1. Mise à jour classement mensuel + stats_total (avant suppression pour lire created_at)
      const { data: { session } } = await supabase.auth.getSession()
      fetch('/api/card-added', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ userId, cardId: idManuelle }),
      }).catch(e => console.error('[card-added DELETE] stats divergence:', e))

      // 2. Suppression de la table des cartes manuelles
      const { error } = await supabase.from('cartes_manuelles').delete().eq('id', idManuelle).eq('user_id', uid)
      if (error) throw error

      // 2bis. Libérer sa pochette dans un classeur si elle y était rangée —
      // binder_slots référence card_key en texte libre (pas de FK), donc rien
      // ne le fait automatiquement : sans ça, la pochette restait bloquée à
      // vie, affichant l'image d'une carte qui n'existe plus, en empêchant
      // toute nouvelle carte d'y être placée. La policy RLS de binder_slots
      // restreint déjà la suppression aux classeurs de l'appelant.
      await supabase.from('binder_slots').delete().eq('card_key', cardKey)

      // 2ter. Même chose côté checklist de set — une entrée auto-matchée sur
      // cette carte restait marquée "possédée" pour toujours après suppression
      // de la carte qui le prouvait (rien ne les relie par FK). Seules les
      // entrées auto-matchées (manually_checked=false) sont revues : une
      // coche manuelle reste une déclaration explicite de l'utilisateur,
      // pas quelque chose à annuler automatiquement.
      await supabase.from('user_set_completion').delete().eq('user_id', uid).eq('matched_card_key', cardKey).eq('manually_checked', false)
      await supabase.from('entry_images').delete().eq('user_id', uid).eq('image_url', cardKey)

      // 3. Nettoyage de sa visibilité si elle était en mode privé
      await supabase.from('cartes_privees').delete().eq('user_id', uid).eq('card_key', cardKey)
      setPrivateCards(prev => { const s = new Set(prev); s.delete(cardKey); return s })
    } catch (e: any) {
      toast.error('Erreur lors de la suppression : ' + e.message)
      // La carte avait déjà disparu de l'UI de façon optimiste (voir
      // handleDeleteCard) — sans ça, un échec réseau/RLS ici la laissait
      // manquante indéfiniment côté écran alors qu'elle existe toujours en
      // base, jusqu'à un rechargement manuel de la page.
      if (pending) setCards(prev => {
        const next = [...prev]
        next.splice(Math.min(pending.index, next.length), 0, pending.card)
        return next
      })
    }
  }

  const handleDeleteCard = (idManuelle: string, cardKey: string) => {
    if (!currentUser || currentUser !== userId) return
    const index = cards.findIndex(c => c.id_manuelle === idManuelle)
    if (index === -1) return
    const card = cards[index]

    // Mise à jour de l'état local pour faire disparaître l'élément instantanément
    setCards(prev => prev.filter(c => c.id_manuelle !== idManuelle))

    const timeoutId = setTimeout(() => finalizeDeleteCard(idManuelle, cardKey), UNDO_DELETE_DELAY_MS)
    pendingDeletesRef.current.set(idManuelle, { card, index, timeoutId })
    setUndoBanner({ id: idManuelle, nom: card.n })
  }

  const undoDeleteCard = (idManuelle: string) => {
    const pending = pendingDeletesRef.current.get(idManuelle)
    if (!pending) return
    clearTimeout(pending.timeoutId)
    pendingDeletesRef.current.delete(idManuelle)
    setCards(prev => {
      const next = [...prev]
      next.splice(Math.min(pending.index, next.length), 0, pending.card)
      return next
    })
    setUndoBanner(null)
  }

  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
  // Repart de zéro dès que la sélection change -- sans ça, confirmer une
  // suppression groupée puis fermer/rouvrir la sélection sur un autre lot de
  // cartes garderait le bouton "Confirmer" affiché sans nouveau clic.
  useEffect(() => { setBulkDeleteConfirm(false) }, [selectedCards])

  // Suppression groupée : réutilise handleDeleteCard carte par carte (même délai
  // d'annulation de 5s, même nettoyage binder_slots/checklist/visibilité par
  // carte) plutôt que de dupliquer la logique de finalizeDeleteCard. Seule la
  // suppression concerne les cartes manuelles (isManuelle) — les cartes
  // communautaires n'ont pas d'id_manuelle à supprimer, comme pour le bouton
  // de suppression individuel (voir `d.isManuelle && d.id_manuelle` plus bas).
  const bulkDeleteSelected = () => {
    if (!currentUser || currentUser !== userId) return
    const targets = [...selectedCards]
      .map(id => cards.find(c => c.isManuelle && c.id_manuelle === id))
      .filter((c): c is Card => !!c)
    if (targets.length === 0) { setBulkDeleteConfirm(false); return }
    const ids = targets.map(c => c.id_manuelle!)
    for (const card of targets) handleDeleteCard(card.id_manuelle!, card.f)
    setSelectedCards(new Set())
    setBulkDeleteConfirm(false)
    // Un seul bandeau "Annuler" consolidé plutôt qu'un par carte (qui se
    // remplaceraient les uns les autres) -- undoBulkDelete annule chaque
    // suppression individuellement pendant la fenêtre de 5s.
    setUndoBanner({ id: `__bulk__:${ids.join(',')}`, nom: `${targets.length} carte${targets.length > 1 ? 's' : ''}`, ids })
  }

  const undoBulkDelete = (ids: string[]) => {
    for (const id of ids) undoDeleteCard(id)
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
    const { error } = await supabase.from('card_collections').upsert(rows, { onConflict: 'user_id,card_key,collection', ignoreDuplicates: true })
    if (error) { toast.error('Erreur lors de l\'ajout à la collection : ' + error.message); return }
    setCards(prev => prev.map(c => {
      const id = c.isManuelle ? c.id_manuelle : c.f
      if (!id || !selectedCards.has(id)) return c
      const cols = [...new Set([...(c.collections || []), tag])]
      return { ...c, collections: cols, collection_tag: cols[0] || '' }
    }))
    if (!collectionTags.includes(tag)) setCollectionTags(prev => [...prev, tag].sort())
  }

  // Retire les cartes sélectionnées d'une collection spécifique
  const removeSelectedFromCollection = async (tag: string) => {
    if (!currentUser || !tag) return
    const keys: string[] = []
    for (const id of selectedCards) {
      const card = cards.find(c => (c.isManuelle ? c.id_manuelle : c.f) === id)
      if (card) keys.push(card.f)
    }
    if (keys.length === 0) return
    await supabase.from('card_collections').delete().eq('user_id', currentUser).eq('collection', tag).in('card_key', keys)
    setCards(prev => prev.map(c => {
      const id = c.isManuelle ? c.id_manuelle : c.f
      if (!id || !selectedCards.has(id)) return c
      const cols = (c.collections || []).filter(col => col !== tag)
      return { ...c, collections: cols, collection_tag: cols[0] || '' }
    }))
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

  const loadCSV = async (url: string | null, tagsMap?: Map<string, string>, galleryOrder: string[] = [], venteMap?: Map<string, boolean>) => {
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
            collection_tag: (tagsMap || csvTags).get(c[0]?.trim()) || '',
            disponible_vente: (venteMap || csvVente).get(c[0]?.trim()) || false
          }
        }).filter(Boolean) as Card[]
      }

      const mapManuelle = (m: any): Card => ({
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
        collection_tag: m.collection_tag || '', disponible_vente: m.disponible_vente || false, vendue: m.vendue || false, item_type: m.item_type || 'card',
        storage_binder: m.storage_binder || '', storage_page: m.storage_page ?? null, storage_slot: m.storage_slot || '',
        lien_vinted: m.lien_vinted || '', lien_ebay: m.lien_ebay || '',
      })

      const applyAndShow = (manuelles: any[], ccMap: Map<string, string[]>) => {
        const cartesM: Card[] = manuelles.map(mapManuelle)
        const attachCollections = (card: Card) => {
          const legacy = card.collection_tag ? [card.collection_tag] : []
          const cols = [...new Set([...(ccMap.get(card.f) || []), ...legacy])]
          card.collections = cols
          card.collection_tag = cols[0] || ''
        }
        parsed.forEach(attachCollections)
        cartesM.forEach(attachCollections)
        cartesM.sort((a, b) => (a.position ?? 9999) - (b.position ?? 9999))
        const allCards = [...parsed, ...cartesM]
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
        setUsingOfflineCache(false)
        // searchParams.get() decode deja la valeur — un decodeURIComponent() ici
        // double-decodait le param (symetrique au double-encode corrige plus bas).
        const target = initialCardUrl || cardParam || null
        if (target) {
          const match = allCards.find(c => c.f === target)
          if (match) {
            setPopup(match)
            // Nettoie l'URL affichée dans la barre d'adresse : peu importe d'où vient ce
            // lien long (recherche globale, ancienne notification, partage...), on la
            // remplace par le lien court une fois la carte résolue côté client.
            if (!match.id_manuelle) {
              getCsvCardSharePath(userId, match.f).then(path => {
                if (path.startsWith('/c/')) router.replace(path)
              })
            }
          }
        }
      }

      // Premier batch + card_collections en parallèle → affichage immédiat.
      // C'est la requête la plus lourde de la galerie (select('*') sur
      // jusqu'à 1000 cartes) : sans filet, un ralentissement Supabase ici
      // laissait la page figée sur le squelette de chargement indéfiniment,
      // sans jamais tomber dans le catch (une promesse qui ne resout ni ne
      // rejette jamais ne déclenche aucun des deux). Même filet que init()
      // et NativeHomeDashboard : timeout court + peu de tentatives, pour
      // atteindre vite un état stable (donnees ou repli) plutot que de
      // laisser la page paraitre figee pendant ~40s avant de reagir.
      const fetchFirstBatch = async (attempt: number): Promise<any> => {
        const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 6000))
        try {
          return await Promise.race([
            Promise.all([
              supabase.from('cartes_manuelles').select('*', { count: 'exact' }).eq('user_id', uid).order('created_at', { ascending: true }).range(0, 999),
              supabase.from('card_collections').select('card_key, collection').eq('user_id', uid),
            ]),
            timeout,
          ])
        } catch (e) {
          if (attempt >= 2) throw e
          await new Promise(r => setTimeout(r, 1000))
          return fetchFirstBatch(attempt + 1)
        }
      }
      const [firstResult, ccResult] = await fetchFirstBatch(1)
      const firstBatch = firstResult.data || []
      const totalCount = firstResult.count || 0
      const ccMap = new Map<string, string[]>()
      for (const r of ccResult.data || []) {
        const arr = ccMap.get(r.card_key) || []; arr.push(r.collection); ccMap.set(r.card_key, arr)
      }

      applyAndShow(firstBatch, ccMap)

      // Si plus de 1000 cartes, charge le reste en arrière-plan
      if (totalCount > 1000) {
        const pageCount = Math.ceil(totalCount / 1000)
        const remainingBatches = await Promise.all(
          Array.from({ length: pageCount - 1 }, (_, i) =>
            supabase.from('cartes_manuelles').select('*').eq('user_id', uid).order('created_at', { ascending: true }).range((i + 1) * 1000, (i + 2) * 1000 - 1).then(r => r.data || [])
          )
        )
        applyAndShow([...firstBatch, ...remainingBatches.flat()], ccMap)
      }
    } catch (e) {
      console.error('CSV error', e)
      // Hors-ligne / requête échouée : si c'est la galerie du propriétaire, on
      // retombe sur la dernière copie mise en cache plutôt que d'afficher du vide.
      if (isOwner) {
        try {
          const cached = localStorage.getItem(`gallery-cache-${userId}`)
          if (cached) {
            const allCards: Card[] = JSON.parse(cached)
            setCards(allCards)
            setTeams([...new Set(allCards.map(d => d.t).filter(Boolean))].sort())
            setBrands([...new Set(allCards.map(d => d.s).filter(Boolean))].sort())
            setYears([...new Set(allCards.map(d => d.y).filter(Boolean))].sort())
            setCollectionTags([...new Set(allCards.flatMap(d => d.collections || []).filter(Boolean) as string[])].sort())
            setUsingOfflineCache(true)
          }
        } catch {}
      }
      setLoaded(true)
    }
  }

  // Cache hors-ligne + widget écran d'accueil pour le propriétaire de la galerie.
  // Séparé de applyAndShow() car isOwner (dérivé de l'auth, résolue en parallèle
  // du chargement des cartes) peut encore valoir false au moment où les cartes
  // arrivent en premier — cet effet se redéclenche quand isOwner devient vrai.
  const lastAddedCard = [...cards]
    .filter(c => c.created_at)
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0]
  const lastAddedKey = lastAddedCard ? `${lastAddedCard.f}_${cards.length}` : `_${cards.length}`

  useEffect(() => {
    if (!isOwner || !loaded || cards.length === 0) return
    try { localStorage.setItem(`gallery-cache-${userId}`, JSON.stringify(cards)) } catch {}
    if (lastAddedCard) {
      updateGalleryWidget({
        imageUrl: lastAddedCard.f,
        playerName: lastAddedCard.n || t('gallery_default_gallery_name'),
        totalCards: cards.length,
        galleryUrl: `https://www.memorabilius.fr/galerie/${userId}`,
        team: lastAddedCard.t || '',
        year: lastAddedCard.y || '',
        rc: !!lastAddedCard.rc,
        auto: !!lastAddedCard.auto,
        patch: !!lastAddedCard.patch,
      })
    }
  }, [isOwner, loaded, lastAddedKey, userId])

  const gallerySports = useMemo(() => {
    const set = new Set<Sport>()
    for (const c of cards) { const sp = inferSportFromTeamName(c.t); if (sp) set.add(sp) }
    return [...set].sort()
  }, [cards])

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
        (!fSport || inferSportFromTeamName(d.t) === fSport) &&
        (!fTeamDebounced || d.t.toLowerCase().includes(fTeamDebounced.toLowerCase())) &&
        (!fBrandDebounced || d.s.toLowerCase().includes(fBrandDebounced.toLowerCase())) &&
        (!fYear || d.y === fYear) &&
        (!fCollectionTag || (d.collections || []).some(c => matchCols.has(c))) &&
        (!activeFilters.rc || d.rc) &&
        (!activeFilters.auto || d.auto) &&
        (!activeFilters.patch || d.patch) &&
        (!activeFilters.num || d.num !== '') &&
        (numMax == null || (() => { const m = (d.num || '').match(/\/(\d+)$/); return m ? parseInt(m[1]) <= numMax : false })()) &&
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
  }, [cards, search, fSport, fTeamDebounced, fBrandDebounced, fYear, fCollectionTag, activeFilters, numMax, filterPrivate, filterVente, filterMemo, privateCards, isOwner, sortBy, sortBy2, pinTeam, cardValues, tabSettings])

  const filteredStats = useMemo(() => ({
    rc:   filtered.filter(c => c.rc).length,
    auto: filtered.filter(c => c.auto).length,
    num:  filtered.filter(c => c.num !== '').length,
    patch: filtered.filter(c => c.patch).length,
  }), [filtered])

  // Vue chronologie : regroupe les cartes filtrees par mois d'ajout, toujours
  // du plus recent au plus ancien (independamment du tri choisi pour la
  // grille -- c'est le seul interet de cette vue). Les cartes sans date
  // (import CSV ancien) rejoignent un groupe "Date inconnue" en dernier.
  const timelineGroups = useMemo(() => {
    const withDate = filtered.filter(c => c.created_at)
    const withoutDate = filtered.filter(c => !c.created_at)
    withDate.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    const groups: { key: string; label: string; cards: Card[] }[] = []
    for (const c of withDate) {
      const d = new Date(c.created_at!)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      let g = groups.find(g => g.key === key)
      if (!g) {
        const label = d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'de' ? 'de-DE' : 'en-US', { month: 'long', year: 'numeric' })
        g = { key, label: label.charAt(0).toUpperCase() + label.slice(1), cards: [] }
        groups.push(g)
      }
      g.cards.push(c)
    }
    if (withoutDate.length > 0) groups.push({ key: 'none', label: t('gallery_timeline_no_date'), cards: withoutDate })
    return groups
  }, [filtered, lang, t])

  // Petit flash visuel quand une stat du header change (ex: carte ajoutee) —
  // fait remarquer ce qui vient de bouger plutot que de changer silencieusement.
  const totalFlash = useFlashOnChange(filtered.length)
  const rcFlash = useFlashOnChange(filteredStats.rc)
  const autoFlash = useFlashOnChange(filteredStats.auto)
  const numFlash = useFlashOnChange(filteredStats.num)
  const patchFlash = useFlashOnChange(filteredStats.patch)
  const totalCount = useCountUp(filtered.length)
  const rcCount = useCountUp(filteredStats.rc)
  const autoCount = useCountUp(filteredStats.auto)
  const numCount = useCountUp(filteredStats.num)
  const patchCount = useCountUp(filteredStats.patch)

  // Volontairement PAS `[filtered]` : `filtered` recalcule (nouvelle
  // référence) a chaque `setCards()`, y compris un simple glisser-deposer
  // pour reordonner - ca renvoyait l'utilisateur en page 1 (donc en haut)
  // a chaque deplacement de carte. On ne reinitialise la page que quand un
  // critere de filtre/tri change reellement.
  useEffect(() => { setPage(1) }, [search, fSport, fTeamDebounced, fBrandDebounced, fYear, fCollectionTag, activeFilters, filterPrivate, filterVente, filterMemo, sortBy, sortBy2, pinTeam])

  useEffect(() => {
    const ids = new Set(cards.map(getCardId))
    if (prevCardIdsRef.current) {
      const added = [...ids].filter(id => !prevCardIdsRef.current!.has(id))
      if (added.length > 0) {
        setJustAddedIds(new Set(added))
        const timer = setTimeout(() => setJustAddedIds(new Set()), 1300)
        prevCardIdsRef.current = ids
        return () => clearTimeout(timer)
      }
    }
    prevCardIdsRef.current = ids
  }, [cards])

  // Repositionne l'indicateur d'onglet actif — au changement d'onglet et au
  // redimensionnement (les onglets scrollent horizontalement sur mobile).
  useEffect(() => {
    const measure = () => {
      const btn = tabBtnRefs.current[activeTab]
      const bar = tabBarRef.current
      if (!btn || !bar) return
      const barRect = bar.getBoundingClientRect()
      const btnRect = btn.getBoundingClientRect()
      setTabIndicator({ left: btnRect.left - barRect.left + bar.scrollLeft, width: btnRect.width })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [activeTab, isOwner])

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
    if (fTeamDebounced) sp.set('team', fTeamDebounced)
    if (fBrandDebounced) sp.set('brand', fBrandDebounced)
    if (fYear) sp.set('year', fYear)
    if (fCollectionTag) sp.set('tag', fCollectionTag)
    if (sortBy !== 'default') sp.set('sort', sortBy)
    if (sortBy2 !== 'none') sp.set('sort2', sortBy2)
    if (pinTeam) sp.set('pin', pinTeam)
    if (filterVente) sp.set('vente', '1')
    // URLSearchParams.set()/.toString() encode deja la valeur — un encodeURIComponent()
    // ici double-encodait le param (%2F devenait %252F). A chaque render qui
    // re-declenchait cet effet, le param divergeait un peu plus de ce que la lecture
    // attendait, ce qui pouvait faire boucler la resynchronisation popup <-> URL
    // (carte qui apparait/disparait en boucle, notamment apres un F5 sur un viewer ouvert).
    if (popup?.f) sp.set('card', popup.f)
    const str = sp.toString()
    router.replace(str ? `?${str}` : window.location.pathname, { scroll: false })
  }, [loaded, search, fTeamDebounced, fBrandDebounced, fYear, fCollectionTag, sortBy, sortBy2, pinTeam, filterVente, popup])

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
    if (!grailPickerOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setGrailPickerOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [grailPickerOpen])

  // Raccourci "/" pour aller directement à la recherche sans prendre la souris
  // (courant sur les sites avec beaucoup de contenu à filtrer) — ignoré si on
  // est déjà en train de taper ailleurs (input/textarea/contenteditable), sinon
  // taper "/" dans un autre champ volerait le focus au milieu de la frappe.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/') return
      const target = e.target as HTMLElement
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return
      e.preventDefault()
      searchInputRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 500)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const toggleFilter = (k: keyof typeof activeFilters) => setActiveFilters(p => ({ ...p, [k]: !p[k] }))

  const getCardId = (c: Card) => c.id_manuelle || c.f

  // Prepare les cartes selectionnees en mode Multi-QR pour la page d'etiquettes
  // de vente imprimables -- reutilise la meme selection plutot que d'en creer
  // une seconde, separee. Passe par sessionStorage (pas de limite d'URL, et le
  // payload -- images en base ou juste des dizaines de cartes -- resterait trop
  // gros pour un querystring) plutot qu'un aller-retour base de donnees.
  const openSaleLabels = () => {
    if (qrSelected.size === 0) return
    const items = [...qrSelected.entries()].map(([cardId, { url, title, subtitle }]) => {
      const card = cards.find(c => getCardId(c) === cardId)
      return {
        url, title, subtitle,
        image: card?.f || '',
        value: card ? cardValues.get(card.f) ?? null : null,
      }
    })
    try { sessionStorage.setItem('mb_sale_labels', JSON.stringify(items)) } catch {}
    router.push(`/galerie/${userId}/etiquettes`)
  }

  const toggleQrCard = async (d: Card) => {
    const cardId = getCardId(d)
    if (qrSelected.has(cardId)) {
      setQrSelected(prev => { const next = new Map(prev); next.delete(cardId); return next })
      return
    }
    const url = d.id_manuelle ? `/s/${d.id_manuelle}` : await getCsvCardSharePath(userId, d.f)
    setQrSelected(prev => {
      const next = new Map(prev)
      next.set(cardId, {
        url,
        title: d.n,
        subtitle: [d.y, d.br, d.s].filter(Boolean).join(' · '),
      })
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
      await saveOrShareFile(content, 'qr-codes.zip')
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

  // Sélection multiple par glisser (long press sur une carte puis glisser le doigt
  // sur les autres) : évite de devoir taper chaque carte une à une pour une
  // sélection groupée. paintedRef évite de re-traiter la même carte à chaque
  // événement de déplacement ; paintAddModeRef fixe si on ajoute ou retire de la
  // sélection pour tout le geste, décidé par l'état de la toute première carte.
  const paintedRef = useRef<Set<string>>(new Set())
  const paintAddModeRef = useRef(true)
  const startPaintSelect = (d: Card) => {
    hapticTap()
    const id = getCardId(d)
    if (!editMode) setEditMode(true)
    const willSelect = !selectedCards.has(id)
    paintAddModeRef.current = willSelect
    paintedRef.current = new Set([id])
    setSelectedCards(prev => { const next = new Set(prev); if (willSelect) next.add(id); else next.delete(id); return next })
  }
  const paintMoveScheduledRef = useRef(false)
  const paintMovePosRef = useRef({ x: 0, y: 0 })
  const handlePaintMove = (x: number, y: number) => {
    // touchmove peut arriver des dizaines de fois/seconde ; document.elementFromPoint
    // force un hit-test synchrone sur le thread principal à chaque appel — sans
    // ce throttle par frame, glisser sur les cartes saccadait sur les appareils
    // Android bas/moyen de gamme (natif via Capacitor WebView). La position la
    // plus récente est gardée à part pour ne traiter que le dernier point de
    // chaque frame, pas le premier (sinon un doigt qui va vite "saute" des cartes).
    paintMovePosRef.current = { x, y }
    if (paintMoveScheduledRef.current) return
    paintMoveScheduledRef.current = true
    requestAnimationFrame(() => {
      paintMoveScheduledRef.current = false
      const { x, y } = paintMovePosRef.current
      const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest('[data-card-id]')
      const id = el?.getAttribute('data-card-id')
      if (!id || paintedRef.current.has(id)) return
      paintedRef.current.add(id)
      hapticTap()
      setSelectedCards(prev => { const next = new Set(prev); if (paintAddModeRef.current) next.add(id); else next.delete(id); return next })
    })
  }
  const handlePaintEnd = () => { paintedRef.current = new Set(); paintMoveScheduledRef.current = false }

  const shareCardNative = async (d: Card) => {
    if (!isNative) return
    hapticTap()
    try {
      const path = d.id_manuelle ? `/s/${d.id_manuelle}` : await getCsvCardSharePath(userId, d.f)
      const { Share } = await import('@capacitor/share')
      await Share.share({
        title: d.n,
        url: `https://www.memorabilius.fr${path}`,
      })
    } catch {}
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
    if (grailSearchDebounced.trim().length === 0) return []
    const q = grailSearchDebounced.toLowerCase()
    return cards.filter(c => {
      if (grailCards.some(g => g.card_key === c.f)) return false
      return c.n.toLowerCase().includes(q) || c.v.toLowerCase().includes(q) ||
             c.s.toLowerCase().includes(q) || (c.t || '').toLowerCase().includes(q) ||
             (c.br || '').toLowerCase().includes(q)
    })
  }, [grailSearchDebounced, cards, grailCards])

  const gridRef = useRef<HTMLDivElement>(null)

  // Cascade d'apparition des toutes premieres cartes au tout premier affichage
  // de la grille (pas a chaque changement de filtre/tri ensuite).
  const [initialCascadeDone, setInitialCascadeDone] = useState(false)
  useEffect(() => {
    if (loaded && displayed.length > 0 && !initialCascadeDone) {
      const id = setTimeout(() => setInitialCascadeDone(true), 700)
      return () => clearTimeout(id)
    }
  }, [loaded, displayed.length, initialCascadeDone])

  // FLIP : quand le tri/filtre change l'ordre des cartes, on les fait glisser
  // vers leur nouvelle position au lieu d'un saut brut. Ignoré pendant un drag
  // (dnd-kit gère déjà ses propres transforms dans ce cas) et en reduced-motion.
  const prevCardRectsRef = useRef<Map<string, DOMRect>>(new Map())
  useLayoutEffect(() => {
    const container = gridRef.current
    if (!container || activeDragId) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const els = Array.from(container.querySelectorAll<HTMLElement>('[data-card-id]'))
    const newRects = new Map<string, DOMRect>()
    els.forEach(el => { const id = el.dataset.cardId; if (id) newRects.set(id, el.getBoundingClientRect()) })
    els.forEach(el => {
      const id = el.dataset.cardId
      if (!id) return
      const oldRect = prevCardRectsRef.current.get(id)
      const newRect = newRects.get(id)
      if (!oldRect || !newRect) return
      const dx = oldRect.left - newRect.left
      const dy = oldRect.top - newRect.top
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
      el.style.transition = 'none'
      el.style.transform = `translate(${dx}px, ${dy}px)`
      requestAnimationFrame(() => {
        el.style.transition = 'transform 0.28s ease'
        el.style.transform = ''
      })
    })
    prevCardRectsRef.current = newRects
  }, [displayed, activeDragId])

  const getTags = (d: Card) => {
    const oon = d.num && isOneOfOne(d.num)
    const low = d.num && !oon && isLowNum(d.num)
    const bronze = d.num && !oon && !low && isBronzeNum(d.num)
    return (
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', minHeight: 18 }}>
        {d.item_type && d.item_type !== 'card' && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#7b1fa2', color: 'white' }}>🏆 MÉMO</span>}
        <CardTagBadges rc={d.rc} auto={d.auto} size="md" />
        {d.num && !oon && !low && !bronze && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#7b1fa2', color: 'white' }}>{d.num}</span>}
        {bronze && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: 'linear-gradient(135deg,#6d3a00,#cd7f32,#f5cba7,#cd7f32,#6d3a00)', color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.6)', display: 'inline-block', animation: 'bro-anim 2.6s ease-in-out infinite' }}>{d.num}</span>}
        {oon && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: 'linear-gradient(135deg,#b8860b,#ffd700,#fffacd,#ffd700,#b8860b)', color: '#3d2800', textShadow: '0 1px 0 rgba(255,255,255,0.4)', display: 'inline-block', animation: 'oon-anim 1.8s ease-in-out infinite' }}>{d.num}</span>}
        {low && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: 'linear-gradient(135deg,#555,#c0c0c0,#fff,#c0c0c0,#555)', color: '#111', display: 'inline-block', animation: 'low-anim 2.2s ease-in-out infinite' }}>{d.num}</span>}
        <CardTagBadges patch={d.patch} size="md" />
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
                onClick={(e) => { e.stopPropagation(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setColorPickerUp(r.bottom > window.innerHeight * 0.55); setColorPickerLeft(r.left < window.innerWidth * 0.5); setColorPickerTag(colorPickerTag === tag ? null : tag); setRenameValue(tag); setDeleteTagConfirm(null) }}
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
            <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', ...(colorPickerUp ? { bottom: '110%' } : { top: '110%' }), ...(colorPickerLeft ? { left: 0 } : { right: 0 }), background: dark ? '#1e1e1e' : 'white', borderRadius: 12, padding: 10, boxShadow: dark ? '0 8px 30px rgba(0,0,0,0.5)' : '0 8px 30px rgba(0,0,0,0.18)', border: dark ? '1px solid #333' : 'none', zIndex: 100, width: 'min(220px, calc(100vw - 24px))' }}>
              <input
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === 'Escape') { setColorPickerTag(null); return }
                  if (e.key !== 'Enter') return
                  const newName = renameValue.trim()
                  if (!newName || newName === tag) { setColorPickerTag(null); return }
                  await Promise.all([
                    supabase.from('card_collections').update({ collection: newName }).eq('user_id', uid).eq('collection', tag),
                    supabase.from('cartes_manuelles').update({ collection_tag: newName }).eq('user_id', uid).eq('collection_tag', tag),
                    supabase.from('carte_tags').update({ collection_tag: newName }).eq('user_id', uid).eq('collection_tag', tag),
                  ])
                  const cur = tabSettings.get(tag)
                  await supabase.from('collection_tab_settings').delete().eq('user_id', uid).eq('tag', tag)
                  if (cur) await supabase.from('collection_tab_settings').upsert({ user_id: userId, tag: newName, color: cur.color, position: cur.position, parent: cur.parent ?? null }, { onConflict: 'user_id,tag' })
                  await supabase.from('collection_tab_settings').update({ parent: newName }).eq('user_id', uid).eq('parent', tag)
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
                      await supabase.from('card_collections').delete().eq('user_id', uid).eq('collection', tag)
                      await supabase.from('cartes_manuelles').update({ collection_tag: null }).eq('user_id', uid).eq('collection_tag', tag)
                      await supabase.from('carte_tags').update({ collection_tag: null }).eq('user_id', uid).eq('collection_tag', tag)
                      await supabase.from('collection_tab_settings').delete().eq('user_id', uid).eq('tag', tag)
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

  // Au-dela de 6 tags de collection, la rangee devient tres longue sur un profil
  // avec beaucoup de sous-collections -- on replie avec un "+N" plutot que de tout
  // afficher d'un coup, sauf si le tag actif est justement dans la partie repliee.
  const TAG_VISIBLE_LIMIT = 6
  const hiddenTagsCount = Math.max(0, principals.length - TAG_VISIBLE_LIMIT)
  const activeTagIsHidden = !!activeParent && principals.indexOf(activeParent) >= TAG_VISIBLE_LIMIT
  const tagsExpanded = showAllCollectionTags || hiddenTagsCount === 0 || activeTagIsHidden
  const visiblePrincipals = tagsExpanded ? principals : principals.slice(0, TAG_VISIBLE_LIMIT)

  const hasAdvancedActive = !!(fSport || fBrand || fYear || sortBy !== 'default')
  const advancedVisible = showAdvancedFilters || hasAdvancedActive

  return (
    <>
      <div style={{ maxWidth: 1400, margin: '0 auto', fontFamily: 'Inter, sans-serif', padding: '0 10px', paddingBottom: (editMode && isOwner && selectedCards.size > 0) || qrMode ? 80 : 0 }}>

        {usingOfflineCache && (
          <div style={{
            background: dark ? '#3a2e00' : '#fff8e1', border: `1px solid ${dark ? '#5a4600' : '#ffe082'}`,
            borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, fontWeight: 600,
            color: dark ? '#ffd966' : '#8a6500', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            📡 Hors ligne — affichage de la dernière version de ta galerie enregistrée sur cet appareil.
          </div>
        )}

        {/* Arrivée via le QR "carte de visite" (bouton Partager) — transforme une
            rencontre en personne en connexion sur l'app en pointant vers le
            bouton Suivre juste en dessous, plutôt que d'en dupliquer un ici. */}
        {!isOwner && searchParams.get('src') === 'carte' && (
          <div style={{
            background: `${accent}14`, border: `1px solid ${accent}33`, borderRadius: 12,
            padding: '10px 16px', marginBottom: 14, fontSize: 13, fontWeight: 600,
            color: dark ? '#ddd' : '#333', textAlign: 'center',
          }}>
            {t('gallery_met_banner').replace('{name}', profile?.display_name || t('gallery_default_collector'))}
          </div>
        )}

        {/* Header profil — degrade dans la couleur d'accent du collectionneur, concentre
            en bas a droite et qui s'estompe vers le haut a gauche. Calque plein format
            (pas juste une bande en haut) pour que le clip coincide avec le contour reel
            du header (coins arrondis) plutot que de couper au milieu du contenu. */}
        <div style={{ position: 'relative', background: dark ? '#1e1e1e' : 'white', borderRadius: 16, marginBottom: 20, boxShadow: 'var(--elevation-md)', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(to top left, ${accent}${dark ? '3d' : '2b'}, transparent 70%)`,
            pointerEvents: 'none',
          }} />
          <div style={{ position: 'relative', padding: '24px 30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', flex: '1 1 300px' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {/* L'anneau de niveau/XP entoure directement l'avatar (LevelBadge) au lieu
                  d'un pave separe a cote du nom -- une seule chose a regarder pour la
                  progression, et le badge chiffre remplace l'ancien "?" d'info. */}
              {profile?.id ? (
                <LevelBadge userId={profile.id} celebrateOnLevelUp={isOwner} accent={accent} avatarClassName="profile-avatar-halo">
                  <img
                    src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.display_name || 'U')}&background=003DA6&color=fff&size=128`}
                    width={80} height={80}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                    alt={profile?.display_name || t('gallery_default_collector')}
                  />
                </LevelBadge>
              ) : (
                <img
                  src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.display_name || 'U')}&background=003DA6&color=fff&size=128`}
                  className="profile-avatar-halo"
                  width={80} height={80}
                  style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${accent}`, transition: 'box-shadow 0.2s', ['--avatar-accent' as any]: accent }}
                  alt={profile?.display_name || t('gallery_default_collector')}
                />
              )}
              <div style={{ position: 'absolute', bottom: 2, right: 2 }}>
                <OnlineIndicator lastSeen={profile?.last_seen} size={16} />
              </div>
            </div>
            <div style={{ minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                <h1 className={profile?.is_donor ? 'holo-name' : ''} style={{ fontSize: 24, fontWeight: 900, margin: 0, color: profile?.is_donor ? undefined : undefined }}>{profile?.display_name || t('gallery_default_collector')}</h1>
                {profile?.is_donor && (
                  <span className="sticker-holo" data-label="Donateur Ko-fi" style={{ fontSize: 26 }}>☕</span>
                )}
                {(Array.isArray(profile?.favorite_teams) ? profile.favorite_teams : []).map((id: string) => {
                  const team = getTeamById(id)
                  return (
                    <span key={id} className="sticker-team" data-label={team?.name ?? id}>
                      <TeamBadge teamId={id} size={28} />
                    </span>
                  )
                })}
              </div>

              <FollowCounts userId={userId} onOpenList={setFollowModalTab} />

              {profile?.bio && (
                <p title={profile.bio} style={{
                  fontSize: 13, color: dark ? '#aaa' : '#555', margin: '0 0 10px', lineHeight: 1.5, maxWidth: 400,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>{profile.bio}</p>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {profile?.instagram && (
                  <a href={`https://instagram.com/${profile.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                    title={profile.instagram.startsWith('@') ? profile.instagram : `@${profile.instagram}`}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: '50%', color: '#E1306C', background: dark ? '#2a1a20' : '#fce4ec', flexShrink: 0 }}>
                    <InstagramIcon size={15} />
                  </a>
                )}
                {profile?.twitter && (
                  <a href={`https://x.com/${profile.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                    title={profile.twitter.startsWith('@') ? profile.twitter : `@${profile.twitter}`}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: '50%', color: dark ? '#e0e0e0' : '#121212', background: dark ? '#1a1a1a' : '#f0f0f0', border: dark ? '1px solid #333' : 'none', flexShrink: 0 }}>
                    <XIcon size={13} />
                  </a>
                )}
                {profile?.discord && (
                  <button
                    type="button"
                    title={profile.discord}
                    aria-label={`${t('gallery_copy_discord')} : ${profile.discord}`}
                    onClick={() => {
                      navigator.clipboard.writeText(profile.discord).then(
                        () => toast.success(t('gallery_discord_copied')),
                        () => toast.error(t('gallery_discord_copy_failed'))
                      )
                    }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: '50%', color: '#5865F2', background: dark ? '#1a1c33' : '#eef0ff', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                    <DiscordIcon size={15} />
                  </button>
                )}
                {currentUser && currentUser !== userId && (
                  <Link href={`/messages?to=${userId}`} style={{
                    display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700,
                    color: 'white', background: accent, padding: '5px 12px', borderRadius: 20, textDecoration: 'none'
                  }}>
                    {t('gallery_message')}
                  </Link>
                )}
                <FollowButton targetUserId={userId} accent={accent} />
              </div>
            </div>
          </div>

          {loaded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-end', flexShrink: 0, minWidth: 260, marginLeft: 'auto' }} className="header-stats-block">
              <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end', width: '100%' }}>
                {[
                  { val: totalCount, label: t('gallery_cards'), flash: totalFlash },
                  { val: rcCount, label: 'RC', color: '#e67e22', flash: rcFlash },
                  { val: autoCount, label: 'Auto', color: '#2e7d32', flash: autoFlash },
                  { val: numCount, label: 'Num', color: '#7b1fa2', flash: numFlash },
                  { val: patchCount, label: 'Patch', color: '#1976d2', flash: patchFlash },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center', minWidth: 45 }}>
                    <div className={s.flash ? 'stat-flash' : undefined} style={{ fontSize: 22, fontWeight: 900, color: s.color || accent }}>{s.val}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="galerie-actions" style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>

                {/* Boutons mode édition */}
                {isOwner && editMode && (
                  <>
                    <button
                      onClick={() => {
                        const allIds = new Set(filtered.map(getCardId))
                        const allSelected = filtered.every(c => selectedCards.has(getCardId(c)))
                        setSelectedCards(allSelected ? new Set() : allIds)
                      }}
                      style={{ background: dark ? '#2a2a2a' : '#f0f0f0', color: dark ? '#ddd' : '#333', border: 'none', borderRadius: 10, padding: '12px 18px', fontWeight: 800, fontSize: 15, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      {filtered.length > 0 && filtered.every(c => selectedCards.has(getCardId(c))) ? '☐ Désélectionner' : '☑ Tout sélectionner'}
                    </button>
                    <button
                      onClick={() => { setEditMode(false); setSelectedCards(new Set()) }}
                      className="btn-ajouter"
                      style={{ background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 28px', fontWeight: 800, fontSize: 15, cursor: 'pointer', textAlign: 'center', whiteSpace: 'nowrap' }}
                    >
                      ✓ Terminé
                    </button>
                  </>
                )}

                {/* Bouton "..." — actions secondaires */}
                {!editMode && (
                  <div className="btn-menu" style={{ position: 'relative' }}>
                    <button
                      onClick={(e) => {
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                        setActionMenuUp(r.bottom > window.innerHeight * 0.55)
                        setActionMenuRect({ top: r.top, bottom: r.bottom, right: window.innerWidth - r.right })
                        setActionMenuOpen(v => !v)
                      }}
                      title={t('gallery_more_actions')}
                      aria-label={t('gallery_more_actions')}
                      style={{ background: dark ? '#2a2a2a' : '#f0f0f0', color: dark ? '#ddd' : '#333', border: 'none', borderRadius: 8, padding: '10px 14px', fontWeight: 700, fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
                    >
                      ⋮
                    </button>
                    {actionMenuOpen && actionMenuRect && createPortal(
                      <>
                        {/* Overlay invisible pour fermer */}
                        <div onClick={() => setActionMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
                        {/* Portale sur document.body : le header a `overflow:hidden` (degrade
                            d'accent), donc un menu position:absolute a l'interieur serait
                            recoupe des qu'il deborde -- fixed + coordonnees ecran a la place. */}
                        <div style={{ position: 'fixed', ...(actionMenuUp ? { bottom: window.innerHeight - actionMenuRect.top + 6 } : { top: actionMenuRect.bottom + 6 }), right: actionMenuRect.right, background: dark ? '#1e1e1e' : '#fff', borderRadius: 12, boxShadow: dark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.15)', border: dark ? '1px solid #333' : 'none', padding: 6, zIndex: 100000, minWidth: 190, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {isOwner && (
                            <button onClick={() => { setEditMode(m => !m); setSelectedCards(new Set()); setActionMenuOpen(false) }}
                              style={{ background: 'none', border: 'none', borderRadius: 8, padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'left', color: dark ? '#ddd' : '#333', width: '100%' }}>
                              {editMode ? t('gallery_done') : t('gallery_privacy')}
                            </button>
                          )}
                          <button onClick={() => { setActionMenuOpen(false); setShareModalOpen(true) }}
                            style={{ background: 'none', border: 'none', borderRadius: 8, padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'left', color: dark ? '#ddd' : '#333', width: '100%' }}>
                            ↗ Partager
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
                            📊 {showStats ? t('gallery_hide_stats') : t('gallery_show_stats')}
                          </button>
                          <button onClick={() => { setQrMode(m => !m); setQrSelected(new Map()); setActionMenuOpen(false) }}
                            style={{ background: 'none', border: 'none', borderRadius: 8, padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'left', color: dark ? '#ddd' : '#333', width: '100%' }}>
                            ▦ {qrMode ? 'Quitter Multi-QR' : 'Multi-QR'}
                          </button>
                        </div>
                      </>,
                      document.body
                    )}
                    <CollectorCard
                      userId={uid}
                      open={shareModalOpen}
                      onOpenChange={setShareModalOpen}
                      url={`/galerie/${profile?.slug || userId}?src=carte`}
                      displayName={profile?.display_name || t('gallery_default_collector')}
                      avatarUrl={profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.display_name || 'U')}&background=003DA6&color=fff&size=128`}
                      accent={accent}
                      totalCards={cards.length}
                      isDonor={!!profile?.is_donor}
                    />
                  </div>
                )}

                {/* CTA principal */}
                {isOwner && !editMode && (
                  <Link href={`/galerie/${userId}/ajouter`} className="btn-ajouter" style={{
                    background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 70%, black))`, color: 'white',
                    border: 'none', borderRadius: 10, padding: '12px 28px',
                    fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: `0 4px 14px ${accent}55`,
                    textDecoration: 'none', display: 'inline-block', textAlign: 'center', whiteSpace: 'nowrap',
                  }}>
                    + {t('gallery_add')}
                  </Link>
                )}
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Stats de collection */}
        {showStats && loaded && (
          <CollectionStats cards={cards} accent={accent} totalValeur={isOwner ? Array.from(cardValues.values()).reduce((a, b) => a + b, 0) : undefined} />
        )}

        {/* Grail Wall — podium 3 places (or/argent/bronze) */}
        {(isOwner || grailCards.length > 0) && (() => {
          const GRAIL_MAX = 3
          const MEDALS = [
            { emoji: '🥇', color: '#FFD700', glow: '#FFD70088', width: 132 },
            { emoji: '🥈', color: '#C0C0C0', glow: '#C0C0C088', width: 104 },
            { emoji: '🥉', color: '#CD7F32', glow: '#CD7F3288', width: 104 },
          ]
          const grailMap = new Map(cards.map(c => [c.f, c]))
          const grailItems = grailCards.map(g => grailMap.get(g.card_key)).filter(Boolean) as Card[]
          const grailLoading = grailCards.length > 0 && !cardsLoaded
          const podiumOrder = [1, 0, 2] // argent · or · bronze, l'or au centre

          const renderSlot = (i: number) => {
            const medal = MEDALS[i]
            if (i >= GRAIL_MAX) return null

            if (grailLoading && i < grailCards.length) {
              return (
                <div key={`sk-${i}`} style={{
                  width: medal.width, borderRadius: 12, aspectRatio: '2.5/3.5',
                  background: dark
                    ? 'linear-gradient(90deg,#2a2a2a 25%,#333 50%,#2a2a2a 75%)'
                    : 'linear-gradient(90deg,#f0f0f0 25%,#e4e4e4 50%,#f0f0f0 75%)',
                  backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
                }} />
              )
            }

            const card = !grailLoading ? grailItems[i] : undefined
            if (card) {
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: i === 0 ? 26 : 20 }}>{medal.emoji}</span>
                  <div onClick={() => setPopup(card)} role="button" tabIndex={0} aria-label={card.n}
                    onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); setPopup(card) } }}
                    className={`grail-wall-cursor${i === 0 ? ' grail-gold-glow' : ''}`} style={{
                    width: medal.width, cursor: 'pointer', position: 'relative',
                    background: `linear-gradient(160deg, ${medal.color}, ${medal.color}99)`, padding: 3, borderRadius: 12,
                    boxShadow: i === 0 ? undefined : `0 6px 20px ${medal.glow}`, transition: 'transform 0.2s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                  >
                    <div style={{ borderRadius: 9, overflow: 'hidden', background: 'white', position: 'relative' }}>
                      {isOwner && (
                        deleteGrailConfirm === card.f ? (
                          <div style={{ position: 'absolute', top: 4, right: 4, zIndex: 3, display: 'flex', gap: 2 }}>
                            <button onClick={async e => { e.stopPropagation(); await supabase.from('grail_cards').delete().eq('user_id', uid).eq('card_key', card.f); setGrailCards(prev => prev.filter(g => g.card_key !== card.f)); setDeleteGrailConfirm(null) }} aria-label="Confirmer la suppression" style={{ background: '#e74c3c', border: 'none', borderRadius: 4, width: 18, height: 18, color: 'white', fontSize: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>✓</button>
                            <button onClick={e => { e.stopPropagation(); setDeleteGrailConfirm(null) }} aria-label="Annuler" style={{ background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 4, width: 18, height: 18, color: 'white', fontSize: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>✕</button>
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
                        <p style={{ fontSize: 9, color: medal.color, fontWeight: 700, margin: '1px 0 0', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.v || card.s}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            }

            // Slot vide
            return (
              <div key={`empty-${i}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: i === 0 ? 26 : 20, opacity: 0.35 }}>{medal.emoji}</span>
                {isOwner ? (
                  <div
                    onClick={() => { setGrailPickerOpen(true); setGrailSearch('') }}
                    role="button" tabIndex={0} aria-label={t('gallery_choose_card')}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setGrailPickerOpen(true); setGrailSearch('') } }}
                    style={{
                      width: medal.width, border: `2px dashed ${medal.color}66`, borderRadius: 12,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: 6, cursor: 'pointer', transition: '0.15s', aspectRatio: '2.5/3.5',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = medal.color; (e.currentTarget as HTMLDivElement).style.background = medal.color + '11' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = medal.color + '66'; (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                  >
                    <span style={{ fontSize: 24, opacity: 0.4 }}>+</span>
                  </div>
                ) : (
                  <div style={{ width: medal.width, border: '2px dashed #eee', borderRadius: 12, aspectRatio: '2.5/3.5' }} />
                )}
              </div>
            )
          }

          return (
            <div ref={grailReveal.ref} className={grailReveal.className} style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 18 }}>💎</span>
                <span style={{ fontWeight: 900, fontSize: 15, color: dark ? '#eee' : '#121212', letterSpacing: 0.5 }}>Grail Wall</span>
                <span style={{ fontSize: 11, color: '#bbb', fontWeight: 600 }}>— {t('gallery_jewels')}</span>
              </div>

              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', justifyContent: 'center' }}>
                {podiumOrder.map(i => renderSlot(i))}
              </div>

              {/* Modal de recherche pour ajouter au grail */}
              {grailPickerOpen && createPortal(
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                  onClick={() => setGrailPickerOpen(false)}>
                  <div onClick={e => e.stopPropagation()} style={{ background: dark ? '#1e1e1e' : 'white', borderRadius: 16, padding: 20, width: '100%', maxWidth: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h3 style={{ margin: 0, fontWeight: 900, fontSize: 16, color: dark ? '#eee' : '#121212' }}>💎 {t('gallery_choose_card')}</h3>
                      <ModalCloseButton onClick={() => setGrailPickerOpen(false)} dark={dark} />
                    </div>
                    <input
                      autoFocus
                      value={grailSearch}
                      onChange={e => setGrailSearch(e.target.value)}
                      placeholder={t('gallery_search_collection')}
                      style={{ padding: '10px 14px', borderRadius: 8, border: dark ? '1px solid #444' : '1px solid #ddd', fontSize: 14, outline: 'none', background: dark ? '#2a2a2a' : 'white', color: dark ? '#eee' : '#111' }}
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
                                fireConfetti()
                                if (grailCards.length + 1 >= 3) setGrailPickerOpen(false)
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
                </div>,
                document.body
              )}
            </div>
          )
        })()}

        {/* Onglets Collection / Wishlist / Commentaires / Bibliothèque — scrollable sur mobile.
            L'onglet actif est indique par une pilule qui glisse (mesuree via refs) plutot
            que chaque bouton togglant independamment son propre fond. */}
        <div ref={tabBarRef} style={{ position: 'relative', display: 'flex', gap: 4, marginBottom: 16, background: dark ? '#2a2a2a' : '#f0f0f0', borderRadius: 10, padding: 4, maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {tabIndicator && (
            <div style={{
              position: 'absolute', top: 4, bottom: 4, left: tabIndicator.left, width: tabIndicator.width,
              background: dark ? '#121212' : 'white', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              transition: 'left 0.25s cubic-bezier(0.22,0.61,0.36,1), width 0.25s cubic-bezier(0.22,0.61,0.36,1)',
              pointerEvents: 'none',
            }} />
          )}
          {(['collection', 'library', 'objectifs', 'badges', 'comments', ...(isOwner ? ['likes'] as const : [])] as const).map(tab => (
            <button key={tab} ref={el => { if (el) tabBtnRefs.current[tab] = el }} onClick={() => setActiveTab(tab as any)} style={{
              position: 'relative', zIndex: 1,
              padding: '8px 16px', border: 'none', borderRadius: 8, cursor: 'pointer', background: 'transparent',
              fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0,
              color: activeTab === tab ? accent : '#999',
              transition: 'color 0.15s',
            }}>
              {tab === 'collection' ? '🃏 Collection' : tab === 'library' ? t('gallery_tab_library') : tab === 'objectifs' ? t('gallery_tab_objectifs') : tab === 'badges' ? '🏅 Badges' : tab === 'comments' ? t('gallery_tab_comments') : t('gallery_tab_liked')}
            </button>
          ))}
        </div>

        {activeTab === 'badges' && (
          <div style={{ paddingBottom: 32 }}>
            <BadgeBox userId={profile?.id || userId} isOwner={isOwner} />
          </div>
        )}

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
          exportCards={cards}
          cardValues={cardValues}
          profileName={profile?.display_name || ''}
          avatarUrl={profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.display_name || 'U')}&background=003DA6&color=fff&size=128`}
          onOpenCard={(img) => {
            // Retrouve la carte complète de la collection par son image, pour ouvrir
            // le vrai Viewer3D de la galerie (toutes les infos + tags), pas une version minimale
            const match = cards.find(c => c.f === img || c.b === img)
            if (match) { setPopup(match); return true }
            return false
          }}
        />}

        {activeTab === 'collection' && <>
        {/* Panneau de filtres — non-sticky : plusieurs tentatives de le garder
            collé au scroll (position:sticky) ont chacune introduit un nouveau
            bug de rendu propre au WebView Android (barre trop haute, passait
            sous la barre de statut, cartes visibles au travers, puis un grand
            espace vide) sans pouvoir les déboguer en direct (natif only).
            Retour à un bloc simple et fiable — le gain de confort du sticky ne
            valait pas l'instabilité que ça causait. */}
        <div style={{ background: dark ? '#1e1e1e' : '#fff', padding: 10, borderRadius: 8, marginBottom: 15, border: dark ? '1px solid #333' : '1px solid #eee' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 10 }}>
            <div>
            <div style={{ position: 'relative' }}>
              <input ref={searchInputRef} value={searchInput} onChange={e => {
                setSearchInput(e.target.value)
                if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
                searchDebounceRef.current = setTimeout(() => {
                  const parsed = parseNaturalQuery(e.target.value)
                  const hints: string[] = []
                  setActiveFilters({ rc: parsed.rc, auto: parsed.auto, num: parsed.num, patch: parsed.patch })
                  if (parsed.rc) hints.push('RC')
                  if (parsed.auto) hints.push('Auto')
                  if (parsed.patch) hints.push('Patch')
                  setFYear(parsed.year || ''); if (parsed.year) hints.push(parsed.year)
                  setNumMax(parsed.numMax)
                  if (parsed.num) hints.push(parsed.numMax != null ? `≤ /${parsed.numMax}` : t('gallery_numbered_hint'))
                  setNlpHint(hints)
                  setSearch(parsed.text)
                }, 200)
              }} placeholder={t('gallery_search')} aria-label={t('gallery_search_label')} style={{ width: '100%', boxSizing: 'border-box', paddingRight: !isNative && !searchInput ? 26 : undefined }} />
              {/* Indice de raccourci clavier "/" — desktop web uniquement, aucun sens sur natif (pas de clavier physique) */}
              {!isNative && !searchInput && (
                <kbd aria-hidden="true" style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none',
                  fontSize: 11, fontWeight: 700, color: dark ? '#777' : '#aaa', background: dark ? '#2a2a2a' : '#f0f0f0',
                  border: `1px solid ${dark ? '#444' : '#ddd'}`, borderRadius: 4, padding: '1px 6px', fontFamily: 'inherit',
                }}>/</kbd>
              )}
            </div>
              {nlpHint.length > 0 && (
                <p style={{ fontSize: 10, color: dark ? '#999' : '#777', margin: '3px 0 0' }}>
                  {t('search_understood_as')} <strong style={{ color: dark ? `color-mix(in srgb, ${accent} 65%, white)` : accent }}>{nlpHint.join(' · ')}</strong>
                </p>
              )}
            </div>
            <div>
              <input value={fTeam} onChange={e => setFTeam(e.target.value)} placeholder={t('gallery_team_label')} aria-label={t('gallery_team_label')} list="gallery-teams" style={{ width: '100%', boxSizing: 'border-box' }} />
              <datalist id="gallery-teams">{teams.map(team => <option key={team} value={team} />)}</datalist>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5, marginBottom: 10 }}>
            {(['rc', 'auto', 'num', 'patch'] as const).map(k => (
              <button key={k} onClick={() => toggleFilter(k)} style={{
                padding: '8px 2px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                background: activeFilters[k] ? TAG_COLORS[k] : (dark ? '#2a2a2a' : '#f0f0f0'), color: activeFilters[k] ? 'white' : (dark ? '#bbb' : '#333')
              }}>{activeFilters[k] && <span className="selection-check-pop">✓ </span>}{k === 'num' ? '# NUM' : k.toUpperCase()}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isOwner ? 'repeat(3,1fr)' : 'repeat(2,1fr)', gap: 5, marginBottom: 10 }}>
            <button onClick={() => setFilterMemo(p => !p)} style={{
              padding: '8px 2px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
              background: filterMemo ? '#7b1fa2' : (dark ? '#2a2a2a' : '#f0f0f0'), color: filterMemo ? 'white' : (dark ? '#bbb' : '#333')
            }}>{filterMemo && <span className="selection-check-pop">✓ </span>}🏆 {t('gallery_filter_memo')}</button>
            <button onClick={() => setFilterVente(p => !p)} style={{
              padding: '8px 2px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
              background: filterVente ? '#2e7d32' : (dark ? '#2a2a2a' : '#f0f0f0'), color: filterVente ? 'white' : (dark ? '#bbb' : '#333')
            }}>{filterVente && <span className="selection-check-pop">✓ </span>}🏷️ {t('gallery_filter_sale')}</button>
            {isOwner && (
              <button onClick={() => setFilterPrivate(p => !p)} style={{
                padding: '8px 2px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                background: filterPrivate ? '#555' : (dark ? '#2a2a2a' : '#f0f0f0'), color: filterPrivate ? 'white' : (dark ? '#bbb' : '#333')
              }}>{filterPrivate && <span className="selection-check-pop">✓ </span>}🔒 {t('gallery_filter_private')}</button>
            )}
          </div>

          <button type="button" onClick={() => setShowAdvancedFilters(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: 800, color: dark ? '#aaa' : '#666', padding: '4px 0', marginBottom: advancedVisible ? 10 : 0,
          }}>
            <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: advancedVisible ? 'rotate(90deg)' : 'none' }}>▶</span>
            {t('gallery_advanced_filters')}{hasAdvancedActive && !advancedVisible ? ' •' : ''}
          </button>

          {advancedVisible && <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 10 }}>
            <div><label style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 3 }}>{lang === 'fr' ? 'Sport' : 'Sport'}</label>
              <select value={fSport} onChange={e => setFSport(e.target.value)}>
                <option value="">{t('gallery_all')}</option>
                {gallerySports.map(sp => <option key={sp} value={sp}>{SPORT_LABELS[sp]}</option>)}
              </select>
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
          </>}
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
                {visiblePrincipals.map(tag => renderTagPill(tag, 0))}
                {hiddenTagsCount > 0 && !activeTagIsHidden && (
                  <button onClick={() => setShowAllCollectionTags(v => !v)} style={{
                    padding: '5px 12px', border: 'none', borderRadius: 20, cursor: 'pointer',
                    fontSize: 11, fontWeight: 700, background: dark ? '#2a2a2a' : '#f0f0f0', color: dark ? '#ccc' : '#555',
                  }}>
                    {showAllCollectionTags ? t('gallery_show_less') : `+${hiddenTagsCount}`}
                  </button>
                )}
                {isOwner && (
                  <button
                    onClick={async () => {
                      const name = prompt(t('gallery_new_collection_prompt'))?.trim()
                      if (!name || collectionTags.includes(name)) return
                      const position = principals.length
                      await supabase.from('collection_tab_settings').upsert({ user_id: userId, tag: name, color: accent, position }, { onConflict: 'user_id,tag' })
                      setTabSettings(prev => new Map(prev).set(name, { color: accent, position, parent: null }))
                      setCollectionTags(prev => [...prev, name].sort())
                      setFCollectionTag(name)
                    }}
                    title={t('gallery_new_collection_title')}
                    aria-label={t('gallery_new_collection_title')}
                    style={{
                      width: 26, height: 26, borderRadius: '50%', border: `2px dashed ${dark ? '#444' : '#ccc'}`,
                      background: 'none', color: dark ? '#888' : '#999', fontSize: 15, fontWeight: 900, lineHeight: 1,
                      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}
                  >+</button>
                )}
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

        {/* Aperçu statique (purement visuel, aucune interaction) pendant le chargement
            réel — voir fetchInitialPreview() dans page.tsx. Disparaît dès que `loaded`
            passe à true via le flux existant, inchangé, qui reste seul maître du jeu. */}
        {!loaded && initialGrailCards && initialGrailCards.length > 0 && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', margin: '0 0 16px' }}>
            {initialGrailCards.map(c => (
              <div key={c.id} style={{ width: 90, borderRadius: 8, overflow: 'hidden', background: dark ? '#2a2a2a' : '#f0f0f0' }}>
                <div style={{ width: '100%', aspectRatio: '2.5/3.5', overflow: 'hidden' }}>
                  <img src={c.image_recto} alt="" loading="eager" style={c.is_horizontal
                    ? { width: '140%', height: '71.43%', marginLeft: '-20%', marginTop: '14.286%', transform: 'rotate(90deg)', objectFit: 'cover' }
                    : { width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loaded && (
          initialCards && initialCards.length > 0 ? (
            <div className="card-grid">
              {initialCards.map(c => (
                <div key={c.id} className="card-item" style={{ borderRadius: 8, overflow: 'hidden', background: dark ? '#2a2a2a' : '#f0f0f0' }}>
                  <div style={{ width: '100%', aspectRatio: '2.5/3.5', overflow: 'hidden' }}>
                    <img src={c.image_recto} alt="" loading="eager" style={c.is_horizontal
                      ? { width: '140%', height: '71.43%', marginLeft: '-20%', marginTop: '14.286%', transform: 'rotate(90deg)', objectFit: 'cover' }
                      : { width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
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
              <style>{`@keyframes shimmer { 0%, 100% { opacity: 1 } 50% { opacity: 0.55 } }`}</style>
            </div>
          )
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
          .card-grid-compact .card-item { flex: 0 0 calc(33.333% - 7px) !important; max-width: calc(33.333% - 7px) !important; }
          @media (min-width: 900px) { .card-grid-compact .card-item { flex: 0 0 calc(12.5% - 9px) !important; max-width: calc(12.5% - 9px) !important; } }
          .card-grid-compact .card-item p { font-size: 10px !important; }

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
        
        {mounted && undoBanner && createPortal(
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10000, display: 'flex', alignItems: 'center', gap: 14, background: '#1a1a1a', color: 'white', borderRadius: '12px 12px 0 0', padding: '12px 24px', paddingBottom: 'max(12px, var(--safe-area-inset-bottom, env(safe-area-inset-bottom)), 40px)', fontSize: 13, fontWeight: 700, boxShadow: '0 -4px 24px rgba(0,0,0,0.35)' }}>
            <span style={{ flex: 1 }}>🗑️ {t('gallery_deleted_toast').replace('{nom}', undoBanner.nom)}</span>
            <button onClick={() => undoBanner.ids ? undoBulkDelete(undoBanner.ids) : undoDeleteCard(undoBanner.id)}
              style={{ background: 'white', color: '#111', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>
              {t('gallery_undo')}
            </button>
          </div>,
          document.body
        )}

        {mounted && editMode && isOwner && selectedCards.size > 0 && createPortal(
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10, background: '#003DA6', color: 'white', borderRadius: '12px 12px 0 0', padding: '12px 24px', paddingBottom: 'max(12px, var(--safe-area-inset-bottom, env(safe-area-inset-bottom)), 40px)', fontSize: 13, fontWeight: 700, flexWrap: 'wrap', boxShadow: '0 -4px 24px rgba(0,61,166,0.35)' }}>
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
                placeholder={t('gallery_col_name_placeholder')}
                style={{ background: 'white', border: 'none', borderRadius: 6, color: '#111', padding: '5px 10px', fontSize: 12, fontWeight: 700, flexShrink: 0, width: 180, outline: 'none' }}
              />
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={() => { setShowBulkNewTag(false); setBulkNewTag('') }}
                style={{ background: 'rgba(255,255,255,0.25)', border: 'none', borderRadius: 4, color: 'white', padding: '4px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
              >✕</button>
              </>
            ) : (
              <>
                <select
                  value=""
                  onChange={async (e) => {
                    const tag = e.target.value
                    if (!tag) return
                    if (tag === '__new__') { setShowBulkNewTag(true); return }
                    await addSelectedToCollection(tag)
                  }}
                  style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, color: 'white', padding: '4px 8px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                >
                  <option value="" style={{ color: '#333' }}>🏷 Ajouter à…</option>
                  <option value="__new__" style={{ color: '#003DA6', fontWeight: 900 }}>✚ Créer une nouvelle…</option>
                  {collectionTags.map(tag => (
                    <option key={tag} value={tag} style={{ color: '#333' }}>{tag}</option>
                  ))}
                </select>
                {(() => {
                  const selCollections = [...new Set(
                    [...selectedCards].flatMap(id => {
                      const card = cards.find(c => (c.isManuelle ? c.id_manuelle : c.f) === id)
                      return card?.collections || []
                    })
                  )]
                  if (selCollections.length === 0) return null
                  return (
                    <select
                      value=""
                      onChange={async (e) => {
                        const tag = e.target.value
                        if (!tag) return
                        if (tag === '__all__') { await removeSelectedFromAllCollections(); return }
                        await removeSelectedFromCollection(tag)
                      }}
                      style={{ background: 'rgba(239,68,68,0.25)', border: '1px solid rgba(239,68,68,0.5)', borderRadius: 6, color: 'white', padding: '4px 8px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                    >
                      <option value="" style={{ color: '#333' }}>🗑 Retirer de…</option>
                      {selCollections.map(tag => (
                        <option key={tag} value={tag} style={{ color: '#333' }}>{tag}</option>
                      ))}
                      <option value="__all__" style={{ color: '#b91c1c', fontWeight: 900 }}>— Toutes les collections —</option>
                    </select>
                  )
                })()}
              </>
            )}
            <button
              onClick={() => {
                // selectedCards contient déjà des getCardId(d) (id_manuelle ou f,
                // voir toggleCardSelection) — matcher GalerieExport là-dessus
                // directement plutôt que sur la seule URL photo (deux cartes sans
                // photo, ou avec le même scan réutilisé, partageraient sinon la
                // même clé et se retrouveraient toutes les deux dans l'export).
                setExportSelectionKeys(new Set(selectedCards))
                setExportSelectionOpen(true)
              }}
              style={{ background: 'rgba(255,255,255,0.2)', border: '1.5px solid rgba(255,255,255,0.5)', borderRadius: 6, color: 'white', padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              📤 Partager
            </button>
            <button
              onClick={startBulkEdit}
              style={{ background: 'rgba(255,255,255,0.2)', border: '1.5px solid rgba(255,255,255,0.5)', borderRadius: 6, color: 'white', padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              ✏️ Modifier en groupe
            </button>
            {[...selectedCards].some(id => cards.find(c => c.isManuelle && c.id_manuelle === id)) && (
              bulkDeleteConfirm ? (
                <>
                  <span style={{ flexShrink: 0 }}>Supprimer définitivement ?</span>
                  <button onClick={bulkDeleteSelected} aria-label="Confirmer la suppression groupée"
                    style={{ background: '#e74c3c', color: 'white', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>
                    ✓ Confirmer
                  </button>
                  <button onClick={() => setBulkDeleteConfirm(false)} aria-label="Annuler la suppression groupée"
                    style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, color: 'white', padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                    ✕
                  </button>
                </>
              ) : (
                <button onClick={() => setBulkDeleteConfirm(true)} aria-label="Supprimer les cartes sélectionnées"
                  style={{ background: 'rgba(239,68,68,0.25)', border: '1.5px solid rgba(239,68,68,0.5)', borderRadius: 6, color: 'white', padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  🗑 Supprimer
                </button>
              )
            )}
            <button onClick={() => setSelectedCards(new Set())} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, color: 'white', padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              ✕ Désélectionner
            </button>
          </div>,
          document.body
        )}

        <GalerieExport
          cards={cards}
          profileName={profile?.display_name || ''}
          avatarUrl={profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.display_name || 'U')}&background=003DA6&color=fff&size=128`}
          accent={accent}
          lang={lang}
          cardValues={cardValues}
          isOwner={isOwner}
          restrictToKeys={exportSelectionKeys}
          open={exportSelectionOpen}
          onOpenChange={setExportSelectionOpen}
          hideTrigger
        />

        {mounted && qrMode && createPortal(
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10, background: '#7c3aed', color: 'white', borderRadius: '12px 12px 0 0', padding: '12px 24px', paddingBottom: 'max(12px, var(--safe-area-inset-bottom, env(safe-area-inset-bottom)), 40px)', fontSize: 13, fontWeight: 700, flexWrap: 'wrap', boxShadow: '0 -4px 24px rgba(124,58,237,0.35)' }}>
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
            <button onClick={openSaleLabels} disabled={qrSelected.size === 0}
              style={{ background: qrSelected.size > 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.5)', borderRadius: 6, color: 'white', padding: '6px 14px', cursor: qrSelected.size > 0 ? 'pointer' : 'default', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
              🏷️ Étiquettes de vente
            </button>
            <button onClick={() => { setQrMode(false); setQrSelected(new Map()) }}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, color: 'white', padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              ✕ Quitter
            </button>
          </div>,
          document.body
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginBottom: 10 }}>
          <button type="button" onClick={() => setViewMode('grid')} title={t('gallery_view_grid')} style={{
            border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            background: viewMode === 'grid' ? accent : (dark ? '#2a2a2a' : '#f0f0f0'), color: viewMode === 'grid' ? 'white' : (dark ? '#ccc' : '#555'),
          }}>▦ {t('gallery_view_grid')}</button>
          <button type="button" onClick={() => setViewMode('timeline')} title={t('gallery_view_timeline')} style={{
            border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            background: viewMode === 'timeline' ? accent : (dark ? '#2a2a2a' : '#f0f0f0'), color: viewMode === 'timeline' ? 'white' : (dark ? '#ccc' : '#555'),
          }}>📅 {t('gallery_view_timeline')}</button>
          {viewMode === 'grid' && (
            <button type="button" onClick={toggleCompactView} title="Vue compacte" style={{
              border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: compactView ? accent : (dark ? '#2a2a2a' : '#f0f0f0'), color: compactView ? 'white' : (dark ? '#ccc' : '#555'),
            }}>▪▪▪ Compact</button>
          )}
        </div>

        {viewMode === 'timeline' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {timelineGroups.length === 0 && (
              <p style={{ color: '#999', textAlign: 'center', padding: 30 }}>{t('gallery_no_match_title')}</p>
            )}
            {timelineGroups.map(group => (
              <div key={group.key}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontWeight: 900, fontSize: 14, color: dark ? '#eee' : '#121212' }}>{group.label}</span>
                  <span style={{ fontSize: 11, color: '#999', fontWeight: 700 }}>{group.cards.length} {t('gallery_cards')}</span>
                  <div style={{ flex: 1, height: 1, background: dark ? '#2a2a2a' : '#eee' }} />
                </div>
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6 }}>
                  {group.cards.map(c => (
                    <div key={getCardId(c)} onClick={() => setPopup(c)} role="button" tabIndex={0} aria-label={c.n}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPopup(c) } }}
                      style={{
                      flex: '0 0 auto', width: 90, cursor: 'pointer', borderRadius: 8, overflow: 'hidden',
                      ...coloredBorder((c.collection_tag && tabSettings.get(c.collection_tag)?.color) || accent),
                    }}>
                      {renderCardImage(c)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {viewMode === 'grid' && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={e => setActiveDragId(e.active.id as string)}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={displayed.map(getCardId)} strategy={rectSortingStrategy}>
          <div ref={el => { gridRef.current = el; cardGridReveal.ref.current = el }} className={`card-grid ${cardGridReveal.className}${compactView ? ' card-grid-compact' : ''}`}>
          {displayed.map((d, idx) => (
            <SortableCard
              key={getCardId(d)}
              id={getCardId(d)}
              disabled={!editMode || !isOwner || sortBy !== 'default'}
              className={`card-item${justAddedIds.has(getCardId(d)) ? ' card-just-added' : ''}${!initialCascadeDone && idx < 24 ? ' card-cascade-in' : ''}`}
              onLongPress={qrMode ? undefined : editMode && isOwner ? () => startPaintSelect(d) : () => shareCardNative(d)}
              onPaintMove={handlePaintMove}
              onPaintEnd={handlePaintEnd}
              onClick={() => {
                if (qrMode) { toggleQrCard(d); return }
                if (editMode && isOwner) { toggleCardSelection(getCardId(d)); return }
                if (!editMode) setPopup(d)
              }}
              style={{
              ...(!initialCascadeDone && idx < 24 ? { animationDelay: `${idx * 25}ms` } : {}),
              borderRadius: 8, padding: 8,
              background: qrSelected.has(getCardId(d)) ? '#f5f3ff' : selectedCards.has(getCardId(d)) ? '#e8f0fe' : 'white',
              outline: qrSelected.has(getCardId(d)) ? '2px solid #7c3aed' : selectedCards.has(getCardId(d)) ? '2px solid #003DA6' : 'none',
              cursor: qrMode ? 'pointer' : (editMode && isOwner && sortBy === 'default' ? 'pointer' : editMode ? 'default' : 'pointer'),
              ...((privateCards.has(d.f) && isOwner)
                ? { border: '2px solid #e74c3c' }
                : coloredBorder((d.collection_tag && tabSettings.get(d.collection_tag)?.color) || accent)),
              boxSizing: 'border-box',
              opacity: activeDragId === getCardId(d) ? 0.35 : privateCards.has(d.f) && isOwner ? 0.7 : 1,
              ...(activeDragId === getCardId(d) ? { outline: '2px dashed #003DA6', outlineOffset: -2, background: dark ? '#1a2b57' : '#eef4ff' } : {}),
              position: 'relative',
              transition: 'opacity 0.15s',
              overflow: 'visible',
            }}>
              {isOwner && privateCards.has(d.f) && (
                <div style={{ position: 'absolute', top: 6, left: 6, background: '#e74c3c', color: 'white', fontSize: 9, fontWeight: 900, padding: '2px 6px', borderRadius: 4, zIndex: 2 }}>
                  {t('gallery_private')}
                </div>
              )}
              {d.vendue ? (
                <div title={t('gallery_sold_badge')} style={{ position: 'absolute', top: 6, right: 6, background: '#c0392b', color: 'white', fontSize: 9, fontWeight: 900, padding: '2px 6px', borderRadius: 4, zIndex: 2, letterSpacing: 0.3 }}>
                  💰 {t('gallery_sold_badge').toUpperCase()}
                </div>
              ) : d.disponible_vente && (
                <div title={t('gallery_for_sale_title')} style={{ position: 'absolute', top: 6, right: 6, background: '#2e7d32', color: 'white', fontSize: 9, fontWeight: 900, padding: '2px 6px', borderRadius: 4, zIndex: 2, letterSpacing: 0.3 }}>
                  🏷️ {t('gallery_for_sale_label')}
                </div>
              )}
              {editMode && isOwner && selectedCards.has(getCardId(d)) && (
                <>
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,61,166,0.14)', zIndex: 1, borderRadius: 6, pointerEvents: 'none' }} />
                  <div className="selection-check-pop" style={{ position: 'absolute', top: 6, left: 6, background: '#003DA6', color: 'white', fontSize: 13, width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3, fontWeight: 900, boxShadow: '0 2px 8px rgba(0,61,166,0.5)' }}>
                    ✓
                  </div>
                </>
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
                          <button onClick={e => { e.stopPropagation(); handleDeleteCard(d.id_manuelle!, d.f); setDeleteCardConfirm(null) }} aria-label="Confirmer la suppression" style={{ background: '#e74c3c', color: 'white', border: 'none', borderRadius: 6, padding: '4px 5px', fontSize: 9, fontWeight: 900, cursor: 'pointer' }}>✓</button>
                          <button onClick={e => { e.stopPropagation(); setDeleteCardConfirm(null) }} aria-label="Annuler" style={{ background: '#555', color: 'white', border: 'none', borderRadius: 6, padding: '4px 5px', fontSize: 9, fontWeight: 900, cursor: 'pointer' }}>✕</button>
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
                            const lien = d.id_manuelle ? `/s/${d.id_manuelle}` : await getCsvCardSharePath(userId, d.f)
                            await supabase.from('notifications').insert({
                              user_id: userId,
                              type: 'like',
                              message: `${likerName} a aimé votre carte`,
                              lien,
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
        )}

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
                <button onClick={() => { setSearchInput(''); setSearch(''); setFTeam(''); setFBrand(''); setFYear(''); setFCollectionTag(''); setPinTeam(''); setActiveFilters({ rc: false, auto: false, num: false, patch: false }); setFilterVente(false); setNumMax(null); setNlpHint([]) }} style={{ background: '#003DA6', color: 'white', padding: '10px 20px', borderRadius: 50, fontWeight: 800, fontSize: 13, border: 'none', cursor: 'pointer' }}>
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

      {followModalTab && (
        <FollowListModal
          userId={userId}
          initialTab={followModalTab}
          onClose={() => setFollowModalTab(null)}
          accent={accent}
        />
      )}

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
          cardValue={cardValues.get(popup.f)}
          onValueSave={isOwner ? async (val) => {
            if (val == null) {
              await supabase.from('card_values').delete().eq('user_id', uid).eq('card_key', popup.f)
              setCardValues(prev => { const m = new Map(prev); m.delete(popup.f); return m })
            } else {
              await supabase.from('card_values').upsert({ user_id: userId, card_key: popup.f, valeur: val }, { onConflict: 'user_id,card_key' })
              setCardValues(prev => new Map(prev).set(popup.f, val))
            }
          } : undefined}
          onProposeTrade={!isOwner && currentUser && popup.id_manuelle ? () => setTradeCard(popup) : undefined}
          onVendueChange={(card, vendue) => {
            setCards(prev => prev.map(c => c.f === card.f ? { ...c, vendue } : c))
            setPopup(prev => prev && prev.f === card.f ? { ...prev, vendue } : prev)
          }}
          onDisponibleVenteChange={(card, disponible_vente) => {
            setCards(prev => prev.map(c => c.f === card.f ? { ...c, disponible_vente } : c))
            setPopup(prev => prev && prev.f === card.f ? { ...prev, disponible_vente } : prev)
          }}
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
            // "Déjà dans ma collection" doit exiger une correspondance exacte sur toutes
            // les infos de la carte, pas juste le nom + collection — sinon deux cartes du
            // même joueur mais d'année/marque/tirage différents se marquaient à tort comme
            // déjà possédées.
            let dupQuery = supabase.from('cartes_manuelles')
              .select('id').eq('user_id', currentUser).eq('nom', popup.n).eq('collection', popup.s || '')
              .eq('auto', !!popup.auto).eq('rc', !!popup.rc).eq('patch', !!popup.patch)
            if (popup.v) dupQuery = dupQuery.eq('variation', popup.v)
            else dupQuery = (dupQuery as any).is('variation', null)
            if (popup.y) dupQuery = dupQuery.eq('annee', popup.y)
            else dupQuery = (dupQuery as any).is('annee', null)
            if (popup.br) dupQuery = dupQuery.eq('marque', popup.br)
            else dupQuery = (dupQuery as any).is('marque', null)
            if (popup.num) dupQuery = dupQuery.eq('num', popup.num)
            else dupQuery = (dupQuery as any).is('num', null)
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
          likeData={cardLikes.get(popup.f) || { count: 0, liked: false }}
          onLike={currentUser ? async () => {
            const likeInfo = cardLikes.get(popup.f) || { count: 0, liked: false }
            const isLiked = likeInfo.liked
            setCardLikes(prev => {
              const m = new Map(prev)
              m.set(popup.f, { count: likeInfo.count + (isLiked ? -1 : 1), liked: !isLiked })
              return m
            })
            if (isLiked) {
              await supabase.from('card_likes').delete().eq('card_key', popup.f).eq('gallery_user_id', userId).eq('liker_user_id', currentUser)
            } else {
              await supabase.from('card_likes').upsert({ card_key: popup.f, gallery_user_id: userId, liker_user_id: currentUser }, { onConflict: 'card_key,gallery_user_id,liker_user_id' })
              if (currentUser !== userId) {
                const { data: liker } = await supabase.from('profiles').select('display_name').eq('id', currentUser).single()
                const likerName = liker?.display_name || 'Quelqu\'un'
                const lien = popup.id_manuelle ? `/s/${popup.id_manuelle}` : await getCsvCardSharePath(userId, popup.f)
                await supabase.from('notifications').insert({ user_id: userId, type: 'like', message: `${likerName} a aimé votre carte`, lien, lu: false })
                const { data: { session } } = await supabase.auth.getSession()
                if (session?.access_token) {
                  fetch('/api/like-notify', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` }, body: JSON.stringify({ toUserId: userId, likerName }) }).catch(() => {})
                }
              }
            }
          } : undefined}
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
            position: 'fixed', bottom: `calc(88px + ${isNative ? NAV_TOTAL_HEIGHT_CSS : '0px'})`, right: 24, zIndex: 9000,
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
          targetUserName={profile?.display_name || t('gallery_default_collector')}
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
          padding: '14px 20px', paddingBottom: 'max(14px, var(--safe-area-inset-bottom, env(safe-area-inset-bottom)), 40px)',
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
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