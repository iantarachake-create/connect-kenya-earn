import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeKenyanPhone } from "./phone";

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function isPaid(userId: string) {
  const db = await admin();
  const { data } = await db.from("profiles").select("registration_paid_at").eq("id", userId).maybeSingle();
  return Boolean(data?.registration_paid_at);
}

export const getMe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const [{ data: profile }, { data: roles }, { count: unread }] = await Promise.all([
      db.from("profiles").select("*").eq("id", context.userId).maybeSingle(),
      db.from("user_roles").select("role").eq("user_id", context.userId),
      db.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", context.userId).is("read_at", null),
    ]);
    const r = (roles ?? []).map((x) => x.role as string);
    return { profile, roles: r, isAdmin: r.includes("admin") || r.includes("super_admin"), unread: unread ?? 0 };
  });

export const getDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const uid = context.userId;
    const [wallet, txs, done, live, refs, notes, chart] = await Promise.all([
      db.from("wallets").select("*").eq("user_id", uid).maybeSingle(),
      db.from("wallet_transactions").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(8),
      db.from("task_submissions").select("*", { count: "exact", head: true }).eq("user_id", uid).eq("status", "rewarded"),
      db.from("campaigns").select("*", { count: "exact", head: true }).eq("status", "live"),
      db.from("referrals").select("reward_amount, rewarded_at").eq("referrer_id", uid),
      db.from("notifications").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(5),
      db.from("wallet_transactions").select("amount, created_at, type").eq("user_id", uid).gte("created_at", new Date(Date.now() - 13 * 864e5).toISOString()),
    ]);
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.now() - (13 - i) * 864e5);
      return { key: d.toISOString().slice(0, 10), label: d.toLocaleDateString("en-KE", { day: "2-digit", month: "short" }), earned: 0 };
    });
    for (const t of chart.data ?? []) {
      if (t.type === "withdrawal") continue;
      const day = days.find((d) => d.key === String(t.created_at).slice(0, 10));
      if (day) day.earned += Math.max(0, Number(t.amount));
    }
    return {
      wallet: wallet.data,
      transactions: txs.data ?? [],
      completed: done.count ?? 0,
      live: live.count ?? 0,
      referralEarnings: (refs.data ?? []).filter((r) => r.rewarded_at).reduce((a, r) => a + Number(r.reward_amount ?? 0), 0),
      notifications: notes.data ?? [],
      chart: days,
    };
  });

export const listEarn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const [{ data: campaigns }, { data: mine }] = await Promise.all([
      db.from("campaigns").select("*, businesses(name, verification_status)").eq("status", "live").order("created_at", { ascending: false }),
      db.from("task_submissions").select("id, campaign_id, status, reviewer_notes").eq("user_id", context.userId),
    ]);
    return { campaigns: campaigns ?? [], mine: mine ?? [], paid: await isPaid(context.userId) };
  });

export const startTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ campaignId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await isPaid(context.userId))) return { ok: false, message: "Pay the KSH 300 registration fee to start tasks." };
    const db = await admin();
    const { data: c } = await db.from("campaigns").select("id, status, participant_limit, ends_at").eq("id", data.campaignId).maybeSingle();
    if (!c || c.status !== "live") return { ok: false, message: "This campaign is no longer available." };
    if (c.ends_at && new Date(c.ends_at) < new Date()) return { ok: false, message: "This campaign has ended." };
    const { data: existing } = await db.from("task_submissions").select("id").eq("campaign_id", c.id).eq("user_id", context.userId).maybeSingle();
    if (existing) return { ok: false, message: "You already joined this campaign." };
    if (c.participant_limit) {
      const { count } = await db.from("task_submissions").select("*", { count: "exact", head: true }).eq("campaign_id", c.id);
      if ((count ?? 0) >= c.participant_limit) return { ok: false, message: "All spots are taken." };
    }
    const { error } = await db.from("task_submissions").insert({ campaign_id: c.id, user_id: context.userId, status: "started" });
    return error ? { ok: false, message: error.message } : { ok: true, message: "Task started. Submit your proof when done." };
  });

export const submitTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), evidence: z.string().trim().min(3).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const now = new Date().toISOString();
    const { data: row, error } = await db
      .from("task_submissions")
      .update({ status: "submitted", evidence: { note: data.evidence } as never, submitted_at: now, updated_at: now })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .eq("status", "started")
      .select("id")
      .maybeSingle();
    if (error || !row) return { ok: false, message: "Could not submit this task." };
    return { ok: true, message: "Submitted for verification." };
  });

export const getReferrals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const [{ data: profile }, { data: refs }] = await Promise.all([
      db.from("profiles").select("referral_code").eq("id", context.userId).maybeSingle(),
      db.from("referrals").select("*").eq("referrer_id", context.userId).order("created_at", { ascending: false }),
    ]);
    const ids = (refs ?? []).map((r) => r.referred_id).filter(Boolean) as string[];
    const { data: people } = ids.length ? await db.from("profiles").select("id, full_name, registration_paid_at").in("id", ids) : { data: [] };
    const list = (refs ?? []).map((r) => ({ ...r, person: (people ?? []).find((p) => p.id === r.referred_id) }));
    const clicks = list.reduce((a, r) => a + Number(r.clicks ?? 0), 0);
    const signups = list.filter((r) => r.referred_id).length;
    const qualified = list.filter((r) => r.qualified_at).length;
    return {
      code: profile?.referral_code ?? "",
      list,
      clicks,
      signups,
      qualified,
      conversion: signups ? Math.round((qualified / signups) * 100) : 0,
      earnings: list.filter((r) => r.rewarded_at).reduce((a, r) => a + Number(r.reward_amount ?? 0), 0),
    };
  });

export const getWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const [w, t, wd, p] = await Promise.all([
      db.from("wallets").select("*").eq("user_id", context.userId).maybeSingle(),
      db.from("wallet_transactions").select("*").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(100),
      db.from("withdrawal_requests").select("*").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(50),
      db.from("profiles").select("phone, registration_paid_at").eq("id", context.userId).maybeSingle(),
    ]);
    return { wallet: w.data, transactions: t.data ?? [], withdrawals: wd.data ?? [], phone: p.data?.phone ?? "", paid: Boolean(p.data?.registration_paid_at) };
  });

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ amount: z.number().int().min(100).max(150000), phone: z.string().max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await isPaid(context.userId))) return { ok: false, message: "Pay the KSH 300 registration fee before withdrawing." };
    const phone = normalizeKenyanPhone(data.phone);
    if (!phone) return { ok: false, message: "Enter a valid Kenyan number, e.g. 0711385747 or +254111385747." };
    const db = await admin();
    const { count } = await db
      .from("withdrawal_requests")
      .select("*", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .in("status", ["pending", "reviewing", "approved"]);
    if ((count ?? 0) >= 1) return { ok: false, message: "You already have a withdrawal being processed." };
    const { data: ref, error } = await context.supabase.rpc("request_withdrawal", { _amount: data.amount, _phone: phone });
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: `Withdrawal ${ref} requested. We will send it to M-Pesa after review.` };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ full_name: z.string().trim().min(2).max(100), phone: z.string().max(20), county: z.string().trim().max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    const phone = data.phone ? normalizeKenyanPhone(data.phone) : null;
    if (data.phone && !phone) return { ok: false, message: "Enter a valid Kenyan phone number." };
    const db = await admin();
    const { error } = await db.from("profiles").update({ full_name: data.full_name, phone, county: data.county || null, updated_at: new Date().toISOString() }).eq("id", context.userId);
    return error ? { ok: false, message: error.message } : { ok: true, message: "Profile saved." };
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    await db.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", context.userId).is("read_at", null);
    return { ok: true };
  });

export const listNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const { data } = await db.from("notifications").select("*").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(30);
    return data ?? [];
  });

export const createTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ subject: z.string().trim().min(4).max(150), category: z.string().max(40), message: z.string().trim().min(5).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: t, error } = await db.from("support_tickets").insert({ user_id: context.userId, subject: data.subject, category: data.category }).select("id").single();
    if (error) return { ok: false, message: error.message };
    await db.from("support_messages").insert({ ticket_id: t.id, sender_id: context.userId, message: data.message });
    return { ok: true, message: "Ticket opened. Our team will reply soon." };
  });

/* ---------------- Business ---------------- */

export const getBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const { data: business } = await db.from("businesses").select("*").eq("owner_id", context.userId).maybeSingle();
    if (!business) return { business: null, campaigns: [] };
    const { data: campaigns } = await db.from("campaigns").select("*").eq("business_id", business.id).order("created_at", { ascending: false });
    const ids = (campaigns ?? []).map((c) => c.id);
    const { data: subs } = ids.length ? await db.from("task_submissions").select("campaign_id, status").in("campaign_id", ids) : { data: [] };
    return {
      business,
      campaigns: (campaigns ?? []).map((c) => {
        const s = (subs ?? []).filter((x) => x.campaign_id === c.id);
        const rewarded = s.filter((x) => x.status === "rewarded").length;
        return { ...c, participants: s.length, rewarded, spent: rewarded * Number(c.reward_amount), conversion: s.length ? Math.round((rewarded / s.length) * 100) : 0 };
      }),
    };
  });

export const saveBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ name: z.string().trim().min(2).max(120), description: z.string().trim().max(1000), website: z.string().trim().max(200), registration_number: z.string().trim().max(60) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: existing } = await db.from("businesses").select("id").eq("owner_id", context.userId).maybeSingle();
    const payload = { name: data.name, description: data.description || null, website: data.website || null, registration_number: data.registration_number || null };
    const res = existing
      ? await db.from("businesses").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", existing.id)
      : await db.from("businesses").insert({ ...payload, owner_id: context.userId, verification_status: data.registration_number ? "pending" : "unverified" });
    if (res.error) return { ok: false, message: res.error.message };
    await db.from("user_roles").upsert({ user_id: context.userId, role: "business" }, { onConflict: "user_id,role", ignoreDuplicates: true });
    return { ok: true, message: "Business profile saved." };
  });

const campaignSchema = z.object({
  title: z.string().trim().min(4).max(140),
  description: z.string().trim().min(10).max(2000),
  category: z.string().min(2).max(40),
  reward_amount: z.number().int().min(10).max(10000),
  budget: z.number().int().min(100).max(10000000),
  participant_limit: z.number().int().min(1).max(100000),
  estimated_minutes: z.number().int().min(1).max(600),
  requirements: z.string().trim().max(1000),
  verification_method: z.string().trim().min(2).max(120),
  audience: z.string().trim().max(200),
  ends_at: z.string().max(40),
  submit: z.boolean(),
});

export const createCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => campaignSchema.parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: b } = await db.from("businesses").select("id").eq("owner_id", context.userId).maybeSingle();
    if (!b) return { ok: false, message: "Create your business profile first." };
    if (data.reward_amount * data.participant_limit > data.budget) return { ok: false, message: "Budget must cover reward × participant limit." };
    const slug = `${data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}-${Math.random().toString(36).slice(2, 7)}`;
    const { error } = await db.from("campaigns").insert({
      business_id: b.id,
      title: data.title,
      slug,
      description: data.description,
      category: data.category,
      reward_amount: data.reward_amount,
      budget: data.budget,
      participant_limit: data.participant_limit,
      estimated_minutes: data.estimated_minutes,
      requirements: data.requirements || null,
      verification_method: data.verification_method,
      audience: data.audience || null,
      ends_at: data.ends_at ? new Date(data.ends_at).toISOString() : null,
      starts_at: new Date().toISOString(),
      status: data.submit ? "admin_review" : "draft",
    } as never);
    return error ? { ok: false, message: error.message } : { ok: true, message: data.submit ? "Campaign sent for admin review." : "Draft saved." };
  });

export const setCampaignStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), action: z.enum(["submit", "pause", "resume", "complete"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: b } = await db.from("businesses").select("id").eq("owner_id", context.userId).maybeSingle();
    const { data: c } = await db.from("campaigns").select("id, status, business_id").eq("id", data.id).maybeSingle();
    if (!b || !c || c.business_id !== b.id) return { ok: false, message: "Campaign not found." };
    const allowed: Record<string, [string[], string]> = {
      submit: [["draft", "rejected"], "admin_review"],
      pause: [["live"], "paused"],
      resume: [["paused"], "live"],
      complete: [["live", "paused"], "completed"],
    };
    const [from, to] = allowed[data.action];
    if (!from.includes(c.status)) return { ok: false, message: "That change is not allowed right now." };
    await db.from("campaigns").update({ status: to as never, updated_at: new Date().toISOString() }).eq("id", c.id);
    return { ok: true, message: "Campaign updated." };
  });
