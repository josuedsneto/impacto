import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Defensive check — middleware (proxy) should have redirected already,
  // but belt-and-suspenders for direct server-side access
  if (!user) {
    redirect('/login')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Bem-vindo, {user.email}
        </p>
        <p className="text-xs text-muted-foreground">
          Plataforma em construção — autenticação funcionando.
        </p>
      </div>
    </main>
  )
}
