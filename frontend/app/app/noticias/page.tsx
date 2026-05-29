"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";

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
      const data = await apiFetch<{ items: NewsItem[] }>(`/api/news`);
      setNews(data.items);
      const now = new Date();
      setLastUpdate(
        now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erro de conexão com o servidor.");
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
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

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
