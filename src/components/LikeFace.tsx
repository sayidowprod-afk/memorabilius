'use client'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

// 282 · Le cœur « J'aime » : même animation partout (galerie, fiche de carte, commentaires).
// Quand on aime, le cœur fait un petit rebond, et le compteur monte en douceur quand il change. Rien ne bouge au chargement de la page.
export default function LikeFace({ liked, count, layout = 'stack', heartSize = 16, countStyle }: {
  liked: boolean; count?: number; layout?: 'stack' | 'inline' | 'heart-only'; heartSize?: number; countStyle?: CSSProperties
}) {
  const first = useRef(true)
  const prev = useRef({ liked, count })
  const [popHeart, setPopHeart] = useState(false)
  const [popCount, setPopCount] = useState(false)

  useEffect(() => {
    if (first.current) { first.current = false; prev.current = { liked, count }; return }
    const timers: number[] = []
    if (liked && !prev.current.liked) { setPopHeart(true); timers.push(window.setTimeout(() => setPopHeart(false), 600)) }
    if (count !== prev.current.count) { setPopCount(true); timers.push(window.setTimeout(() => setPopCount(false), 400)) }
    prev.current = { liked, count }
    return () => timers.forEach(t => window.clearTimeout(t))
  }, [liked, count])

  const heart = (
    <span className={popHeart ? 'da-heart-pop' : undefined} style={{ display: 'inline-block', fontSize: heartSize, lineHeight: 1, transition: 'transform .15s', transform: liked ? 'scale(1.2)' : 'scale(1)' }}>
      {liked ? '❤️' : '🤍'}
    </span>
  )
  if (layout === 'heart-only' || !count || count <= 0) return heart
  const num = <span className={popCount ? 'da-count-pop' : undefined} style={{ display: 'inline-block', ...countStyle }}>{count}</span>
  return layout === 'inline' ? <>{heart} {num}</> : <>{heart}{num}</>
}
