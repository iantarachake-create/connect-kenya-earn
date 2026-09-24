import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ActivationCard, useRegistration } from "@/components/activation-card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: { mode: "login" } });
    return { user: data.user };
  },
  component: RegistrationGate,
});

function RegistrationGate() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const reg = useRegistration();
  const admin = useQuery({
    queryKey: ["is-admin", user.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      return Boolean(data);
    },
  });

  if (reg.isLoading || admin.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading your account…
      </div>
    );
  }

  if (reg.data?.paid || admin.data) return <Outlet />;

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Activate your EARNPESA account</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A one-time registration fee of KSH 300 is required before you can use the platform.
            Pay securely via M-Pesa below.
          </p>
        </div>
        <ActivationCard />
        <Button
          variant="ghost"
          className="w-full"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/" });
          }}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}
