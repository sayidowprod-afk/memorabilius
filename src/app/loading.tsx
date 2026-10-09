import CardLoader from '@/components/CardLoader'

export default function Loading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <CardLoader />
    </div>
  )
}
