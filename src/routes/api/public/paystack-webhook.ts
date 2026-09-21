import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

type PaystackEvent = {
  event?: string;
  data?: {
    reference?: string;
    status?: string;
    metadata?: { user_id?: string; purpose?: string };
  };
};

export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PAYSTACK_SECRET_KEY"];
        if (!secret) return new Response("Not configured", { status: 503 });

        const body = await request.text();
        const signature = request.headers.get("x-paystack-signature") ?? "";
        const expected = createHmac("sha512", secret).update(body).digest("hex");
        const a = Buffer.from(signature);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: PaystackEvent;
        try {
          payload = JSON.parse(body) as PaystackEvent;
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        const reference = payload.data?.reference;
        if (!reference) return new Response("ok");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const success = payload.event === "charge.success" && payload.data?.status === "success";
        const now = new Date().toISOString();

        const { data: row } = await supabaseAdmin
          .from("registration_payments")
          .update({ status: success ? "success" : "failed", paid_at: success ? now : null, updated_at: now })
          .eq("provider_reference", reference)
          .select("user_id")
          .maybeSingle();

        const userId = row?.user_id ?? payload.data?.metadata?.user_id;
        if (success && userId) {
          await supabaseAdmin.from("profiles").update({ registration_paid_at: now }).eq("id", userId);
          await supabaseAdmin.from("notifications").insert({
            user_id: userId,
            category: "payment",
            title: "Account activated",
            message: "Your KSH 300 registration fee was received. You can now start earning.",
          });
        }

        return new Response("ok");
      },
    },
  },
});
