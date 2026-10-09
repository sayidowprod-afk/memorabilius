import { redirect } from 'next/navigation'

// L'ancien apercu de la direction artistique a ete remplace par /admin/da (idees visuelles, reservees aux admins).
export default function Page() {
  redirect('/admin/da')
}
