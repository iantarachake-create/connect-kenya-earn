CREATE TYPE public.app_role AS ENUM ('user','business','admin','super_admin');
CREATE TYPE public.verification_status AS ENUM ('unverified','pending','verified','rejected');
CREATE TYPE public.campaign_status AS ENUM ('draft','submitted','admin_review','approved','live','completed','rejected','paused');
CREATE TYPE public.task_status AS ENUM ('started','submitted','verification','approved','rejected','rewarded');
CREATE TYPE public.transaction_type AS ENUM ('campaign_reward','referral_reward','withdrawal','adjustment','campaign_funding');
CREATE TYPE public.transaction_status AS ENUM ('pending','completed','failed','reversed');
CREATE TYPE public.withdrawal_status AS ENUM ('pending','reviewing','approved','completed','rejected');

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;

CREATE TABLE public.profiles (
 id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 full_name text NOT NULL DEFAULT '', phone text, county text, avatar_url text,
 referral_code text UNIQUE NOT NULL DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
 verification_status public.verification_status NOT NULL DEFAULT 'unverified', preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE ON public.profiles TO authenticated; GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles own read" ON public.profiles FOR SELECT TO authenticated USING (id=auth.uid());
CREATE POLICY "profiles own update" ON public.profiles FOR UPDATE TO authenticated USING (id=auth.uid()) WITH CHECK (id=auth.uid());

CREATE TABLE public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, role public.app_role NOT NULL DEFAULT 'user', UNIQUE(user_id,role));
GRANT SELECT ON public.user_roles TO authenticated; GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles own read" ON public.user_roles FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid,_role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO authenticated;
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.has_role(_user_id,'admin') OR public.has_role(_user_id,'super_admin') $$;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

CREATE TABLE public.businesses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, name text NOT NULL, registration_number text, description text, website text, logo_url text, verification_status public.verification_status NOT NULL DEFAULT 'unverified', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.businesses TO authenticated; GRANT ALL ON public.businesses TO service_role;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "business public verified or owner" ON public.businesses FOR SELECT USING (verification_status='verified' OR owner_id=auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "business owner create" ON public.businesses FOR INSERT TO authenticated WITH CHECK (owner_id=auth.uid());
CREATE POLICY "business owner edit" ON public.businesses FOR UPDATE TO authenticated USING (owner_id=auth.uid() OR public.is_admin(auth.uid())) WITH CHECK (owner_id=auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE public.campaigns (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE, title text NOT NULL, slug text UNIQUE NOT NULL, category text NOT NULL, description text NOT NULL, requirements text NOT NULL, verification_method text NOT NULL, audience jsonb NOT NULL DEFAULT '{}'::jsonb, reward_amount numeric(12,2) NOT NULL CHECK(reward_amount>0), budget numeric(12,2) NOT NULL CHECK(budget>=reward_amount), participant_limit integer NOT NULL CHECK(participant_limit>0), estimated_minutes integer NOT NULL CHECK(estimated_minutes>0), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, status public.campaign_status NOT NULL DEFAULT 'draft', is_verified boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.campaigns TO anon; GRANT SELECT,INSERT,UPDATE,DELETE ON public.campaigns TO authenticated; GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaign public live" ON public.campaigns FOR SELECT USING (status IN ('approved','live','completed') OR EXISTS(SELECT 1 FROM public.businesses b WHERE b.id=business_id AND b.owner_id=auth.uid()) OR public.is_admin(auth.uid()));
CREATE POLICY "campaign owner create" ON public.campaigns FOR INSERT TO authenticated WITH CHECK (EXISTS(SELECT 1 FROM public.businesses b WHERE b.id=business_id AND b.owner_id=auth.uid()));
CREATE POLICY "campaign owner edit" ON public.campaigns FOR UPDATE TO authenticated USING (EXISTS(SELECT 1 FROM public.businesses b WHERE b.id=business_id AND b.owner_id=auth.uid()) OR public.is_admin(auth.uid()));

CREATE TABLE public.task_submissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT, user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, status public.task_status NOT NULL DEFAULT 'started', evidence jsonb NOT NULL DEFAULT '{}'::jsonb, reviewer_notes text, submitted_at timestamptz, reviewed_at timestamptz, rewarded_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(campaign_id,user_id));
GRANT SELECT,INSERT,UPDATE ON public.task_submissions TO authenticated; GRANT ALL ON public.task_submissions TO service_role;
ALTER TABLE public.task_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "submissions participant or business" ON public.task_submissions FOR SELECT TO authenticated USING (user_id=auth.uid() OR EXISTS(SELECT 1 FROM public.campaigns c JOIN public.businesses b ON b.id=c.business_id WHERE c.id=campaign_id AND b.owner_id=auth.uid()) OR public.is_admin(auth.uid()));
CREATE POLICY "submissions own start" ON public.task_submissions FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid());
CREATE POLICY "submissions participant or reviewer edit" ON public.task_submissions FOR UPDATE TO authenticated USING (user_id=auth.uid() OR EXISTS(SELECT 1 FROM public.campaigns c JOIN public.businesses b ON b.id=c.business_id WHERE c.id=campaign_id AND b.owner_id=auth.uid()) OR public.is_admin(auth.uid()));

CREATE TABLE public.referrals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), referrer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, referred_id uuid UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE, clicks integer NOT NULL DEFAULT 0, qualified_at timestamptz, reward_amount numeric(12,2) NOT NULL DEFAULT 0, rewarded_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), CHECK(referrer_id<>referred_id));
GRANT SELECT ON public.referrals TO authenticated; GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referrals participants read" ON public.referrals FOR SELECT TO authenticated USING (referrer_id=auth.uid() OR referred_id=auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE public.wallets (user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE, available_balance numeric(12,2) NOT NULL DEFAULT 0 CHECK(available_balance>=0), pending_balance numeric(12,2) NOT NULL DEFAULT 0 CHECK(pending_balance>=0), total_earned numeric(12,2) NOT NULL DEFAULT 0 CHECK(total_earned>=0), total_withdrawn numeric(12,2) NOT NULL DEFAULT 0 CHECK(total_withdrawn>=0), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.wallets TO authenticated; GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet own read" ON public.wallets FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE public.wallet_transactions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT, amount numeric(12,2) NOT NULL, type public.transaction_type NOT NULL, status public.transaction_status NOT NULL DEFAULT 'pending', reference_id text UNIQUE NOT NULL, description text NOT NULL DEFAULT '', metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.wallet_transactions TO authenticated; GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transactions own read" ON public.wallet_transactions FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE public.withdrawal_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT, amount numeric(12,2) NOT NULL CHECK(amount>=100), mpesa_phone text NOT NULL CHECK(mpesa_phone ~ '^254[17][0-9]{8}$'), status public.withdrawal_status NOT NULL DEFAULT 'pending', reference_id text UNIQUE NOT NULL, mpesa_receipt text, review_notes text, reviewed_by uuid REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT ON public.withdrawal_requests TO authenticated; GRANT ALL ON public.withdrawal_requests TO service_role;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "withdrawals own read" ON public.withdrawal_requests FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE public.notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, title text NOT NULL, message text NOT NULL, category text NOT NULL, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,UPDATE ON public.notifications TO authenticated; GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications own read" ON public.notifications FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY "notifications own mark read" ON public.notifications FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());

CREATE TABLE public.support_tickets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, subject text NOT NULL, category text NOT NULL, status text NOT NULL DEFAULT 'open', priority text NOT NULL DEFAULT 'normal', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT ON public.support_tickets TO authenticated; GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tickets own read" ON public.support_tickets FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "tickets own create" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());

CREATE TABLE public.support_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE, sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT, message text NOT NULL CHECK(length(message)<=5000), created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT ON public.support_messages TO authenticated; GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ticket messages participant" ON public.support_messages FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.support_tickets t WHERE t.id=ticket_id AND (t.user_id=auth.uid() OR public.is_admin(auth.uid()))));
CREATE POLICY "ticket messages participant create" ON public.support_messages FOR INSERT TO authenticated WITH CHECK(sender_id=auth.uid() AND EXISTS(SELECT 1 FROM public.support_tickets t WHERE t.id=ticket_id AND (t.user_id=auth.uid() OR public.is_admin(auth.uid()))));

CREATE TABLE public.fraud_reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reporter_id uuid NOT NULL REFERENCES public.profiles(id), subject_type text NOT NULL, subject_id uuid, reason text NOT NULL, status text NOT NULL DEFAULT 'open', risk_score integer CHECK(risk_score BETWEEN 0 AND 100), created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT ON public.fraud_reports TO authenticated; GRANT ALL ON public.fraud_reports TO service_role;
ALTER TABLE public.fraud_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fraud reporter read" ON public.fraud_reports FOR SELECT TO authenticated USING(reporter_id=auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "fraud reporter create" ON public.fraud_reports FOR INSERT TO authenticated WITH CHECK(reporter_id=auth.uid());

CREATE TABLE public.disputes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id), transaction_id uuid REFERENCES public.wallet_transactions(id), reason text NOT NULL, status text NOT NULL DEFAULT 'open', resolution text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT ON public.disputes TO authenticated; GRANT ALL ON public.disputes TO service_role;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disputes own read" ON public.disputes FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "disputes own create" ON public.disputes FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());

CREATE TABLE public.articles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text UNIQUE NOT NULL, title text NOT NULL, excerpt text NOT NULL, body text NOT NULL, category text NOT NULL, published boolean NOT NULL DEFAULT false, published_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.articles TO anon,authenticated; GRANT ALL ON public.articles TO service_role;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "articles public published" ON public.articles FOR SELECT USING(published=true OR public.is_admin(auth.uid()));

CREATE TABLE public.faqs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), question text NOT NULL, answer text NOT NULL, category text NOT NULL, sort_order integer NOT NULL DEFAULT 0, published boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.faqs TO anon,authenticated; GRANT ALL ON public.faqs TO service_role;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "faqs public" ON public.faqs FOR SELECT USING(published=true OR public.is_admin(auth.uid()));

CREATE TABLE public.announcements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, message text NOT NULL, audience text NOT NULL DEFAULT 'all', published boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.announcements TO authenticated; GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "announcements read" ON public.announcements FOR SELECT TO authenticated USING(published=true OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.bootstrap_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN INSERT INTO public.profiles(id,full_name,phone) VALUES(NEW.id,coalesce(NEW.raw_user_meta_data->>'full_name',''),NEW.raw_user_meta_data->>'phone'); INSERT INTO public.user_roles(user_id,role) VALUES(NEW.id,'user'); INSERT INTO public.wallets(user_id) VALUES(NEW.id); RETURN NEW; END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.bootstrap_user();

CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount numeric,_phone text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE _id uuid:=gen_random_uuid(); _ref text:='WD-'||upper(substr(replace(_id::text,'-',''),1,10)); BEGIN IF _amount<100 THEN RAISE EXCEPTION 'Minimum withdrawal is KES 100'; END IF; IF _phone !~ '^254[17][0-9]{8}$' THEN RAISE EXCEPTION 'Use a valid Kenyan M-Pesa number'; END IF; UPDATE public.wallets SET available_balance=available_balance-_amount, pending_balance=pending_balance+_amount, updated_at=now() WHERE user_id=auth.uid() AND available_balance>=_amount; IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient available balance'; END IF; INSERT INTO public.withdrawal_requests(id,user_id,amount,mpesa_phone,reference_id) VALUES(_id,auth.uid(),_amount,_phone,_ref); INSERT INTO public.wallet_transactions(user_id,amount,type,status,reference_id,description,metadata) VALUES(auth.uid(),-_amount,'withdrawal','pending',_ref,'M-Pesa withdrawal request',jsonb_build_object('withdrawal_id',_id)); RETURN _id; END $$;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Wallet ledger is immutable'; END $$;
CREATE TRIGGER wallet_ledger_immutable BEFORE UPDATE OR DELETE ON public.wallet_transactions FOR EACH ROW EXECUTE FUNCTION public.prevent_ledger_mutation();

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER businesses_updated BEFORE UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER campaigns_updated BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER submissions_updated BEFORE UPDATE ON public.task_submissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER withdrawals_updated BEFORE UPDATE ON public.withdrawal_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tickets_updated BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER disputes_updated BEFORE UPDATE ON public.disputes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER articles_updated BEFORE UPDATE ON public.articles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.faqs(question,answer,category,sort_order) VALUES
('How do rewards become available?','Rewards move to your available balance only after the campaign action passes verification.','Rewards',1),
('Do I need to deposit money?','No. EARNPESA does not require deposits and does not promise guaranteed returns.','Safety',2),
('How are M-Pesa withdrawals processed?','Submit a request from your wallet. Our team reviews it, sends the payment manually, and records the receipt.','Withdrawals',3),
('When is a referral qualified?','A referral qualifies only after the required action is completed and verified.','Referrals',4);
INSERT INTO public.articles(slug,title,excerpt,body,category,published,published_at) VALUES
('spot-legitimate-online-opportunities','How to spot legitimate online opportunities','A practical checklist for evaluating digital campaigns before you participate.','Check the business identity, reward rules, verification method, dates, and privacy terms. Avoid offers that demand deposits or promise guaranteed returns.','Online opportunities',true,now()),
('digital-skills-kenya-2026','Digital skills Kenyan businesses value','Build practical skills in communication, research, analytics, AI tools, and responsible online marketing.','Start with one measurable skill, practise on small projects, document results, and keep learning as tools change.','Digital skills',true,now()),
('personal-finance-reward-income','Treating reward income responsibly','Simple ways to plan irregular digital earnings without relying on them as guaranteed income.','Track each payment, budget conservatively, protect your M-Pesa PIN, and keep records for your own financial planning.','Personal finance',true,now());