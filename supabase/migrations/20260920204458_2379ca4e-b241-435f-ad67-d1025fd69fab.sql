CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid,_role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;
REVOKE ALL ON FUNCTION private.has_role(uuid,public.app_role) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid,_role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,private AS $$ SELECT private.has_role(_user_id,_role) $$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,private AS $$ SELECT private.has_role(_user_id,'admin') OR private.has_role(_user_id,'super_admin') $$;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.bootstrap_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN INSERT INTO public.profiles(id,full_name,phone) VALUES(NEW.id,coalesce(NEW.raw_user_meta_data->>'full_name',''),NEW.raw_user_meta_data->>'phone'); INSERT INTO public.user_roles(user_id,role) VALUES(NEW.id,'user'); INSERT INTO public.wallets(user_id) VALUES(NEW.id); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION private.bootstrap_user() FROM PUBLIC, anon, authenticated;
DROP TRIGGER on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION private.bootstrap_user();
DROP FUNCTION public.bootstrap_user();

CREATE OR REPLACE FUNCTION private.request_withdrawal(_user_id uuid,_amount numeric,_phone text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE _id uuid:=gen_random_uuid(); _ref text:='WD-'||upper(substr(replace(_id::text,'-',''),1,10)); BEGIN IF _user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF; IF _amount<100 THEN RAISE EXCEPTION 'Minimum withdrawal is KES 100'; END IF; IF _phone !~ '^254[17][0-9]{8}$' THEN RAISE EXCEPTION 'Use a valid Kenyan M-Pesa number'; END IF; UPDATE public.wallets SET available_balance=available_balance-_amount, pending_balance=pending_balance+_amount, updated_at=now() WHERE user_id=_user_id AND available_balance>=_amount; IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient available balance'; END IF; INSERT INTO public.withdrawal_requests(id,user_id,amount,mpesa_phone,reference_id) VALUES(_id,_user_id,_amount,_phone,_ref); INSERT INTO public.wallet_transactions(user_id,amount,type,status,reference_id,description,metadata) VALUES(_user_id,-_amount,'withdrawal','pending',_ref,'M-Pesa withdrawal request',jsonb_build_object('withdrawal_id',_id)); RETURN _id; END $$;
REVOKE ALL ON FUNCTION private.request_withdrawal(uuid,numeric,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount numeric,_phone text) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path=public,private AS $$ SELECT private.request_withdrawal(auth.uid(),_amount,_phone) $$;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric,text) TO authenticated;