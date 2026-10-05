import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { SuggestionQueue } from '@/components/admin/SuggestionQueue'
import { AdminConfig } from '@/components/admin/AdminConfig'
import { AtrUsinasAdmin } from '@/components/admin/AtrUsinasAdmin'
import { PageHeader } from '@/components/layout/PageHeader'

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = user.app_metadata?.role
  if (role !== 'admin') {
    redirect('/app/dashboard')
  }

  return (
    <div className="space-y-10">
      <PageHeader
        titulo="Administração"
        descricao="Aprove ativos sugeridos, ajuste configurações do sistema e gerencie usinas e acessos."
      />
      <SuggestionQueue />
      <AdminConfig />
      <AtrUsinasAdmin />
    </div>
  )
}
