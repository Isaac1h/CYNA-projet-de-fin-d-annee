import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getStripe } from '@/lib/stripe-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/account/subscriptions/[id]/reactivate
 *
 * Annule une résiliation programmée (`cancel_at_period_end = false` côté
 * Stripe) tant que la période courante n'est pas terminée. Au-delà
 * (`status = 'canceled'`), la souscription est morte et il faut un
 * nouveau Checkout — pas couvert par cette route.
 *
 * Même garde owner que /cancel : on lit la sub depuis la base avec
 * `eq('user_id', user.id)`, on tire le `stripe_subscription_id` de la
 * ligne, et on ignore le body côté Stripe.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Les statuts pour lesquels une réactivation a un sens. 'canceled' veut
// dire que la période est passée et Stripe a vraiment terminé la sub —
// on ne réactive plus, on relance un Checkout.
const REACTIVATABLE_STATUSES: ReadonlySet<string> = new Set([
  'active',
  'trialing',
  'past_due',
]);

type SubRow = {
  id: string;
  user_id: string;
  stripe_subscription_id: string;
  status: string;
  cancel_at_period_end: boolean;
};

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'invalid subscription id' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'authentication required' }, { status: 401 });
  }

  const { data: row, error: selectError } = await supabase
    .from('subscriptions')
    .select('id, user_id, stripe_subscription_id, status, cancel_at_period_end')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (selectError) {
    return NextResponse.json(
      { error: `lookup failed: ${selectError.message}` },
      { status: 500 },
    );
  }
  if (!row) {
    return NextResponse.json({ error: 'subscription not found' }, { status: 404 });
  }
  const sub = row as SubRow;

  if (!REACTIVATABLE_STATUSES.has(sub.status)) {
    return NextResponse.json(
      {
        error: `subscription status '${sub.status}' cannot be reactivated`,
        status: sub.status,
        hint:
          sub.status === 'canceled'
            ? 'period already ended; start a new subscription'
            : undefined,
      },
      { status: 409 },
    );
  }

  if (!sub.cancel_at_period_end) {
    // Pas en attente de résiliation → idempotent.
    return NextResponse.json({ ok: true, already_active: true });
  }

  const stripe = getStripe();
  let updated;
  try {
    updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[account/reactivate] stripe.subscriptions.update failed for ${sub.stripe_subscription_id}: ${message}`,
    );
    return NextResponse.json(
      { error: 'unable to reactivate, please try again' },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    cancel_at_period_end: updated.cancel_at_period_end ?? false,
    cancel_at: updated.cancel_at,
    status: updated.status,
  });
}
