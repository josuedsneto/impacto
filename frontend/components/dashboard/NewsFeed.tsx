"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

const RSS_QUERIES = [
  { q: "açúcar futuros NY mercado", label: "Açúcar" },
  { q: "dólar real câmbio Brasil", label: "Câmbio" },
];

export function NewsFeed() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNews() {
      try {
        const results = await Promise.all(
          RSS_QUERIES.map(async ({ q, label }) => {
            const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
            const res = await fetch(
              `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
            );
            const data = await res.json();
            const parser = new DOMParser();
            const xml = parser.parseFromString(data.contents, "text/xml");
            const xmlItems = Array.from(xml.querySelectorAll("item")).slice(0, 8);
            return xmlItems.map((item) => ({
              title: item.querySelector("title")?.textContent ?? "",
              link: item.querySelector("link")?.textContent ?? "",
              pubDate: item.querySelector("pubDate")?.textContent ?? "",
              source: label,
            }));
          })
        );
        const all = results.flat().sort(
          (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
        );
        setItems(all);
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

      {items.slice(0, 4).map((item, i) => (
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
              background: item.source === "Açúcar" ? "#fef9c3" : "#eff6ff",
              color: item.source === "Açúcar" ? "#854d0e" : "#1d4ed8",
            }}
          >
            {item.source}
          </span>
          <p
            className="leading-snug"
            style={{ fontSize: 12, color: "#1f2937" }}
          >
            {item.title}
          </p>
          <p className="mt-0.5" style={{ fontSize: 11, color: "#9ca3af" }}>
            {item.pubDate
              ? new Date(item.pubDate).toLocaleDateString("pt-BR", {
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
