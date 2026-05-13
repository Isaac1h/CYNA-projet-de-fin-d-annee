import 'server-only';
import { Resend } from 'resend';

/**
 * Resend client accessor + senders métier (ticket 39, partie famille 2).
 *
 * `import 'server-only'` empêche Next.js de bundler ce module côté client :
 * RESEND_API_KEY ne fuit jamais dans le browser. Tout fichier qui importe
 * ce module devient automatiquement server-only.
 *
 * Lazy + cached comme stripe-server.ts / supabase-service.ts : on évite
 * de crasher le build quand l'env est absent au static-analysis time.
 * Les failures arrivent sur le premier appel réel.
 *
 * Templates : HTML inline. Volontairement simple — pas de react-email ni
 * de fichiers de templates séparés tant qu'on n'a qu'un seul type de mail.
 * À refacto quand on aura 3+ types d'emails (reset MDP, facture renouvelée,
 * commande annulée…).
 */

let cached: Resend | null = null;

function getResend(): Resend {
  if (cached) return cached;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      'RESEND_API_KEY is not set. Add it to .env.local before sending emails from a route handler.',
    );
  }
  cached = new Resend(apiKey);
  return cached;
}

function defaultFrom(): string {
  // `onboarding@resend.dev` est l'expéditeur de test fourni par Resend
  // sans nécessiter de domaine vérifié. À remplacer par EMAIL_FROM
  // pointant sur un alias du domaine vérifié pour la prod.
  return process.env.EMAIL_FROM ?? 'Cyna <onboarding@resend.dev>';
}

function originForLinks(): string {
  // Lien "Voir ma facture" → /orders. NEXT_PUBLIC_SITE_URL préféré pour
  // prod ; fallback localhost utile en dev quand l'URL n'est pas posée.
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

type OrderItem = {
  name: string;
  quantity: number;
  unit_amount: number;          // centimes
  billing_interval: 'monthly' | 'annual';
  unit_type: 'flat' | 'per_user' | 'per_device';
};

const INTERVAL_LABEL: Record<OrderItem['billing_interval'], string> = {
  monthly: 'Mensuel',
  annual: 'Annuel',
};

const UNIT_LABEL: Record<OrderItem['unit_type'], string> = {
  flat: 'Forfait',
  per_user: 'Par utilisateur',
  per_device: 'Par appareil',
};

function formatPrice(centimes: number, currency: string): string {
  const code = (currency || 'eur').toUpperCase();
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: code,
    }).format(centimes / 100);
  } catch {
    return `${(centimes / 100).toFixed(2)} ${code}`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderOrderConfirmationHtml(params: {
  orderNumber: string;
  orderId: string;
  items: OrderItem[];
  totalCents: number;
  currency: string;
}): { subject: string; html: string; text: string } {
  const { orderNumber, items, totalCents, currency } = params;
  const total = formatPrice(totalCents, currency);
  const ordersUrl = `${originForLinks()}/orders`;

  const rowsHtml = items
    .map((item) => {
      const line = formatPrice(item.unit_amount * item.quantity, currency);
      const detail = `${INTERVAL_LABEL[item.billing_interval]} · ${UNIT_LABEL[item.unit_type]} · ×${item.quantity}`;
      return `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">
            <div style="font-weight:600;color:#0f172a;">${escapeHtml(item.name)}</div>
            <div style="font-size:12px;color:#64748b;">${escapeHtml(detail)}</div>
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#0f172a;white-space:nowrap;">${line}</td>
        </tr>`;
    })
    .join('');

  const rowsText = items
    .map(
      (item) =>
        `- ${item.name} (${INTERVAL_LABEL[item.billing_interval]} · ${UNIT_LABEL[item.unit_type]} · ×${item.quantity}) : ${formatPrice(item.unit_amount * item.quantity, currency)}`,
    )
    .join('\n');

  const subject = `Commande Cyna ${orderNumber} confirmée`;

  const html = `<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#0f172a;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f8fafc;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr><td style="padding:24px 24px 0;">
            <h1 style="margin:0;font-size:20px;color:#2B2086;">Commande confirmée</h1>
            <p style="margin:8px 0 0;color:#475569;font-size:14px;">
              Merci pour votre commande. Votre numéro : <strong>${escapeHtml(orderNumber)}</strong>.
            </p>
          </td></tr>
          <tr><td style="padding:16px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #e5e7eb;border-radius:6px;">
              ${rowsHtml}
              <tr>
                <td style="padding:12px;font-weight:600;color:#0f172a;">Total</td>
                <td style="padding:12px;text-align:right;font-weight:700;color:#2B2086;font-size:16px;">${total}</td>
              </tr>
            </table>
          </td></tr>
          <tr><td style="padding:0 24px 24px;">
            <a href="${ordersUrl}" style="display:inline-block;background:#2B2086;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600;font-size:14px;">
              Voir ma commande et télécharger la facture
            </a>
            <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">
              La facture est disponible depuis votre espace personnel sur Cyna, après connexion.
              Pour toute question, répondez à ce mail ou contactez-nous depuis la page Outils.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const text = `Commande Cyna ${orderNumber} confirmée

Merci pour votre commande.

${rowsText}

Total : ${total}

Voir ma commande et télécharger la facture : ${ordersUrl}

Pour toute question, contactez-nous depuis la page Outils sur Cyna.`;

  return { subject, html, text };
}

// ── Ticket 45 — alerte rupture stock (destinée à l'admin, pas au client) ──

function renderRuptureAlertHtml(params: {
  productName: string;
  productId: string;
  actorEmail: string | null;
}): { subject: string; html: string; text: string } {
  const { productName, actorEmail } = params;
  const adminUrl = `${originForLinks()}/admin#products`;
  const when = new Date().toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const actor = actorEmail ?? 'un administrateur';
  const subject = `⚠ Rupture de stock — ${productName}`;

  const html = `<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#0f172a;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f8fafc;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr><td style="padding:24px 24px 0;">
            <h1 style="margin:0;font-size:20px;color:#b91c1c;">⚠ Rupture de stock</h1>
            <p style="margin:12px 0 0;color:#0f172a;font-size:15px;">
              Le produit <strong>${escapeHtml(productName)}</strong> vient de passer en rupture de stock.
            </p>
            <p style="margin:8px 0 0;font-size:13px;color:#475569;">
              Modification effectuée par ${escapeHtml(actor)} le ${escapeHtml(when)}.
            </p>
          </td></tr>
          <tr><td style="padding:16px 24px 24px;">
            <a href="${adminUrl}" style="display:inline-block;background:#2B2086;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600;font-size:14px;">
              Voir dans le back-office
            </a>
            <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">
              Cette alerte ne se répétera pas tant que le produit n&rsquo;aura pas
              été remis en stock.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const text = `Rupture de stock — ${productName}

Le produit ${productName} vient de passer en rupture de stock.
Modification effectuée par ${actor} le ${when}.

Voir dans le back-office : ${adminUrl}

Cette alerte ne se répétera pas tant que le produit n'aura pas été remis en stock.`;

  return { subject, html, text };
}

/**
 * Envoie l'email d'alerte rupture stock à l'admin.
 *
 * Destinataire = ADMIN_ALERT_EMAIL (env). Si non configurée, on log un
 * warn et on n'envoie rien — l'appelant reste best-effort et ne casse
 * pas la mutation produit. Aucun throw sur env manquante ; les vrais
 * échecs Resend en revanche throw pour que l'appelant log précisément.
 */
export async function sendRuptureAlert(params: {
  productName: string;
  productId: string;
  actorEmail: string | null;
}): Promise<void> {
  const to = process.env.ADMIN_ALERT_EMAIL;
  if (!to || to.trim().length === 0) {
    console.warn(
      '[rupture-alert] ADMIN_ALERT_EMAIL is not set — email skipped. Set it in .env.local to enable alerts.',
    );
    return;
  }

  const { subject, html, text } = renderRuptureAlertHtml(params);

  const resend = getResend();
  const { error } = await resend.emails.send({
    from: defaultFrom(),
    to,
    subject,
    html,
    text,
  });
  if (error) {
    throw new Error(`resend.emails.send rupture alert failed: ${error.message ?? 'unknown'}`);
  }
}

/**
 * Envoie l'email de confirmation de commande. Throw si Resend renvoie
 * une erreur ou si l'env n'est pas configurée — l'appelant attrape
 * pour rester best-effort (cf. webhook handler).
 */
export async function sendOrderConfirmation(params: {
  to: string;
  orderNumber: string;
  orderId: string;
  items: OrderItem[];
  totalCents: number;
  currency: string;
}): Promise<void> {
  if (!params.to || params.to.trim().length === 0) {
    throw new Error('order confirmation: recipient email is required');
  }

  const { subject, html, text } = renderOrderConfirmationHtml(params);

  const resend = getResend();
  const { error } = await resend.emails.send({
    from: defaultFrom(),
    to: params.to,
    subject,
    html,
    text,
  });
  if (error) {
    // Resend SDK return shape : { error: { message, name } }. On throw
    // pour que l'appelant catch et log proprement ; le best-effort vit
    // côté webhook (try/catch local autour de l'appel).
    throw new Error(`resend.emails.send failed: ${error.message ?? 'unknown'}`);
  }
}
