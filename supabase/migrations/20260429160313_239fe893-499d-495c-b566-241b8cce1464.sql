-- 1) KYC documents bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: each user can read/write only files under their own folder
DROP POLICY IF EXISTS "kyc_select_own" ON storage.objects;
CREATE POLICY "kyc_select_own" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "kyc_insert_own" ON storage.objects;
CREATE POLICY "kyc_insert_own" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "kyc_update_own" ON storage.objects;
CREATE POLICY "kyc_update_own" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "kyc_delete_own" ON storage.objects;
CREATE POLICY "kyc_delete_own" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Admins can read all KYC files
DROP POLICY IF EXISTS "kyc_admin_read_all" ON storage.objects;
CREATE POLICY "kyc_admin_read_all" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'kyc-documents' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) KYC verifications table
CREATE TABLE IF NOT EXISTS public.kyc_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  national_id text,
  front_image_path text,
  back_image_path text,
  status text NOT NULL DEFAULT 'pending', -- pending | verified | rejected
  rejection_reason text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kyc_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kyc_select_own_row" ON public.kyc_verifications;
CREATE POLICY "kyc_select_own_row" ON public.kyc_verifications
FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "kyc_insert_own_row" ON public.kyc_verifications;
CREATE POLICY "kyc_insert_own_row" ON public.kyc_verifications
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "kyc_update_own_row" ON public.kyc_verifications;
CREATE POLICY "kyc_update_own_row" ON public.kyc_verifications
FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND status = 'pending')
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "kyc_admin_select_all" ON public.kyc_verifications;
CREATE POLICY "kyc_admin_select_all" ON public.kyc_verifications
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "kyc_admin_update_all" ON public.kyc_verifications;
CREATE POLICY "kyc_admin_update_all" ON public.kyc_verifications
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- updated_at trigger
DROP TRIGGER IF EXISTS set_kyc_updated_at ON public.kyc_verifications;
CREATE TRIGGER set_kyc_updated_at
BEFORE UPDATE ON public.kyc_verifications
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) RPC: total spent for a user (sum of paid orders)
CREATE OR REPLACE FUNCTION public.user_total_spent(_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(total), 0)::numeric
  FROM public.orders
  WHERE user_id = _user_id
    AND status IN ('paid', 'completed', 'delivered', 'confirmed');
$$;