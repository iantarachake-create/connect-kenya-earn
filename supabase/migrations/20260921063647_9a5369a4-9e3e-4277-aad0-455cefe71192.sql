ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS registration_paid_at timestamptz;

CREATE TABLE IF NOT EXISTS public.registration_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL DEFAULT 300,
  phone text NOT NULL,
  provider text NOT NULL DEFAULT 'paystack',
  provider_reference text UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS registration_payments_user_idx ON public.registration_payments(user_id, created_at DESC);

GRANT SELECT ON public.registration_payments TO authenticated;
GRANT ALL ON public.registration_payments TO service_role;

ALTER TABLE public.registration_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own registration payments" ON public.registration_payments;
CREATE POLICY "Users read own registration payments" ON public.registration_payments
FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));