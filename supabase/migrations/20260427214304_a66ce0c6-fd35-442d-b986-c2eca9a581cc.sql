REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_staff(UUID) FROM anon, authenticated, public;