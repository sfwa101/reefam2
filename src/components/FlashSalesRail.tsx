import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useFlashSale } from "@/hooks/useMarketing";

function formatRemaining(ms: number) {
  if (ms <= 0) return "انتهى";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}س ${m}د`;
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export default function FlashSalesRail() {
  const { data } = useFlashSale();
  const sale = data?.sale ?? null;
  const items = data?.items ?? [];

  // Tick every second only when a sale exists; SSR-safe (mounted gate).
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(0);
  useEffect(() => {
    setMounted(true);
    setNow(Date.now());
    if (!sale) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [sale?.id]);

  if (!sale || items.length === 0) return null;
  const remaining = mounted ? new Date(sale.ends_at).getTime() - now : 0;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-destructive animate-pulse" />
          <h2 className="font-display text-base font-extrabold">عروض الفلاش</h2>
        </div>
        {mounted && (
          <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-extrabold text-destructive tabular-nums">
            ينتهي خلال {formatRemaining(remaining)}
          </span>
        )}
      </div>
      <div className="-mx-4 overflow-x-auto px-4 no-scrollbar">
        <div className="flex gap-2.5">
          {items.map((it) => {
            const final = Math.round(Number(it.original_price) * (1 - Number(it.discount_pct) / 100));
            return (
              <Link
                key={it.id}
                to="/product/$productId"
                params={{ productId: it.product_id }}
                className="w-36 shrink-0 rounded-2xl bg-surface p-3 ring-1 ring-border/40 active:scale-95 transition shadow-soft"
              >
                <div className="mb-1 inline-flex rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-extrabold text-destructive-foreground">
                  -{Math.round(Number(it.discount_pct))}٪
                </div>
                <p className="line-clamp-2 text-[12px] font-bold leading-tight">
                  {it.product_name ?? it.product_id}
                </p>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="font-display text-sm font-extrabold tabular-nums">{final}</span>
                  <span className="text-[9px] text-muted-foreground line-through tabular-nums">
                    {Math.round(Number(it.original_price))}
                  </span>
                  <span className="text-[9px] text-muted-foreground">ج.م</span>
                </div>
                {it.reason && <p className="mt-0.5 text-[9px] text-muted-foreground">{it.reason}</p>}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
