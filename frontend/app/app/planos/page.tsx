import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSubscription, isPro, PLAN_LABELS } from "@/lib/plan";
import type { Plan } from "@/lib/plan";
import { PlanosClient } from "./PlanosClient";

export default async function PlanosPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";
  const sub = await getSubscription(token);

  const params = await searchParams;

  return (
    <PlanosClient
      currentPlan={sub.plan}
      hasStripe={sub.has_stripe}
      periodEnd={sub.current_period_end}
      successParam={params.success === "1"}
      canceledParam={params.canceled === "1"}
    />
  );
}
