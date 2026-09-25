import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeKenyanPhone, toLocalKenyanPhone } from "./phone";

export const REGISTRATION_FEE_KES = 300;

type ChargeResult = {
  ok: boolean;
  status: "pending" | "success" | "failed";
  reference?: string;
  message: string;
};

/** Registration status for the signed-in member. */
export const getRegistrationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: payments }] = await Promise.all([
      supabase.from("profiles").select("registration_paid_at, phone").eq("id", userId).maybeSingle(),
      supabase
        .from("registration_payments")
        .select("id, status, amount, phone, provider_reference, created_at, paid_at")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    return {
      paid: Boolean(profile?.registration_paid_at),
      paidAt: profile?.registration_paid_at ?? null,
      phone: profile?.phone ?? null,
      fee: REGISTRATION_FEE_KES,
      attempts: payments ?? [],
    };
  });

/** Sends the KSH 300 M-Pesa STK push through Paystack. */
export const startRegistrationPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phone: string }) => input)
  .handler(async ({ data, context }): Promise<ChargeResult> => {
    const { supabase, userId, claims } = context;
    const intl = normalizeKenyanPhone(data.phone);
    const local = toLocalKenyanPhone(data.phone);
    if (!intl || !local) {
      return { ok: false, status: "failed", message: "Enter a valid Kenyan number, e.g. 0111385747 or +254111385747." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("registration_paid_at")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.registration_paid_at) {
      return { ok: true, status: "success", message: "Your account is already activated." };
    }

    const secret = process.env["PAYSTACK_SECRET_KEY"]?.trim().replace(/^['"]|['"]$/g, "");
    if (!secret) {
      return { ok: false, status: "failed", message: "Payments are not configured yet. Please try again later." };
    }

    const email = (claims["email"] as string | undefined) ?? `user-${userId}@earnpesa.co.ke`;
    const reference = `EPREG-${Date.now()}-${userId.slice(0, 8)}`;

    let payload: { status?: boolean; message?: string; data?: { status?: string; reference?: string; display_text?: string } };
    try {
      const response = await fetch("https://api.paystack.co/charge", {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          amount: REGISTRATION_FEE_KES * 100,
          currency: "KES",
          reference,
          mobile_money: { phone: `+${intl}`, provider: "mpesa" },
          metadata: { user_id: userId, purpose: "registration_fee" },
        }),
      });
      payload = (await response.json()) as typeof payload;
      if (response.status === 401 || payload?.message?.toLowerCase().includes("invalid key")) {
        console.error("[paystack] authentication rejected; replace PAYSTACK_SECRET_KEY on the host");
        return {
          ok: false,
          status: "failed",
          message: "The payment service key needs to be updated. Please contact support.",
        };
      }
    } catch (error) {
      console.error("[paystack] charge failed", error);
      return { ok: false, status: "failed", message: "We could not reach the payment service. Please try again." };
    }

    const chargeStatus = payload?.data?.status ?? "failed";
    const succeeded = chargeStatus === "success";
    const ref = payload?.data?.reference ?? reference;
    const rec = await supabase.rpc("record_registration_payment" as never, {
      _token: secret, _reference: ref, _user_id: userId, _amount: REGISTRATION_FEE_KES, _phone: intl,
      _status: succeeded ? "success" : payload?.status ? "pending" : "failed", _raw: (payload ?? {}) as never,
    } as never);
    if (rec.error) console.error("[payments] record failed", rec.error.message);

    if (succeeded) return { ok: true, status: "success", reference: ref, message: "Payment received. Your account is activated." };

    if (!payload?.status) {
      console.error("[paystack] charge rejected", payload?.message);
      return { ok: false, status: "failed", message: payload?.message ?? "The payment could not be started." };
    }

    return {
      ok: true,
      status: "pending",
      reference: payload.data?.reference ?? reference,
      message:
        payload.data?.display_text ??
        `Check ${local} for the M-Pesa prompt and enter your PIN to pay KSH ${REGISTRATION_FEE_KES}.`,
    };
  });

/** Confirms a pending charge with Paystack (used while the STK prompt is open). */
export const confirmRegistrationPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reference: string }) => input)
  .handler(async ({ data, context }): Promise<ChargeResult> => {
    const { userId } = context;
    const secret = process.env["PAYSTACK_SECRET_KEY"]?.trim().replace(/^['"]|['"]$/g, "");
    if (!secret) return { ok: false, status: "failed", message: "Payments are not configured yet." };

    let payload: { data?: { status?: string; gateway_response?: string } } = {};
    try {
      const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`, {
        headers: { Authorization: `Bearer ${secret}` },
      });
      payload = (await response.json()) as typeof payload;
    } catch (error) {
      console.error("[paystack] verify failed", error);
      return { ok: false, status: "pending", message: "Still waiting for confirmation." };
    }

    const status = payload.data?.status;
    const final = status === "success" ? "success" : status === "failed" || status === "reversed" ? "failed" : null;
    if (final) {
      const rec = await context.supabase.rpc("record_registration_payment" as never, {
        _token: secret, _reference: data.reference, _user_id: userId, _status: final,
      } as never);
      if (rec.error) console.error("[payments] record failed", rec.error.message);
      if (final === "success") return { ok: true, status: "success", message: "Payment confirmed. Your account is activated." };
      return { ok: false, status: "failed", message: payload.data?.gateway_response ?? "The payment was not completed." };
    }

    return { ok: true, status: "pending", message: "Waiting for your M-Pesa confirmation…" };
  });
