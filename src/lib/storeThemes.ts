// Per-store theme colors (HSL strings, no hsl() wrapper)
// Used to tint sticky category bars and accents per store section.

export type StoreThemeKey =
  | "supermarket"
  | "produce"
  | "dairy"
  | "kitchen"
  | "pharmacy"
  | "library"
  | "subscriptions"
  | "wholesale"
  | "recipes"
  | "homeTools";

export type StoreTheme = {
  /** primary brand color of the section */
  hue: string; // e.g. "142 55% 38%"
  /** soft tint background for sticky bars */
  soft: string; // e.g. "142 55% 92%"
  /** accent for active sub-chip */
  ink: string; // foreground for active main pill
  /** gradient string for hero/header */
  gradient: string;
  /** display name */
  label: string;
};

export const storeThemes: Record<StoreThemeKey, StoreTheme> = {
  supermarket: {
    hue: "142 55% 38%",
    soft: "140 50% 92%",
    ink: "150 25% 15%",
    gradient: "linear-gradient(135deg, hsl(140 55% 90%), hsl(155 45% 80%))",
    label: "السوبرماركت",
  },
  produce: {
    hue: "95 55% 38%",
    soft: "100 60% 92%",
    ink: "110 30% 18%",
    gradient: "linear-gradient(135deg, hsl(100 60% 90%), hsl(85 55% 78%))",
    label: "الخضار والفواكه",
  },
  dairy: {
    hue: "38 70% 48%",
    soft: "45 80% 93%",
    ink: "30 35% 18%",
    gradient: "linear-gradient(135deg, hsl(48 80% 93%), hsl(35 70% 82%))",
    label: "الألبان",
  },
  kitchen: {
    hue: "18 75% 50%",
    soft: "22 80% 93%",
    ink: "15 35% 18%",
    gradient: "linear-gradient(135deg, hsl(22 80% 92%), hsl(10 70% 80%))",
    label: "المطبخ الجاهز",
  },
  pharmacy: {
    hue: "195 70% 42%",
    soft: "195 75% 93%",
    ink: "200 35% 18%",
    gradient: "linear-gradient(135deg, hsl(195 75% 92%), hsl(180 60% 80%))",
    label: "الصيدلية",
  },
  library: {
    hue: "260 55% 50%",
    soft: "260 60% 94%",
    ink: "260 30% 20%",
    gradient: "linear-gradient(135deg, hsl(260 65% 93%), hsl(245 55% 82%))",
    label: "المكتبة",
  },
  subscriptions: {
    hue: "330 65% 50%",
    soft: "330 75% 94%",
    ink: "325 35% 20%",
    gradient: "linear-gradient(135deg, hsl(330 75% 93%), hsl(310 60% 82%))",
    label: "الاشتراكات",
  },
  wholesale: {
    hue: "215 65% 35%",
    soft: "215 60% 92%",
    ink: "220 35% 18%",
    gradient: "linear-gradient(135deg, hsl(220 60% 22%), hsl(200 50% 35%) 60%, hsl(40 80% 55%))",
    label: "ريف الجملة",
  },
  recipes: {
    hue: "10 70% 48%",
    soft: "15 75% 93%",
    ink: "10 35% 18%",
    gradient: "linear-gradient(135deg, hsl(15 80% 92%), hsl(5 65% 80%))",
    label: "الوصفات",
  },
  homeTools: {
    hue: "180 55% 38%",
    soft: "180 55% 92%",
    ink: "190 30% 18%",
    gradient: "linear-gradient(135deg, hsl(180 50% 90%), hsl(195 50% 80%))",
    label: "الأدوات المنزلية",
  },
};
