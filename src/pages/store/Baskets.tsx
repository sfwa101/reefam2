import SinglePageStore, { type StoreCategory } from "@/components/SinglePageStore";
import { products } from "@/lib/products";
import { storeThemes } from "@/lib/storeThemes";

const cats: StoreCategory[] = [
  { id: "all",       name: "الكل",        match: (p) => p.source === "baskets" },
  { id: "weekly",    name: "أسبوعية",     match: (p) => p.source === "baskets" && p.subCategory === "أسبوعية" },
  { id: "fruit",     name: "فواكه",       match: (p) => p.source === "baskets" && p.subCategory === "فواكه" },
  { id: "veg",       name: "خضار",        match: (p) => p.source === "baskets" && p.subCategory === "خضار" },
  { id: "breakfast", name: "إفطار",       match: (p) => p.source === "baskets" && p.subCategory === "إفطار" },
  { id: "events",    name: "مناسبات",     match: (p) => p.source === "baskets" && p.subCategory === "مناسبات" },
];

const Baskets = () => {
  const theme = storeThemes.baskets;
  return (
    <SinglePageStore
      themeKey="baskets"
      title="سلال الريف"
      subtitle="وفّر حتى 25٪ مع سلال جاهزة لكل أسبوع"
      searchPlaceholder="ابحث في السلال…"
      products={products}
      categories={cats}
      hero={
        <section className="rounded-[1.75rem] p-5 shadow-tile" style={{ background: theme.gradient }}>
          <span className="text-[10px] font-bold text-foreground/80">وفّر بالكمية</span>
          <h2 className="font-display text-2xl font-extrabold text-foreground">سلال جاهزة</h2>
          <p className="mt-1 text-xs text-foreground/70">منتجات مختارة بأسعار مخفّضة</p>
        </section>
      }
    />
  );
};
export default Baskets;