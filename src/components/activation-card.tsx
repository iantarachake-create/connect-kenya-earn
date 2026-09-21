import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { BadgeCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import {
  confirmRegistrationPayment,
  getRegistrationStatus,
  startRegistrationPayment,
  REGISTRATION_FEE_KES,
} from "@/lib/payments.functions";
import { KENYAN_PHONE_HINT } from "@/lib/phone";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function useRegistration() {
  const fn = useServerFn(getRegistrationStatus);
  return useQuery({ queryKey: ["registration"], queryFn: () => fn({ data: undefined as never }) });
}

export function ActivationCard() {
  const { data, isLoading } = useRegistration();
  const queryClient = useQueryClient();
  const start = useServerFn(startRegistrationPayment);
  const confirm = useServerFn(confirmRegistrationPayment);
  const [phone, setPhone] = useState("");
  const [reference, setReference] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (data?.phone && !phone) setPhone(`0${data.phone.slice(3)}`);
  }, [data?.phone]);

  const pay = useMutation({
    mutationFn: () => start({ data: { phone } }),
    onSuccess: (result) => {
      setNote(result.message);
      if (result.status === "success") {
        toast.success(result.message);
        void queryClient.invalidateQueries({ queryKey: ["registration"] });
      } else if (result.status === "pending" && result.reference) {
        setReference(result.reference);
        toast.info(result.message);
      } else {
        toast.error(result.message);
      }
    },
    onError: () => toast.error("We could not start the payment. Please try again."),
  });

  useEffect(() => {
    if (!reference) return;
    const id = setInterval(async () => {
      const result = await confirm({ data: { reference } });
      setNote(result.message);
      if (result.status === "success") {
        setReference(null);
        toast.success(result.message);
        void queryClient.invalidateQueries({ queryKey: ["registration"] });
      } else if (result.status === "failed") {
        setReference(null);
        toast.error(result.message);
      }
    }, 6000);
    return () => clearInterval(id);
  }, [reference]);

  if (isLoading || data?.paid) return null;

  return (
    <section className="rounded-xl border-2 border-primary/30 bg-card p-5 premium-shadow">
      <div className="flex items-center gap-2 text-primary">
        <BadgeCheck className="size-5" />
        <p className="text-xs font-bold uppercase tracking-wide">Activate your account</p>
      </div>
      <h2 className="mt-2 font-display text-xl font-extrabold">One-time registration fee of KSH {REGISTRATION_FEE_KES}</h2>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Pay once by M-Pesa to unlock campaigns, referral rewards and withdrawals. You will receive a payment prompt on your
        phone — enter your M-Pesa PIN to confirm.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label htmlFor="mpesa-phone">M-Pesa phone number</Label>
          <Input
            id="mpesa-phone"
            className="mt-2 h-11"
            inputMode="tel"
            placeholder="0111385747"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">{KENYAN_PHONE_HINT}</p>
        </div>
        <Button className="h-11" disabled={pay.isPending || Boolean(reference)} onClick={() => pay.mutate()}>
          <Smartphone /> {reference ? "Waiting for PIN…" : pay.isPending ? "Sending prompt…" : `Pay KSH ${REGISTRATION_FEE_KES}`}
        </Button>
      </div>
      {note && <p role="status" className="mt-3 rounded-md bg-muted p-3 text-sm">{note}</p>}
    </section>
  );
}
