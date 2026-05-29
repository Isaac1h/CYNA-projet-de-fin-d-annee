import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getStripe } from '@/lib/stripe-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * DELETE /api/account/payment-methods/[id]
 *
 * Détache une carte du customer Stripe du user connecté.
 *
 * Owner-guard CRITIQUE (point sécurité de ce ticket) :
 *
 *   1. auth.getUser() → 401 si pas de session.
 *   2. Lit profile.stripe_customer_id du user (RLS self-read).
 *   3. stripe.paymentMethods.retrieve(pm_id) → si Stripe renvoie not_found,
 *      on remonte 404 indifférencié.
 *   4. Compare pm.customer au stripe_customer_id du user → si différent,
 *      on remonte 404 indifférencié (NE révèle JAMAIS l'existence
 *      d'une carte appartenant à un autre user).
 *   5. Seulement à ce moment-là, stripe.paymentMethods.detach(pm_id).
 *
 * Sans cette garde, un user A pourrait forger un pm_id appartenant à
 * un user B (devinable ou récupéré par d'autres moyens) et le détacher
 * — leak + déni de service. Le 404 indifférencié empêche aussi
 * l'énumération d'existence.
 */

const PM_ID_RE = /^pm_[A-Za-z0-9_]+$/;

function notFound(): NextResponse {
  return NextResponse.json({ error: 'not found' }, { status: 404 });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  if (!PM_ID_RE.test(params.id)) {
    return NextResponse.json({ error: 'invalid payment method id' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'authentication required' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle();
  const customerId = (profile as { stripe_customer_id: string | null } | null)?.stripe_customer_id ?? null;
  if (!customerId) {
    // User sans customer Stripe ne peut posséder aucune carte → 404.
    return notFound();
  }

  const stripe = getStripe();

  // ── OWNER-GUARD ───────────────────────────────────────────────────────
  let pm;
  try {
    pm = await stripe.paymentMethods.retrieve(params.id);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'resource_missing') return notFound();
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[pm DELETE] retrieve failed for ${params.id}: ${message}`);
    return NextResponse.json({ error: 'stripe lookup failed' }, { status: 502 });
  }
  const pmCustomer = typeof pm.customer === 'string' ? pm.customer : (pm.customer?.id ?? null);
  if (pmCustomer !== customerId) {
    // Indifférencié : on ne révèle pas que la carte existe et appartient
    // à quelqu'un d'autre.
    console.warn(
      `[pm DELETE] owner-guard refused: user ${user.id} (customer ${customerId}) ` +
        `tried to detach ${params.id} owned by ${pmCustomer}`,
    );
    return notFound();
  }
  // ──────────────────────────────────────────────────────────────────────

  try {
    await stripe.paymentMethods.detach(params.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[pm DELETE] detach failed for ${params.id}: ${message}`);
    return NextResponse.json(
      { error: 'unable to remove card, please try again' },
      { status: 502 },
    );
  }

  return NextResponse.json({ deleted: true });
}
