
ALTER TABLE public.order_items RENAME COLUMN qty TO quantity;
ALTER TABLE public.order_items RENAME COLUMN name TO product_name;
ALTER TABLE public.order_items RENAME COLUMN image TO product_image;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS whatsapp_sent boolean NOT NULL DEFAULT false;
