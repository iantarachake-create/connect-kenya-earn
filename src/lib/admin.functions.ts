import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
  if (error || !data) throw new Error("Forbidden");
}

export const getAdminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const count = async (table: string, filter?: (q: any) => any) => {
      let q = supabaseAdmin.from(table as never).select("*", { count: "exact", head: true });
      if (filter) q = filter(q);
      const { count: c } = await q;
      return c ?? 0;
    };
    const [users, businesses, campaigns, liveCampaigns, pendingWithdrawals, fraud, tickets, payments] = await Promise.all([
      count("profiles"),
      count("businesses"),
      count("campaigns"),
      count("campaigns", (q) => q.eq("status", "live")),
      count("withdrawal_requests", (q) => q.in("status", ["pending", "reviewing", "approved"])),
      count("fraud_reports", (q) => q.eq("status", "open")),
      count("support_tickets", (q) => q.neq("status", "closed")),
      count("registration_payments", (q) => q.eq("status", "success")),
    ]);
    const { data: wallets } = await supabaseAdmin.from("wallets").select("total_earned, total_withdrawn, available_balance");
    const sum = (key: "total_earned" | "total_withdrawn" | "available_balance") =>
      (wallets ?? []).reduce((acc, w) => acc + Number(w[key] ?? 0), 0);
    return {
      users,
      businesses,
      campaigns,
      liveCampaigns,
      pendingWithdrawals,
      fraud,
      tickets,
      activatedMembers: payments,
      registrationRevenue: payments * 300,
      totalRewarded: sum("total_earned"),
      totalWithdrawn: sum("total_withdrawn"),
      walletLiability: sum("available_balance"),
    };
  });

export const listAdminQueues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [withdrawals, campaigns, members, fraud, tickets] = await Promise.all([
      supabaseAdmin
        .from("withdrawal_requests")
        .select("id, amount, mpesa_phone, reference_id, status, created_at, mpesa_receipt, user_id")
        .order("created_at", { ascending: false })
        .limit(40),
      supabaseAdmin
        .from("campaigns")
        .select("id, title, category, reward_amount, budget, status, is_verified, created_at")
        .in("status", ["submitted", "admin_review", "approved", "live"])
        .order("created_at", { ascending: false })
        .limit(40),
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, phone, county, referral_code, registration_paid_at, created_at")
        .order("created_at", { ascending: false })
        .limit(40),
      supabaseAdmin.from("fraud_reports").select("id, subject_type, reason, status, created_at").order("created_at", { ascending: false }).limit(20),
      supabaseAdmin.from("support_tickets").select("id, subject, category, status, priority, created_at").order("created_at", { ascending: false }).limit(20),
    ]);
    return {
      withdrawals: withdrawals.data ?? [],
      campaigns: campaigns.data ?? [],
      members: members.data ?? [],
      fraud: fraud.data ?? [],
      tickets: tickets.data ?? [],
    };
  });

export const reviewWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; action: "complete" | "reject"; receipt?: string; notes?: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: request } = await supabaseAdmin
      .from("withdrawal_requests")
      .select("id, user_id, amount, status, reference_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!request) return { ok: false, message: "Withdrawal not found." };
    if (request.status === "completed" || request.status === "rejected") {
      return { ok: false, message: "This withdrawal was already closed." };
    }

    const { data: wallet } = await supabaseAdmin
      .from("wallets")
      .select("pending_balance, available_balance, total_withdrawn")
      .eq("user_id", request.user_id)
      .maybeSingle();
    const amount = Number(request.amount);
    const now = new Date().toISOString();

    if (data.action === "complete") {
      await supabaseAdmin
        .from("wallets")
        .update({
          pending_balance: Math.max(0, Number(wallet?.pending_balance ?? 0) - amount),
          total_withdrawn: Number(wallet?.total_withdrawn ?? 0) + amount,
          updated_at: now,
        })
        .eq("user_id", request.user_id);
      await supabaseAdmin
        .from("withdrawal_requests")
        .update({ status: "completed", mpesa_receipt: data.receipt ?? null, review_notes: data.notes ?? null, reviewed_by: context.userId, updated_at: now })
        .eq("id", data.id);
      await supabaseAdmin.from("notifications").insert({
        user_id: request.user_id,
        category: "withdrawal",
        title: "Withdrawal paid",
        message: `Your withdrawal ${request.reference_id} of KSH ${amount} was sent to M-Pesa.`,
      });
      return { ok: true, message: "Withdrawal marked as paid." };
    }

    await supabaseAdmin
      .from("wallets")
      .update({
        pending_balance: Math.max(0, Number(wallet?.pending_balance ?? 0) - amount),
        available_balance: Number(wallet?.available_balance ?? 0) + amount,
        updated_at: now,
      })
      .eq("user_id", request.user_id);
    await supabaseAdmin.from("wallet_transactions").insert({
      user_id: request.user_id,
      amount,
      type: "adjustment",
      status: "completed",
      reference_id: `RV-${request.reference_id}`,
      description: `Withdrawal ${request.reference_id} reversed`,
    });
    await supabaseAdmin
      .from("withdrawal_requests")
      .update({ status: "rejected", review_notes: data.notes ?? null, reviewed_by: context.userId, updated_at: now })
      .eq("id", data.id);
    await supabaseAdmin.from("notifications").insert({
      user_id: request.user_id,
      category: "withdrawal",
      title: "Withdrawal rejected",
      message: `Your withdrawal ${request.reference_id} was rejected and KSH ${amount} returned to your balance.`,
    });
    return { ok: true, message: "Withdrawal rejected and funds returned." };
  });

export const reviewCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; action: "approve" | "reject" | "verify" }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch =
      data.action === "approve"
        ? { status: "live" as const }
        : data.action === "reject"
          ? { status: "rejected" as const }
          : { is_verified: true };
    const { error } = await supabaseAdmin.from("campaigns").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", data.id);
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: data.action === "verify" ? "Campaign marked as verified." : `Campaign ${data.action}d.` };
  });

export const reviewSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; action: "approve" | "reject"; notes?: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: submission } = await supabaseAdmin
      .from("task_submissions")
      .select("id, user_id, status, campaign_id, campaigns(reward_amount, title)")
      .eq("id", data.id)
      .maybeSingle();
    if (!submission) return { ok: false, message: "Submission not found." };
    if (submission.status === "rewarded" || submission.status === "rejected") {
      return { ok: false, message: "This submission was already reviewed." };
    }
    const now = new Date().toISOString();
    if (data.action === "reject") {
      await supabaseAdmin
        .from("task_submissions")
        .update({ status: "rejected", reviewer_notes: data.notes ?? null, reviewed_at: now, updated_at: now })
        .eq("id", data.id);
      return { ok: true, message: "Submission rejected." };
    }

    const reward = Number((submission as any).campaigns?.reward_amount ?? 0);
    const { data: wallet } = await supabaseAdmin
      .from("wallets")
      .select("available_balance, total_earned")
      .eq("user_id", submission.user_id)
      .maybeSingle();
    await supabaseAdmin
      .from("wallets")
      .update({
        available_balance: Number(wallet?.available_balance ?? 0) + reward,
        total_earned: Number(wallet?.total_earned ?? 0) + reward,
        updated_at: now,
      })
      .eq("user_id", submission.user_id);
    await supabaseAdmin.from("wallet_transactions").insert({
      user_id: submission.user_id,
      amount: reward,
      type: "campaign_reward",
      status: "completed",
      reference_id: `RW-${submission.id.slice(0, 10).toUpperCase()}`,
      description: `Reward for ${(submission as any).campaigns?.title ?? "campaign"}`,
    });
    await supabaseAdmin
      .from("task_submissions")
      .update({ status: "rewarded", reviewer_notes: data.notes ?? null, reviewed_at: now, rewarded_at: now, updated_at: now })
      .eq("id", data.id);
    await supabaseAdmin.from("notifications").insert({
      user_id: submission.user_id,
      category: "reward",
      title: "Reward approved",
      message: `KSH ${reward} was added to your available balance.`,
    });
    return { ok: true, message: `Approved and KSH ${reward} credited.` };
  });

export const listPendingSubmissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("task_submissions")
      .select("id, status, created_at, user_id, campaigns(title, reward_amount)")
      .in("status", ["submitted", "verification"])
      .order("created_at", { ascending: false })
      .limit(40);
    return (data ?? []).map((row) => ({
      id: row.id,
      status: row.status,
      created_at: row.created_at,
      user_id: row.user_id,
      title: (row as any).campaigns?.title ?? "Campaign",
      reward: Number((row as any).campaigns?.reward_amount ?? 0),
    }));
  });
