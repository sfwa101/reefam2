import { useEffect, useMemo, useState } from "react";
import { Megaphone, Tag, Zap, Image as ImageIcon, Plus, Trash2, Pencil, Power, Loader2, Calendar, Percent, ShoppingBag } from "lucide-react";
import { MobileTopbar } from "@/components/admin/MobileTopbar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";

// -------------------------------------------------------------
// Marketing Hub — central control for Banners, Coupons, Flash Sales
// Built on top of UniversalAdminGrid principles (KPI tiles + table)
// -------------------------------------------------------------

type TabKey = "banners" | "coupons" | "flash";

const PLACEMENTS: { value: string; label: string }[] = [
  { value: "hero", label: "الواجهة الرئيسية" },
  { value: "category_middle", label: "وسط الأقسام" },
  { value: "cart_top", label: "أعلى السلة" },
  { value: "home_strip", label: "شريط الصفحة" },
];

const TIERS = ["bronze", "silver", "gold", "platinum"];

export default function Marketing() {
  const [tab, setTab] = useState<TabKey>("banners");

  return (
    <>
      <MobileTopbar title="مركز التسويق" />
      <div className="hidden lg:block px-6 pt-8 pb-3 max-w-[1400px] mx-auto">
        <h1 className="font-display text-[30px] tracking-tight">مركز التسويق</h1>
        <p className="text-[13px] text-foreground-secondary mt-1">
          البانرات الحية، الكوبونات الذكية، وعروض الفلاش — كل شيء في واجهة واحدة.
        </p>
      </div>

      <div className="px-4 lg:px-6 pt-3 pb-10 max-w-[1400px] mx-auto">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-12 bg-surface-muted rounded-2xl p-1 mb-5">
            <TabsTrigger value="banners" className="rounded-xl gap-2 text-[13px]">
              <ImageIcon className="h-4 w-4" /> البانرات
            </TabsTrigger>
            <TabsTrigger value="flash" className="rounded-xl gap-2 text-[13px]">
              <Zap className="h-4 w-4" /> عروض الفلاش
            </TabsTrigger>
            <TabsTrigger value="coupons" className="rounded-xl gap-2 text-[13px]">
              <Tag className="h-4 w-4" /> الكوبونات
            </TabsTrigger>
          </TabsList>

          <TabsContent value="banners" className="mt-0"><BannersPanel /></TabsContent>
          <TabsContent value="flash" className="mt-0"><FlashPanel /></TabsContent>
          <TabsContent value="coupons" className="mt-0"><CouponsPanel /></TabsContent>
        </Tabs>
      </div>
    </>
  );
}

// =============================================================
// KPI tile (lightweight, matches UniversalAdminGrid Bento style)
// =============================================================
function Kpi({ icon: Icon, label, value, tone = "primary" }: { icon: any; label: string; value: string | number; tone?: string }) {
  const tones: Record<string, string> = {
    primary: "from-primary to-primary-glow",
    success: "from-[hsl(var(--success))] to-[hsl(var(--teal))]",
    warning: "from-[hsl(var(--accent))] to-[hsl(20_100%_55%)]",
    info: "from-[hsl(var(--info))] to-[hsl(var(--indigo))]",
  };
  return (
    <div className="rounded-3xl p-4 bg-card border border-border/50 shadow-soft">
      <div className={cn("h-9 w-9 rounded-xl bg-gradient-to-br text-white flex items-center justify-center mb-3 shadow-sm", tones[tone])}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={2.5} />
      </div>
      <p className="text-[11px] text-foreground-tertiary leading-tight">{label}</p>
      <p className="font-display text-[20px] num leading-tight mt-0.5">{value}</p>
    </div>
  );
}

// =============================================================
// BANNERS
// =============================================================
function BannersPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("banners").select("*").order("sort_order", { ascending: true });
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const metrics = useMemo(() => ({
    total: rows.length,
    active: rows.filter((r) => r.is_active).length,
    hero: rows.filter((r) => r.placement === "hero").length,
  }), [rows]);

  const toggleActive = async (row: any) => {
    const { error } = await (supabase as any).from("banners").update({ is_active: !row.is_active }).eq("id", row.id);
    if (error) toast.error("تعذر التحديث"); else { toast.success(row.is_active ? "تم الإيقاف" : "تم التفعيل"); load(); }
  };
  const remove = async (row: any) => {
    if (!confirm("حذف البانر؟")) return;
    const { error } = await (supabase as any).from("banners").delete().eq("id", row.id);
    if (error) toast.error("فشل الحذف"); else { toast.success("تم الحذف"); load(); }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 lg:gap-4">
        <Kpi icon={ImageIcon} label="إجمالي البانرات" value={fmtNum(metrics.total)} tone="primary" />
        <Kpi icon={Power} label="بانرات نشطة" value={fmtNum(metrics.active)} tone="success" />
        <Kpi icon={Megaphone} label="في الواجهة الرئيسية" value={fmtNum(metrics.hero)} tone="info" />
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => { setEditing(null); setOpen(true); }}
          className="h-10 px-4 rounded-2xl bg-primary text-primary-foreground text-[13px] font-semibold press inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> بانر جديد
        </button>
      </div>

      <section className="bg-surface rounded-3xl border border-border/50 shadow-soft overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <ImageIcon className="h-10 w-10 mx-auto mb-2 text-foreground-tertiary opacity-50" />
            <p className="font-display text-[15px]">لا توجد بانرات</p>
            <p className="text-[12px] text-foreground-tertiary mt-1">ابدأ بإضافة أول بانر ترويجي</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {rows.map((r) => (
              <div key={r.id} className="px-4 lg:px-5 py-3 flex items-center gap-3">
                <div className="h-14 w-20 rounded-xl overflow-hidden bg-surface-muted shrink-0 border border-border/50">
                  {r.image_url ? <img src={r.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="h-5 w-5 text-foreground-tertiary" /></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-[14px] truncate">{r.title}</p>
                  <p className="text-[11.5px] text-foreground-tertiary truncate">
                    {PLACEMENTS.find((p) => p.value === r.placement)?.label ?? r.placement}
                    {r.link_url && " • " + r.link_url}
                  </p>
                </div>
                <span className={cn("h-2 w-2 rounded-full", r.is_active ? "bg-success" : "bg-foreground-tertiary")} />
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggleActive(r)} className="h-8 w-8 rounded-xl border border-border/60 inline-flex items-center justify-center press"><Power className="h-3.5 w-3.5" /></button>
                  <button onClick={() => { setEditing(r); setOpen(true); }} className="h-8 w-8 rounded-xl bg-primary-soft text-primary border border-primary/20 inline-flex items-center justify-center press"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => remove(r)} className="h-8 w-8 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 inline-flex items-center justify-center press"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <BannerDialog open={open} setOpen={setOpen} editing={editing} onSaved={load} />
    </div>
  );
}

function BannerDialog({ open, setOpen, editing, onSaved }: { open: boolean; setOpen: (b: boolean) => void; editing: any; onSaved: () => void }) {
  const [form, setForm] = useState<any>({ title: "", subtitle: "", image_url: "", placement: "hero", link_url: "", category_slug: "", sort_order: 0, is_active: true });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) setForm({ ...editing });
    else setForm({ title: "", subtitle: "", image_url: "", placement: "hero", link_url: "", category_slug: "", sort_order: 0, is_active: true });
  }, [editing, open]);

  const upload = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("marketing-banners").upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) { toast.error("فشل الرفع"); setUploading(false); return; }
    const { data } = supabase.storage.from("marketing-banners").getPublicUrl(path);
    setForm((f: any) => ({ ...f, image_url: data.publicUrl }));
    setUploading(false);
    toast.success("تم رفع الصورة");
  };

  const save = async () => {
    if (!form.title || !form.image_url) { toast.error("العنوان والصورة مطلوبان"); return; }
    setSaving(true);
    const payload = { ...form, sort_order: Number(form.sort_order) || 0 };
    delete payload.created_at; delete payload.updated_at;
    const res = editing
      ? await (supabase as any).from("banners").update(payload).eq("id", editing.id)
      : await (supabase as any).from("banners").insert(payload);
    setSaving(false);
    if (res.error) toast.error("فشل الحفظ"); else { toast.success("تم الحفظ"); setOpen(false); onSaved(); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? "تعديل البانر" : "بانر جديد"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="الصورة">
            <div className="space-y-2">
              {form.image_url && <img src={form.image_url} alt="" className="w-full h-32 object-cover rounded-xl border border-border/50" />}
              <label className="flex items-center justify-center h-10 rounded-xl border border-dashed border-border bg-surface cursor-pointer text-[13px] press">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : (form.image_url ? "تغيير الصورة" : "رفع صورة")}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              </label>
            </div>
          </Field>
          <Field label="العنوان"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="العنوان الفرعي"><Input value={form.subtitle ?? ""} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} /></Field>
          <Field label="مكان الظهور">
            <select value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value })} className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-[13.5px]">
              {PLACEMENTS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="رابط الانتقال (اختياري)"><Input placeholder="/store/meat" value={form.link_url ?? ""} onChange={(e) => setForm({ ...form, link_url: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="الترتيب"><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></Field>
            <Field label="الحالة">
              <button type="button" onClick={() => setForm({ ...form, is_active: !form.is_active })} className={cn("w-full h-10 rounded-md text-[13px] font-semibold border", form.is_active ? "bg-success/10 text-success border-success/20" : "bg-surface-muted border-border/60")}>{form.is_active ? "نشط" : "موقوف"}</button>
            </Field>
          </div>
        </div>
        <DialogFooter>
          <button onClick={() => setOpen(false)} className="h-10 px-4 rounded-xl border border-border/60 text-[13px]">إلغاء</button>
          <button onClick={save} disabled={saving} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold disabled:opacity-50">{saving ? "حفظ..." : "حفظ"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================
// COUPONS
// =============================================================
function CouponsPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("coupons").select("*").order("created_at", { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const metrics = useMemo(() => ({
    total: rows.length,
    active: rows.filter((r) => r.is_active).length,
    used: rows.reduce((s, r) => s + (r.uses_count ?? 0), 0),
  }), [rows]);

  const toggleActive = async (row: any) => {
    const { error } = await (supabase as any).from("coupons").update({ is_active: !row.is_active }).eq("id", row.id);
    if (error) toast.error("تعذر التحديث"); else load();
  };
  const remove = async (row: any) => {
    if (!confirm("حذف الكوبون؟")) return;
    const { error } = await (supabase as any).from("coupons").delete().eq("id", row.id);
    if (error) toast.error("فشل الحذف"); else { toast.success("تم الحذف"); load(); }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 lg:gap-4">
        <Kpi icon={Tag} label="إجمالي الكوبونات" value={fmtNum(metrics.total)} tone="primary" />
        <Kpi icon={Power} label="نشطة" value={fmtNum(metrics.active)} tone="success" />
        <Kpi icon={ShoppingBag} label="مرات الاستخدام" value={fmtNum(metrics.used)} tone="info" />
      </div>

      <div className="flex justify-end">
        <button onClick={() => { setEditing(null); setOpen(true); }} className="h-10 px-4 rounded-2xl bg-primary text-primary-foreground text-[13px] font-semibold press inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> كوبون جديد
        </button>
      </div>

      <section className="bg-surface rounded-3xl border border-border/50 shadow-soft overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center"><Tag className="h-10 w-10 mx-auto mb-2 text-foreground-tertiary opacity-50" /><p className="font-display text-[15px]">لا توجد كوبونات</p></div>
        ) : (
          <div className="divide-y divide-border/40">
            {rows.map((r) => (
              <div key={r.id} className="px-4 lg:px-5 py-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center shrink-0"><Tag className="h-5 w-5" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-[14px] truncate">{r.code}</p>
                  <p className="text-[11.5px] text-foreground-tertiary truncate">
                    {r.discount_amount ? `${fmtNum(r.discount_amount)} ج.م` : `${r.discount_pct}%`}
                    {r.min_order_total ? ` • حد أدنى ${fmtNum(r.min_order_total)}` : ""}
                    {r.min_user_level && r.min_user_level !== "bronze" ? ` • ${r.min_user_level}+` : ""}
                  </p>
                </div>
                <div className="text-left shrink-0 hidden md:block">
                  <p className="text-[11px] text-foreground-tertiary">استخدام</p>
                  <p className="font-display text-[13px] num">{fmtNum(r.uses_count ?? 0)}{r.max_uses ? `/${r.max_uses}` : ""}</p>
                </div>
                <span className={cn("h-2 w-2 rounded-full", r.is_active ? "bg-success" : "bg-foreground-tertiary")} />
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggleActive(r)} className="h-8 w-8 rounded-xl border border-border/60 inline-flex items-center justify-center press"><Power className="h-3.5 w-3.5" /></button>
                  <button onClick={() => { setEditing(r); setOpen(true); }} className="h-8 w-8 rounded-xl bg-primary-soft text-primary border border-primary/20 inline-flex items-center justify-center press"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => remove(r)} className="h-8 w-8 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 inline-flex items-center justify-center press"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <CouponDialog open={open} setOpen={setOpen} editing={editing} onSaved={load} />
    </div>
  );
}

function CouponDialog({ open, setOpen, editing, onSaved }: { open: boolean; setOpen: (b: boolean) => void; editing: any; onSaved: () => void }) {
  const [form, setForm] = useState<any>({ code: "", description: "", discount_pct: 10, discount_amount: null, min_order_total: null, min_user_level: "bronze", per_user_limit: 1, max_uses: null, ends_at: "", is_active: true, type: "pct" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({ ...editing, type: editing.discount_amount ? "amount" : "pct", ends_at: editing.ends_at ? editing.ends_at.slice(0, 16) : "" });
    } else {
      setForm({ code: "", description: "", discount_pct: 10, discount_amount: null, min_order_total: null, min_user_level: "bronze", per_user_limit: 1, max_uses: null, ends_at: "", is_active: true, type: "pct" });
    }
  }, [editing, open]);

  const save = async () => {
    if (!form.code) { toast.error("الكود مطلوب"); return; }
    setSaving(true);
    const payload: any = {
      code: form.code.toUpperCase(),
      description: form.description || null,
      discount_pct: form.type === "pct" ? Number(form.discount_pct) : 0,
      discount_amount: form.type === "amount" ? Number(form.discount_amount) : null,
      min_order_total: form.min_order_total ? Number(form.min_order_total) : null,
      min_user_level: form.min_user_level,
      per_user_limit: Number(form.per_user_limit) || 1,
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      is_active: form.is_active,
    };
    const res = editing
      ? await (supabase as any).from("coupons").update(payload).eq("id", editing.id)
      : await (supabase as any).from("coupons").insert(payload);
    setSaving(false);
    if (res.error) toast.error("فشل الحفظ: " + res.error.message); else { toast.success("تم الحفظ"); setOpen(false); onSaved(); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? "تعديل الكوبون" : "كوبون جديد"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="الكود"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="REEF20" /></Field>
          <Field label="الوصف"><Input value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="نوع الخصم">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setForm({ ...form, type: "pct" })} className={cn("h-10 rounded-xl text-[13px] font-semibold border", form.type === "pct" ? "bg-primary-soft text-primary border-primary/30" : "bg-surface border-border/60")}><Percent className="h-4 w-4 inline -mt-0.5 ml-1" />نسبة %</button>
              <button type="button" onClick={() => setForm({ ...form, type: "amount" })} className={cn("h-10 rounded-xl text-[13px] font-semibold border", form.type === "amount" ? "bg-primary-soft text-primary border-primary/30" : "bg-surface border-border/60")}>مبلغ ثابت</button>
            </div>
          </Field>
          {form.type === "pct" ? (
            <Field label="نسبة الخصم %"><Input type="number" value={form.discount_pct} onChange={(e) => setForm({ ...form, discount_pct: e.target.value })} /></Field>
          ) : (
            <Field label="مبلغ الخصم (ج.م)"><Input type="number" value={form.discount_amount ?? ""} onChange={(e) => setForm({ ...form, discount_amount: e.target.value })} /></Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="الحد الأدنى للطلب"><Input type="number" value={form.min_order_total ?? ""} onChange={(e) => setForm({ ...form, min_order_total: e.target.value })} /></Field>
            <Field label="حد لكل عميل"><Input type="number" value={form.per_user_limit} onChange={(e) => setForm({ ...form, per_user_limit: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="مستوى العميل (VIP)">
              <select value={form.min_user_level} onChange={(e) => setForm({ ...form, min_user_level: e.target.value })} className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-[13.5px]">
                {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="إجمالي الاستخدام"><Input type="number" placeholder="∞" value={form.max_uses ?? ""} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} /></Field>
          </div>
          <Field label="تاريخ الانتهاء"><Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></Field>
        </div>
        <DialogFooter>
          <button onClick={() => setOpen(false)} className="h-10 px-4 rounded-xl border border-border/60 text-[13px]">إلغاء</button>
          <button onClick={save} disabled={saving} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold disabled:opacity-50">{saving ? "حفظ..." : "حفظ"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================
// FLASH SALES
// =============================================================
function FlashPanel() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [activeSale, setActiveSale] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: sales } = await (supabase as any).from("flash_sales").select("*").eq("is_active", true).order("starts_at", { ascending: false }).limit(1);
    const sale = sales?.[0] ?? null;
    setActiveSale(sale);
    if (sale) {
      const { data } = await (supabase as any).from("flash_sale_products").select("*").eq("flash_sale_id", sale.id).order("rank");
      setProducts(data ?? []);
    } else setProducts([]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const ensureSale = async () => {
    if (activeSale) return activeSale;
    const ends = new Date(); ends.setHours(ends.getHours() + 24);
    const { data, error } = await (supabase as any).from("flash_sales").insert({ ends_at: ends.toISOString(), is_active: true, cycle_label: "Flash 24h" }).select().single();
    if (error) { toast.error("تعذر إنشاء الحملة"); return null; }
    setActiveSale(data);
    return data;
  };

  const remove = async (row: any) => {
    if (!confirm("إزالة من العرض؟")) return;
    const { error } = await (supabase as any).from("flash_sale_products").delete().eq("id", row.id);
    if (error) toast.error("فشل الحذف"); else load();
  };

  const endSale = async () => {
    if (!activeSale) return;
    if (!confirm("إنهاء حملة الفلاش الحالية؟")) return;
    await (supabase as any).from("flash_sales").update({ is_active: false, ends_at: new Date().toISOString() }).eq("id", activeSale.id);
    toast.success("تم إنهاء الحملة"); load();
  };

  const metrics = useMemo(() => {
    const avgDisc = products.length ? products.reduce((s, p) => s + Number(p.discount_pct || 0), 0) / products.length : 0;
    return { count: products.length, avgDisc: avgDisc.toFixed(0), endsIn: activeSale?.ends_at ?? null };
  }, [products, activeSale]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 lg:gap-4">
        <Kpi icon={Zap} label="منتجات في العرض" value={fmtNum(metrics.count)} tone="warning" />
        <Kpi icon={Percent} label="متوسط الخصم" value={`${metrics.avgDisc}%`} tone="success" />
        <Kpi icon={Calendar} label="ينتهي" value={metrics.endsIn ? new Date(metrics.endsIn).toLocaleString("ar-EG", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }) : "—"} tone="info" />
      </div>

      <div className="flex justify-between items-center gap-2 flex-wrap">
        {activeSale ? (
          <CountdownPill endsAt={activeSale.ends_at} />
        ) : (
          <span className="text-[12px] text-foreground-tertiary">لا توجد حملة نشطة — أضف منتجاً لبدء حملة جديدة.</span>
        )}
        <div className="flex items-center gap-2">
          {activeSale && <button onClick={endSale} className="h-10 px-3 rounded-2xl border border-destructive/30 text-destructive text-[12.5px] font-semibold press">إنهاء الحملة</button>}
          <button onClick={() => { setEditing(null); setOpen(true); }} className="h-10 px-4 rounded-2xl bg-primary text-primary-foreground text-[13px] font-semibold press inline-flex items-center gap-2">
            <Plus className="h-4 w-4" /> منتج للفلاش
          </button>
        </div>
      </div>

      <section className="bg-surface rounded-3xl border border-border/50 shadow-soft overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}</div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center"><Zap className="h-10 w-10 mx-auto mb-2 text-foreground-tertiary opacity-50" /><p className="font-display text-[15px]">لا توجد منتجات في الفلاش</p></div>
        ) : (
          <div className="divide-y divide-border/40">
            {products.map((p) => (
              <div key={p.id} className="px-4 lg:px-5 py-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))] flex items-center justify-center shrink-0"><Zap className="h-5 w-5" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-[14px] truncate">{p.product_name ?? p.product_id}</p>
                  <p className="text-[11.5px] text-foreground-tertiary">من {fmtNum(p.original_price)} • خصم {p.discount_pct}%</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => remove(p)} className="h-8 w-8 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 inline-flex items-center justify-center press"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <FlashDialog open={open} setOpen={setOpen} editing={editing} ensureSale={ensureSale} onSaved={load} />
    </div>
  );
}

function CountdownPill({ endsAt }: { endsAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const diff = new Date(endsAt).getTime() - now;
  if (diff <= 0) return <span className="text-[12px] text-destructive">انتهت الحملة</span>;
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return (
    <div className="inline-flex items-center gap-2 h-10 px-3 rounded-2xl bg-[hsl(var(--accent))]/10 border border-[hsl(var(--accent))]/30 text-[hsl(var(--accent))]">
      <Zap className="h-4 w-4" />
      <span className="font-display num text-[13px]">{String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</span>
    </div>
  );
}

function FlashDialog({ open, setOpen, editing, ensureSale, onSaved }: { open: boolean; setOpen: (b: boolean) => void; editing: any; ensureSale: () => Promise<any>; onSaved: () => void }) {
  const [form, setForm] = useState<any>({ product_id: "", product_name: "", category: "", original_price: 0, discount_pct: 20, reason: "", rank: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) setForm({ ...editing });
    else setForm({ product_id: "", product_name: "", category: "", original_price: 0, discount_pct: 20, reason: "", rank: 0 });
  }, [editing, open]);

  const save = async () => {
    if (!form.product_id || !form.original_price) { toast.error("المنتج والسعر مطلوبان"); return; }
    setSaving(true);
    const sale = await ensureSale();
    if (!sale) { setSaving(false); return; }
    const payload = {
      flash_sale_id: sale.id,
      product_id: form.product_id,
      product_name: form.product_name || null,
      category: form.category || null,
      original_price: Number(form.original_price),
      discount_pct: Number(form.discount_pct),
      reason: form.reason || null,
      rank: Number(form.rank) || 0,
    };
    const { error } = await (supabase as any).from("flash_sale_products").insert(payload);
    setSaving(false);
    if (error) toast.error("فشل الحفظ"); else { toast.success("تمت الإضافة"); setOpen(false); onSaved(); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>إضافة منتج لعرض الفلاش</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="معرّف المنتج"><Input value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} placeholder="apple" /></Field>
          <Field label="اسم المنتج"><Input value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="السعر الأصلي"><Input type="number" value={form.original_price} onChange={(e) => setForm({ ...form, original_price: e.target.value })} /></Field>
            <Field label="نسبة الخصم %"><Input type="number" value={form.discount_pct} onChange={(e) => setForm({ ...form, discount_pct: e.target.value })} /></Field>
          </div>
          <Field label="القسم"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="meat" /></Field>
          <Field label="السبب / الوسم"><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="عرض اليوم" /></Field>
        </div>
        <DialogFooter>
          <button onClick={() => setOpen(false)} className="h-10 px-4 rounded-xl border border-border/60 text-[13px]">إلغاء</button>
          <button onClick={save} disabled={saving} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold disabled:opacity-50">{saving ? "حفظ..." : "إضافة"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[12px] text-foreground-secondary">{label}</label>
      {children}
    </div>
  );
}
