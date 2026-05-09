-- Ticket 39 (partie famille 2) — email de confirmation de commande.
-- Garde d'idempotence par-commande pour le webhook
-- checkout.session.completed : Stripe peut rejouer l'event (at-least-once
-- semantic + reset de stripe_events sur erreur du handler), il faut
-- garantir qu'un même order ne déclenche pas plusieurs envois Resend.
--
-- Pattern : UPDATE ... SET confirmation_email_sent_at = now()
--           WHERE id = $1 AND confirmation_email_sent_at IS NULL
--           RETURNING id;
-- 1 ligne renvoyée = claim acquis, on envoie. 0 ligne = quelqu'un a
-- déjà tenté, on saute. PG sérialise les UPDATE concurrents sur la
-- même ligne — atomique par construction.
--
-- Trade-off documenté : on pose le timestamp AVANT envoi. Un échec
-- Resend après claim NE déclenche PAS un nouveau ticket (préférer
-- 0 email à 2). Resend manuel : SET confirmation_email_sent_at = NULL
-- via service_role + stripe events resend.

alter table public.orders
  add column if not exists confirmation_email_sent_at timestamptz;

comment on column public.orders.confirmation_email_sent_at is
  'Posée par le webhook checkout.session.completed APRÈS claim atomique
   et tentative d''envoi du mail de confirmation (Resend). NULL = jamais
   tenté. NOT NULL = au moins une tentative (succès OU échec) ; on
   n''envoie pas un deuxième mail. Pour rejouer : UPDATE ... = NULL via
   service_role + stripe events resend.';
