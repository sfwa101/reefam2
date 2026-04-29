REVOKE ALL ON FUNCTION public.user_trust_limit(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.wallet_transfer(text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_trust_limit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_transfer(text, numeric, text) TO authenticated;