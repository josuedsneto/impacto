import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { SuggestionQueue } from '@/components/admin/SuggestionQueue'

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <main className="container mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-semibold mb-6">Painel do Administrador</h1>
      <SuggestionQueue />
    </main>
  )
}
