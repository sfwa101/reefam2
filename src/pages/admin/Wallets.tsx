import { useEffect, useMemo, useState } from "react";
import { Search, Wallet as WalletIcon, Plus, Minus, X, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Profile = { id: string; full_name: string | null; phone: string | null };
type Wallet = { user_id: string; balance: number; points: number };
type Tx = {
  id: string;
  user_id: string;
  kind: string;
  label: string;
  amount: number;
  source: string | null;
  created_at: string;
};

export default function AdminWallets() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [wallets, setWallets] = useState<Record<string, Wallet>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Profile | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, phone")
      .order("created_at", { ascending: false })
      .limit(500);
    const list = (profs ?? []) as Profile[];
    setProfiles(list);
    const ids = list.map((p) => p.id);
    if (ids.length > 0) {
      const { data: w } = await supabase
        .from("wallet_balances")
        .select("user_id, balance, points")
        .in("user_id", ids);
      const map: Record<string, Wallet> = {};
      (w ?? []).forEach((r: any) => {
        map[r.user_id] = {
          user_id: r.user_id,
          balance: Number(r.balance ?? 0),
          points: Number(r.points ?? 0),
        };
      });
      setWallets(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return profiles.filter((p) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (p.full_name ?? "").toLowerCase().includes(q) ||
        (p.phone ?? "").includes(q)
      );
    });
  }, [profiles, search]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">المحافظ والنقاط</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          إيداع أو خصم رصيد ونقاط للعملاء
        </p>
      </div>

      <div className="rounded-3xl border border-border bg-card p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم أو الهاتف…"
            className="w-full rounded-2xl border border-border bg-background py-2.5 pe-10 ps-3 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">جارٍ التحميل…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">لا يوجد عملاء</div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((p) => {
              const w = wallets[p.id] ?? { balance: 0, points: 0 };
              return (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className="flex w-full items-center gap-4 p-4 text-right transition-colors hover:bg-muted/40"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <WalletIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p.full_name || "—"}</div>
                    <div className="truncate text-xs text-muted-foreground">{p.phone || "—"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{Number(w.balance).toFixed(2)} ج.م</div>
                    <div className="text-xs text-muted-foreground">{w.points} نقطة</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <WalletDrawer
          profile={selected}
          wallet={wallets[selected.id]}
          onClose={() => setSelected(null)}
          onChanged={() => {
            load();
          }}
        />
      )}
    </div>
  );
}

function WalletDrawer({
  profile,
  wallet,
  onClose,
  onChanged,
}: {
  profile: Profile;
  wallet?: Wallet;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<"credit" | "debit">("credit");
  const [points, setPoints] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Tx[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const balance = Number(wallet?.balance ?? 0);
  const userPoints = Number(wallet?.points ?? 0);

  useEffect(() => {
    (async () => {
      setLoadingHistory(true);
      const { data } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setHistory((data ?? []) as Tx[]);
      setLoadingHistory(false);
    })();
  }, [profile.id]);

  const handleAmountSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast.error("أدخل مبلغًا صحيحًا");
      return;
    }
    if (!label.trim()) {
      toast.error("أدخل وصفًا للعملية");
      return;
    }
    setBusy(true);
    const newBalance = kind === "credit" ? balance + amt : Math.max(0, balance - amt);
    const { error: upErr } = await supabase
      .from("wallet_balances")
      .upsert({
        user_id: profile.id,
        balance: newBalance,
        points: userPoints,
        updated_at: new Date().toISOString(),
      });
    if (upErr) {
      toast.error("تعذّر تحديث الرصيد: " + upErr.message);
      setBusy(false);
      return;
    }
    const { error: txErr } = await supabase.from("wallet_transactions").insert({
      user_id: profile.id,
      kind,
      label: label.trim(),
      amount: amt,
      source: "admin_manual",
    });
    if (txErr) {
      toast.error("تم تحديث الرصيد لكن لم تُسجَّل العملية: " + txErr.message);
    } else {
      toast.success(kind === "credit" ? "تم إيداع المبلغ" : "تم خصم المبلغ");
    }
    setAmount("");
    setLabel("");
    onChanged();
    setBusy(false);
    onClose();
  };

  const handlePointsSubmit = async (delta: number) => {
    const p = parseInt(points);
    if (!p || p <= 0) {
      toast.error("أدخل عدد نقاط صحيحًا");
      return;
    }
    setBusy(true);
    const newPoints = Math.max(0, userPoints + delta * p);
    const { error } = await supabase.from("wallet_balances").upsert({
      user_id: profile.id,
      balance,
      points: newPoints,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      toast.error("تعذّر التحديث: " + error.message);
    } else {
      toast.success("تم تحديث النقاط");
      onChanged();
      onClose();
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 lg:items-center lg:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card shadow-float lg:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 px-5 py-4 backdrop-blur">
          <div>
            <h2 className="text-base font-bold">{profile.full_name || "—"}</h2>
            <p className="text-xs text-muted-foreground">{profile.phone || "—"}</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-4">
              <div className="text-xs text-muted-foreground">الرصيد الحالي</div>
              <div className="mt-1 text-xl font-bold">{balance.toFixed(2)} ج.م</div>
            </div>
            <div className="rounded-2xl border border-border bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-4">
              <div className="text-xs text-muted-foreground">النقاط</div>
              <div className="mt-1 text-xl font-bold">{userPoints}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-4">
            <h3 className="mb-3 text-sm font-semibold">تعديل الرصيد</h3>
            <div className="mb-3 flex gap-2">
              <button
                onClick={() => setKind("credit")}
                className={cn(
                  "flex-1 rounded-xl px-3 py-2 text-sm font-medium",
                  kind === "credit"
                    ? "bg-emerald-500 text-white"
                    : "border border-border bg-card",
                )}
              >
                <Plus className="mr-1 inline h-3.5 w-3.5" /> إيداع
              </button>
              <button
                onClick={() => setKind("debit")}
                className={cn(
                  "flex-1 rounded-xl px-3 py-2 text-sm font-medium",
                  kind === "debit"
                    ? "bg-rose-500 text-white"
                    : "border border-border bg-card",
                )}
              >
                <Minus className="mr-1 inline h-3.5 w-3.5" /> خصم
              </button>
            </div>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="المبلغ بالجنيه"
              className="mb-2 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="الوصف (مثال: تعويض / مكافأة)"
              className="mb-3 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={handleAmountSubmit}
              disabled={busy}
              className="w-full rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? "جارٍ التنفيذ…" : "تأكيد"}
            </button>
          </div>

          <div className="rounded-2xl border border-border bg-background p-4">
            <h3 className="mb-3 text-sm font-semibold">تعديل النقاط</h3>
            <input
              type="number"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder="عدد النقاط"
              className="mb-3 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <div className="flex gap-2">
              <button
                onClick={() => handlePointsSubmit(1)}
                disabled={busy}
                className="flex-1 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                <Plus className="mr-1 inline h-3.5 w-3.5" /> إضافة
              </button>
              <button
                onClick={() => handlePointsSubmit(-1)}
                disabled={busy}
                className="flex-1 rounded-xl bg-rose-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                <Minus className="mr-1 inline h-3.5 w-3.5" /> خصم
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="mb-3 flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">آخر 20 عملية</h3>
            </div>
            {loadingHistory ? (
              <div className="py-4 text-center text-xs text-muted-foreground">جارٍ التحميل…</div>
            ) : history.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">لا توجد عمليات</div>
            ) : (
              <ul className="divide-y divide-border">
                {history.map((t) => (
                  <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{t.label}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(t.created_at).toLocaleString("ar-EG", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                        {t.source && ` · ${t.source}`}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "shrink-0 font-bold",
                        t.kind === "credit" ? "text-emerald-600" : "text-rose-600",
                      )}
                    >
                      {t.kind === "credit" ? "+" : "−"}
                      {Number(t.amount).toFixed(2)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}