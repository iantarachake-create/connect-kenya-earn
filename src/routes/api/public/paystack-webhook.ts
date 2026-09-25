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

        const { createClient } = await import("@supabase/supabase-js");
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const db = createClient(process.env["SUPABASE_URL"]!, key, {
          auth: { persistSession: false },
          global: { fetch: (input, init) => {
            const h = new Headers(init?.headers);
            if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
            h.set("apikey", key);
            return fetch(input, { ...init, headers: h });
          } },
        });
        const success = payload.event === "charge.success" && payload.data?.status === "success";
        const { error } = await db.rpc("record_registration_payment" as never, {
          _token: secret, _reference: reference, _status: success ? "success" : "failed",
          _user_id: payload.data?.metadata?.user_id ?? null,
        } as never);
        if (error) console.error("[webhook] record failed", error.message);

        return new Response("ok");
      },
    },
  },
});
