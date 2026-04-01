import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { SuggestionQueue } from '@/components/admin/SuggestionQueue'
import { AdminConfig } from '@/components/admin/AdminConfig'

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
    <main className="container mx-auto py-8 space-y-10">
      <h1 className="text-2xl font-semibold mb-6">Painel do Administrador</h1>
      <SuggestionQueue />
      <AdminConfig />
    </main>
  )
}
