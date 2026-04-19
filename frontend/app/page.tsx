import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Sugarcane — Análise de risco para o mercado sucroenergético',
  description: 'Simulações Monte Carlo, precificação de opções Black-Scholes, análise cambial e gestão de risco para usinas e traders de açúcar.',
}

export default async function HomePage() {
  // Redirect authenticated users straight to the dashboard
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/app/dashboard')

  return (
    <div style={{ fontFamily: 'var(--font-geist-sans, sans-serif)', background: '#0f172a', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── Nav ── */}
      <nav style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="28" height="28" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
            <rect width="26" height="26" rx="7" fill="#16a34a"/>
            <line x1="13" y1="22" x2="13" y2="6" stroke="#bbf7d0" strokeWidth="2.2" strokeLinecap="round"/>
            <circle cx="13" cy="18" r="1.5" fill="#4ade80"/>
            <circle cx="13" cy="13" r="1.5" fill="#4ade80"/>
            <circle cx="13" cy="8" r="1.5" fill="#4ade80"/>
            <path d="M13 18 Q18 15 17 10" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
            <path d="M13 13 Q8 10 9 5" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
            <path d="M13 8 Q17 6 16 3" stroke="#86efac" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
          </svg>
          <span style={{ color: '#f9fafb', fontWeight: 800, fontSize: 17, letterSpacing: '-0.3px' }}>Sugarcane</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Link
            href="/login"
            style={{ background: '#16a34a', color: '#fff', padding: '7px 18px', borderRadius: 6, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}
          >
            Entrar
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 420 }}>

        {/* Left — text */}
        <div style={{ flex: 1, padding: '56px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <p style={{ fontSize: 10, color: '#4ade80', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 16 }}>
            Plataforma de risco · mercado sucroenergético
          </p>
          <h1 style={{ fontSize: 36, color: '#f9fafb', fontWeight: 900, lineHeight: 1.15, margin: '0 0 16px 0' }}>
            Análise de risco para o<br/>mercado de açúcar
          </h1>
          <p style={{ fontSize: 14, color: '#9ca3af', lineHeight: 1.65, margin: '0 0 32px 0', maxWidth: 420 }}>
            Simulações Monte Carlo, precificação de opções Black-Scholes, análise cambial e gestão de risco — tudo em um só lugar para usinas e traders.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link
              href="/login"
              style={{ background: '#16a34a', color: '#fff', padding: '11px 26px', borderRadius: 7, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}
            >
              Acessar plataforma →
            </Link>
            <span style={{ color: '#4b5563', padding: '11px 26px', fontSize: 14, cursor: 'default' }}>
              Ver funcionalidades
            </span>
          </div>
        </div>

        {/* Right — image */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 360 }}>
          <Image
            src="/sugarcane-field.jpg"
            alt="Foto aérea de fazenda de cana-de-açúcar"
            fill
            style={{ objectFit: 'cover', opacity: 0.75 }}
            priority
          />
          {/* Left-blend gradient */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #0f172a 0%, transparent 30%)' }} />

          {/* Price card — top right: USD/BRL */}
          <div style={{ position: 'absolute', top: 24, right: 24, background: 'rgba(15,23,42,0.88)', border: '1px solid #1e293b', borderRadius: 10, padding: '12px 18px', backdropFilter: 'blur(8px)' }}>
            <p style={{ fontSize: 9, color: '#6b7280', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', margin: '0 0 4px 0' }}>USD / BRL</p>
            <p style={{ fontSize: 20, color: '#f9fafb', fontWeight: 800, margin: 0 }}>R$ 5.72</p>
            <p style={{ fontSize: 11, color: '#f87171', fontWeight: 600, margin: '2px 0 0 0' }}>▼ −0.21%</p>
            <p style={{ fontSize: 8, color: '#4b5563', margin: '4px 0 0 0', letterSpacing: '0.5px' }}>ILUSTRATIVO</p>
          </div>

          {/* Price card — bottom right: Açúcar NY */}
          <div style={{ position: 'absolute', bottom: 40, right: 24, background: 'rgba(15,23,42,0.92)', border: '1px solid #1e293b', borderRadius: 10, padding: '14px 20px', backdropFilter: 'blur(8px)', minWidth: 160 }}>
            <p style={{ fontSize: 9, color: '#6b7280', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', margin: '0 0 4px 0' }}>AÇÚCAR NY #11</p>
            <p style={{ fontSize: 26, color: '#f9fafb', fontWeight: 800, margin: 0 }}>
              18.42 <span style={{ fontSize: 13, color: '#9ca3af' }}>¢/lb</span>
            </p>
            <p style={{ fontSize: 11, color: '#4ade80', fontWeight: 600, margin: '2px 0 0 0' }}>▲ +0.83% hoje</p>
            <p style={{ fontSize: 8, color: '#4b5563', margin: '4px 0 0 0', letterSpacing: '0.5px' }}>ILUSTRATIVO</p>
          </div>

          {/* Photo credit */}
          <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.38)' }}>
              Foto de{' '}
              <a
                href="https://unsplash.com/pt-br/@joshwithers?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'rgba(255,255,255,0.48)', textDecoration: 'underline' }}
              >
                Josh Withers
              </a>
              {' '}na{' '}
              <a
                href="https://unsplash.com/pt-br/fotografias/foto-aerea-da-fazenda-lZ4xZZuk8iA?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'rgba(255,255,255,0.48)', textDecoration: 'underline' }}
              >
                Unsplash
              </a>
            </span>
          </div>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div style={{ background: '#052e16', borderTop: '1px solid #14532d', borderBottom: '1px solid #14532d', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', textAlign: 'center' }}>
        {[
          { value: '10.000', label: 'simulações por análise' },
          { value: '20+',    label: 'ferramentas de análise' },
          { value: 'P5–P95', label: 'percentis de cenário' },
          { value: 'Tempo real', label: 'dados de mercado ao vivo' },
        ].map((stat, i, arr) => (
          <div
            key={stat.label}
            style={{ padding: '24px 16px', borderRight: i < arr.length - 1 ? '1px solid #14532d' : undefined }}
          >
            <p style={{ fontSize: 28, color: '#4ade80', fontWeight: 900, lineHeight: 1, margin: 0 }}>{stat.value}</p>
            <p style={{ fontSize: 11, color: '#6b7280', margin: '6px 0 0 0' }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── Footer ── */}
      <footer style={{ background: '#0f172a', padding: '18px 32px', textAlign: 'center' }}>
        <span style={{ fontSize: 11, color: '#374151' }}>© {new Date().getFullYear()} Sugarcane · Plataforma sucroenergética</span>
      </footer>

    </div>
  )
}
