'use client'
import { useEffect, useRef, useState } from 'react'
import { useIsAppUI } from '@/lib/useIsNative'
import { hapticTap } from '@/lib/haptics'

const THRESHOLD = 70

export default function PullToRefresh() {
  const isApp = useIsAppUI()
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const pulling = useRef(false)
  const pullValue = useRef(0)
  const refreshingRef = useRef(false)

  useEffect(() => {
    if (!isApp) return

    const onTouchStart = (e: TouchEvent) => {
      // Écouteur global sur tout le document — sans cette exclusion, glisser un
      // point de contour vers le bas dans le scanner de cartes (ou tout autre
      // widget avec son propre drag) est confondu avec un tir-pour-rafraîchir
      // et recharge l'app en plein milieu, ce qui a été rapporté comme
      // « l'app me déconnecte du scan ».
      if ((e.target as Element)?.closest?.('[data-no-ptr]')) return
      if (window.scrollY <= 0 && !refreshingRef.current) {
        startY.current = e.touches[0].clientY
        pulling.current = true
      }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current) return
      const dy = e.touches[0].clientY - startY.current
      if (dy > 0 && window.scrollY <= 0) {
        const next = Math.min(dy * 0.5, 100)
        pullValue.current = next
        setPull(next)
      } else {
        pulling.current = false
        pullValue.current = 0
        setPull(0)
      }
    }
    const onTouchEnd = () => {
      if (!pulling.current) return
      pulling.current = false
      if (pullValue.current > THRESHOLD) {
        refreshingRef.current = true
        setRefreshing(true)
        setPull(THRESHOLD)
        hapticTap()
        setTimeout(() => window.location.reload(), 350)
      } else {
        pullValue.current = 0
        setPull(0)
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd)
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [isApp])

  if (!isApp) return null

  return (
    <div style={{
      position: 'fixed', top: 'var(--safe-area-inset-top, env(safe-area-inset-top))', left: 0, right: 0,
      display: 'flex', justifyContent: 'center',
      height: pull, overflow: 'hidden', zIndex: 260, pointerEvents: 'none',
      transition: pulling.current ? 'none' : 'height 0.2s ease',
    }}>
      {/* ballon de basket : tourne pendant qu'on tire, rebondit pendant l'actualisation */}
      <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true" style={{
        marginTop: 12,
        animation: refreshing ? 'ptr-bounce 0.55s ease-in-out infinite' : 'none',
        transform: refreshing ? undefined : `rotate(${pull * 4}deg) scale(${0.6 + Math.min(pull / THRESHOLD, 1) * 0.4})`,
        opacity: Math.min(pull / THRESHOLD, 1),
      }}>
        <circle cx="16" cy="16" r="14.5" fill="#e8741f" stroke="#7a3410" strokeWidth="1.5" />
        <path d="M16 1.5v29M1.5 16h29" stroke="#2a1206" strokeWidth="1.4" fill="none" />
        <path d="M5 5.5c6 4 6 17 0 21M27 5.5c-6 4-6 17 0 21" stroke="#2a1206" strokeWidth="1.4" fill="none" />
      </svg>
      <style>{`@keyframes ptr-bounce { 0%,100% { transform: translateY(0) } 50% { transform: translateY(14px) } }`}</style>
    </div>
  )
}
