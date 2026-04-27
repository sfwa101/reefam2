import SinglePageStore, { type StoreCategory } from "@/components/SinglePageStore";
import { products } from "@/lib/products";
import { storeThemes } from "@/lib/storeThemes";
import { Printer } from "lucide-react";
import { toast } from "sonner";

const cats: StoreCategory[] = [
  { id: "all", name: "الكل", match: (p) => p.source === "library" },
  { id: "books", name: "كتب", match: (p) => p.source === "library" && p.category === "قصص" },
  { id: "stationery", name: "قرطاسية", match: (p) => p.source === "library" && p.category === "قرطاسية" },
  { id: "notebooks", name: "كشاكيل وورق", match: (p) => p.source === "library" && p.subCategory === "كشاكيل" },
  { id: "pens", name: "أقلام وأدوات", match: (p) => p.source === "library" && p.subCategory === "أقلام" },
  { id: "sets", name: "أطقم مدرسية", match: (p) => p.source === "library" && p.subCategory === "أطقم" },
];

const SchoolLibrary = () => {
  const theme = storeThemes.library;
  return (
    <SinglePageStore
      themeKey="library"
      title="مكتبة الطلبة"
      subtitle="قرطاسية، كتب، وخدمات تصوير"
      searchPlaceholder="ابحث عن قلم، كتاب، أو حقيبة…"
      products={products}
      categories={cats}
      hero={
        <section className="rounded-[1.75rem] p-5 shadow-tile" style={{ background: theme.gradient }}>
          <span className="text-[10px] font-bold" style={{ color: `hsl(${theme.hue})` }}>عودة المدارس</span>
          <h2 className="mt-1 font-display text-2xl font-extrabold text-foreground text-balance">
            كل ما يحتاجه طالبك<br />في مكان واحد
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">قرطاسية · كتب · تصوير · حقائب</p>
        </section>
      }
      intro={
        <button
          onClick={() => toast("تم فتح خدمة التصوير. ارفع ملفك من هنا.")}
          className="glass-strong mb-3 flex w-full items-center gap-3 rounded-2xl p-4 shadow-soft"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft">
            <Printer className="h-6 w-6 text-primary" strokeWidth={2.4} />
          </div>
          <div className="flex-1 text-right">
            <p className="font-display text-sm font-extrabold">خدمة التصوير والطباعة</p>
            <p className="text-[11px] text-muted-foreground">ارفع ملفك واستلمه خلال ساعتين</p>
          </div>
          <span className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">ارفع</span>
        </button>
      }
    />
  );
};

export default SchoolLibrary;
