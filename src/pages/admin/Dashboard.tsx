import { useEffect, useState } from "react";
import {
  ShoppingBag,
  DollarSign,
  Users,
  Package,
  TrendingUp,
  Clock,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

type Stats = {
  todayRevenue: number;
  todayOrders: number;
  pendingOrders: number;
  customers: number;
  products: number;
  weekRevenue: number;
};

type ChartPoint = { day: string; revenue: number; orders: number };
type RecentOrder = {
  id: string;
  total: number;
  status: string;
  created_at: string;
};

const STATUS_AR: Record<string, string> = {
  pending: "قيد المراجعة",
  confirmed: "مؤكد",
  preparing: "قيد التحضير",
  shipping: "قيد الشحن",
  delivered: "تم التوصيل",
  cancelled: "ملغي",
};

const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  confirmed: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  preparing: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  shipping: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400",
  delivered: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  cancelled: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [recent, setRecent] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const [ordersRes, productsRes, customersRes, recentRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, total, status, created_at")
          .gte("created_at", sevenDaysAgo.toISOString()),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase
          .from("orders")
          .select("id, total, status, created_at")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      if (cancelled) return;

      const orders = ordersRes.data ?? [];
      const todayOrders = orders.filter(
        (o) => new Date(o.created_at) >= startOfToday,
      );
      const todayRevenue = todayOrders
        .filter((o) => o.status !== "cancelled")
        .reduce((s, o) => s + Number(o.total), 0);
      const weekRevenue = orders
        .filter((o) => o.status !== "cancelled")
        .reduce((s, o) => s + Number(o.total), 0);
      const pendingOrders = orders.filter((o) => o.status === "pending").length;

      // Build last 7 days chart
      const days: ChartPoint[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        d.setHours(0, 0, 0, 0);
        const next = new Date(d);
        next.setDate(d.getDate() + 1);
        const dayOrders = orders.filter((o) => {
          const t = new Date(o.created_at);
          return t >= d && t < next && o.status !== "cancelled";
        });
        days.push({
          day: d.toLocaleDateString("ar-EG", { weekday: "short" }),
          revenue: dayOrders.reduce((s, o) => s + Number(o.total), 0),
          orders: dayOrders.length,
        });
      }

      setStats({
        todayRevenue,
        todayOrders: todayOrders.length,
        pendingOrders,
        customers: customersRes.count ?? 0,
        products: productsRes.count ?? 0,
        weekRevenue,
      });
      setChart(days);
      setRecent((recentRes.data ?? []) as RecentOrder[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">نظرة عامة</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ملخّص أداء المتجر اليوم وآخر 7 أيام
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="إيراد اليوم"
          value={loading ? "—" : `${stats!.todayRevenue.toFixed(2)} ج.م`}
          icon={DollarSign}
          tone="from-emerald-500/15 to-emerald-500/5 text-emerald-600"
        />
        <KpiCard
          label="طلبات اليوم"
          value={loading ? "—" : String(stats!.todayOrders)}
          icon={ShoppingBag}
          tone="from-blue-500/15 to-blue-500/5 text-blue-600"
        />
        <KpiCard
          label="قيد المراجعة"
          value={loading ? "—" : String(stats!.pendingOrders)}
          icon={Clock}
          tone="from-amber-500/15 to-amber-500/5 text-amber-600"
          highlight={!loading && stats!.pendingOrders > 0}
        />
        <KpiCard
          label="إيراد الأسبوع"
          value={loading ? "—" : `${stats!.weekRevenue.toFixed(2)} ج.م`}
          icon={TrendingUp}
          tone="from-violet-500/15 to-violet-500/5 text-violet-600"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="إجمالي العملاء"
          value={loading ? "—" : String(stats!.customers)}
          icon={Users}
          tone="from-pink-500/15 to-pink-500/5 text-pink-600"
        />
        <KpiCard
          label="إجمالي المنتجات"
          value={loading ? "—" : String(stats!.products)}
          icon={Package}
          tone="from-teal-500/15 to-teal-500/5 text-teal-600"
        />
      </div>

      {/* Chart */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">المبيعات — آخر 7 أيام</h2>
            <p className="text-xs text-muted-foreground">إيراد يومي بالجنيه</p>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#rev)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent orders */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">أحدث الطلبات</h2>
          <Link
            to="/admin/orders"
            className="text-xs font-medium text-primary hover:underline"
          >
            عرض الكل
          </Link>
        </div>
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">جارٍ التحميل…</div>
        ) : recent.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">لا توجد طلبات بعد</div>
        ) : (
          <div className="divide-y divide-border">
            {recent.map((o) => (
              <div key={o.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <div className="font-mono text-xs text-muted-foreground">
                    #{o.id.slice(0, 8)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleString("ar-EG", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                      STATUS_TONE[o.status] ?? "bg-muted text-muted-foreground",
                    )}
                  >
                    {STATUS_AR[o.status] ?? o.status}
                  </span>
                  <div className="text-sm font-semibold">{Number(o.total).toFixed(2)} ج.م</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
  highlight,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-soft transition-shadow hover:shadow-tile",
        highlight && "ring-2 ring-amber-500/40",
      )}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-60", tone)} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-xl bg-card/70")}>
            <Icon className={cn("h-4 w-4", tone.split(" ").pop())} />
          </div>
        </div>
        <div className="mt-3 text-xl font-bold tracking-tight lg:text-2xl">{value}</div>
      </div>
    </div>
  );
}