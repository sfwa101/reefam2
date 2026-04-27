import { useState } from "react";
import BackHeader from "@/components/BackHeader";
import { CreditCard, Wallet, Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";

type Method =
  | { id: string; type: "card"; brand: string; last4: string; isDefault?: boolean }
  | { id: string; type: "wallet"; brand: "محفظة ريف"; balance: number; isDefault?: boolean };

const initial: Method[] = [
  { id: "w1", type: "wallet", brand: "محفظة ريف", balance: 725, isDefault: true },
  { id: "c1", type: "card", brand: "Visa", last4: "4242" },
  { id: "c2", type: "card", brand: "Mastercard", last4: "1881" },
];

const Payments = () => {
  const [list, setList] = useState<Method[]>(initial);
  const setDefault = (id: string) => {
    setList((p) => p.map((m) => ({ ...m, isDefault: m.id === id })));
    toast.success("تم تعيين وسيلة الدفع الافتراضية");
  };
  const remove = (id: string) => {
    setList((p) => p.filter((m) => m.id !== id));
    toast("تم الحذف");
  };

  return (
    <div className="space-y-5">
      <BackHeader title="وسائل الدفع" subtitle="بطاقاتك ومحفظتك" accent="حسابي" />

      <div className="space-y-3">
        {list.map((m) => (
          <div key={m.id} className={`glass-strong rounded-2xl p-4 shadow-soft ${m.isDefault ? "ring-2 ring-primary" : ""}`}>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-foreground to-foreground/70 text-background">
                {m.type === "card" ? <CreditCard className="h-5 w-5" /> : <Wallet className="h-5 w-5" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-display text-sm font-extrabold">
                    {m.type === "card" ? `${m.brand} •••• ${m.last4}` : m.brand}
                  </p>
                  {m.isDefault && <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold text-primary-foreground">افتراضي</span>}
                </div>
                {m.type === "wallet" && <p className="text-[11px] text-muted-foreground">رصيد {m.balance} ج.م</p>}
                {m.type === "card" && <p className="text-[11px] text-muted-foreground">تنتهي 12/27</p>}
              </div>
              <div className="flex gap-1">
                {!m.isDefault && (
                  <button onClick={() => setDefault(m.id)} className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground/5">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
                {m.type === "card" && (
                  <button onClick={() => remove(m.id)} className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => toast("سيتم فتح نموذج إضافة بطاقة جديدة")}
        className="glass flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold text-primary shadow-soft"
      >
        <Plus className="h-4 w-4" /> إضافة بطاقة جديدة
      </button>
    </div>
  );
};

export default Payments;
