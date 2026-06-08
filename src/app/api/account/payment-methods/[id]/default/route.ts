import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getStripe } from '@/lib/stripe-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/account/payment-methods/[id]/default
 *
 * Définit la carte comme moyen de paiement par défaut pour les factures
 * (utilisé par Stripe pour les renouvellements d'abonnement).
 *
 * Source de vérité = Stripe : on n'a pas de colonne `is_default` côté
 * Postgres, c'est `customer.invoice_settings.default_payment_method`
 * qui pilote. La route GET liste cette valeur côté UI.
 *
 * MÊME owner-guard que DELETE — point sécurité critique du ticket :
 *   1. auth → 401
 *   2. profile.stripe_customer_id
 *   3. stripe.paymentMethods.retrieve(pm_id) → 404 si not_found
 *   4. pm.customer === user.stripe_customer_id → 404 indifférencié sinon
 *   5. stripe.customers.update(customer, { invoice_settings:
 *      { default_payment_method: pm_id } })
 */

const PM_ID_RE = /^pm_[A-Za-z0-9_]+$/;

function notFound(): NextResponse {
  return NextResponse.json({ error: 'not found' }, { status: 404 });
}

export async function PATCH(
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
  if (!customerId) return notFound();

  const stripe = getStripe();

  let pm;
  try {
    pm = await stripe.paymentMethods.retrieve(params.id);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'resource_missing') return notFound();
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[pm /default] retrieve failed for ${params.id}: ${message}`);
    return NextResponse.json({ error: 'stripe lookup failed' }, { status: 502 });
  }
  const pmCustomer = typeof pm.customer === 'string' ? pm.customer : (pm.customer?.id ?? null);
  if (pmCustomer !== customerId) {
    console.warn(
      `[pm /default] owner-guard refused: user ${user.id} (customer ${customerId}) ` +
        `tried to set default to ${params.id} owned by ${pmCustomer}`,
    );
    return notFound();
  }

  try {
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: params.id },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[pm /default] customers.update failed: ${message}`);
    return NextResponse.json(
      { error: 'unable to set default card, please try again' },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, defaultCardId: params.id });
}
