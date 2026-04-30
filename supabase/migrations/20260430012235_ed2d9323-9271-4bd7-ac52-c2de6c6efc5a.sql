
REVOKE EXECUTE ON FUNCTION public.admin_topup_wallet(uuid, numeric, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_topup_wallet(uuid, numeric, text, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.validate_discount(numeric, numeric, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.validate_discount(numeric, numeric, numeric) TO authenticated;
