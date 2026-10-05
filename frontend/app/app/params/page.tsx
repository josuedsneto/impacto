import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import ParamsForm from '@/components/params/ParamsForm'
import { PageHeader } from '@/components/layout/PageHeader'

export default async function ParamsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div>
      <PageHeader
        titulo="Parâmetros"
        descricao="Valores padrão por ativo usados nas suas simulações: volatilidade, taxa livre de risco e limite de variação."
      />
      <ParamsForm />
    </div>
  )
}
