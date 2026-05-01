-- Admin / finance read access to savings ledger
DROP POLICY IF EXISTS "savings_jar_admin_select" ON public.savings_jar;
CREATE POLICY "savings_jar_admin_select" ON public.savings_jar
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finance'));

DROP POLICY IF EXISTS "savings_tx_admin_select" ON public.savings_transactions;
CREATE POLICY "savings_tx_admin_select" ON public.savings_transactions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finance'));
