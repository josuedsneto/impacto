"use client";

import { useEffect, useRef } from "react";

interface TickerItem {
  label: string;
  ticker: string;
  value: number | null;
  change: number | null;
  unit: string;
}

interface TickerTapeProps {
  items: TickerItem[];
}

export function TickerTape({ items }: TickerTapeProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let x = 0;
    let raf: number;
    function animate() {
      x -= 0.5;
      if (Math.abs(x) >= el!.scrollWidth / 2) x = 0;
      el!.style.transform = `translateX(${x}px)`;
      raf = requestAnimationFrame(animate);
    }
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [items]);

  const doubled = [...items, ...items]; // duplicate for seamless loop

  return (
    <div className="overflow-hidden border-b border-zinc-800 bg-zinc-950 py-1.5">
      <div ref={ref} className="flex gap-8 whitespace-nowrap w-max">
        {doubled.map((item, i) => (
          <span key={i} className="flex items-center gap-2 text-xs font-mono">
            <span className="text-zinc-400 uppercase">{item.label}</span>
            <span className="text-white font-bold">
              {item.value?.toFixed(2) ?? "—"} {item.unit}
            </span>
            {item.change !== null && (
              <span className={item.change >= 0 ? "text-green-400" : "text-red-400"}>
                {item.change >= 0 ? "▲" : "▼"} {Math.abs(item.change).toFixed(2)}%
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
