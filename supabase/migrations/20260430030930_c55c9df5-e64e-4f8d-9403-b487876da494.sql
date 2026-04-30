
-- ============================================
-- 1) UNITS OF MEASURE
-- ============================================
CREATE TABLE IF NOT EXISTS public.units_of_measure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name_ar text NOT NULL,
  name_en text,
  is_base boolean NOT NULL DEFAULT false,
  sort_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.units_of_measure ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "uom_read_all" ON public.units_of_measure;
CREATE POLICY "uom_read_all" ON public.units_of_measure FOR SELECT USING (true);
DROP POLICY IF EXISTS "uom_admin_write" ON public.units_of_measure;
CREATE POLICY "uom_admin_write" ON public.units_of_measure FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.units_of_measure (code, name_ar, name_en, is_base, sort_order) VALUES
  ('piece', 'قطعة', 'Piece', true, 1),
  ('pack',  'علبة', 'Pack', false, 2),
  ('carton','كرتونة','Carton', false, 3),
  ('pallet','طبلية','Pallet', false, 4)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 2) PRODUCT_UNITS
-- ============================================
CREATE TABLE IF NOT EXISTS public.product_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  unit_code text NOT NULL REFERENCES public.units_of_measure(code),
  conversion_factor int NOT NULL CHECK (conversion_factor >= 1),
  selling_price numeric(12,2),
  cost_price_per_unit numeric(12,2),
  is_default_buy boolean NOT NULL DEFAULT false,
  is_default_sell boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, unit_code)
);

CREATE INDEX IF NOT EXISTS idx_product_units_product ON public.product_units(product_id);

ALTER TABLE public.product_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_units_read_all" ON public.product_units;
CREATE POLICY "product_units_read_all" ON public.product_units FOR SELECT USING (true);
DROP POLICY IF EXISTS "product_units_staff_write" ON public.product_units;
CREATE POLICY "product_units_staff_write" ON public.product_units FOR ALL
  USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));

DROP TRIGGER IF EXISTS trg_product_units_updated_at ON public.product_units;
CREATE TRIGGER trg_product_units_updated_at
  BEFORE UPDATE ON public.product_units
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- 3) Convert any unit -> pieces
-- ============================================
CREATE OR REPLACE FUNCTION public.convert_to_pieces(_product_id text, _unit_code text, _qty numeric)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _factor int;
BEGIN
  IF _unit_code = 'piece' THEN RETURN _qty; END IF;
  SELECT conversion_factor INTO _factor
  FROM public.product_units
  WHERE product_id = _product_id AND unit_code = _unit_code AND is_active = true;
  IF _factor IS NULL THEN RAISE EXCEPTION 'unit_not_configured: % for %', _unit_code, _product_id; END IF;
  RETURN _qty * _factor;
END $$;

-- ============================================
-- 4) Nested stock breakdown
-- ============================================
CREATE OR REPLACE FUNCTION public.nested_stock_breakdown(_product_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _total_pieces int; _remaining int;
  _pallet int := 0; _carton int := 0; _pack int := 0;
  _f_pallet int; _f_carton int; _f_pack int;
BEGIN
  SELECT COALESCE(SUM(stock - reserved),0)::int INTO _total_pieces
  FROM public.inventory_locations WHERE product_id = _product_id;

  SELECT conversion_factor INTO _f_pallet FROM public.product_units
    WHERE product_id=_product_id AND unit_code='pallet' AND is_active=true;
  SELECT conversion_factor INTO _f_carton FROM public.product_units
    WHERE product_id=_product_id AND unit_code='carton' AND is_active=true;
  SELECT conversion_factor INTO _f_pack FROM public.product_units
    WHERE product_id=_product_id AND unit_code='pack' AND is_active=true;

  _remaining := _total_pieces;
  IF _f_pallet IS NOT NULL AND _f_pallet > 0 THEN
    _pallet := _remaining / _f_pallet; _remaining := _remaining - (_pallet * _f_pallet);
  END IF;
  IF _f_carton IS NOT NULL AND _f_carton > 0 THEN
    _carton := _remaining / _f_carton; _remaining := _remaining - (_carton * _f_carton);
  END IF;
  IF _f_pack IS NOT NULL AND _f_pack > 0 THEN
    _pack := _remaining / _f_pack; _remaining := _remaining - (_pack * _f_pack);
  END IF;

  RETURN jsonb_build_object(
    'total_pieces', _total_pieces,
    'pallet', _pallet, 'pallet_factor', _f_pallet,
    'carton', _carton, 'carton_factor', _f_carton,
    'pack',   _pack,   'pack_factor',   _f_pack,
    'piece',  _remaining,
    'human_readable',
      CASE WHEN _total_pieces = 0 THEN 'لا يوجد رصيد'
      ELSE trim(both ' ' FROM
        (CASE WHEN _pallet>0 THEN _pallet||' طبلية ' ELSE '' END) ||
        (CASE WHEN _carton>0 THEN _carton||' كرتونة ' ELSE '' END) ||
        (CASE WHEN _pack>0   THEN _pack  ||' علبة '   ELSE '' END) ||
        (CASE WHEN _remaining>0 THEN _remaining||' قطعة' ELSE '' END)
      )
      END
  );
END $$;

-- ============================================
-- 5) Margin protection per unit
-- ============================================
CREATE OR REPLACE FUNCTION public.validate_unit_pricing(_product_id text, _unit_code text, _selling_price numeric)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _factor int; _piece_cost numeric; _unit_cost numeric; _floor numeric;
BEGIN
  SELECT conversion_factor INTO _factor FROM public.product_units
    WHERE product_id=_product_id AND unit_code=_unit_code;
  IF _factor IS NULL THEN _factor := 1; END IF;

  SELECT COALESCE(cost_price,0) + COALESCE(packaging_cost,0) INTO _piece_cost
    FROM public.products WHERE id = _product_id;

  IF _piece_cost IS NULL OR _piece_cost <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'reason','no_cost', 'warning','تكلفة القطعة غير محددة');
  END IF;

  _unit_cost := _piece_cost * _factor;
  _floor := _unit_cost * 1.15;

  IF _selling_price < _floor THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason','below_margin_floor',
      'unit_cost', _unit_cost, 'min_allowed_price', _floor, 'attempted', _selling_price,
      'message', 'سعر الوحدة (' || _selling_price || ') أقل من الحد الأدنى لحماية الهامش (' || round(_floor,2) || ')'
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'unit_cost', _unit_cost, 'floor', _floor,
    'margin_pct', round(((_selling_price - _unit_cost)/_selling_price)*100, 2));
END $$;

-- ============================================
-- 6) CROSS-BRANCH TRANSFERS
-- ============================================
CREATE TABLE IF NOT EXISTS public.cross_branch_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  quantity_pieces int NOT NULL,
  source_branch_id uuid REFERENCES public.branches(id),
  source_warehouse_id uuid REFERENCES public.warehouses(id),
  target_branch_id uuid REFERENCES public.branches(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','in_transit','received','cancelled')),
  shipping_cost numeric(12,2) DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cross_branch_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cbt_staff_all" ON public.cross_branch_transfers;
CREATE POLICY "cbt_staff_all" ON public.cross_branch_transfers FOR ALL
  USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));

DROP TRIGGER IF EXISTS trg_cbt_updated_at ON public.cross_branch_transfers;
CREATE TRIGGER trg_cbt_updated_at
  BEFORE UPDATE ON public.cross_branch_transfers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.auto_route_order_to_branch(
  _order_id uuid, _product_id text, _qty_pieces int, _target_branch uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _wh record; _local int; _transfer_id uuid;
BEGIN
  IF NOT is_staff(auth.uid()) AND NOT EXISTS (SELECT 1 FROM public.orders WHERE id=_order_id AND user_id=auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(SUM(il.stock - il.reserved),0)::int INTO _local
  FROM public.inventory_locations il
  JOIN public.warehouses w ON w.id = il.warehouse_id
  WHERE il.product_id = _product_id AND w.branch_id = _target_branch AND w.is_active = true;

  IF _local >= _qty_pieces THEN
    RETURN jsonb_build_object('mode','local_stock','available',_local);
  END IF;

  SELECT w.id AS warehouse_id, w.branch_id, (il.stock - il.reserved)::int AS avail
    INTO _wh
  FROM public.inventory_locations il
  JOIN public.warehouses w ON w.id = il.warehouse_id
  WHERE il.product_id = _product_id
    AND w.is_active = true
    AND w.branch_id IS DISTINCT FROM _target_branch
    AND (il.stock - il.reserved) >= _qty_pieces
  ORDER BY w.priority ASC, (il.stock - il.reserved) DESC
  LIMIT 1;

  IF _wh IS NULL THEN
    RETURN jsonb_build_object('mode','unavailable','available',_local,'requested',_qty_pieces);
  END IF;

  INSERT INTO public.cross_branch_transfers
    (order_id, product_id, quantity_pieces, source_branch_id, source_warehouse_id, target_branch_id, status, notes)
  VALUES (_order_id, _product_id, _qty_pieces, _wh.branch_id, _wh.warehouse_id, _target_branch, 'pending',
          'تحويل آلي - نقص رصيد محلي')
  RETURNING id INTO _transfer_id;

  UPDATE public.inventory_locations
    SET reserved = reserved + _qty_pieces, updated_at = now()
    WHERE warehouse_id = _wh.warehouse_id AND product_id = _product_id;

  RETURN jsonb_build_object(
    'mode','cross_branch_transfer',
    'transfer_id', _transfer_id,
    'source_branch_id', _wh.branch_id,
    'source_warehouse_id', _wh.warehouse_id,
    'target_branch_id', _target_branch,
    'qty_pieces', _qty_pieces
  );
END $$;

-- ============================================
-- 7) ZAKAT
-- ============================================
CREATE TABLE IF NOT EXISTS public.zakat_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  inventory_market_value numeric(14,2) NOT NULL DEFAULT 0,
  cash_balances numeric(14,2) NOT NULL DEFAULT 0,
  receivables numeric(14,2) NOT NULL DEFAULT 0,
  liabilities numeric(14,2) NOT NULL DEFAULT 0,
  zakat_base numeric(14,2) NOT NULL DEFAULT 0,
  nisab_value numeric(14,2) NOT NULL DEFAULT 0,
  zakat_due numeric(14,2) NOT NULL DEFAULT 0,
  is_above_nisab boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'computed' CHECK (status IN ('computed','approved','paid')),
  notes text,
  computed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.zakat_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "zakat_admin_finance" ON public.zakat_assessments;
CREATE POLICY "zakat_admin_finance" ON public.zakat_assessments FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'finance'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'finance'::app_role));

CREATE OR REPLACE FUNCTION public.compute_zakat_assessment(_nisab_value numeric DEFAULT 50000)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _inv numeric; _cash numeric; _recv numeric; _liab numeric;
        _base numeric; _due numeric; _above boolean; _id uuid;
BEGIN
  IF NOT (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'finance'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(SUM(il.stock * COALESCE(p.selling_price, p.price, 0)),0) INTO _inv
  FROM public.inventory_locations il
  JOIN public.products p ON p.id = il.product_id
  WHERE p.is_active = true;

  _cash := 0;

  SELECT COALESCE(SUM(total),0) INTO _recv
  FROM public.orders WHERE status IN ('delivered','confirmed') AND COALESCE(payment_status,'') <> 'paid';

  SELECT COALESCE((SELECT SUM(outstanding_balance) FROM public.suppliers),0)
       + COALESCE((SELECT SUM(balance) FROM public.wallet_balances),0)
       + COALESCE((SELECT SUM(amount_due) FROM public.partner_ledgers WHERE status='accrued'),0)
    INTO _liab;

  _base := GREATEST(_inv + _cash + _recv - _liab, 0);
  _above := _base >= _nisab_value;
  _due := CASE WHEN _above THEN round(_base * 0.025, 2) ELSE 0 END;

  INSERT INTO public.zakat_assessments
    (period_start, period_end, inventory_market_value, cash_balances, receivables, liabilities,
     zakat_base, nisab_value, zakat_due, is_above_nisab, computed_by, status)
  VALUES (CURRENT_DATE - INTERVAL '1 year', CURRENT_DATE,
          _inv, _cash, _recv, _liab, _base, _nisab_value, _due, _above, auth.uid(), 'computed')
  RETURNING id INTO _id;

  RETURN jsonb_build_object(
    'id', _id, 'inventory_market_value', _inv, 'cash', _cash,
    'receivables', _recv, 'liabilities', _liab,
    'zakat_base', _base, 'nisab', _nisab_value,
    'is_above_nisab', _above, 'zakat_due', _due, 'rate', '2.5%',
    'note', 'زكاة عروض التجارة - تُقوَّم البضاعة بسعر السوق وتُخصم الالتزامات الحالة'
  );
END $$;

-- ============================================
-- 8) RIBA AUDIT
-- ============================================
CREATE TABLE IF NOT EXISTS public.riba_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text NOT NULL,
  source_id text NOT NULL,
  category text NOT NULL CHECK (category IN ('interest','late_fee','speculative','clear_riba','suspicion')),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  amount numeric(12,2),
  description text NOT NULL,
  recommendation text,
  status text NOT NULL DEFAULT 'flagged' CHECK (status IN ('flagged','reviewed','dismissed','resolved')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.riba_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "riba_admin_finance" ON public.riba_audit_log;
CREATE POLICY "riba_admin_finance" ON public.riba_audit_log FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'finance'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'finance'::app_role));

CREATE OR REPLACE FUNCTION public.scan_riba_suspicions()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _flagged int := 0; _r record;
BEGIN
  IF NOT (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'finance'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  FOR _r IN
    SELECT id::text AS sid, amount, COALESCE(category,'') || ' ' || COALESCE(notes,'') AS blob
    FROM public.daily_expenses
    WHERE lower(COALESCE(category,'') || ' ' || COALESCE(notes,'')) ~
          '(فائدة|فوائد|ربا|interest|late fee|غرامة تأخير|تأخير سداد)'
      AND NOT EXISTS (SELECT 1 FROM public.riba_audit_log r
                      WHERE r.source_table='daily_expenses' AND r.source_id = id::text)
  LOOP
    INSERT INTO public.riba_audit_log(source_table, source_id, category, severity, amount, description, recommendation)
    VALUES ('daily_expenses', _r.sid, 'interest', 'high', _r.amount,
            'مصروف يحتمل فائدة/غرامة تأخير: ' || _r.blob,
            'مراجعة المصدر — إن كانت فائدة بنكية أو غرامة ربوية فيجب إيقاف المعاملة');
    _flagged := _flagged + 1;
  END LOOP;

  FOR _r IN
    SELECT pi.id::text AS sid, pi.total
    FROM public.purchase_invoices pi
    WHERE pi.due_date IS NOT NULL
      AND pi.due_date - pi.invoice_date > INTERVAL '180 days'
      AND NOT EXISTS (SELECT 1 FROM public.riba_audit_log r
                      WHERE r.source_table='purchase_invoices' AND r.source_id = pi.id::text)
  LOOP
    INSERT INTO public.riba_audit_log(source_table, source_id, category, severity, amount, description, recommendation)
    VALUES ('purchase_invoices', _r.sid, 'suspicion', 'low', _r.total,
            'فاتورة مشتريات بأجل يتجاوز 180 يوم — تحقق من عدم وجود زيادة سعرية مقابل التأجيل',
            'إن كانت الزيادة مقابل الأجل فهي ربا النسيئة. إن كان السعر ثابتاً فلا حرج.');
    _flagged := _flagged + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'flagged_now', _flagged, 'scanned_at', now());
END $$;

-- ============================================
-- 9) HAKIM CHAT
-- ============================================
CREATE TABLE IF NOT EXISTS public.hakim_chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  context_period_days int DEFAULT 7,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hakim_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.hakim_chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hakim_msgs_session ON public.hakim_chat_messages(session_id, created_at);

ALTER TABLE public.hakim_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hakim_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hakim_sessions_owner" ON public.hakim_chat_sessions;
CREATE POLICY "hakim_sessions_owner" ON public.hakim_chat_sessions FOR ALL
  USING (auth.uid() = user_id AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'finance'::app_role) OR has_role(auth.uid(),'store_manager'::app_role)))
  WITH CHECK (auth.uid() = user_id AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'finance'::app_role) OR has_role(auth.uid(),'store_manager'::app_role)));

DROP POLICY IF EXISTS "hakim_msgs_owner" ON public.hakim_chat_messages;
CREATE POLICY "hakim_msgs_owner" ON public.hakim_chat_messages FOR ALL
  USING (EXISTS (SELECT 1 FROM public.hakim_chat_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hakim_chat_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()));

-- ============================================
-- 10) HAKIM DEEP REPORT
-- ============================================
CREATE OR REPLACE FUNCTION public.hakim_deep_report(_from date DEFAULT NULL, _to date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _start date; _end date; _days numeric;
  _orders int; _gross numeric; _items_rev numeric; _items_cost numeric; _net numeric;
  _categories jsonb; _top_products jsonb; _slow_products jsonb;
  _expenses_total numeric; _expenses_by_cat jsonb;
  _supp_due numeric; _supp_due_30 numeric; _wallet_liab numeric; _partner_due numeric;
  _low_stock_count int; _eroded jsonb;
  _zakat_preview jsonb; _riba_open int;
  _avg_order numeric; _orders_per_day numeric;
BEGIN
  IF NOT (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'finance'::app_role) OR has_role(auth.uid(),'store_manager'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  _end   := COALESCE(_to, CURRENT_DATE);
  _start := COALESCE(_from, _end - INTERVAL '7 days');
  _days := GREATEST((_end - _start)::numeric, 1);

  SELECT COUNT(*), COALESCE(SUM(total),0) INTO _orders, _gross
  FROM public.orders
  WHERE created_at::date BETWEEN _start AND _end
    AND status IN ('paid','completed','delivered','confirmed');

  SELECT COALESCE(SUM(oi.price * oi.quantity),0),
         COALESCE(SUM(COALESCE(p.cost_price, p.price * 0.7) * oi.quantity),0)
    INTO _items_rev, _items_cost
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  LEFT JOIN public.products p ON p.id = oi.product_id
  WHERE o.created_at::date BETWEEN _start AND _end
    AND o.status IN ('paid','completed','delivered','confirmed');

  _net := _items_rev - _items_cost;
  _avg_order := CASE WHEN _orders>0 THEN _gross/_orders ELSE 0 END;
  _orders_per_day := round(_orders / _days, 2);

  SELECT COALESCE(jsonb_agg(row_to_json(t)),'[]'::jsonb) INTO _categories FROM (
    SELECT COALESCE(p.category,'غير مصنف') AS category,
           SUM(oi.quantity)::int AS units,
           round(SUM(oi.price * oi.quantity)::numeric, 2) AS revenue,
           round(SUM(COALESCE(p.cost_price, p.price*0.7) * oi.quantity)::numeric, 2) AS cost,
           round((SUM(oi.price * oi.quantity) - SUM(COALESCE(p.cost_price, p.price*0.7) * oi.quantity))::numeric, 2) AS profit,
           CASE WHEN SUM(oi.price * oi.quantity) > 0 THEN
             round(((SUM(oi.price * oi.quantity) - SUM(COALESCE(p.cost_price, p.price*0.7) * oi.quantity)) / SUM(oi.price * oi.quantity) * 100)::numeric, 2)
           ELSE 0 END AS margin_pct
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    LEFT JOIN public.products p ON p.id = oi.product_id
    WHERE o.created_at::date BETWEEN _start AND _end
      AND o.status IN ('paid','completed','delivered','confirmed')
    GROUP BY 1 ORDER BY revenue DESC
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)),'[]'::jsonb) INTO _top_products FROM (
    SELECT p.id, p.name, SUM(oi.quantity)::int AS units, round(SUM(oi.price*oi.quantity)::numeric,2) AS revenue
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    JOIN public.products p ON p.id = oi.product_id
    WHERE o.created_at::date BETWEEN _start AND _end
      AND o.status IN ('paid','completed','delivered','confirmed')
    GROUP BY p.id, p.name ORDER BY revenue DESC LIMIT 10
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)),'[]'::jsonb) INTO _slow_products FROM (
    SELECT p.id, p.name, p.stock, p.price
    FROM public.products p
    WHERE p.is_active=true AND p.stock > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.order_items oi
        JOIN public.orders o ON o.id=oi.order_id
        WHERE oi.product_id=p.id AND o.created_at::date BETWEEN _start AND _end
          AND o.status IN ('paid','completed','delivered','confirmed')
      )
    ORDER BY p.stock DESC LIMIT 15
  ) t;

  SELECT COALESCE(SUM(amount),0) INTO _expenses_total
    FROM public.daily_expenses WHERE expense_date BETWEEN _start AND _end;
  SELECT COALESCE(jsonb_object_agg(category, total),'{}'::jsonb) INTO _expenses_by_cat FROM (
    SELECT category, round(SUM(amount)::numeric,2) AS total
    FROM public.daily_expenses WHERE expense_date BETWEEN _start AND _end GROUP BY category
  ) e;

  SELECT COALESCE(SUM(outstanding_balance),0) INTO _supp_due FROM public.suppliers WHERE is_active=true;
  SELECT COALESCE(SUM(remaining),0) INTO _supp_due_30
    FROM public.purchase_invoices
    WHERE status IN ('open','partially_paid') AND due_date IS NOT NULL AND due_date <= CURRENT_DATE + INTERVAL '30 days';
  SELECT COALESCE(SUM(balance),0) INTO _wallet_liab FROM public.wallet_balances;
  SELECT COALESCE(SUM(amount_due),0) INTO _partner_due FROM public.partner_ledgers WHERE status='accrued';

  SELECT COUNT(*) INTO _low_stock_count FROM public.products WHERE is_active=true AND stock <= 5;

  SELECT COALESCE(jsonb_agg(row_to_json(t)),'[]'::jsonb) INTO _eroded FROM (
    SELECT id, name, selling_price, cost_price,
      round(((selling_price - COALESCE(cost_price,0) - COALESCE(packaging_cost,0))/NULLIF(selling_price,0))*100,2) AS margin_pct
    FROM public.products
    WHERE is_active=true AND cost_price IS NOT NULL AND cost_price > 0
      AND (selling_price - cost_price - COALESCE(packaging_cost,0)) < (cost_price + COALESCE(packaging_cost,0)) * 0.20
    ORDER BY margin_pct ASC NULLS LAST LIMIT 10
  ) t;

  _zakat_preview := jsonb_build_object(
    'inventory_value', (SELECT COALESCE(SUM(il.stock * COALESCE(p.selling_price,p.price,0)),0)
                        FROM public.inventory_locations il JOIN public.products p ON p.id=il.product_id),
    'liabilities', _supp_due + _wallet_liab + _partner_due,
    'note', 'تقدير لحظي. الزكاة الفعلية تُحسب عند تمام الحول من شاشة الزكاة.'
  );

  SELECT COUNT(*) INTO _riba_open FROM public.riba_audit_log WHERE status='flagged';

  RETURN jsonb_build_object(
    'period', jsonb_build_object('from',_start,'to',_end,'days',_days),
    'sales', jsonb_build_object(
      'orders', _orders, 'gross', _gross,
      'items_revenue', _items_rev, 'items_cost', _items_cost,
      'net_profit', _net,
      'avg_order_value', round(_avg_order,2),
      'orders_per_day', _orders_per_day,
      'margin_pct', CASE WHEN _items_rev>0 THEN round((_net/_items_rev)*100,2) ELSE 0 END
    ),
    'by_category', _categories,
    'top_products', _top_products,
    'slow_products', _slow_products,
    'expenses', jsonb_build_object('total', _expenses_total, 'by_category', _expenses_by_cat),
    'liabilities', jsonb_build_object(
      'suppliers_outstanding', _supp_due,
      'suppliers_due_30d', _supp_due_30,
      'wallet_liabilities', _wallet_liab,
      'partners_accrued', _partner_due
    ),
    'inventory', jsonb_build_object('low_stock_count', _low_stock_count, 'eroded_margin_products', _eroded),
    'shariah', jsonb_build_object('zakat_preview', _zakat_preview, 'riba_flags_open', _riba_open),
    'generated_at', now()
  );
END $$;

-- Auto-seed piece unit per product
CREATE OR REPLACE FUNCTION public.ensure_piece_unit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.product_units (product_id, unit_code, conversion_factor, selling_price, is_default_buy, is_default_sell, is_active)
  VALUES (NEW.id, 'piece', 1, NEW.price, true, true, true)
  ON CONFLICT (product_id, unit_code) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ensure_piece_unit ON public.products;
CREATE TRIGGER trg_ensure_piece_unit
  AFTER INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.ensure_piece_unit();

-- Backfill piece units for existing products
INSERT INTO public.product_units (product_id, unit_code, conversion_factor, selling_price, is_default_buy, is_default_sell, is_active)
SELECT id, 'piece', 1, price, true, true, true FROM public.products
ON CONFLICT (product_id, unit_code) DO NOTHING;
