
-- ============ IMMUTABLE VENDOR LEDGER ============
CREATE TABLE IF NOT EXISTS public.vendor_wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  order_item_id UUID,
  product_id TEXT,
  product_name TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('credit_sale','debit_commission','debit_payout','reversal','adjustment')),
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'cleared' CHECK (status IN ('pending','cleared','reversed','failed')),
  gross_amount NUMERIC,
  commission_pct NUMERIC,
  payout_request_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vwt_vendor ON public.vendor_wallet_transactions(vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vwt_order ON public.vendor_wallet_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_vwt_status ON public.vendor_wallet_transactions(vendor_id, status);

ALTER TABLE public.vendor_wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vwt_owner_or_staff_read" ON public.vendor_wallet_transactions;
CREATE POLICY "vwt_owner_or_staff_read" ON public.vendor_wallet_transactions
  FOR SELECT TO authenticated
  USING (
    is_staff(auth.uid())
    OR has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'finance'::app_role)
    OR vendor_id IN (SELECT public.user_vendor_ids(auth.uid()))
  );

-- Writes are system-only via security-definer functions; no direct insert policy.

-- ============ VENDOR PAYOUT REQUESTS ============
CREATE TABLE IF NOT EXISTS public.vendor_payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  requester_user_id UUID REFERENCES auth.users(id),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL DEFAULT 'bank_transfer'
    CHECK (method IN ('bank_transfer','vodafone_cash','instapay','cash')),
  bank_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','rejected','cancelled')),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  payout_id UUID REFERENCES public.vendor_payouts(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vpr_vendor ON public.vendor_payout_requests(vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vpr_status ON public.vendor_payout_requests(status);

ALTER TABLE public.vendor_payout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vpr_owner_or_staff_read" ON public.vendor_payout_requests;
CREATE POLICY "vpr_owner_or_staff_read" ON public.vendor_payout_requests
  FOR SELECT TO authenticated
  USING (
    is_staff(auth.uid())
    OR has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'finance'::app_role)
    OR vendor_id IN (SELECT public.user_vendor_ids(auth.uid()))
  );

DROP POLICY IF EXISTS "vpr_admin_write" ON public.vendor_payout_requests;
CREATE POLICY "vpr_admin_write" ON public.vendor_payout_requests
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'finance'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'finance'::app_role));

CREATE TRIGGER trg_vpr_updated
  BEFORE UPDATE ON public.vendor_payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ WALLET RECOMPUTE (event-sourced) ============
CREATE OR REPLACE FUNCTION public.recompute_vendor_wallet(_vendor_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _avail NUMERIC := 0;
  _pending NUMERIC := 0;
  _earned NUMERIC := 0;
  _paid NUMERIC := 0;
BEGIN
  SELECT
    COALESCE(SUM(
      CASE
        WHEN status = 'cleared' AND kind = 'credit_sale' THEN amount
        WHEN status = 'cleared' AND kind IN ('debit_commission','debit_payout') THEN -amount
        WHEN status = 'cleared' AND kind = 'reversal' THEN -amount
        WHEN status = 'cleared' AND kind = 'adjustment' THEN amount
        ELSE 0
      END
    ), 0),
    COALESCE(SUM(
      CASE
        WHEN status = 'pending' AND kind = 'credit_sale' THEN amount
        WHEN status = 'pending' AND kind IN ('debit_commission','debit_payout') THEN -amount
        ELSE 0
      END
    ), 0),
    COALESCE(SUM(CASE WHEN status='cleared' AND kind='credit_sale' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status='cleared' AND kind='debit_payout' THEN amount ELSE 0 END), 0)
  INTO _avail, _pending, _earned, _paid
  FROM public.vendor_wallet_transactions
  WHERE vendor_id = _vendor_id;

  INSERT INTO public.vendor_wallets (vendor_id, available_balance, pending_balance, lifetime_earned, lifetime_paid_out)
  VALUES (_vendor_id, GREATEST(0,_avail), GREATEST(0,_pending), _earned, _paid)
  ON CONFLICT (vendor_id) DO UPDATE
    SET available_balance = GREATEST(0, EXCLUDED.available_balance),
        pending_balance   = GREATEST(0, EXCLUDED.pending_balance),
        lifetime_earned   = EXCLUDED.lifetime_earned,
        lifetime_paid_out = EXCLUDED.lifetime_paid_out,
        updated_at = now();

  RETURN jsonb_build_object(
    'vendor_id', _vendor_id,
    'available_balance', GREATEST(0,_avail),
    'pending_balance', GREATEST(0,_pending),
    'lifetime_earned', _earned,
    'lifetime_paid_out', _paid
  );
END $$;

-- ============ AUTO-CREDIT ON ORDER COMPLETION ============
CREATE OR REPLACE FUNCTION public.credit_vendors_on_order_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _it RECORD;
  _gross NUMERIC;
  _comm_pct NUMERIC;
  _comm NUMERIC;
  _net NUMERIC;
  _affected UUID[] := ARRAY[]::UUID[];
BEGIN
  IF NEW.status NOT IN ('delivered','completed') THEN RETURN NEW; END IF;
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;

  FOR _it IN
    SELECT oi.id AS order_item_id, oi.product_id, oi.product_name,
           oi.price, oi.quantity,
           p.vendor_id,
           COALESCE(v.commission_pct, 10) AS commission_pct
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    JOIN public.vendors  v ON v.id = p.vendor_id
    WHERE oi.order_id = NEW.id
      AND p.vendor_id IS NOT NULL
      AND v.is_active = true
  LOOP
    -- Idempotency: skip if already settled for this item
    IF EXISTS (
      SELECT 1 FROM public.vendor_wallet_transactions
      WHERE order_item_id = _it.order_item_id
        AND vendor_id = _it.vendor_id
        AND kind = 'credit_sale'
    ) THEN
      CONTINUE;
    END IF;

    _gross    := _it.price * _it.quantity;
    _comm_pct := _it.commission_pct;
    _comm     := ROUND(_gross * _comm_pct / 100.0, 2);
    _net      := _gross - _comm;

    -- Sale credit (cleared)
    INSERT INTO public.vendor_wallet_transactions
      (vendor_id, order_id, order_item_id, product_id, product_name,
       kind, amount, status, gross_amount, commission_pct, notes)
    VALUES
      (_it.vendor_id, NEW.id, _it.order_item_id, _it.product_id, _it.product_name,
       'credit_sale', _gross, 'cleared', _gross, _comm_pct,
       'بيع طلب #' || substr(NEW.id::text,1,8));

    -- Commission debit (cleared)
    IF _comm > 0 THEN
      INSERT INTO public.vendor_wallet_transactions
        (vendor_id, order_id, order_item_id, product_id, product_name,
         kind, amount, status, gross_amount, commission_pct, notes)
      VALUES
        (_it.vendor_id, NEW.id, _it.order_item_id, _it.product_id, _it.product_name,
         'debit_commission', _comm, 'cleared', _gross, _comm_pct,
         'عمولة المنصة (' || _comm_pct || '٪)');
    END IF;

    IF NOT (_it.vendor_id = ANY(_affected)) THEN
      _affected := array_append(_affected, _it.vendor_id);
    END IF;
  END LOOP;

  -- Refresh cached wallet rows
  IF array_length(_affected,1) IS NOT NULL THEN
    FOR _it IN SELECT unnest(_affected) AS vid LOOP
      PERFORM public.recompute_vendor_wallet(_it.vid);
    END LOOP;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_credit_vendors_on_complete ON public.orders;
CREATE TRIGGER trg_credit_vendors_on_complete
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.credit_vendors_on_order_complete();

-- ============ VENDOR PAYOUT REQUEST RPC ============
CREATE OR REPLACE FUNCTION public.request_vendor_payout(
  _vendor_id UUID,
  _amount NUMERIC,
  _method TEXT,
  _bank_details JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _avail NUMERIC;
  _req_id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF _method NOT IN ('bank_transfer','vodafone_cash','instapay','cash') THEN
    RAISE EXCEPTION 'invalid_method';
  END IF;

  -- Caller must own the vendor (or be admin/finance)
  IF NOT (
    has_role(_uid,'admin'::app_role)
    OR has_role(_uid,'finance'::app_role)
    OR _vendor_id IN (SELECT public.user_vendor_ids(_uid))
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Sync wallet first, then check funds
  PERFORM public.recompute_vendor_wallet(_vendor_id);
  SELECT available_balance INTO _avail FROM public.vendor_wallets WHERE vendor_id = _vendor_id;
  IF COALESCE(_avail,0) < _amount THEN
    RAISE EXCEPTION 'insufficient_funds (available=%, requested=%)', COALESCE(_avail,0), _amount;
  END IF;

  INSERT INTO public.vendor_payout_requests
    (vendor_id, requester_user_id, amount, method, bank_details, status)
  VALUES (_vendor_id, _uid, _amount, _method, COALESCE(_bank_details,'{}'::jsonb), 'pending')
  RETURNING id INTO _req_id;

  -- Pending debit on the ledger to lock funds
  INSERT INTO public.vendor_wallet_transactions
    (vendor_id, kind, amount, status, payout_request_id, notes)
  VALUES (_vendor_id, 'debit_payout', _amount, 'pending', _req_id,
          'طلب سحب — قيد المراجعة');

  PERFORM public.recompute_vendor_wallet(_vendor_id);

  RETURN jsonb_build_object('ok', true, 'request_id', _req_id, 'available_after', GREATEST(0, _avail - _amount));
END $$;
