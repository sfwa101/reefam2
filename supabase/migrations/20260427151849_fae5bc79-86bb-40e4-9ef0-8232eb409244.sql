
CREATE TABLE IF NOT EXISTS public.wallet_balances (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance numeric(12,2) NOT NULL DEFAULT 0,
  points integer NOT NULL DEFAULT 0,
  cashback numeric(12,2) NOT NULL DEFAULT 0,
  coupons integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wb_select_own" ON public.wallet_balances FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "wb_insert_own" ON public.wallet_balances FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wb_update_own" ON public.wallet_balances FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'debit',
  label text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wt_select_own" ON public.wallet_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "wt_insert_own" ON public.wallet_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS wt_user_id_idx ON public.wallet_transactions(user_id);

-- Auto-create wallet row when a profile is created.
CREATE OR REPLACE FUNCTION public.handle_new_wallet()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.wallet_balances (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_profile_wallet ON public.profiles;
CREATE TRIGGER on_profile_wallet
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_new_wallet();
