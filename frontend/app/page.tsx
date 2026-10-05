import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Sugarcane — Análise de risco para o mercado sucroenergético',
  description: 'Simulações Monte Carlo, precificação de opções Black-Scholes, análise cambial e gestão de risco para usinas e traders de açúcar.',
}

const STATS = [
  { value: '10.000', label: 'simulações por análise' },
  { value: '20+', label: 'ferramentas de análise' },
  { value: 'P5–P95', label: 'percentis de cenário' },
  { value: 'Diário', label: 'dados de mercado atualizados' },
]

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 26 26" fill="none" aria-hidden="true" focusable="false" className="text-positive">
      <rect width="26" height="26" rx="7" fill="currentColor" />
      <g className="text-foreground" stroke="currentColor" strokeLinecap="round" fill="none">
        <line x1="13" y1="22" x2="13" y2="6" strokeWidth="2.2" />
        <path d="M13 18 Q18 15 17 10" strokeWidth="1.5" />
        <path d="M13 13 Q8 10 9 5" strokeWidth="1.5" />
        <path d="M13 8 Q17 6 16 3" strokeWidth="1.2" />
      </g>
    </svg>
  )
}

function CartaoPreco({ rotulo, valor, unidade, variacao, alta, className }: {
  rotulo: string; valor: string; unidade?: string; variacao: string; alta: boolean; className: string
}) {
  return (
    <div className={`absolute rounded-xl border border-border bg-background/90 px-5 py-3 backdrop-blur ${className}`}>
      <p className="mb-1 text-[9px] font-bold uppercase tracking-[1.5px] text-muted-foreground">{rotulo}</p>
      <p className="text-2xl font-extrabold text-foreground">
        {valor} {unidade && <span className="text-sm font-normal text-muted-foreground">{unidade}</span>}
      </p>
      <p className={`mt-0.5 text-[11px] font-semibold ${alta ? 'text-positive' : 'text-negative'}`}>{variacao}</p>
      <p className="mt-1 text-[8px] tracking-[0.5px] text-muted-foreground">ILUSTRATIVO</p>
    </div>
  )
}

export default async function HomePage() {
  // Usuário logado vai direto ao dashboard
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/app/dashboard')

  // A landing é sempre escura (identidade de marketing): o escopo .dark fixa os tokens escuros.
  return (
    <div className="dark flex min-h-screen flex-col bg-background text-foreground">
      <nav className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-8">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="text-[17px] font-extrabold tracking-tight">Sugarcane</span>
        </div>
        <Link
          href="/login"
          className="rounded-md bg-primary px-4 py-2 text-[13px] font-bold text-primary-foreground hover:bg-primary/90"
        >
          Entrar
        </Link>
      </nav>

      <div className="flex flex-1 flex-col md:min-h-[420px] md:flex-row">
        <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-12 md:py-14">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[3px] text-positive">
            Plataforma de risco · mercado sucroenergético
          </p>
          <h1 className="mb-4 text-3xl font-black leading-tight sm:text-4xl">
            Análise de risco para o<br />mercado de açúcar
          </h1>
          <p className="mb-8 max-w-[420px] text-sm leading-relaxed text-muted-foreground">
            Simulações Monte Carlo, precificação de opções Black-Scholes, análise cambial e gestão de risco — tudo em um só lugar para usinas e traders.
          </p>
          <div>
            <Link
              href="/login"
              className="inline-block rounded-md bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90"
            >
              Acessar plataforma →
            </Link>
          </div>
        </div>

        <div className="relative min-h-[360px] flex-1 overflow-hidden">
          <Image
            src="/sugarcane-field.jpg"
            alt="Foto aérea de fazenda de cana-de-açúcar"
            fill
            className="object-cover opacity-75"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background to-transparent to-30% md:bg-gradient-to-r" />

          <CartaoPreco className="right-4 top-4 sm:right-6 sm:top-6" rotulo="USD / BRL" valor="R$ 5,72" variacao="▼ −0,21%" alta={false} />
          <CartaoPreco className="bottom-10 right-4 sm:right-6" rotulo="Açúcar NY nº 11" valor="18,42" unidade="¢/lb" variacao="▲ +0,83% hoje" alta />

          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] text-foreground/40">
            Foto de{' '}
            <a
              href="https://unsplash.com/pt-br/@joshwithers?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Josh Withers
            </a>{' '}
            na{' '}
            <a
              href="https://unsplash.com/pt-br/fotografias/foto-aerea-da-fazenda-lZ4xZZuk8iA?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Unsplash
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 border-y border-border bg-card text-center md:grid-cols-4">
        {STATS.map((stat) => (
          <div key={stat.label} className="border-border px-4 py-6 [&:not(:last-child)]:md:border-r">
            <p className="text-2xl font-black leading-none text-positive sm:text-3xl">{stat.value}</p>
            <p className="mt-1.5 text-[11px] text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      <footer className="px-8 py-5 text-center">
        <span className="text-[11px] text-muted-foreground">© {new Date().getFullYear()} Sugarcane · Plataforma sucroenergética</span>
      </footer>
    </div>
  )
}
