import SinglePageStore, { type StoreCategory } from "@/components/SinglePageStore";
import { products } from "@/lib/products";
import { storeThemes } from "@/lib/storeThemes";
import { Pill, FileText, Phone, Clock } from "lucide-react";
import { toast } from "sonner";

const cats: StoreCategory[] = [
  { id: "all", name: "الكل", match: (p) => p.source === "pharmacy" },
  { id: "vit", name: "فيتامينات", match: (p) => p.source === "pharmacy" && p.category === "فيتامينات" },
  { id: "med", name: "أدوية", match: (p) => p.source === "pharmacy" && p.category === "أدوية" },
  { id: "care", name: "عناية شخصية", match: (p) => p.source === "supermarket" && p.category === "العناية الشخصية" },
  { id: "baby", name: "مستلزمات أطفال", match: (p) => p.source === "supermarket" && p.category === "أطعمة الأطفال" },
];

const Pharmacy = () => {
  const theme = storeThemes.pharmacy;
  return (
    <SinglePageStore
      themeKey="pharmacy"
      title="صيدلية ريف"
      subtitle="صحتك أولوية، توصيل خلال ساعة"
      searchPlaceholder="ابحث عن دواء، فيتامين…"
      products={products}
      categories={cats}
      hero={
        <section className="rounded-[1.75rem] p-5 shadow-tile" style={{ background: theme.gradient }}>
          <span className="text-[10px] font-bold" style={{ color: `hsl(${theme.hue})` }}>خدمة جديدة</span>
          <h2 className="mt-1 font-display text-2xl font-extrabold text-foreground text-balance">
            ارفع وصفتك الطبية<br />ويتم تجهيزها فورًا
          </h2>
        </section>
      }
      intro={
        <div className="mb-3 grid grid-cols-3 gap-3">
          {[
            { icon: FileText, label: "رفع وصفة" },
            { icon: Phone, label: "استشارة" },
            { icon: Clock, label: "تذكير دواء" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.label}
                onClick={() => toast(s.label)}
                className="glass-strong flex flex-col items-center gap-2 rounded-2xl p-3 shadow-soft"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft">
                  <Icon className="h-5 w-5 text-primary" strokeWidth={2.4} />
                </div>
                <span className="text-[11px] font-bold">{s.label}</span>
              </button>
            );
          })}
        </div>
      }
    />
  );
};

export default Pharmacy;
// Re-export icon to ensure tree-shaking happy
export { Pill };
