-- Lot Outils — Formulaire de contact réel.
-- Mirrors CDC §Outils + modele-donnees-CYNA.md §4 (RLS): canal de contact
-- lisible par l'admin, accessible en INSERT à tout visiteur, fermé en
-- lecture/écriture à tout non-admin.
--
-- Strict scope: table contact_messages + RLS + grants. Aucune RPC : un
-- simple INSERT suffit, les policies suffisent à fermer la surface. La
-- validation métier (formats, longueurs, anti-spam léger) reste côté
-- route/Edge Function — les CHECK ici ne sont qu'un filet de sécurité.
--
-- Prerequisites verified before apply:
--   public.profiles(id)  — owner FK target (nullable: visiteur anonyme OK)
--   public.is_admin()    — RBAC helper réutilisé par RLS

-- ---------------------------------------------------------------------------
-- contact_messages — un message = une ligne. Pas de fil de discussion,
-- pas de pièce jointe. On garde l'objet minimal et on ouvrira un canal
-- séparé si besoin (réponse par email côté support).
--
-- user_id ON DELETE SET NULL : si l'auteur supprime son compte plus tard,
-- le message reste lisible par le support (anonymisé côté FK). Cohérent
-- avec la conservation RGPD 12 mois annoncée dans ContactForm.
-- ---------------------------------------------------------------------------
create table if not exists public.contact_messages (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid                    references public.profiles(id) on delete set null,
  name       text        not null    check (length(name)    between 1 and 120),
  email      text        not null    check (length(email)   between 3 and 254),
  subject    text        not null    check (length(subject) between 1 and 200),
  message    text        not null    check (length(message) between 1 and 5000),
  status     text        not null    default 'new'
                                     check (status in ('new', 'read', 'archived')),
  created_at timestamptz not null    default now()
);

comment on table public.contact_messages is
  'Messages envoyés depuis le formulaire de contact public. INSERT ouvert
   à anon + authenticated via RLS ; SELECT/UPDATE réservés à l''admin.
   user_id NULL = visiteur non connecté.';

-- Tri BO : nouveaux d'abord. Index partiel parce que la file ''new''
-- est le seul cas chaud — les messages traités sont consultés à la marge.
create index if not exists contact_messages_new_created_idx
  on public.contact_messages (created_at desc)
  where status = 'new';

create index if not exists contact_messages_status_created_idx
  on public.contact_messages (status, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
--   INSERT  : anon + authenticated. Le with_check empêche un visiteur de
--             poser un user_id arbitraire (anti-spoofing). En complément,
--             les column grants ci-dessous interdisent à anon de passer
--             user_id du tout.
--
--   SELECT  : admin uniquement. Aucune policy pour anon/authenticated →
--             RLS deny par défaut. Un visiteur ne lit pas les messages
--             des autres, même les siens (pas de cas d'usage produit ici).
--
--   UPDATE  : admin uniquement (status: new → read → archived).
--
--   DELETE  : aucune policy → réservé au service_role (purges RGPD côté
--             tooling admin, pas exposé à l'UI).
-- ---------------------------------------------------------------------------
alter table public.contact_messages enable row level security;

drop policy if exists contact_messages_public_insert  on public.contact_messages;
drop policy if exists contact_messages_admin_select   on public.contact_messages;
drop policy if exists contact_messages_admin_update   on public.contact_messages;

create policy contact_messages_public_insert
  on public.contact_messages
  for insert to anon, authenticated
  with check (
    user_id is null
    or user_id = auth.uid()
  );

create policy contact_messages_admin_select
  on public.contact_messages
  for select to authenticated
  using (public.is_admin());

create policy contact_messages_admin_update
  on public.contact_messages
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Column grants — defense in depth.
--
-- RLS deny-by-default suffit déjà à fermer SELECT/UPDATE/DELETE pour les
-- rôles non-admin. On révoque quand même les GRANTs SQL pour qu'un futur
-- ajout de policy par erreur n'ouvre pas le robinet sans qu'on s'en
-- rende compte.
--
-- Côté INSERT : on n'autorise PAS anon à fournir user_id (ce serait une
-- attribution forgée par un visiteur non authentifié — la policy le
-- bloque déjà, le revoke ferme la surface au niveau grant). Les
-- authenticated peuvent le passer (auto-attribution autorisée par la
-- policy). id/created_at/status restent côté défaut serveur pour anon.
-- ---------------------------------------------------------------------------
revoke all on public.contact_messages from anon, authenticated;

grant insert (name, email, subject, message) on public.contact_messages to anon;
grant insert (name, email, subject, message, user_id) on public.contact_messages to authenticated;

-- L'admin lit/met-à-jour via la session JWT du rôle authenticated +
-- is_admin() — pas besoin de grant supplémentaire (l'UPDATE policy
-- ouvre le chemin, et on ne grant pas update sur des colonnes spécifiques
-- pour éviter qu'un admin réécrive email/message/name a posteriori ;
-- seul le status doit bouger).
grant select on public.contact_messages to authenticated;
grant update (status) on public.contact_messages to authenticated;
