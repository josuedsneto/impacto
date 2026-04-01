# Login + Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a login page (email+senha + magic link) and Next.js middleware protecting all `/app/*` routes.

**Architecture:** Middleware intercepts `/app/*` requests, reads Supabase session from cookies via `@supabase/ssr`, redirects unauthenticated users to `/login`. Login page is a Client Component using the existing `@/lib/supabase/client` helper.

**Tech Stack:** Next.js App Router, `@supabase/ssr`, shadcn/ui (Tabs, Input, Button, Card, Label)

---

### Task 1: Middleware

**Files:**
- Create: `frontend/middleware.ts`

- [ ] **Step 1: Create middleware file**

`frontend/middleware.ts`:
```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && request.nextUrl.pathname.startsWith('/app')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/app/:path*'],
}
```

- [ ] **Step 2: Commit**

```bash
cd frontend
git add middleware.ts
git commit -m "feat(auth): protect /app/* routes via middleware"
```

---

### Task 2: Login Page

**Files:**
- Create: `frontend/app/login/page.tsx`

- [ ] **Step 1: Create login page**

`frontend/app/login/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/app/dashboard");
      router.refresh();
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ email });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setMagicSent(true);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#f4f6f9" }}
    >
      <Card style={{ width: 400, background: "#fff", border: "1px solid #e5e7eb" }}>
        <CardHeader className="pb-4">
          <CardTitle style={{ fontSize: 20, color: "#111827" }}>Impacto</CardTitle>
          <CardDescription style={{ fontSize: 13, color: "#6b7280" }}>
            Simulações e análise de mercado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="senha">
            <TabsList className="w-full mb-4">
              <TabsTrigger value="senha" className="flex-1">
                Email + Senha
              </TabsTrigger>
              <TabsTrigger value="magic" className="flex-1">
                Magic Link
              </TabsTrigger>
            </TabsList>

            <TabsContent value="senha">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                {error && (
                  <p style={{ color: "#dc2626", fontSize: 13 }}>{error}</p>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="magic">
              {magicSent ? (
                <div className="text-center py-6 space-y-2">
                  <p style={{ color: "#15803d", fontSize: 14, fontWeight: 600 }}>
                    ✓ Link enviado para {email}
                  </p>
                  <p style={{ color: "#6b7280", fontSize: 12 }}>
                    Verifique sua caixa de entrada e clique no link para entrar.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleMagicLink} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="magic-email">Email</Label>
                    <Input
                      id="magic-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  {error && (
                    <p style={{ color: "#dc2626", fontSize: 13 }}>{error}</p>
                  )}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Enviando..." : "Enviar magic link"}
                  </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat(auth): add login page with email+senha and magic link"
```

---

### Task 3: Build and Deploy

- [ ] **Step 1: Build locally**

```bash
cd "C:\Users\netin\OneDrive\Documentos\Code\impacto\frontend"
rm -rf .next
npm run build
```

Expected: build succeeds with no type errors.

- [ ] **Step 2: Deploy**

```bash
vercel --prod
```

- [ ] **Step 3: Manual test**

1. Open `https://sugarcane-two.vercel.app/app/dashboard` without being logged in → should redirect to `/login`
2. Log in with email + senha → should redirect to `/app/dashboard`
3. Log out (clear localStorage or use Supabase `signOut`) → reload `/app/simulation` → should redirect to `/login`
4. Test magic link tab → enter email → should show "✓ Link enviado"
