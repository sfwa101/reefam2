-- Phase 26: Seed ui_layouts for the Main Super App Hub
INSERT INTO public.ui_layouts (page_key, section_order, section_config)
VALUES (
  'main_hub',
  '[
    "MainSearchHeader",
    "StoryCircles",
    "PromotionSlider",
    "DepartmentGrid"
  ]'::jsonb,
  '{
    "MainSearchHeader": { "padding": "lg" },
    "StoryCircles":     { "density": "comfortable" },
    "PromotionSlider":  { "variant": "aurora" },
    "DepartmentGrid":   { "density": "comfortable" }
  }'::jsonb
)
ON CONFLICT (page_key) DO NOTHING;