"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";

const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

interface NewsItem {
  title: string;
  link: string;
  source: string;
  published: string;
}

export default function NoticiasPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ items: NewsItem[] }>("/api/news");
      setNews(data.items);
      const now = new Date();
      setLastUpdate(
        now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchNews]);

  return (
    <div>
      <PageHeader
        titulo="Notícias"
        descricao="Últimas notícias sobre açúcar, dólar e mercado, atualizadas a cada 30 minutos."
        atualizadoEm={lastUpdate ? `Atualizado às ${lastUpdate}` : undefined}
      />

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      )}

      {error && <ErrorState mensagem={error} onRetry={fetchNews} />}

      {!loading && !error && news.length === 0 && <EmptyState mensagem="Nenhuma notícia disponível agora." />}

      {!loading && !error && news.length > 0 && (
        <div className="space-y-3">
          {news.map((item) => (
            <Card key={item.link}>
              <CardContent className="py-4">
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-brand underline-offset-4 hover:underline"
                >
                  {item.title}
                </a>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{item.source}</span>
                  <span aria-hidden>·</span>
                  <span>
                    {item.published
                      ? new Date(item.published).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
