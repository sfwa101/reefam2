-- Phase 1: Visual Builder — versioning + history
-- Adds draft/published status, custom section titles, and a history table.

-- 1) Drop the page_key unique constraint (multiple rows per page now: one draft, one published)
ALTER TABLE public.ui_layouts DROP CONSTRAINT IF EXISTS ui_layouts_page_key_key;

-- 2) Add new columns
ALTER TABLE public.ui_layouts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft','published')),
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS section_titles jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_by uuid;

-- 3) Backfill: any existing row is treated as published v1
UPDATE public.ui_layouts
SET status = 'published',
    published_at = COALESCE(published_at, updated_at, now())
WHERE status IS NULL OR status = 'published';

-- 4) New unique constraint: at most one row per (page_key, status)
ALTER TABLE public.ui_layouts
  ADD CONSTRAINT ui_layouts_page_status_key UNIQUE (page_key, status);

-- 5) Index for fast public reads of published layouts
CREATE INDEX IF NOT EXISTS idx_ui_layouts_page_status
  ON public.ui_layouts (page_key, status)
  WHERE is_active = true;

-- 6) History table — every publish snapshots the layout for rollback
CREATE TABLE IF NOT EXISTS public.ui_layout_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text NOT NULL,
  version integer NOT NULL,
  title text,
  section_order jsonb NOT NULL,
  section_config jsonb NOT NULL,
  section_titles jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_by uuid,
  published_at timestamptz NOT NULL DEFAULT now(),
  note text
);

CREATE INDEX IF NOT EXISTS idx_ui_layout_history_page
  ON public.ui_layout_history (page_key, published_at DESC);

ALTER TABLE public.ui_layout_history ENABLE ROW LEVEL SECURITY;

-- Admins can read/write history; everyone else has no access
DROP POLICY IF EXISTS "ui_layout_history admin read" ON public.ui_layout_history;
CREATE POLICY "ui_layout_history admin read"
  ON public.ui_layout_history FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "ui_layout_history admin insert" ON public.ui_layout_history;
CREATE POLICY "ui_layout_history admin insert"
  ON public.ui_layout_history FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 7) Trigger: when status flips to 'published', snapshot into history and bump version
CREATE OR REPLACE FUNCTION public.ui_layouts_publish_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published'
       OR OLD.section_order IS DISTINCT FROM NEW.section_order
       OR OLD.section_config IS DISTINCT FROM NEW.section_config
       OR OLD.section_titles IS DISTINCT FROM NEW.section_titles) THEN
    NEW.published_at := now();
    NEW.published_by := auth.uid();
    INSERT INTO public.ui_layout_history (
      page_key, version, title, section_order, section_config, section_titles, published_by
    ) VALUES (
      NEW.page_key, NEW.version, NEW.title, NEW.section_order, NEW.section_config, NEW.section_titles, auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ui_layouts_publish_snapshot ON public.ui_layouts;
CREATE TRIGGER trg_ui_layouts_publish_snapshot
  BEFORE INSERT OR UPDATE ON public.ui_layouts
  FOR EACH ROW
  EXECUTE FUNCTION public.ui_layouts_publish_snapshot();