import SinglePageStore, { type StoreCategory } from "@/components/SinglePageStore";
import { products } from "@/lib/products";
import { storeThemes } from "@/lib/storeThemes";

const cats: StoreCategory[] = [
  { id: "all", name: "الكل", match: (p) => p.source === "home" },
  { id: "clean", name: "تنظيف", match: (p) => p.source === "home" && p.subCategory === "تنظيف" },
  { id: "kitchen", name: "أدوات مطبخ", match: (p) => p.source === "home" && p.subCategory === "مطبخ" },
];

const HomeTools = () => {
  const theme = storeThemes.homeTools;
  return (
    <SinglePageStore
      themeKey="homeTools"
      title="الأدوات المنزلية"
      subtitle="كل ما يلزم بيتك بأناقة"
      searchPlaceholder="ابحث في الأدوات المنزلية…"
      products={products}
      categories={cats}
      hero={
        <section className="rounded-[1.75rem] p-5 shadow-tile" style={{ background: theme.gradient }}>
          <span className="text-[10px] font-bold" style={{ color: `hsl(${theme.hue})` }}>جديد</span>
          <h2 className="mt-1 font-display text-2xl font-extrabold text-foreground text-balance">
            متجر الأدوات المنزلية<br />منتجات مختارة بعناية
          </h2>
        </section>
      }
    />
  );
};

export default HomeTools;
