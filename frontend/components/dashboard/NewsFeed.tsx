"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

interface NewsItem {
  title: string;
  link: string;
  published: string;
  source: string;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

export function NewsFeed() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNews() {
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token ?? "";

        const res = await fetch(`${API}/api/news`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const data = await res.json();
        setItems((data.items as NewsItem[]).slice(0, 4));
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchNews();
  }, []);

  return (
    <div
      className="rounded-[10px] p-5"
      style={{ background: "#fff", border: "1px solid #e5e7eb" }}
    >
      <p
        className="font-bold mb-3 pb-3"
        style={{
          fontSize: 13,
          color: "#111827",
          borderBottom: "1px solid #f3f4f6",
        }}
      >
        Notícias do Mercado
      </p>

      {loading && (
        <p style={{ fontSize: 12, color: "#9ca3af" }}>Carregando notícias...</p>
      )}
      {!loading && items.length === 0 && (
        <p style={{ fontSize: 12, color: "#9ca3af" }}>Nenhuma notícia encontrada.</p>
      )}

      {items.map((item, i) => (
        <a
          key={i}
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
          style={{
            paddingTop: 10,
            paddingBottom: 10,
            borderBottom: i < 3 ? "1px solid #f9fafb" : "none",
          }}
        >
          <span
            className="inline-block font-bold rounded mb-1"
            style={{
              fontSize: 10,
              padding: "2px 6px",
              letterSpacing: "0.3px",
              background: "#eff6ff",
              color: "#1d4ed8",
            }}
          >
            {item.source}
          </span>
          <p className="leading-snug" style={{ fontSize: 12, color: "#1f2937" }}>
            {item.title}
          </p>
          <p className="mt-0.5" style={{ fontSize: 11, color: "#9ca3af" }}>
            {item.published
              ? new Date(item.published).toLocaleDateString("pt-BR", {
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
