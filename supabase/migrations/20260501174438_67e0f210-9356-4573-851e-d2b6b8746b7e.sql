-- ============================================================
-- Phase 20: Server-Driven UI Engine — ui_layouts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ui_layouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_key TEXT NOT NULL UNIQUE,
  section_order JSONB NOT NULL DEFAULT '[]'::jsonb,
  section_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ui_layouts ENABLE ROW LEVEL SECURITY;

-- Public read: storefront must render layouts for everyone (incl. anonymous)
CREATE POLICY "ui_layouts public read"
  ON public.ui_layouts FOR SELECT
  USING (true);

-- Admin-only writes (relies on existing has_role(uuid, app_role))
CREATE POLICY "ui_layouts admin insert"
  ON public.ui_layouts FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "ui_layouts admin update"
  ON public.ui_layouts FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "ui_layouts admin delete"
  ON public.ui_layouts FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Auto-update timestamp
DROP TRIGGER IF EXISTS trg_ui_layouts_updated_at ON public.ui_layouts;
CREATE TRIGGER trg_ui_layouts_updated_at
  BEFORE UPDATE ON public.ui_layouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_ui_layouts_page_key ON public.ui_layouts(page_key) WHERE is_active = true;

-- Seed: current Phase 14 storefront home composition
INSERT INTO public.ui_layouts (page_key, section_order, section_config)
VALUES (
  'home',
  '[
    "HeroBanner",
    "CategoriesGrid",
    "FlashDeals",
    "BestSellersRail",
    "BundlesRail",
    "ProductsGrid"
  ]'::jsonb,
  '{
    "HeroBanner":     { "variant": "aurora",   "padding": "lg" },
    "CategoriesGrid": { "sticky": true,        "hue": "142 35% 38%" },
    "FlashDeals":     { "tone": "accent",      "showTimer": true },
    "BestSellersRail":{ "tone": "primary" },
    "BundlesRail":    { "tone": "teal" },
    "ProductsGrid":   { "density": "comfortable" }
  }'::jsonb
)
ON CONFLICT (page_key) DO NOTHING;
