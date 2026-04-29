import SinglePageStore, { type StoreCategory } from "@/components/SinglePageStore";
import { products } from "@/lib/products";
import { storeThemes } from "@/lib/storeThemes";

const cats: StoreCategory[] = [
  { id: "all",     name: "الكل",          match: (p) => p.source === "village" },
  { id: "honey",   name: "عسل ومربى",     match: (p) => p.source === "village" && p.subCategory === "عسل ومربى" },
  { id: "dairy",   name: "ألبان بلدية",   match: (p) => p.source === "village" && p.subCategory === "ألبان بلدية" },
  { id: "pickles", name: "مخللات",        match: (p) => p.source === "village" && p.subCategory === "مخللات" },
];

const Village = () => {
  const theme = storeThemes.village;
  return (
    <SinglePageStore
      themeKey="village"
      title="منتجات القرية"
      subtitle="خيرات الريف الأصيلة من المزارعين مباشرة"
      searchPlaceholder="ابحث في خيرات القرية…"
      products={products}
      categories={cats}
      hero={
        <section className="rounded-[1.75rem] p-5 shadow-tile" style={{ background: theme.gradient }}>
          <span className="text-[10px] font-bold text-foreground/80">طبيعي 100%</span>
          <h2 className="font-display text-2xl font-extrabold text-foreground">عبق الريف</h2>
          <p className="mt-1 text-xs text-foreground/70">منتجات بلدية من مزارعين موثوقين</p>
        </section>
      }
    />
  );
};
export default Village;