import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { fmtMoney } from "@/lib/format";
import { Loader2, ShieldAlert, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { MobileTopbar } from "@/components/admin/MobileTopbar";

type Req = {
  id: string; user_id: string; kind: string; amount: number; reason: string;
  status: string; created_at: string; branch_id: string | null;
  rejection_reason: string | null;
};
type Profile = { id: string; full_name: string | null; phone: string | null };

const KIND: Record<string, string> = { advance: "سلفة", petty_cash: "نثرية", reimbursement: "استرداد" };

export default function AdvanceApprovals() {
  const { role, loading: roleLoading } = useUserRole();
  const allowed = role === "admin" || role === "finance" || role === "branch_manager";
  const [rows, setRows] = useState<Req[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("staff_advance_requests")
      .select("id, user_id, kind, amount, reason, status, created_at, branch_id, rejection_reason")
      .order("created_at", { ascending: false }).limit(100);
    if (filter === "pending") q = q.eq("status", "pending");
    const { data } = await q;
    const list = (data as Req[]) ?? [];
    setRows(list);
    if (list.length) {
      const ids = Array.from(new Set(list.map((r) => r.user_id)));
      const { data: profs } = await supabase.from("profiles").select("id, full_name, phone").in("id", ids);
      const map: Record<string, Profile> = {};
      (profs ?? []).forEach((p) => { map[p.id] = p as Profile; });
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => { if (allowed) load(); }, [allowed, filter]);

  const approve = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase.rpc("approve_advance_request", { _request_id: id });
    if (error) toast.error(error.message); else { toast.success("تمت الموافقة"); load(); }
    setBusyId(null);
  };
  const reject = async (id: string) => {
    const reason = window.prompt("سبب الرفض؟");
    if (!reason) return;
    setBusyId(id);
    const { error } = await supabase.rpc("reject_advance_request", { _request_id: id, _reason: reason });
    if (error) toast.error(error.message); else { toast.success("تم الرفض"); load(); }
    setBusyId(null);
  };

  if (roleLoading) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!allowed) return (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div><ShieldAlert className="mx-auto h-12 w-12 text-destructive" /><p className="mt-3 font-bold">صلاحية مدير مطلوبة</p></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <MobileTopbar title="طلبات السلف والنثريّة" />
      <main className="p-4">
        <div className="mb-3 flex gap-2">
          <button onClick={() => setFilter("pending")} className={`rounded-full px-4 py-1.5 text-xs font-bold ${filter === "pending" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>قيد المراجعة</button>
          <button onClick={() => setFilter("all")} className={`rounded-full px-4 py-1.5 text-xs font-bold ${filter === "all" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>الكل</button>
        </div>

        {loading ? (
          <div className="grid place-items-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">لا توجد طلبات</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => {
              const p = profiles[r.user_id];
              return (
                <li key={r.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold">{p?.full_name ?? "موظف"}</p>
                      <p className="text-[11px] text-muted-foreground" dir="ltr">{p?.phone ?? ""}</p>
                      <p className="mt-1 text-sm">{KIND[r.kind] ?? r.kind} — <span className="font-display font-extrabold text-primary">{fmtMoney(r.amount)}</span></p>
                      <p className="mt-1 text-xs text-muted-foreground">{r.reason}</p>
                    </div>
                    <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      r.status === "approved" || r.status === "paid" ? "bg-success/15 text-success" :
                      r.status === "rejected" ? "bg-destructive/15 text-destructive" :
                      "bg-warning/15 text-warning"
                    }`}>
                      {r.status === "approved" || r.status === "paid" ? <CheckCircle2 className="h-3 w-3" /> :
                       r.status === "rejected" ? <XCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {r.status === "pending" ? "معلق" : r.status === "approved" ? "موافق" : r.status === "rejected" ? "مرفوض" : "مدفوع"}
                    </span>
                  </div>
                  {r.status === "pending" && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button disabled={busyId === r.id} onClick={() => approve(r.id)}
                        className="rounded-full bg-success py-2 text-xs font-bold text-success-foreground disabled:opacity-50">
                        <CheckCircle2 className="me-1 inline h-3.5 w-3.5" /> موافقة
                      </button>
                      <button disabled={busyId === r.id} onClick={() => reject(r.id)}
                        className="rounded-full bg-destructive py-2 text-xs font-bold text-destructive-foreground disabled:opacity-50">
                        <XCircle className="me-1 inline h-3.5 w-3.5" /> رفض
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
