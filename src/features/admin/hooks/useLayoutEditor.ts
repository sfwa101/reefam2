/**
 * useLayoutEditor — Phase 21 SDUI No-Code editor controller.
 * ----------------------------------------------------------
 * Loads a `ui_layouts` row by `page_key` and exposes lightweight
 * mutation primitives (move up/down, toggle visibility, save).
 * Uses optimistic local state — `saveLayout()` persists to Supabase.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  SectionConfig,
  SectionKey,
  UiLayout,
} from "@/features/storefront/home/types/sdui.types";
import { DEFAULT_HOME_ORDER } from "@/features/storefront/home/hooks/useUiLayout";

const ALL_SECTIONS: SectionKey[] = [
  "HeroBanner",
  "SearchAndFilters",
  "CategoriesGrid",
  "BundlesRail",
  "BestSellersRail",
  "ProductsGrid",
  "FlashDeals",
];

export const SECTION_LABELS: Record<SectionKey, string> = {
  HeroBanner: "البانر الرئيسي",
  SearchAndFilters: "البحث والفلاتر",
  CategoriesGrid: "شبكة الفئات",
  BundlesRail: "الحزم والعروض",
  BestSellersRail: "الأكثر مبيعاً",
  ProductsGrid: "شبكة المنتجات",
  FlashDeals: "العروض السريعة",
};

export const useLayoutEditor = (pageKey: string) => {
  const [layout, setLayout] = useState<UiLayout | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("ui_layouts")
        .select("id,page_key,section_order,section_config,is_active")
        .eq("page_key", pageKey)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setLayout(data as unknown as UiLayout);
      } else {
        setLayout({
          id: "new",
          page_key: pageKey,
          section_order: DEFAULT_HOME_ORDER,
          section_config: {},
          is_active: true,
        });
      }
      setDirty(false);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [pageKey]);

  const moveSectionUp = useCallback((index: number) => {
    setLayout((prev) => {
      if (!prev || index <= 0) return prev;
      const order = [...prev.section_order];
      [order[index - 1], order[index]] = [order[index], order[index - 1]];
      return { ...prev, section_order: order };
    });
    setDirty(true);
  }, []);

  const moveSectionDown = useCallback((index: number) => {
    setLayout((prev) => {
      if (!prev || index >= prev.section_order.length - 1) return prev;
      const order = [...prev.section_order];
      [order[index + 1], order[index]] = [order[index], order[index + 1]];
      return { ...prev, section_order: order };
    });
    setDirty(true);
  }, []);

  const toggleSection = useCallback((key: SectionKey) => {
    setLayout((prev) => {
      if (!prev) return prev;
      const cfg: Partial<Record<SectionKey, SectionConfig>> = {
        ...prev.section_config,
      };
      const current = cfg[key] ?? {};
      const wasEnabled = current.enabled !== false;
      cfg[key] = { ...current, enabled: !wasEnabled };
      return { ...prev, section_config: cfg };
    });
    setDirty(true);
  }, []);

  const addSection = useCallback((key: SectionKey) => {
    setLayout((prev) => {
      if (!prev || prev.section_order.includes(key)) return prev;
      return { ...prev, section_order: [...prev.section_order, key] };
    });
    setDirty(true);
  }, []);

  const removeSection = useCallback((key: SectionKey) => {
    setLayout((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        section_order: prev.section_order.filter((s) => s !== key),
      };
    });
    setDirty(true);
  }, []);

  const saveLayout = useCallback(async () => {
    if (!layout) return { ok: false, error: "no-layout" };
    setSaving(true);
    try {
      const payload = {
        page_key: layout.page_key,
        section_order: layout.section_order,
        section_config: layout.section_config,
        is_active: true,
      };
      const { data, error } = await supabase
        .from("ui_layouts")
        .upsert(payload, { onConflict: "page_key" })
        .select("id,page_key,section_order,section_config,is_active")
        .maybeSingle();
      if (error) throw error;
      if (data) setLayout(data as unknown as UiLayout);
      setDirty(false);
      return { ok: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "save-failed";
      return { ok: false, error: msg };
    } finally {
      setSaving(false);
    }
  }, [layout]);

  const isEnabled = (key: SectionKey) =>
    layout?.section_config?.[key]?.enabled !== false;

  const availableToAdd = layout
    ? ALL_SECTIONS.filter((s) => !layout.section_order.includes(s))
    : [];

  return {
    layout,
    loading,
    saving,
    dirty,
    isEnabled,
    moveSectionUp,
    moveSectionDown,
    toggleSection,
    addSection,
    removeSection,
    availableToAdd,
    saveLayout,
  };
};
