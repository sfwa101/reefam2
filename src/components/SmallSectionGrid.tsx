import {
  Sparkles,
  Snowflake,
  Cookie,
  Coffee,
  Sandwich,
  Baby,
  PawPrint,
  Flower2,
  SprayCan,
  Heart,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SmallSection {
  id: string;
  title: string;
  icon: LucideIcon;
  hue: string;
}

const sections: SmallSection[] = [
  { id: "frozen", title: "المجمدات", icon: Snowflake, hue: "200 70% 92%" },
  { id: "bakery", title: "المخبوزات", icon: Cookie, hue: "30 70% 92%" },
  { id: "drinks", title: "المشروبات", icon: Coffee, hue: "20 50% 90%" },
  { id: "deli", title: "أطعمة جاهزة", icon: Sandwich, hue: "45 75% 90%" },
  { id: "baby", title: "أطعمة الأطفال", icon: Baby, hue: "340 70% 94%" },
  { id: "pets", title: "حيوانات أليفة", icon: PawPrint, hue: "260 35% 92%" },
  { id: "spices", title: "التوابل", icon: Sparkles, hue: "15 80% 90%" },
  { id: "cleaning", title: "التنظيف", icon: SprayCan, hue: "180 50% 92%" },
  { id: "flowers", title: "الورد والهدايا", icon: Flower2, hue: "320 60% 94%" },
  { id: "personal", title: "العناية الشخصية", icon: Heart, hue: "150 40% 92%" },
];

const SmallSectionGrid = () => {
  return (
    <section className="space-y-3 animate-float-up" style={{ animationDelay: "120ms" }}>
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-display text-xl font-extrabold text-foreground">باقي الأقسام</h2>
        <button className="text-xs font-bold text-primary">عرض الكل</button>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {sections.map((s, idx) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              className="group flex flex-col items-center gap-2 rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border/50 transition ease-out hover:-translate-y-0.5 active:scale-[0.97] animate-float-up"
              style={{ animationDelay: `${500 + idx * 40}ms` }}
            >
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ backgroundColor: `hsl(${s.hue})` }}
              >
                <Icon className="h-5 w-5 text-foreground/80" strokeWidth={2.2} />
              </div>
              <span className="text-[11px] font-bold text-foreground text-center leading-tight">
                {s.title}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default SmallSectionGrid;