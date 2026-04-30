-- Coupon validation/redeem RPC enforcing min_user_level
CREATE OR REPLACE FUNCTION public.validate_coupon(_code text, _order_total numeric)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _u uuid := auth.uid(); _c record; _lvl public.app_user_level;
        _level_rank int; _required_rank int;
        _used int; _discount numeric := 0;
BEGIN
  IF _u IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO _c FROM public.coupons WHERE code = _code AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'coupon_not_found'; END IF;
  IF _c.starts_at IS NOT NULL AND _c.starts_at > now() THEN RAISE EXCEPTION 'coupon_not_started'; END IF;
  IF _c.ends_at   IS NOT NULL AND _c.ends_at   < now() THEN RAISE EXCEPTION 'coupon_expired'; END IF;
  IF _c.max_uses IS NOT NULL AND _c.uses_count >= _c.max_uses THEN RAISE EXCEPTION 'coupon_exhausted'; END IF;
  IF _c.min_order_total IS NOT NULL AND _order_total < _c.min_order_total THEN
    RAISE EXCEPTION 'order_below_minimum';
  END IF;

  -- per-user limit
  SELECT COUNT(*) INTO _used FROM public.coupon_redemptions
    WHERE coupon_id = _c.id AND user_id = _u;
  IF _c.per_user_limit IS NOT NULL AND _used >= _c.per_user_limit THEN
    RAISE EXCEPTION 'coupon_per_user_limit';
  END IF;

  -- level gate
  IF _c.min_user_level IS NOT NULL THEN
    _lvl := public.compute_user_level(_u);
    _level_rank := CASE _lvl WHEN 'bronze' THEN 1 WHEN 'silver' THEN 2 WHEN 'gold' THEN 3 WHEN 'platinum' THEN 4 ELSE 0 END;
    _required_rank := CASE _c.min_user_level WHEN 'bronze' THEN 1 WHEN 'silver' THEN 2 WHEN 'gold' THEN 3 WHEN 'platinum' THEN 4 ELSE 0 END;
    IF _level_rank < _required_rank THEN
      RAISE EXCEPTION 'level_too_low: need %', _c.min_user_level;
    END IF;
  END IF;

  IF _c.discount_pct IS NOT NULL AND _c.discount_pct > 0 THEN
    _discount := round(_order_total * _c.discount_pct / 100.0, 2);
  ELSIF _c.discount_amount IS NOT NULL THEN
    _discount := _c.discount_amount;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'coupon_id', _c.id,
    'code', _c.code,
    'discount', _discount,
    'description', _c.description
  );
END $$;

CREATE OR REPLACE FUNCTION public.redeem_coupon(_code text, _order_id uuid, _order_total numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _v jsonb; _coupon_id uuid; _disc numeric;
BEGIN
  _v := public.validate_coupon(_code, _order_total);
  _coupon_id := (_v->>'coupon_id')::uuid;
  _disc := (_v->>'discount')::numeric;

  INSERT INTO public.coupon_redemptions(coupon_id, user_id, order_id, discount_applied)
  VALUES (_coupon_id, auth.uid(), _order_id, _disc);

  UPDATE public.coupons SET uses_count = uses_count + 1 WHERE id = _coupon_id;
  RETURN _v;
END $$;