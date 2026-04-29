import SinglePageStore, { type StoreCategory } from "@/components/SinglePageStore";
import { products } from "@/lib/products";
import { storeThemes } from "@/lib/storeThemes";

const cats: StoreCategory[] = [
  { id: "all",     name: "الكل",        match: (p) => p.source === "meat" },
  { id: "red",     name: "لحوم حمراء",  match: (p) => p.source === "meat" && p.subCategory === "لحوم حمراء" },
  { id: "poultry", name: "دواجن",       match: (p) => p.source === "meat" && p.subCategory === "دواجن" },
  { id: "minced",  name: "مفرومات",     match: (p) => p.source === "meat" && p.subCategory === "مفرومات" },
  { id: "fish",    name: "أسماك",       match: (p) => p.source === "meat" && p.subCategory === "أسماك" },
  { id: "sea",     name: "بحريات",      match: (p) => p.source === "meat" && p.subCategory === "بحريات" },
  { id: "frozen",  name: "مجمدات",      match: (p) => p.source === "meat" && p.subCategory === "مجمدات" },
];

const Meat = () => {
  const theme = storeThemes.meat;
  return (
    <SinglePageStore
      themeKey="meat"
      title="اللحوم والمجمدات"
      subtitle="طازجة بأعلى معايير الجودة والسلامة"
      searchPlaceholder="ابحث في اللحوم والمجمدات…"
      products={products}
      categories={cats}
      hero={
        <section className="rounded-[1.75rem] p-5 shadow-tile" style={{ background: theme.gradient }}>
          <span className="text-[10px] font-bold text-foreground/80">قطّع كما تحب</span>
          <h2 className="font-display text-2xl font-extrabold text-foreground">طازج اليوم</h2>
          <p className="mt-1 text-xs text-foreground/70">يصلك مبرّداً بعربات مجهّزة</p>
        </section>
      }
    />
  );
};
export default Meat;