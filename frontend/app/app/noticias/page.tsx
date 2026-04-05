"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/ErrorState";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";
const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

interface NewsItem {
  title: string;
  link: string;
  source: string;
  published: string;
}

async function getAccessToken(): Promise<string> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

export default function NoticiasPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API}/api/news`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data as { detail?: string; error?: string }).detail ?? data.error ?? "Erro ao carregar notícias.");
        return;
      }
      setNews(data.items as NewsItem[]);
      const now = new Date();
      setLastUpdate(
        now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError("Erro de conexão com o servidor.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [fetchData]);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notícias — Açúcar &amp; Câmbio</h1>
        {lastUpdate && (
          <span className="text-sm text-muted-foreground">
            Última atualização: {lastUpdate}
          </span>
        )}
      </div>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {error && <ErrorState message={error} onRetry={fetchData} />}

      {!loading && !error && (
        <div className="space-y-3">
          {news.map((item, i) => (
            <Card key={i}>
              <CardContent className="pt-4 pb-4">
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-600 hover:underline"
                >
                  {item.title}
                </a>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span>{item.source}</span>
                  <span>·</span>
                  <span>{item.published}</span>
                </div>
              </CardContent>
            </Card>
          ))}
          {news.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma notícia disponível.</p>
          )}
        </div>
      )}
    </div>
  );
}
