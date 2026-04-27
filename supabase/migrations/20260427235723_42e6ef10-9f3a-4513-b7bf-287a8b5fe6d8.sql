-- ============================================
-- 1) STORES
-- ============================================
CREATE TABLE IF NOT EXISTS public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  type text NOT NULL DEFAULT 'internal' CHECK (type IN ('internal','vendor')),
  owner_user_id uuid,
  commission_pct numeric(5,2) NOT NULL DEFAULT 0,
  logo_url text,
  phone text,
  address text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active stores"
  ON public.stores FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage stores"
  ON public.stores FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER stores_set_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- 2) Extend user_roles
-- ============================================
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.user_store_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT store_id FROM public.user_roles
  WHERE user_id = _user_id AND is_active = true AND store_id IS NOT NULL
$$;

-- ============================================
-- 3) Extend products
-- ============================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id);

-- ============================================
-- 4) SUB_ORDERS
-- ============================================
CREATE TABLE IF NOT EXISTS public.sub_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','preparing','ready','collected','cancelled')),
  total numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  confirmed_at timestamptz,
  ready_at timestamptz,
  assigned_collector_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sub_orders_order_idx ON public.sub_orders(order_id);
CREATE INDEX IF NOT EXISTS sub_orders_store_status_idx ON public.sub_orders(store_id, status);

ALTER TABLE public.sub_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customer sees own sub_orders"
  ON public.sub_orders FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = sub_orders.order_id AND o.user_id = auth.uid()
  ));

CREATE POLICY "Store staff sees store sub_orders"
  ON public.sub_orders FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR store_id IN (SELECT public.user_store_ids(auth.uid()))
  );

CREATE POLICY "Store staff updates sub_orders"
  ON public.sub_orders FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR store_id IN (SELECT public.user_store_ids(auth.uid()))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR store_id IN (SELECT public.user_store_ids(auth.uid()))
  );

CREATE POLICY "Sub_orders insert by owner or admin"
  ON public.sub_orders FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.user_id = auth.uid()
    )
  );

CREATE TRIGGER sub_orders_set_updated_at
  BEFORE UPDATE ON public.sub_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- 5) Extend order_items
-- ============================================
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id),
  ADD COLUMN IF NOT EXISTS sub_order_id uuid REFERENCES public.sub_orders(id) ON DELETE SET NULL;

-- ============================================
-- 6) DELIVERY_TASKS
-- ============================================
CREATE TABLE IF NOT EXISTS public.delivery_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_id uuid,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','assigned','picked_up','on_the_way','delivered','failed')),
  driver_lat numeric(10,7),
  driver_lng numeric(10,7),
  estimated_minutes integer,
  started_at timestamptz,
  delivered_at timestamptz,
  delivery_photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_tasks_driver_idx ON public.delivery_tasks(driver_id, status);
CREATE INDEX IF NOT EXISTS delivery_tasks_order_idx ON public.delivery_tasks(order_id);

ALTER TABLE public.delivery_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customer sees own delivery"
  ON public.delivery_tasks FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = delivery_tasks.order_id AND o.user_id = auth.uid()
  ));

CREATE POLICY "Staff sees delivery tasks"
  ON public.delivery_tasks FOR SELECT TO authenticated
  USING (
    driver_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'collector')
    OR public.has_role(auth.uid(), 'delivery')
  );

CREATE POLICY "Driver updates own task"
  ON public.delivery_tasks FOR UPDATE TO authenticated
  USING (driver_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (driver_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin/collector inserts delivery tasks"
  ON public.delivery_tasks FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'collector'));

CREATE TRIGGER delivery_tasks_set_updated_at
  BEFORE UPDATE ON public.delivery_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- 7) STORE_SETTLEMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.store_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  gross_sales numeric(12,2) NOT NULL DEFAULT 0,
  commission_pct numeric(5,2) NOT NULL DEFAULT 0,
  commission_amount numeric(12,2) NOT NULL DEFAULT 0,
  net_payout numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/finance manage settlements"
  ON public.store_settlements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finance'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finance'));

CREATE POLICY "Manager sees own store settlements"
  ON public.store_settlements FOR SELECT TO authenticated
  USING (store_id IN (SELECT public.user_store_ids(auth.uid())));

-- ============================================
-- 8) Tighten product write policies
-- ============================================
DROP POLICY IF EXISTS "Staff can insert products" ON public.products;
DROP POLICY IF EXISTS "Staff can update products" ON public.products;

CREATE POLICY "Admin/store_manager insert products"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (store_id IS NOT NULL AND store_id IN (SELECT public.user_store_ids(auth.uid())))
  );

CREATE POLICY "Admin/store_manager update products"
  ON public.products FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (store_id IS NOT NULL AND store_id IN (SELECT public.user_store_ids(auth.uid())))
  );

-- ============================================
-- 9) Seed default store and link products
-- ============================================
INSERT INTO public.stores (name, slug, type, commission_pct, is_active)
VALUES ('ريف المدينة', 'reef-almadina', 'internal', 0, true)
ON CONFLICT (slug) DO NOTHING;

UPDATE public.products
SET store_id = (SELECT id FROM public.stores WHERE slug = 'reef-almadina')
WHERE store_id IS NULL;