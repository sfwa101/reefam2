import SinglePageStore, { type StoreCategory } from "@/components/SinglePageStore";
import { products } from "@/lib/products";
import { storeThemes } from "@/lib/storeThemes";

const cats: StoreCategory[] = [
  { id: "all",     name: "الكل",      match: (p) => p.source === "restaurants" },
  { id: "egy",     name: "مصري",      match: (p) => p.source === "restaurants" && p.subCategory === "مصري" },
  { id: "sham",    name: "شامي",      match: (p) => p.source === "restaurants" && p.subCategory === "شامي" },
  { id: "italian", name: "إيطالي",    match: (p) => p.source === "restaurants" && p.subCategory === "إيطالي" },
  { id: "us",      name: "أمريكي",    match: (p) => p.source === "restaurants" && p.subCategory === "أمريكي" },
  { id: "asian",   name: "آسيوي",     match: (p) => p.source === "restaurants" && p.subCategory === "آسيوي" },
  { id: "grill",   name: "مشويات",    match: (p) => p.source === "restaurants" && p.subCategory === "مشويات" },
];

const Restaurants = () => {
  const theme = storeThemes.restaurants;
  return (
    <SinglePageStore
      themeKey="restaurants"
      title="مطاعم مختارة"
      subtitle="ألذ الوجبات من أفضل مطاعم المدينة"
      searchPlaceholder="ابحث في المطاعم…"
      products={products}
      categories={cats}
      hero={
        <section className="rounded-[1.75rem] p-5 shadow-tile" style={{ background: theme.gradient }}>
          <span className="text-[10px] font-bold text-foreground/80">توصيل سريع</span>
          <h2 className="font-display text-2xl font-extrabold text-foreground">طعمك المفضل</h2>
          <p className="mt-1 text-xs text-foreground/70">من أشهر المطاعم لباب البيت</p>
        </section>
      }
    />
  );
};
export default Restaurants;