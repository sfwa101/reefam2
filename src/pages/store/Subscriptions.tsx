import BackHeader from "@/components/BackHeader";
import { Check, Sparkles, Dumbbell, Heart, Calendar, Pause, Settings, Clock, Truck, Leaf, Flame, AlertCircle } from "lucide-react";
import { useMemo, useState } from "react";

type PlanId = "loss" | "maintain" | "muscle" | "family";
const plans: { id: PlanId; title: string; icon: any; calories: string; basePrice: number; color: string; tag: string }[] = [
  { id: "loss", title: "خسارة الوزن", icon: Sparkles, calories: "1200 سعرة/يوم", basePrice: 1850, color: "from-rose-500 to-pink-400", tag: "الأكثر طلبًا" },
  { id: "maintain", title: "الحفاظ على الوزن", icon: Heart, calories: "1800 سعرة/يوم", basePrice: 2200, color: "from-emerald-500 to-teal-400", tag: "متوازن" },
  { id: "muscle", title: "بناء العضلات", icon: Dumbbell, calories: "2400 سعرة/يوم", basePrice: 2650, color: "from-amber-500 to-orange-400", tag: "بروتين عالي" },
  { id: "family", title: "عائلية", icon: Heart, calories: "وجبة لأفراد العائلة", basePrice: 3850, color: "from-violet-500 to-indigo-500", tag: "للعائلات" },
];
const frequencies = [
  { id: "daily", label: "يومي · 7 أيام", multiplier: 1 },
  { id: "5days", label: "5 أيام عمل", multiplier: 0.75 },
  { id: "alt", label: "يوم ويوم", multiplier: 0.55 },
];
const durations = [
  { id: 1, label: "أسبوع", weeks: 1, discount: 0 },
  { id: 4, label: "شهر", weeks: 4, discount: 0.05 },
  { id: 12, label: "3 أشهر", weeks: 12, discount: 0.12 },
];
const dietPrefs = ["نباتي", "بدون جلوتين", "كيتو", "حلال", "خالي لاكتوز"];
const allergies = ["مكسرات", "بيض", "أسماك", "صويا", "قمح"];
const timeSlots = ["7-9 ص", "11-1 م", "5-7 م", "8-10 م"];

const Subscriptions = () => {
  const [planId, setPlanId] = useState<PlanId>("maintain");
  const [freq, setFreq] = useState(frequencies[0].id);
  const [dur, setDur] = useState(durations[1].id);
  const [people, setPeople] = useState(1);
  const [diets, setDiets] = useState<Set<string>>(new Set());
  const [allergic, setAllergic] = useState<Set<string>>(new Set());
  const [slot, setSlot] = useState(timeSlots[1]);
  const [paused, setPaused] = useState(false);

  const plan = plans.find((p) => p.id === planId)!;
  const freqObj = frequencies.find((f) => f.id === freq)!;
  const durObj = durations.find((d) => d.id === dur)!;

  const totalPrice = useMemo(() => {
    const weekly = plan.basePrice * freqObj.multiplier * people;
    const total = weekly * durObj.weeks;
    return Math.round(total * (1 - durObj.discount));
  }, [plan, freqObj, durObj, people]);

  const toggle = (s: Set<string>, set: (n: Set<string>) => void, val: string) => {
    const n = new Set(s); n.has(val) ? n.delete(val) : n.add(val); set(n);
  };

  return (
    <div className="space-y-6">
      <BackHeader title="اشتراكات الريف" subtitle="باقات ذكية ومرنة لكل أسلوب حياة" accent="متجر" themeKey="subscriptions" />

      {/* Hero */}
      <section className="relative overflow-hidden rounded-[1.75rem] p-5 shadow-tile"
        style={{ background: "linear-gradient(135deg, hsl(330 60% 35%), hsl(310 50% 50%) 60%, hsl(45 70% 60%))" }}>
        <div className="absolute -bottom-12 -right-10 h-44 w-44 rounded-full bg-white/15 blur-3xl" />
        <div className="relative">
          <span className="inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur">عرض البداية</span>
          <h2 className="mt-3 font-display text-2xl font-extrabold text-white text-balance">
            خصم 25% على<br />أول شهر اشتراك
          </h2>
          <p className="mt-1 text-xs text-white/85">إيقاف، تعديل، وتغيير في أي وقت</p>
        </div>
      </section>

      {/* Plan picker */}
      <section className="space-y-3">
        <h3 className="px-1 font-display text-xl font-extrabold">1. اختر هدفك</h3>
        <div className="grid grid-cols-2 gap-3">
          {plans.map((p) => {
            const Icon = p.icon;
            const isActive = p.id === planId;
            return (
              <button key={p.id} onClick={() => setPlanId(p.id)}
                className={`relative overflow-hidden rounded-2xl p-3 text-right transition ease-apple ${
                  isActive ? "ring-2 ring-primary shadow-pill" : "glass-strong shadow-soft"
                }`}>
                <div className={`mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${p.color} text-white`}>
                  <Icon className="h-5 w-5" strokeWidth={2.4} />
                </div>
                <p className="font-display text-sm font-extrabold">{p.title}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{p.calories}</p>
                <span className="mt-1 inline-block rounded-full bg-foreground/5 px-2 py-0.5 text-[9px] font-bold">{p.tag}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Frequency */}
      <section className="space-y-3">
        <h3 className="px-1 font-display text-xl font-extrabold">2. التكرار</h3>
        <div className="grid grid-cols-3 gap-2">
          {frequencies.map((f) => {
            const isActive = f.id === freq;
            return (
              <button key={f.id} onClick={() => setFreq(f.id)}
                className={`rounded-2xl py-3 text-center text-[11px] font-bold transition ${
                  isActive ? "bg-primary text-primary-foreground shadow-pill" : "glass text-foreground"
                }`}>{f.label}</button>
            );
          })}
        </div>
      </section>

      {/* Duration */}
      <section className="space-y-3">
        <h3 className="px-1 font-display text-xl font-extrabold">3. مدة الاشتراك</h3>
        <div className="grid grid-cols-3 gap-2">
          {durations.map((d) => {
            const isActive = d.id === dur;
            return (
              <button key={d.id} onClick={() => setDur(d.id)}
                className={`relative rounded-2xl py-3 text-center transition ${
                  isActive ? "bg-foreground text-background shadow-pill" : "glass text-foreground"
                }`}>
                <p className="text-sm font-extrabold">{d.label}</p>
                {d.discount > 0 && (
                  <p className={`text-[10px] ${isActive ? "text-background/80" : "text-primary"}`}>وفر {Math.round(d.discount * 100)}%</p>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* People */}
      <section className="glass-strong flex items-center justify-between rounded-2xl p-4 shadow-soft">
        <div>
          <p className="font-display text-sm font-extrabold">عدد الأفراد</p>
          <p className="text-[11px] text-muted-foreground">يضرب السعر ×{people}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setPeople((p) => Math.max(1, p - 1))} className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground/10">−</button>
          <span className="w-6 text-center font-display text-lg font-extrabold tabular-nums">{people}</span>
          <button onClick={() => setPeople((p) => Math.min(8, p + 1))} className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">+</button>
        </div>
      </section>

      {/* Diet preferences */}
      <section className="space-y-2">
        <h3 className="px-1 font-display text-base font-extrabold flex items-center gap-2">
          <Leaf className="h-4 w-4 text-primary" /> تفضيلات الطعام
        </h3>
        <div className="flex flex-wrap gap-2">
          {dietPrefs.map((d) => {
            const on = diets.has(d);
            return (
              <button key={d} onClick={() => toggle(diets, setDiets, d)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  on ? "bg-primary text-primary-foreground" : "glass"
                }`}>{on && "✓ "}{d}</button>
            );
          })}
        </div>
      </section>

      {/* Allergies */}
      <section className="space-y-2">
        <h3 className="px-1 font-display text-base font-extrabold flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive" /> حساسيات يجب تجنبها
        </h3>
        <div className="flex flex-wrap gap-2">
          {allergies.map((a) => {
            const on = allergic.has(a);
            return (
              <button key={a} onClick={() => toggle(allergic, setAllergic, a)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  on ? "bg-destructive text-destructive-foreground" : "glass"
                }`}>{on ? "✕ " : ""}{a}</button>
            );
          })}
        </div>
      </section>

      {/* Delivery slot */}
      <section className="space-y-2">
        <h3 className="px-1 font-display text-base font-extrabold flex items-center gap-2">
          <Truck className="h-4 w-4 text-primary" /> ميعاد التوصيل
        </h3>
        <div className="grid grid-cols-4 gap-2">
          {timeSlots.map((t) => (
            <button key={t} onClick={() => setSlot(t)}
              className={`rounded-xl py-2 text-[11px] font-bold transition ${
                slot === t ? "bg-foreground text-background" : "glass"
              }`}>{t}</button>
          ))}
        </div>
      </section>

      {/* Pause control */}
      <section className="glass-strong flex items-center justify-between rounded-2xl p-4 shadow-soft">
        <div className="flex items-center gap-3">
          <Pause className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-bold">إيقاف مؤقت</p>
            <p className="text-[10px] text-muted-foreground">أوقف اشتراكك دون إلغاء</p>
          </div>
        </div>
        <button onClick={() => setPaused((p) => !p)}
          className={`relative h-7 w-12 rounded-full transition ${paused ? "bg-primary" : "bg-foreground/15"}`}>
          <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${paused ? "right-0.5" : "right-6"}`} />
        </button>
      </section>

      {/* Features */}
      <section className="glass rounded-2xl p-5 shadow-soft">
        <h3 className="mb-3 font-display text-base font-extrabold">ما يميّز اشتراكات الريف</h3>
        <ul className="space-y-2.5">
          {[
            "شيف خاص يحضّر وجباتك يوميًا",
            "تبديل أي وجبة قبل 24 ساعة",
            "إيقاف، تأجيل، أو تغيير في أي لحظة",
            "تخصيص كامل حسب الحساسيات",
            "توصيل مجاني خلال نافذة محددة",
            "كاش باك 5% على كل اشتراك",
          ].map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={3} /> {f}
            </li>
          ))}
        </ul>
      </section>

      {/* Summary CTA */}
      <section className="glass-strong space-y-3 rounded-[1.5rem] p-4 shadow-float">
        <div className="space-y-1">
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">الباقة</span><span className="font-bold">{plan.title}</span></div>
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">المدة</span><span className="font-bold">{durObj.label}</span></div>
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">التوصيل</span><span className="font-bold">{slot}</span></div>
        </div>
        <div className="flex items-baseline justify-between border-t border-border pt-2">
          <span className="font-display text-sm font-bold">الإجمالي</span>
          <span className="font-display text-2xl font-extrabold text-primary tabular-nums">{totalPrice} ج.م</span>
        </div>
        <button className="w-full rounded-2xl bg-primary py-4 font-bold text-primary-foreground shadow-pill">
          ابدأ اشتراكك الآن
        </button>
      </section>
    </div>
  );
};

export default Subscriptions;
