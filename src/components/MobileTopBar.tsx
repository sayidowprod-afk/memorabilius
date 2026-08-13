'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useIsNative } from '@/lib/useIsNative'

const GALLERY_ROOT = /^\/galerie\/[^/]+$/

export default function MobileTopBar() {
  const isNative = useIsNative()
  const pathname = usePathname()

  if (!isNative) return null

  const scrollsAway = GALLERY_ROOT.test(pathname)

  return (
    <div
      style={{
        position: scrollsAway ? 'static' : 'sticky',
        top: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 'calc(env(safe-area-inset-top) + 10px)',
        paddingBottom: 10,
        background: '#003DA6',
      }}
    >
      <Link href="/" style={{ display: 'flex', alignItems: 'center' }}>
        <img
          src="/memorabilius-logo-white-sm.png"
          alt="Memorabilius"
          style={{ height: 20, width: 'auto', background: 'transparent' }}
        />
      </Link>
    </div>
  )
}
