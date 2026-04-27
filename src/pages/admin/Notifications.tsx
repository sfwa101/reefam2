import { useEffect, useState } from "react";
import { Bell, Send, Users as UsersIcon, User as UserIcon, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Profile = { id: string; full_name: string | null; phone: string | null };
type SentNotif = {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  created_at: string;
  read: boolean;
};

export default function AdminNotifications() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [target, setTarget] = useState<"all" | "single">("all");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [icon, setIcon] = useState("bell");
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<SentNotif[]>([]);

  const loadProfiles = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, phone")
      .order("created_at", { ascending: false })
      .limit(500);
    setProfiles((data ?? []) as Profile[]);
  };

  const loadRecent = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id, user_id, title, body, created_at, read")
      .order("created_at", { ascending: false })
      .limit(20);
    setRecent((data ?? []) as SentNotif[]);
  };

  useEffect(() => {
    loadProfiles();
    loadRecent();
  }, []);

  const handleSend = async () => {
    if (!title.trim()) {
      toast.error("أدخل عنوان الإشعار");
      return;
    }
    if (target === "single" && !selectedUser) {
      toast.error("اختر العميل");
      return;
    }
    setBusy(true);
    const userIds =
      target === "all" ? profiles.map((p) => p.id) : [selectedUser!.id];
    const rows = userIds.map((uid) => ({
      user_id: uid,
      title: title.trim(),
      body: body.trim() || null,
      icon,
    }));
    // chunk inserts to avoid payload limits
    const chunkSize = 200;
    let failed = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase.from("notifications").insert(chunk);
      if (error) failed += chunk.length;
    }
    if (failed > 0) {
      toast.error(`فشل إرسال ${failed} إشعار`);
    } else {
      toast.success(
        target === "all"
          ? `تم إرسال الإشعار إلى ${userIds.length} عميل`
          : "تم إرسال الإشعار",
      );
      setTitle("");
      setBody("");
      setSelectedUser(null);
      loadRecent();
    }
    setBusy(false);
  };

  const filteredProfiles = profiles.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (p.full_name ?? "").toLowerCase().includes(q) ||
      (p.phone ?? "").includes(q)
    );
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">الإشعارات</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          أرسل إشعاراً لجميع العملاء أو لعميل محدد
        </p>
      </div>

      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setTarget("all")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors",
              target === "all"
                ? "bg-primary text-primary-foreground shadow-pill"
                : "border border-border bg-background hover:bg-muted",
            )}
          >
            <UsersIcon className="h-4 w-4" />
            جميع العملاء ({profiles.length})
          </button>
          <button
            onClick={() => setTarget("single")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors",
              target === "single"
                ? "bg-primary text-primary-foreground shadow-pill"
                : "border border-border bg-background hover:bg-muted",
            )}
          >
            <UserIcon className="h-4 w-4" />
            عميل محدد
          </button>
        </div>

        {target === "single" && (
          <div className="mb-4">
            <button
              onClick={() => setPickerOpen(true)}
              className="flex w-full items-center justify-between rounded-2xl border border-border bg-background px-4 py-2.5 text-sm hover:bg-muted"
            >
              <span className={selectedUser ? "font-medium" : "text-muted-foreground"}>
                {selectedUser
                  ? `${selectedUser.full_name || "—"} · ${selectedUser.phone || "—"}`
                  : "اختر العميل…"}
              </span>
              <Search className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        )}

        <div className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="عنوان الإشعار *"
            className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="نص الإشعار (اختياري)"
            rows={4}
            className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
          <select
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
          >
            <option value="bell">🔔 جرس</option>
            <option value="gift">🎁 هدية / عرض</option>
            <option value="truck">🚚 توصيل</option>
            <option value="wallet">💰 محفظة</option>
            <option value="info">ℹ️ معلومة</option>
          </select>
        </div>

        <button
          onClick={handleSend}
          disabled={busy}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {busy ? "جارٍ الإرسال…" : "إرسال الإشعار"}
        </button>
      </div>

      {/* Recent */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="mb-4 flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">آخر الإشعارات المرسلة</h2>
        </div>
        {recent.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            لم تُرسل أي إشعارات بعد
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((n) => (
              <li key={n.id} className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{n.title}</div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                      n.read
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/15 text-primary",
                    )}
                  >
                    {n.read ? "مقروء" : "جديد"}
                  </span>
                </div>
                {n.body && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                )}
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(n.created_at).toLocaleString("ar-EG", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 lg:items-center lg:p-4">
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card lg:rounded-3xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card/95 p-4 backdrop-blur">
              <h3 className="text-sm font-bold">اختر العميل</h3>
              <button
                onClick={() => setPickerOpen(false)}
                className="rounded-xl p-2 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4">
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالاسم أو الهاتف…"
                className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <ul className="divide-y divide-border">
              {filteredProfiles.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => {
                      setSelectedUser(p);
                      setPickerOpen(false);
                    }}
                    className="flex w-full items-center justify-between p-4 text-right hover:bg-muted/40"
                  >
                    <div>
                      <div className="font-medium">{p.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{p.phone || "—"}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}