
-- Helper: current user's effective top role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = auth.uid() AND is_active = true
  ORDER BY CASE role
    WHEN 'admin' THEN 1
    WHEN 'finance' THEN 2
    WHEN 'branch_manager' THEN 3
    WHEN 'store_manager' THEN 4
    WHEN 'inventory_clerk' THEN 5
    WHEN 'cashier' THEN 6
    WHEN 'delivery' THEN 7
    WHEN 'staff' THEN 8
    WHEN 'collector' THEN 9
    WHEN 'vendor' THEN 10
    ELSE 99 END
  LIMIT 1
$$;

-- Helper: current user's branch
CREATE OR REPLACE FUNCTION public.current_user_branch_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT branch_id FROM public.user_roles
  WHERE user_id = auth.uid() AND is_active = true AND branch_id IS NOT NULL
  LIMIT 1
$$;

-- Helper: same-branch check
CREATE OR REPLACE FUNCTION public.same_branch(_branch_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT has_role(auth.uid(), 'admin'::app_role)
      OR (_branch_id IS NOT NULL AND _branch_id = public.current_user_branch_id())
$$;

-- 1) Staff attendance
CREATE TABLE IF NOT EXISTS public.staff_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  branch_id uuid REFERENCES public.branches(id),
  check_in_at timestamptz NOT NULL DEFAULT now(),
  check_out_at timestamptz,
  check_in_lat numeric,
  check_in_lng numeric,
  check_out_lat numeric,
  check_out_lng numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attendance_user_day ON public.staff_attendance (user_id, check_in_at DESC);
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_self_select" ON public.staff_attendance
  FOR SELECT USING (user_id = auth.uid()
    OR has_role(auth.uid(),'admin'::app_role)
    OR (has_role(auth.uid(),'branch_manager'::app_role) AND branch_id = current_user_branch_id())
    OR has_role(auth.uid(),'finance'::app_role));

CREATE POLICY "attendance_self_insert" ON public.staff_attendance
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "attendance_self_update" ON public.staff_attendance
  FOR UPDATE USING (user_id = auth.uid()
    OR has_role(auth.uid(),'admin'::app_role)
    OR (has_role(auth.uid(),'branch_manager'::app_role) AND branch_id = current_user_branch_id()));

-- 2) Staff advance/petty-cash requests
CREATE TABLE IF NOT EXISTS public.staff_advance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  branch_id uuid REFERENCES public.branches(id),
  kind text NOT NULL CHECK (kind IN ('advance','petty_cash','reimbursement')),
  amount numeric NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','paid')),
  approved_by uuid,
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_advance_status ON public.staff_advance_requests(status, created_at DESC);
CREATE TRIGGER trg_advance_updated_at BEFORE UPDATE ON public.staff_advance_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.staff_advance_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "advance_select" ON public.staff_advance_requests
  FOR SELECT USING (user_id = auth.uid()
    OR has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'finance'::app_role)
    OR (has_role(auth.uid(),'branch_manager'::app_role) AND branch_id = current_user_branch_id()));

CREATE POLICY "advance_self_insert" ON public.staff_advance_requests
  FOR INSERT WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "advance_manager_update" ON public.staff_advance_requests
  FOR UPDATE USING (has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'finance'::app_role)
    OR (has_role(auth.uid(),'branch_manager'::app_role) AND branch_id = current_user_branch_id()));

-- 3) Cashier sessions
CREATE TABLE IF NOT EXISTS public.cashier_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id uuid NOT NULL,
  branch_id uuid REFERENCES public.branches(id),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opening_float numeric NOT NULL DEFAULT 0,
  closing_cash numeric,
  total_sales numeric NOT NULL DEFAULT 0,
  total_orders int NOT NULL DEFAULT 0,
  notes text
);
CREATE INDEX IF NOT EXISTS idx_cashier_sessions_open ON public.cashier_sessions(cashier_id, closed_at);
ALTER TABLE public.cashier_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cashier_session_select" ON public.cashier_sessions
  FOR SELECT USING (cashier_id = auth.uid()
    OR has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'finance'::app_role)
    OR (has_role(auth.uid(),'branch_manager'::app_role) AND branch_id = current_user_branch_id()));

CREATE POLICY "cashier_session_insert" ON public.cashier_sessions
  FOR INSERT WITH CHECK (cashier_id = auth.uid() AND has_role(auth.uid(),'cashier'::app_role));

CREATE POLICY "cashier_session_update" ON public.cashier_sessions
  FOR UPDATE USING (cashier_id = auth.uid()
    OR has_role(auth.uid(),'admin'::app_role)
    OR (has_role(auth.uid(),'branch_manager'::app_role) AND branch_id = current_user_branch_id()));

-- 4) Approve advance request -> create expense + notify
CREATE OR REPLACE FUNCTION public.approve_advance_request(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _r record; _approver uuid := auth.uid();
BEGIN
  IF NOT (has_role(_approver,'admin'::app_role)
       OR has_role(_approver,'finance'::app_role)
       OR has_role(_approver,'branch_manager'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO _r FROM public.staff_advance_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF _r.status <> 'pending' THEN RAISE EXCEPTION 'already_processed'; END IF;
  IF _r.user_id = _approver THEN RAISE EXCEPTION 'self_approval_forbidden'; END IF;

  UPDATE public.staff_advance_requests
    SET status='approved', approved_by=_approver, approved_at=now()
    WHERE id=_request_id;

  INSERT INTO public.notifications(user_id, title, body, icon)
    VALUES (_r.user_id, '✅ تمت الموافقة على طلبك',
            'تمت الموافقة على طلب '||_r.kind||' بمبلغ '||_r.amount||' ج.م', 'check');

  RETURN jsonb_build_object('ok', true, 'request_id', _request_id);
END $$;

CREATE OR REPLACE FUNCTION public.reject_advance_request(_request_id uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _r record; _approver uuid := auth.uid();
BEGIN
  IF NOT (has_role(_approver,'admin'::app_role)
       OR has_role(_approver,'finance'::app_role)
       OR has_role(_approver,'branch_manager'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO _r FROM public.staff_advance_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF _r.status <> 'pending' THEN RAISE EXCEPTION 'already_processed'; END IF;

  UPDATE public.staff_advance_requests
    SET status='rejected', approved_by=_approver, approved_at=now(), rejection_reason=_reason
    WHERE id=_request_id;

  INSERT INTO public.notifications(user_id, title, body, icon)
    VALUES (_r.user_id, '❌ تم رفض طلبك', COALESCE(_reason,'بدون سبب محدد'), 'x');

  RETURN jsonb_build_object('ok', true, 'request_id', _request_id);
END $$;

REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_branch_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.same_branch(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.approve_advance_request(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reject_advance_request(uuid,text) FROM anon;
