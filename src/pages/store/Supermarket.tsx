import SinglePageStore, { type StoreCategory } from "@/components/SinglePageStore";
import { products } from "@/lib/products";

const cats: StoreCategory[] = [
  { id: "produce", name: "الخضار والفاكهة", match: (p) => p.category === "الخضار والفواكه" },
  { id: "dairy", name: "الألبان والبيض", match: (p) => p.category === "الألبان والبيض" },
  { id: "meat", name: "اللحوم والدواجن", match: (p) => p.category === "اللحوم والدواجن" },
  { id: "bakery", name: "المخبوزات", match: (p) => p.category === "المخبوزات" },
  { id: "pantry", name: "البقالة الجافة", match: (p) => p.category === "البقالة الجافة" },
  { id: "drinks", name: "المشروبات", match: (p) => p.category === "المشروبات" },
  { id: "frozen", name: "المجمدات", match: (p) => p.category === "المجمدات" },
  { id: "baby", name: "أطعمة الأطفال", match: (p) => p.category === "أطعمة الأطفال" },
  { id: "personal", name: "العناية الشخصية", match: (p) => p.category === "العناية الشخصية" },
  { id: "pets", name: "أغذية الحيوانات", match: (p) => p.category === "أغذية الحيوانات" },
];

const Supermarket = () => (
  <SinglePageStore
    themeKey="supermarket"
    title="السوبرماركت"
    subtitle="كل ما تحتاجه يوميًا"
    searchPlaceholder="ابحث في السوبرماركت…"
    products={products.filter((p) => p.source !== "wholesale" && p.source !== "kitchen" && p.source !== "recipes")}
    categories={cats}
  />
);

export default Supermarket;
