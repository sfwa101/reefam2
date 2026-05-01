/**
 * useUiLayout — fetches a `ui_layouts` row by `page_key` for the customer
 * runtime. Defaults to the published version. When `?preview=draft` is
 * present in the URL, falls back to the draft so admins can preview.
 *
 * Falls back to a sane default order when the row is missing so the
 * storefront NEVER renders blank. Public RLS read = anonymous-safe.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { LayoutStatus, SectionKey, UiLayout } from "../types/sdui.types";

const DEFAULT_HOME_ORDER: SectionKey[] = [
  "HeroBanner",
  "SearchAndFilters",
  "CategoriesGrid",
  "BundlesRail",
  "BestSellersRail",
  "ProductsGrid",
];

function readPreviewMode(): LayoutStatus {
  if (typeof window === "undefined") return "published";
  try {
    const sp = new URLSearchParams(window.location.search);
    return sp.get("preview") === "draft" ? "draft" : "published";
  } catch {
    return "published";
  }
}

export const useUiLayout = (pageKey: string, statusOverride?: LayoutStatus) => {
  const [layout, setLayout] = useState<UiLayout | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const status: LayoutStatus = statusOverride ?? readPreviewMode();

    (async () => {
      const fallback: UiLayout = {
        id: "fallback",
        page_key: pageKey,
        section_order: DEFAULT_HOME_ORDER,
        section_config: {},
        section_titles: {},
        is_active: true,
        status: "published",
      };
      try {
        // Try requested status first; if missing, fall back to published.
        let { data } = await supabase
          .from("ui_layouts")
          .select("id,page_key,section_order,section_config,section_titles,is_active,status,version,title")
          .eq("page_key", pageKey)
          .eq("status", status)
          .eq("is_active", true)
          .maybeSingle();

        if (!data && status === "draft") {
          const r = await supabase
            .from("ui_layouts")
            .select("id,page_key,section_order,section_config,section_titles,is_active,status,version,title")
            .eq("page_key", pageKey)
            .eq("status", "published")
            .eq("is_active", true)
            .maybeSingle();
          data = r.data;
        }

        if (cancelled) return;
        setLayout(data ? (data as unknown as UiLayout) : fallback);
      } catch {
        if (!cancelled) setLayout(fallback);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pageKey, statusOverride]);

  return { layout, loading };
};

export { DEFAULT_HOME_ORDER };
