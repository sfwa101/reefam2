import SinglePageStore, { type StoreCategory } from "@/components/SinglePageStore";
import { products } from "@/lib/products";
import { storeThemes } from "@/lib/storeThemes";
import { Clock, Flame, Truck } from "lucide-react";

const cats: StoreCategory[] = [
  { id: "all", name: "كل الوجبات", match: (p) => p.source === "kitchen" || p.source === "recipes" },
  { id: "meals", name: "أطباق رئيسية", match: (p) => p.source === "kitchen" },
  { id: "recipes", name: "وصفات الشيف", match: (p) => p.source === "recipes" },
];

const Kitchen = () => {
  const theme = storeThemes.kitchen;
  return (
    <SinglePageStore
      themeKey="kitchen"
      title="مطبخ ريف المدينة"
      subtitle="وجبات طازجة كل يوم"
      searchPlaceholder="ابحث في الوجبات…"
      products={products}
      categories={cats}
      hero={
        <section
          className="relative overflow-hidden rounded-[1.75rem] p-5 shadow-tile"
          style={{ background: "linear-gradient(135deg, hsl(20 60% 28%), hsl(15 50% 40%) 60%, hsl(35 70% 60%))" }}
        >
          <div className="absolute -bottom-12 -right-10 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
          <span className="inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur">
            وجبة اليوم
          </span>
          <h2 className="mt-3 font-display text-2xl font-extrabold text-white text-balance">
            دجاج مشوي بالأعشاب
          </h2>
          <div className="mt-3 flex items-center gap-3 text-[11px] text-white/85 tabular-nums">
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> 25 د</span>
            <span className="flex items-center gap-1"><Flame className="h-3.5 w-3.5" /> 420 سعرة</span>
            <span className="flex items-center gap-1"><Truck className="h-3.5 w-3.5" /> 30 د</span>
          </div>
        </section>
      }
    />
  );
};

export default Kitchen;
