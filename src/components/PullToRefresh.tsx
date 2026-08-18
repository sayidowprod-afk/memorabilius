'use client'
import { useEffect, useRef, useState } from 'react'
import { useIsNative } from '@/lib/useIsNative'
import { hapticTap } from '@/lib/haptics'

const THRESHOLD = 70

export default function PullToRefresh() {
  const isNative = useIsNative()
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const pulling = useRef(false)
  const pullValue = useRef(0)
  const refreshingRef = useRef(false)

  useEffect(() => {
    if (!isNative) return

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
  }, [isNative])

  if (!isNative) return null

  return (
    <div style={{
      position: 'fixed', top: 'var(--safe-area-inset-top, env(safe-area-inset-top))', left: 0, right: 0,
      display: 'flex', justifyContent: 'center',
      height: pull, overflow: 'hidden', zIndex: 260, pointerEvents: 'none',
      transition: pulling.current ? 'none' : 'height 0.2s ease',
    }}>
      <div style={{
        marginTop: 14, width: 26, height: 26, borderRadius: '50%',
        border: '3px solid #d5deef', borderTopColor: '#003DA6',
        animation: refreshing ? 'ptr-spin 0.6s linear infinite' : 'none',
        transform: refreshing ? undefined : `rotate(${pull * 3}deg)`,
        opacity: Math.min(pull / THRESHOLD, 1),
      }} />
      <style>{`@keyframes ptr-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
