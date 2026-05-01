/**
 * useUiLayout — fetches a `ui_layouts` row by `page_key`.
 *
 * Phase 20 SDUI hook. Falls back to a sane default order when the row
 * is missing or the network is offline so the storefront NEVER renders
 * blank. Public RLS read = anonymous-safe.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SectionKey, UiLayout } from "../types/sdui.types";

const DEFAULT_HOME_ORDER: SectionKey[] = [
  "HeroBanner",
  "SearchAndFilters",
  "CategoriesGrid",
  "BundlesRail",
  "BestSellersRail",
  "ProductsGrid",
];

export const useUiLayout = (pageKey: string) => {
  const [layout, setLayout] = useState<UiLayout | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("ui_layouts")
          .select("id,page_key,section_order,section_config,is_active")
          .eq("page_key", pageKey)
          .eq("is_active", true)
          .maybeSingle();
        if (cancelled) return;
        if (data) {
          setLayout(data as unknown as UiLayout);
        } else {
          setLayout({
            id: "fallback",
            page_key: pageKey,
            section_order: DEFAULT_HOME_ORDER,
            section_config: {},
            is_active: true,
          });
        }
      } catch {
        if (!cancelled) {
          setLayout({
            id: "fallback",
            page_key: pageKey,
            section_order: DEFAULT_HOME_ORDER,
            section_config: {},
            is_active: true,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pageKey]);

  return { layout, loading };
};

export { DEFAULT_HOME_ORDER };
