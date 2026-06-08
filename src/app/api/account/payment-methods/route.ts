import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { getServerSupabase } from '@/lib/supabase-server';
import { getStripe } from '@/lib/stripe-server';
import { getOrCreateStripeCustomer } from '@/lib/stripe-customer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * /api/account/payment-methods
 *
 * GET  — liste les cartes Stripe du user connecté + l'id de la carte par
 *        défaut (invoice_settings.default_payment_method).
 * POST — crée un SetupIntent pour permettre l'ajout d'une nouvelle carte
 *        via Stripe Elements côté client. Retourne le client_secret.
 *
 * Owner-guard :
 *   - getServerSupabase().auth.getUser() → 401 si pas de session.
 *   - getOrCreateStripeCustomer(supabase, user) → le customer Stripe est
 *     TOUJOURS résolu depuis profile.stripe_customer_id (lu via la
 *     session du user, RLS self-read). Aucun customer arbitraire n'est
 *     jamais accepté du client. Conséquence : un user ne peut lister
 *     que ses propres cartes.
 *
 * SetupIntent.usage = 'off_session' : la carte enregistrée pourra être
 * facturée silencieusement plus tard pour les renouvellements
 * d'abonnement (sinon Stripe demanderait SCA à chaque charge récurrente).
 */

type UiCard = {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
};

function toUiCard(pm: Stripe.PaymentMethod): UiCard | null {
  if (pm.type !== 'card' || !pm.card) return null;
  return {
    id: pm.id,
    brand: pm.card.brand,
    last4: pm.card.last4,
    exp_month: pm.card.exp_month,
    exp_year: pm.card.exp_year,
  };
}

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'authentication required' }, { status: 401 });
  }

  // Si l'utilisateur n'a pas encore de stripe_customer_id, sa liste est
  // vide par construction — on évite un appel Stripe inutile.
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle();
  const customerId = (profile as { stripe_customer_id: string | null } | null)?.stripe_customer_id ?? null;
  if (!customerId) {
    return NextResponse.json({ cards: [], defaultCardId: null });
  }

  const stripe = getStripe();
  try {
    const [methods, customer] = await Promise.all([
      stripe.paymentMethods.list({ customer: customerId, type: 'card' }),
      stripe.customers.retrieve(customerId),
    ]);

    const cards: UiCard[] = methods.data
      .map(toUiCard)
      .filter((c): c is UiCard => c !== null);

    // customers.retrieve peut renvoyer un DeletedCustomer ; on garde
    // defaultCardId à null dans ce cas.
    let defaultCardId: string | null = null;
    if (!('deleted' in customer) || !customer.deleted) {
      const def = (customer as Stripe.Customer).invoice_settings?.default_payment_method;
      defaultCardId = typeof def === 'string' ? def : (def?.id ?? null);
    }

    return NextResponse.json({ cards, defaultCardId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[account/payment-methods GET] stripe failure for user ${user.id}: ${message}`);
    return NextResponse.json(
      { error: 'unable to fetch payment methods' },
      { status: 502 },
    );
  }
}

export async function POST(_request: NextRequest): Promise<NextResponse> {
  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'authentication required' }, { status: 401 });
  }

  let customerId: string;
  try {
    customerId = await getOrCreateStripeCustomer(supabase, user, {
      email: user.email ?? undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[account/payment-methods POST] customer resolution failed: ${message}`);
    return NextResponse.json(
      { error: 'unable to prepare card setup' },
      { status: 502 },
    );
  }

  const stripe = getStripe();
  try {
    const intent = await stripe.setupIntents.create({
      customer: customerId,
      usage: 'off_session',
      payment_method_types: ['card'],
    });
    if (!intent.client_secret) {
      throw new Error('setupIntent.client_secret is null');
    }
    return NextResponse.json({ clientSecret: intent.client_secret });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[account/payment-methods POST] stripe setupIntent failure: ${message}`);
    return NextResponse.json(
      { error: 'unable to prepare card setup' },
      { status: 502 },
    );
  }
}
