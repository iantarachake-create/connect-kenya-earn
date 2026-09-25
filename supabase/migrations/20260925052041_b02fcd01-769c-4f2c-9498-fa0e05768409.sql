CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE IF NOT EXISTS private.server_tokens (name text PRIMARY KEY, token_hash text NOT NULL);
INSERT INTO private.server_tokens(name, token_hash) VALUES ('paystack','00aef63f066ecae03eca73eead7838f2850588dd6dac4477ff7ad623f40db7fe')
ON CONFLICT (name) DO UPDATE SET token_hash = EXCLUDED.token_hash;

CREATE OR REPLACE FUNCTION public.record_registration_payment(
  _token text, _reference text, _status text, _user_id uuid DEFAULT NULL,
  _amount numeric DEFAULT 300, _phone text DEFAULT NULL, _raw jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, extensions AS $$
DECLARE _uid uuid; _now timestamptz := now();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM private.server_tokens WHERE name='paystack'
     AND token_hash = encode(extensions.digest(_token,'sha256'),'hex')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _status NOT IN ('pending','success','failed') THEN RAISE EXCEPTION 'bad status'; END IF;
  UPDATE registration_payments SET status=_status, updated_at=_now,
    paid_at = CASE WHEN _status='success' THEN _now ELSE paid_at END
  WHERE provider_reference=_reference RETURNING user_id INTO _uid;
  IF _uid IS NULL THEN
    IF _user_id IS NULL THEN RETURN NULL; END IF;
    INSERT INTO registration_payments(user_id, amount, phone, provider, provider_reference, status, raw, paid_at)
    VALUES (_user_id, _amount, coalesce(_phone,''), 'paystack', _reference, _status, _raw,
            CASE WHEN _status='success' THEN _now END);
    _uid := _user_id;
  END IF;
  IF _phone IS NOT NULL THEN UPDATE profiles SET phone=_phone WHERE id=_uid; END IF;
  IF _status='success' AND EXISTS (SELECT 1 FROM profiles WHERE id=_uid AND registration_paid_at IS NULL) THEN
    UPDATE profiles SET registration_paid_at=_now WHERE id=_uid;
    INSERT INTO notifications(user_id, category, title, message)
    VALUES (_uid,'payment','Account activated','Your KSH 300 registration fee was received. You can now start earning.');
  END IF;
  RETURN _uid;
END $$;
REVOKE ALL ON FUNCTION public.record_registration_payment FROM public;
GRANT EXECUTE ON FUNCTION public.record_registration_payment TO anon, authenticated, service_role;