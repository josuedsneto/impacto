"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { EmptyState, Skeleton } from "@/components/ui/feedback";

interface NewsItem {
  title: string;
  link: string;
  published: string;
  source: string;
}

export function NewsFeed() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNews() {
      try {
        const data = await apiFetch<{ items: NewsItem[] }>("/api/news");
        setItems(data.items.slice(0, 4));
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchNews();
  }, []);

  return (
    <div className="rounded-xl border border-border bg-card p-5 text-card-foreground">
      <p className="mb-3 border-b border-border pb-3 text-[13px] font-bold">Notícias do mercado</p>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      )}
      {!loading && items.length === 0 && <EmptyState mensagem="Nenhuma notícia encontrada agora." />}

      {items.map((item) => (
        <a
          key={item.link}
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-md border-b border-border py-2.5 outline-none last:border-0 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="mb-1 inline-block rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.3px] text-brand">
            {item.source}
          </span>
          <p className="text-xs leading-snug text-foreground">{item.title}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {item.published
              ? new Date(item.published).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : ""}
          </p>
        </a>
      ))}
    </div>
  );
}
