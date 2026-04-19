/**
 * Plan utilities — server-side helpers for reading a user's subscription.
 * Use in server components and layouts only.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

export type Plan = "free" | "pro" | "enterprise";

export interface Subscription {
  plan: Plan;
  current_period_end: string | null;
  has_stripe: boolean;
}

const FREE: Subscription = { plan: "free", current_period_end: null, has_stripe: false };

/**
 * Fetch the authenticated user's current subscription from the backend.
 * Pass the Supabase access token from the server session.
 * Returns { plan: "free" } on any error — never throws.
 */
export async function getSubscription(token: string): Promise<Subscription> {
  if (!token) return FREE;
  try {
    const res = await fetch(`${API}/api/billing/subscription`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 60 }, // cache for 60 s — plan rarely changes
    });
    if (!res.ok) return FREE;
    return (await res.json()) as Subscription;
  } catch {
    return FREE;
  }
}

export const PLAN_LABELS: Record<Plan, string> = {
  free:       "Básico",
  pro:        "Profissional",
  enterprise: "Enterprise",
};

export function isPro(plan: Plan): boolean {
  return plan === "pro" || plan === "enterprise";
}

export function isEnterprise(plan: Plan): boolean {
  return plan === "enterprise";
}
