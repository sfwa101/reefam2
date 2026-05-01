
CREATE TABLE IF NOT EXISTS public.hakim_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info','warning','error','critical')),
  description TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT,
  fingerprint TEXT,
  occurrences INT NOT NULL DEFAULT 1,
  user_id UUID,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hakim_anom_recent
  ON public.hakim_anomalies (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hakim_anom_open
  ON public.hakim_anomalies (resolved, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hakim_anom_fingerprint
  ON public.hakim_anomalies (fingerprint, created_at DESC);

ALTER TABLE public.hakim_anomalies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hakim_self_or_staff_read" ON public.hakim_anomalies;
CREATE POLICY "hakim_self_or_staff_read" ON public.hakim_anomalies
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_staff(auth.uid())
    OR has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'finance'::app_role)
  );

DROP POLICY IF EXISTS "hakim_admin_write" ON public.hakim_anomalies;
CREATE POLICY "hakim_admin_write" ON public.hakim_anomalies
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_hakim_anom_updated
  BEFORE UPDATE ON public.hakim_anomalies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.hakim_anomalies;

-- ======== REPORT ANOMALY (dedupe in a 10-min window) ========
CREATE OR REPLACE FUNCTION public.report_anomaly(
  _type TEXT,
  _severity TEXT,
  _description TEXT,
  _payload JSONB DEFAULT '{}'::jsonb,
  _source TEXT DEFAULT NULL,
  _fingerprint TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _existing UUID;
  _new_id UUID;
  _sev TEXT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF _type IS NULL OR length(trim(_type)) = 0 THEN RAISE EXCEPTION 'invalid_type'; END IF;

  _sev := CASE WHEN _severity IN ('info','warning','error','critical') THEN _severity ELSE 'info' END;

  IF _fingerprint IS NOT NULL THEN
    SELECT id INTO _existing
    FROM public.hakim_anomalies
    WHERE fingerprint = _fingerprint
      AND created_at > now() - INTERVAL '10 minutes'
      AND resolved = false
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF _existing IS NOT NULL THEN
    UPDATE public.hakim_anomalies
       SET occurrences = occurrences + 1,
           payload = payload || COALESCE(_payload, '{}'::jsonb),
           updated_at = now()
     WHERE id = _existing;
    RETURN jsonb_build_object('ok', true, 'id', _existing, 'deduped', true);
  END IF;

  INSERT INTO public.hakim_anomalies
    (type, severity, description, payload, source, fingerprint, user_id)
  VALUES
    (_type, _sev, COALESCE(_description,'(no description)'),
     COALESCE(_payload,'{}'::jsonb), _source, _fingerprint, _uid)
  RETURNING id INTO _new_id;

  RETURN jsonb_build_object('ok', true, 'id', _new_id, 'deduped', false);
END $$;

CREATE OR REPLACE FUNCTION public.resolve_anomaly(_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (is_staff(auth.uid()) OR has_role(auth.uid(),'admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.hakim_anomalies
     SET resolved = true, resolved_by = auth.uid(), resolved_at = now()
   WHERE id = _id;
  RETURN jsonb_build_object('ok', true, 'id', _id);
END $$;

CREATE OR REPLACE FUNCTION public.hakim_pulse_stats(_minutes INT DEFAULT 60)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _open INT;
  _total INT;
  _by_sev JSONB;
  _active_users INT;
BEGIN
  IF NOT (is_staff(auth.uid()) OR has_role(auth.uid(),'admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COUNT(*) FILTER (WHERE NOT resolved),
         COUNT(*)
    INTO _open, _total
  FROM public.hakim_anomalies
  WHERE created_at > now() - (_minutes || ' minutes')::interval;

  SELECT COALESCE(jsonb_object_agg(severity, c), '{}'::jsonb) INTO _by_sev
  FROM (
    SELECT severity, COUNT(*) AS c
    FROM public.hakim_anomalies
    WHERE created_at > now() - (_minutes || ' minutes')::interval
    GROUP BY severity
  ) t;

  SELECT COUNT(DISTINCT user_id) INTO _active_users
  FROM public.user_behavior_logs
  WHERE created_at > now() - INTERVAL '15 minutes';

  RETURN jsonb_build_object(
    'window_minutes', _minutes,
    'anomalies_total', _total,
    'anomalies_open', _open,
    'by_severity', _by_sev,
    'active_users_15m', _active_users,
    'generated_at', now()
  );
END $$;
