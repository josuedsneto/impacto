import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import WatchlistManager from '@/components/watchlist/WatchlistManager'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Defensive check — middleware (proxy) should have redirected already,
  // but belt-and-suspenders for direct server-side access
  if (!user) {
    redirect('/login')
  }

  return (
    <main className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Bem-vindo, {user.email}</p>
      </div>
      <WatchlistManager />
    </main>
  )
}
