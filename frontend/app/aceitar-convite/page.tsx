"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

interface InviteInfo {
  invited_email: string;
  usina_nome: string;
}

async function getToken(): Promise<string | null> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function AcceitarConviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [done, setDone] = useState(false);
  const [usinaNome, setUsinaNome] = useState("");

  useEffect(() => {
    if (!token) {
      setLoadError("Token de convite inválido.");
      setLoading(false);
      return;
    }

    async function load() {
      try {
        // Check login status
        const accessToken = await getToken();
        setIsLoggedIn(!!accessToken);

        // Validate invite (public endpoint)
        const res = await fetch(`${API}/api/invites/validate?token=${encodeURIComponent(token)}`);
        if (!res.ok) {
          const err = await res.json();
          setLoadError(err.detail ?? "Convite inválido ou expirado.");
          return;
        }
        const data = await res.json();
        setInviteInfo({ invited_email: data.invited_email, usina_nome: data.usina_nome });
      } catch {
        setLoadError("Erro ao verificar convite.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [token]);

  async function handleAccept() {
    setAccepting(true);
    try {
      const accessToken = await getToken();
      if (!accessToken) {
        // redirect to login, come back after
        router.push(`/login?next=${encodeURIComponent(`/aceitar-convite?token=${token}`)}`);
        return;
      }
      const res = await fetch(`${API}/api/invites/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail ?? "Erro ao aceitar convite.");
        return;
      }
      setDone(true);
      setUsinaNome(data.usina ?? inviteInfo?.usina_nome ?? "");
    } catch {
      toast.error("Erro de conexão.");
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">Verificando convite...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 max-w-md w-full mx-4 text-center space-y-4">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-xl font-semibold text-gray-900">Convite inválido</h1>
          <p className="text-sm text-gray-500">{loadError}</p>
          <Button variant="outline" onClick={() => router.push("/")}>Ir para o início</Button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 max-w-md w-full mx-4 text-center space-y-4">
          <div className="text-4xl">✅</div>
          <h1 className="text-xl font-semibold text-gray-900">Convite aceito!</h1>
          <p className="text-sm text-gray-500">
            Você agora tem acesso à usina <strong>{usinaNome}</strong>.
          </p>
          <Button onClick={() => router.push("/app/dashboard")}>Ir para o painel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 max-w-md w-full mx-4 space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2 mb-4">
            <svg width="32" height="32" viewBox="0 0 26 26" fill="none" aria-hidden="true">
              <rect width="26" height="26" rx="7" fill="#16a34a"/>
              <line x1="13" y1="22" x2="13" y2="6" stroke="#bbf7d0" strokeWidth="2.2" strokeLinecap="round"/>
              <circle cx="13" cy="18" r="1.5" fill="#4ade80"/>
              <circle cx="13" cy="13" r="1.5" fill="#4ade80"/>
              <circle cx="13" cy="8" r="1.5" fill="#4ade80"/>
            </svg>
            <span style={{ fontWeight: 800, fontSize: 18, color: "#111827" }}>Sugarcane</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Você foi convidado!</h1>
          <p className="text-sm text-gray-500">
            Para a usina <strong className="text-gray-800">{inviteInfo?.usina_nome}</strong>
          </p>
          {inviteInfo?.invited_email && (
            <p className="text-xs text-gray-400">Convite para: {inviteInfo.invited_email}</p>
          )}
        </div>

        <div className="border-t pt-4 space-y-3">
          {isLoggedIn ? (
            <Button className="w-full" onClick={handleAccept} disabled={accepting}>
              {accepting ? "Aceitando..." : "Aceitar convite"}
            </Button>
          ) : (
            <>
              <p className="text-sm text-gray-600 text-center">
                Faça login para aceitar o convite.
              </p>
              <Button
                className="w-full"
                onClick={() => router.push(`/login?next=${encodeURIComponent(`/aceitar-convite?token=${token}`)}`)}
              >
                Entrar para aceitar
              </Button>
            </>
          )}
          <p className="text-xs text-gray-400 text-center">
            O convite expira em 7 dias. Caso não tenha solicitado, ignore este link.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AcceitarConvitePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AcceitarConviteContent />
    </Suspense>
  );
}
