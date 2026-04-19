import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

// Use the configured site URL as the trusted origin; fall back to the request
// origin only in local dev (where NEXT_PUBLIC_SITE_URL is typically unset).
function getTrustedOrigin(requestOrigin: string): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? requestOrigin
}

export async function GET(request: NextRequest) {
  const { searchParams, origin: requestOrigin } = new URL(request.url)
  const trustedOrigin = getTrustedOrigin(requestOrigin)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/app/dashboard'
  const safePath = next.startsWith('/app/') ? next : '/app/dashboard'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${trustedOrigin}${safePath}`)
    }
  }

  // Exchange failed — redirect to login with error indicator
  return NextResponse.redirect(`${trustedOrigin}/login?error=auth_callback_failed`)
}
