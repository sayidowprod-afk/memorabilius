import SetlistClient from '../SetlistClient'

// Ancienne page de checklist : cocher ses cartes, wishlist, suivi manuel. La page du set (../page.tsx) est la vitrine ; celle-ci sert à gérer sa progression.
export const dynamic = 'force-dynamic'

export default async function SetlistGererPage({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params
  return <SetlistClient setId={setId} />
}
