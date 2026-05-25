import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { getServerSupabase } from '@/lib/supabase-server';
import { getStripe } from '@/lib/stripe-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/account/orders/[id]/invoice
 *
 * Renvoie une URL hébergée par Stripe (`hosted_invoice_url`) que le
 * navigateur peut ouvrir tel quel — c'est la page de facture Stripe avec
 * le bouton "Télécharger PDF" déjà conforme. On NE sert PAS le binaire
 * nous-mêmes (pas de proxy, pas de header content-type à gérer, pas de
 * fuite via cache CDN).
 *
 * Garde de sécurité critique :
 *
 *   - getServerSupabase().auth.getUser() → 401 si pas de session.
 *   - SELECT la ligne `orders` filtrée par `id = <param> AND user_id =
 *     auth.uid()`. La RLS `orders_owner_select` filtre déjà côté
 *     Postgres ; la double vérif côté route ferme la surface si la
 *     policy bouge un jour ou si is_admin() est vrai (un admin ne doit
 *     pas pouvoir tirer la facture d'un autre user via cette route —
 *     cf. lot subscriptions, même garde).
 *   - 404 indifférencié : on ne révèle JAMAIS qu'une commande appartient
 *     à quelqu'un d'autre. "Not found" couvre les 3 cas : inexistante,
 *     appartient à autrui, pas encore d'invoice.
 *
 * Résolution de l'invoice :
 *
 *   1. Si `orders.stripe_invoice_id` est rempli → 1 call Stripe direct.
 *   2. Sinon (commande pré-déploiement ou mode payment sans invoice) :
 *      retrieve Checkout Session avec expand=['invoice'] → fallback.
 *   3. Si rien ne ressort (commande pending, paiement abandonné, …) →
 *      404 avec code 'no_invoice' pour que l'UI affiche un message
 *      clair plutôt qu'un crash.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type OrderRow = {
  id: string;
  user_id: string;
  status: string;
  stripe_invoice_id: string | null;
  stripe_checkout_session_id: string | null;
};

function notFound(code: 'order_not_found' | 'no_invoice'): NextResponse {
  return NextResponse.json({ error: 'not found', code }, { status: 404 });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'invalid order id' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'authentication required' }, { status: 401 });
  }

  const { data: row, error: selectError } = await supabase
    .from('orders')
    .select('id, user_id, status, stripe_invoice_id, stripe_checkout_session_id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (selectError) {
    return NextResponse.json(
      { error: `lookup failed: ${selectError.message}` },
      { status: 500 },
    );
  }
  if (!row) return notFound('order_not_found');
  const order = row as OrderRow;

  const stripe = getStripe();
  let invoice: Stripe.Invoice | null = null;

  try {
    if (order.stripe_invoice_id) {
      invoice = await stripe.invoices.retrieve(order.stripe_invoice_id);
    } else if (order.stripe_checkout_session_id) {
      // Fallback pour les commandes antérieures à la migration
      // 20260627150000_orders_stripe_invoice_id (avant qu'on stocke
      // l'invoice id) : on remonte via la session.
      const session = await stripe.checkout.sessions.retrieve(
        order.stripe_checkout_session_id,
        { expand: ['invoice'] },
      );
      if (session.invoice) {
        invoice =
          typeof session.invoice === 'string'
            ? await stripe.invoices.retrieve(session.invoice)
            : (session.invoice as Stripe.Invoice);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[account/invoice] stripe lookup failed for order ${order.id}: ${message}`,
    );
    return NextResponse.json(
      { error: 'unable to fetch invoice from Stripe' },
      { status: 502 },
    );
  }

  if (!invoice || !invoice.hosted_invoice_url) {
    // Commande pending, paiement abandonné, ou invoice sans page hébergée.
    return notFound('no_invoice');
  }

  return NextResponse.json({
    url: invoice.hosted_invoice_url,
    invoice_id: invoice.id,
    // Liens utiles côté UI si elle veut afficher la date ou un fallback
    // direct vers le PDF (le hosted_invoice_url est préféré côté UX).
    invoice_pdf: invoice.invoice_pdf ?? null,
    number: invoice.number ?? null,
  });
}
