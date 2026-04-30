-- Simple key-value settings store for admin-managed app config.
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can read settings — needed for storefront branding.
CREATE POLICY "app_settings_public_read"
  ON public.app_settings FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only admin/finance can write settings.
CREATE POLICY "app_settings_staff_write"
  ON public.app_settings FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role));

CREATE TRIGGER app_settings_set_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed default keys so the UI has something to render.
INSERT INTO public.app_settings (key, value) VALUES
  ('general', '{"store_name":"ريفام","logo_url":"","default_currency":"EGP"}'::jsonb),
  ('finance', '{"tax_pct":14,"default_shipping":25,"min_order_total":50}'::jsonb)
ON CONFLICT (key) DO NOTHING;