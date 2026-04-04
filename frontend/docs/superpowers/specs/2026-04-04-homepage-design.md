# Homepage Design — Sugarcane

**Date:** 2026-04-04  
**File:** `app/page.tsx`  
**Status:** Approved

---

## Overview

Public landing page (unauthenticated) for the Sugarcane platform. Replaces the current placeholder. Redirects authenticated users to `/app/dashboard`.

---

## Layout

### Navigation bar
- Background: `#0f172a` (dark navy)
- Left: SVG logo (green rounded square with sugarcane stalk + leaf paths) + "Sugarcane" wordmark
- Right: "Sobre" link · "Funcionalidades" link · "Entrar" button (green, links to `/login`)
- Border-bottom: `#1e293b`

### Hero — split layout
Two equal columns, `min-height: 380px`, background `#0f172a`.

**Left column (text):**
- Eyebrow label: `PLATAFORMA DE RISCO · MERCADO SUCROENERGÉTICO` (green, uppercase, tracked)
- H1: "Análise de risco para o mercado de açúcar" (32px, white, bold)
- Body: short description of Monte Carlo, Black-Scholes, câmbio, gestão de risco
- Two CTAs: primary "Acessar plataforma →" (green filled) · secondary "Ver funcionalidades" (ghost border)

**Right column (image):**
- Image: `josh-withers-lZ4xZZuk8iA-unsplash.jpg` placed in `public/` as `sugarcane-field.jpg`
- `object-fit: cover`, `opacity: 0.75`
- Gradient overlay left-to-right `#0f172a → transparent` to blend with left column
- **Floating price cards** (glassmorphism, `rgba(15,23,42,0.92)`, `backdrop-filter: blur`):
  - Top-right: USD/BRL card (red negative change)
  - Bottom-right: Açúcar NY #11 card (green positive change)
  - Prices are static/decorative on the landing page (not live-fetched — no auth)
- **Photo credit** (bottom-center, 9px, low opacity):  
  Foto de [Josh Withers](https://unsplash.com/pt-br/@joshwithers) na [Unsplash](https://unsplash.com/pt-br/fotografias/foto-aerea-da-fazenda-lZ4xZZuk8iA)

### Stats bar
Background: `#052e16` (deep green), 4-column grid, dividers `#14532d`.

| Stat | Label |
|------|-------|
| 10.000 | simulações por análise |
| 20+ | ferramentas de análise |
| P5–P95 | percentis de cenário |
| Tempo real | dados de mercado ao vivo |

Numbers in `#4ade80` (bright green), labels in `#6b7280`.

### Footer
- Background: `#0f172a`
- Center: `© 2025 Sugarcane · Plataforma sucroenergética` (11px, muted)

---

## Logo / Icon

SVG inline — 26×26px, `rx=7` rounded square, `fill=#16a34a`.  
Elements: vertical stalk line, 3 node circles, 3 leaf path curves.  
Colors: stalk `#bbf7d0`, nodes/leaves `#4ade80`, top leaf `#86efac`.

To be reused in nav and `<head>` favicon (as `favicon.svg`).

---

## Image asset

- Source: `frontend/josh-withers-lZ4xZZuk8iA-unsplash.jpg`
- Copy to: `frontend/public/sugarcane-field.jpg`
- Reference in code: `/sugarcane-field.jpg` (Next.js `public/` static serving)
- Use Next.js `<Image>` component with `fill` + `object-fit: cover`

---

## Routing

- `app/page.tsx` — this landing page (public, no auth)
- **"Entrar" button** → `href="/login"` (Next.js `<Link>`)
- **"Acessar plataforma →" CTA** → `href="/login"` (same destination)
- **Authenticated users hitting `/`** → server-side redirect to `/app/dashboard`  
  Use `createServerSupabaseClient()` (already used in `app/app/dashboard/page.tsx`),  
  call `supabase.auth.getUser()`, and if `user` exists do `redirect('/app/dashboard')`
- Nav "Sobre" and "Funcionalidades" links → `#` for now (no pages exist yet)

---

## Out of scope

- "Ver funcionalidades" anchor section (can be added in a future iteration)
- "Sobre" page
- Animations / scroll effects
