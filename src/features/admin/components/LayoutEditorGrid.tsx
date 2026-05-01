/**
 * LayoutEditorGrid — Phase 21 No-Code visual editor.
 * Lightweight: native buttons, no drag-and-drop libraries.
 */
import { ChevronUp, ChevronDown, Eye, EyeOff, Trash2, Plus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  SECTION_LABELS,
  useLayoutEditor,
} from "@/features/admin/hooks/useLayoutEditor";
import type { SectionKey } from "@/features/storefront/home/types/sdui.types";

export function LayoutEditorGrid({ pageKey = "home" }: { pageKey?: string }) {
  const ed = useLayoutEditor(pageKey);

  if (ed.loading || !ed.layout) {
    return (
      <div className="glass-strong rounded-2xl p-8 text-center text-foreground-tertiary">
        جاري تحميل المخطط…
      </div>
    );
  }

  const order = ed.layout.section_order;

  return (
    <div className="space-y-3">
      <ul className="space-y-2.5">
        {order.map((key, i) => {
          const enabled = ed.isEnabled(key);
          return (
            <li
              key={key}
              className={cn(
                "glass-strong shadow-soft rounded-2xl p-3.5 flex items-center gap-3 transition-base",
                !enabled && "opacity-60",
              )}
            >
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => ed.moveSectionUp(i)}
                  disabled={i === 0}
                  className="h-7 w-7 rounded-lg bg-card hover:bg-accent/15 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center press"
                  aria-label="نقل للأعلى"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => ed.moveSectionDown(i)}
                  disabled={i === order.length - 1}
                  className="h-7 w-7 rounded-lg bg-card hover:bg-accent/15 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center press"
                  aria-label="نقل للأسفل"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-foreground-tertiary tabular-nums">
                    #{String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="font-display text-sm truncate">
                    {SECTION_LABELS[key] ?? key}
                  </p>
                </div>
                <p className="text-[11px] text-foreground-tertiary mt-0.5 truncate">
                  {key}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {enabled ? (
                  <Eye className="h-4 w-4 text-success" />
                ) : (
                  <EyeOff className="h-4 w-4 text-foreground-tertiary" />
                )}
                <Switch
                  checked={enabled}
                  onCheckedChange={() => ed.toggleSection(key)}
                  aria-label="تفعيل القسم"
                />
                <button
                  type="button"
                  onClick={() => ed.removeSection(key)}
                  className="h-8 w-8 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive flex items-center justify-center press"
                  aria-label="إزالة القسم"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {ed.availableToAdd.length > 0 && (
        <div className="glass rounded-2xl p-3.5">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-foreground-tertiary mb-2">
            أقسام متاحة للإضافة
          </p>
          <div className="flex flex-wrap gap-2">
            {ed.availableToAdd.map((k: SectionKey) => (
              <button
                key={k}
                type="button"
                onClick={() => ed.addSection(k)}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium px-3 py-1.5 press"
              >
                <Plus className="h-3.5 w-3.5" />
                {SECTION_LABELS[k] ?? k}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="sticky bottom-3 z-10 flex items-center justify-between gap-3 glass-strong shadow-float rounded-2xl p-3 mt-4">
        <div className="text-xs text-foreground-secondary">
          {ed.dirty ? (
            <span className="text-warning font-medium">● تغييرات غير محفوظة</span>
          ) : (
            <span className="text-success">✓ محفوظ</span>
          )}
        </div>
        <button
          type="button"
          onClick={ed.saveLayout}
          disabled={!ed.dirty || ed.saving}
          className={cn(
            "rounded-xl px-5 py-2.5 text-sm font-semibold press shadow-soft",
            "bg-gradient-primary text-primary-foreground",
            (!ed.dirty || ed.saving) && "opacity-50 cursor-not-allowed",
          )}
        >
          {ed.saving ? "جاري النشر…" : "نشر المخطط"}
        </button>
      </div>
    </div>
  );
}
