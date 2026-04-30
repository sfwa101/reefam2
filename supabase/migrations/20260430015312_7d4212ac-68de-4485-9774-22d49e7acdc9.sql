-- =========================================================
-- 1) PRODUCTS: packaging_cost + selling_price + Margin Shield
-- =========================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS packaging_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selling_price numeric;

-- Backfill selling_price from price for existing rows
UPDATE public.products SET selling_price = price WHERE selling_price IS NULL;

-- Margin shield trigger: enforce only when cost_price IS NOT NULL
CREATE OR REPLACE FUNCTION public.enforce_margin_shield()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _selling numeric;
  _cost_total numeric;
  _discount numeric;
  _affiliate numeric;
  _net numeric;
  _floor numeric;
BEGIN
  -- Skip if no cost (gradual rollout)
  IF NEW.cost_price IS NULL OR NEW.cost_price <= 0 THEN
    RETURN NEW;
  END IF;

  _selling := COALESCE(NEW.selling_price, NEW.price, 0);
  _cost_total := NEW.cost_price + COALESCE(NEW.packaging_cost, 0);
  _discount := GREATEST(0, COALESCE(NEW.compare_at_price, _selling) - _selling);
  _affiliate := _selling * (COALESCE(NEW.affiliate_commission_pct, 0) / 100.0);
  _net := _selling - _discount - _affiliate;
  _floor := _cost_total * 1.15;

  IF _net < _floor THEN
    -- Allow Super Admin (admin role) to bypass via session setting
    IF current_setting('app.margin_override', true) = 'true'
       AND has_role(auth.uid(), 'admin'::app_role) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'margin_shield_violation: السعر الصافي (%) أقل من الحد الأدنى (%) — التكلفة الكلية %, التغليف %, الخصم %, عمولة الشريك %',
      round(_net,2), round(_floor,2),
      round(_cost_total,2), round(COALESCE(NEW.packaging_cost,0),2),
      round(_discount,2), round(_affiliate,2);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_margin_shield ON public.products;
CREATE TRIGGER trg_margin_shield
  BEFORE INSERT OR UPDATE OF price, selling_price, compare_at_price, cost_price, packaging_cost, affiliate_commission_pct
  ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_margin_shield();

-- =========================================================
-- 2) WALLET LEDGER: status + Maker-Checker
-- =========================================================
ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'cleared',
  ADD COLUMN IF NOT EXISTS reference_order_id uuid,
  ADD COLUMN IF NOT EXISTS created_by_admin uuid,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS vest_release_at timestamptz;

ALTER TABLE public.wallet_transactions
  DROP CONSTRAINT IF EXISTS wallet_tx_status_chk;
ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_tx_status_chk CHECK (status IN ('pending','cleared','failed','reversed'));

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_status ON public.wallet_transactions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_vest ON public.wallet_transactions(status, vest_release_at) WHERE status = 'pending';

-- Add status to topup requests
ALTER TABLE public.wallet_topup_requests
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Allow admin/manager to update topup status (approve/reject)
DROP POLICY IF EXISTS topup_admin_update ON public.wallet_topup_requests;
CREATE POLICY topup_admin_update ON public.wallet_topup_requests
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'store_manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'store_manager'::app_role));

-- Recompute available balance from cleared ledger
CREATE OR REPLACE FUNCTION public.recompute_wallet_balance(_user uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _bal numeric;
BEGIN
  SELECT COALESCE(SUM(CASE WHEN kind='credit' THEN amount ELSE -amount END), 0)
    INTO _bal
  FROM public.wallet_transactions
  WHERE user_id = _user AND status = 'cleared';
  INSERT INTO public.wallet_balances(user_id, balance) VALUES (_user, _bal)
    ON CONFLICT (user_id) DO UPDATE SET balance = EXCLUDED.balance, updated_at = now();
  RETURN _bal;
END;
$$;

-- Replace admin_topup_wallet to create PENDING request + PENDING ledger entry
CREATE OR REPLACE FUNCTION public.admin_topup_wallet(
  _user_id uuid, _amount numeric, _method text,
  _transfer_reference text, _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _admin uuid := auth.uid(); _admin_name text; _topup_id uuid;
BEGIN
  IF _admin IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT (has_role(_admin,'admin'::app_role) OR has_role(_admin,'store_manager'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF _amount > 100000 THEN RAISE EXCEPTION 'amount_too_large'; END IF;
  IF _method NOT IN ('vodafone_cash','instapay','bank_transfer','cash') THEN
    RAISE EXCEPTION 'invalid_method';
  END IF;
  IF _transfer_reference IS NULL OR length(trim(_transfer_reference)) < 4 THEN
    RAISE EXCEPTION 'transfer_reference_required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.wallet_topup_requests
    WHERE method = _method AND transfer_reference = trim(_transfer_reference)
      AND status IN ('pending','completed')
  ) THEN RAISE EXCEPTION 'duplicate_transfer_reference'; END IF;

  SELECT full_name INTO _admin_name FROM public.profiles WHERE id = _admin;

  INSERT INTO public.wallet_topup_requests
    (user_id, amount, method, transfer_reference, note, performed_by, performed_by_name, status)
  VALUES (_user_id, _amount, _method, trim(_transfer_reference), _note, _admin, _admin_name, 'pending')
  RETURNING id INTO _topup_id;

  -- Pending ledger entry (does NOT affect balance until cleared)
  INSERT INTO public.wallet_transactions
    (user_id, amount, kind, label, source, status, created_by_admin)
  VALUES (_user_id, _amount, 'credit',
          'شحن يدوي - ' || _method || ' (#' || trim(_transfer_reference) || ') — قيد الاعتماد',
          'admin_topup', 'pending', _admin);

  RETURN jsonb_build_object('ok', true, 'topup_id', _topup_id, 'status', 'pending');
END;
$$;

-- Approve topup (admin only)
CREATE OR REPLACE FUNCTION public.approve_wallet_topup(_topup_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _r record; _approver uuid := auth.uid(); _new_balance numeric;
BEGIN
  IF NOT has_role(_approver,'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden_admin_only';
  END IF;
  SELECT * INTO _r FROM public.wallet_topup_requests WHERE id = _topup_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'topup_not_found'; END IF;
  IF _r.status <> 'pending' THEN RAISE EXCEPTION 'already_processed'; END IF;
  IF _r.performed_by = _approver THEN RAISE EXCEPTION 'maker_cannot_approve_own'; END IF;

  UPDATE public.wallet_topup_requests
    SET status='completed', approved_by=_approver, approved_at=now()
    WHERE id=_topup_id;

  -- Clear pending ledger entries for this topup
  UPDATE public.wallet_transactions
    SET status='cleared', approved_by=_approver, approved_at=now()
    WHERE source='admin_topup' AND status='pending'
      AND user_id = _r.user_id AND amount = _r.amount AND created_by_admin = _r.performed_by
      AND label LIKE '%' || _r.transfer_reference || '%';

  _new_balance := public.recompute_wallet_balance(_r.user_id);
  RETURN jsonb_build_object('ok', true, 'new_balance', _new_balance);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_wallet_topup(_topup_id uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _r record; _approver uuid := auth.uid();
BEGIN
  IF NOT has_role(_approver,'admin'::app_role) THEN RAISE EXCEPTION 'forbidden_admin_only'; END IF;
  SELECT * INTO _r FROM public.wallet_topup_requests WHERE id=_topup_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'topup_not_found'; END IF;
  IF _r.status <> 'pending' THEN RAISE EXCEPTION 'already_processed'; END IF;

  UPDATE public.wallet_topup_requests
    SET status='rejected', approved_by=_approver, approved_at=now(), rejection_reason=_reason
    WHERE id=_topup_id;

  UPDATE public.wallet_transactions
    SET status='failed', approved_by=_approver, approved_at=now(),
        label = label || ' — مرفوض: ' || COALESCE(_reason,'')
    WHERE source='admin_topup' AND status='pending'
      AND user_id = _r.user_id AND amount = _r.amount AND created_by_admin = _r.performed_by
      AND label LIKE '%' || _r.transfer_reference || '%';

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- =========================================================
-- 3) AFFILIATE: Vesting + Clawback
-- =========================================================
ALTER TABLE public.commission_ledger
  ADD COLUMN IF NOT EXISTS vest_release_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS clawed_back_at timestamptz;

-- Standardize statuses: pending_vest -> cleared -> clawed_back
CREATE INDEX IF NOT EXISTS idx_commission_status_vest
  ON public.commission_ledger(status, vest_release_at);

-- Cron worker: vest mature commissions
CREATE OR REPLACE FUNCTION public.process_commission_vesting()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _vested int := 0; _r record;
BEGIN
  FOR _r IN
    SELECT * FROM public.commission_ledger
    WHERE status = 'pending_vest'
      AND vest_release_at IS NOT NULL
      AND vest_release_at <= now()
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.commission_ledger
      SET status='cleared', paid_at = now()
      WHERE id = _r.id;

    INSERT INTO public.wallet_transactions
      (user_id, amount, kind, label, source, status, reference_order_id)
    VALUES (_r.affiliate_user_id, _r.commission_amount, 'credit',
            'عمولة شريك نجاح — ' || COALESCE(_r.product_name,'منتج'),
            'affiliate_vested', 'cleared', _r.order_id);

    PERFORM public.recompute_wallet_balance(_r.affiliate_user_id);
    _vested := _vested + 1;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'vested', _vested, 'ts', now());
END;
$$;

-- Clawback trigger: when an order is set to "returned/refunded"
CREATE OR REPLACE FUNCTION public.clawback_on_order_return()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _r record;
BEGIN
  IF NEW.status IN ('returned','refunded','cancelled')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    FOR _r IN SELECT * FROM public.commission_ledger
              WHERE order_id = NEW.id AND status IN ('pending_vest','cleared')
              FOR UPDATE
    LOOP
      UPDATE public.commission_ledger
        SET status = 'clawed_back', clawed_back_at = now(),
            notes = COALESCE(notes||' | ','') || 'استرداد تلقائي - الطلب '||NEW.status
        WHERE id = _r.id;

      -- If already cleared into wallet, reverse
      IF _r.status = 'cleared' THEN
        INSERT INTO public.wallet_transactions
          (user_id, amount, kind, label, source, status, reference_order_id)
        VALUES (_r.affiliate_user_id, _r.commission_amount, 'debit',
                'استرداد عمولة (الطلب '||NEW.status||')',
                'affiliate_clawback', 'cleared', NEW.id);
        PERFORM public.recompute_wallet_balance(_r.affiliate_user_id);
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clawback_on_return ON public.orders;
CREATE TRIGGER trg_clawback_on_return
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.clawback_on_order_return();

-- =========================================================
-- 4) CFO DASHBOARD
-- =========================================================
CREATE OR REPLACE FUNCTION public.cfo_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _disc_month numeric;
  _comm_pending numeric;
  _comm_cleared_total numeric;
  _wallet_liability numeric;
  _eroded jsonb;
BEGIN
  IF NOT (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'finance'::app_role) OR has_role(auth.uid(),'store_manager'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(SUM(GREATEST(0, COALESCE(p.compare_at_price,p.selling_price,p.price) - p.selling_price) * oi.quantity), 0)
    INTO _disc_month
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  LEFT JOIN public.products p ON p.id = oi.product_id
  WHERE o.created_at >= date_trunc('month', now())
    AND o.status IN ('paid','completed','delivered','confirmed');

  SELECT COALESCE(SUM(commission_amount),0) INTO _comm_pending
    FROM public.commission_ledger WHERE status='pending_vest';

  SELECT COALESCE(SUM(commission_amount),0) INTO _comm_cleared_total
    FROM public.commission_ledger WHERE status='cleared'
      AND created_at >= date_trunc('month', now());

  SELECT COALESCE(SUM(balance),0) INTO _wallet_liability FROM public.wallet_balances;

  SELECT COALESCE(jsonb_agg(row_to_json(t)),'[]'::jsonb) INTO _eroded FROM (
    SELECT id, name, category, selling_price, cost_price, packaging_cost,
           (selling_price - COALESCE(cost_price,0) - COALESCE(packaging_cost,0)) AS margin,
           CASE WHEN selling_price>0
                THEN round(((selling_price - COALESCE(cost_price,0) - COALESCE(packaging_cost,0))/selling_price)*100,2)
                ELSE 0 END AS margin_pct
    FROM public.products
    WHERE is_active=true AND cost_price IS NOT NULL AND cost_price > 0
      AND (selling_price - cost_price - COALESCE(packaging_cost,0)) < (cost_price + COALESCE(packaging_cost,0)) * 0.20
    ORDER BY margin_pct ASC LIMIT 20
  ) t;

  RETURN jsonb_build_object(
    'discounts_this_month', _disc_month,
    'commissions_pending_vest', _comm_pending,
    'commissions_paid_this_month', _comm_cleared_total,
    'wallet_liabilities_total', _wallet_liability,
    'eroded_margin_products', _eroded,
    'generated_at', now()
  );
END;
$$;

-- =========================================================
-- 5) pg_cron — vest commissions every hour
-- =========================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='affiliate_vesting_hourly') THEN
    PERFORM cron.unschedule('affiliate_vesting_hourly');
  END IF;
  PERFORM cron.schedule(
    'affiliate_vesting_hourly',
    '0 * * * *',
    $cron$ SELECT public.process_commission_vesting(); $cron$
  );
END $$;
