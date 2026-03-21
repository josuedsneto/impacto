import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import ParamsForm from '@/components/params/ParamsForm'

export default async function ParamsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <main className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações de Parâmetros</h1>
        <p className="text-sm text-muted-foreground">
          Defina volatilidade, taxa livre de risco e PCT Bound por ativo.
        </p>
      </div>
      <ParamsForm />
    </main>
  )
}
