-- Follow-up i18n LOT 1 — traduction EN de la 4e catégorie.
-- Ferme le gap laissé par 20260712_i18n_en_seed_vitrine.sql
-- (Intelligence des Menaces avait été skippée faute de correspondance
-- avec la traduction 'Audit' initialement fournie).
-- Idempotent : jsonb_set(..., true) ne touche que la clé {en}.

begin;

update public.categories
set
  name        = jsonb_set(coalesce(name,        '{}'::jsonb), '{en}', to_jsonb('Threat Intelligence'::text),                              true),
  description = jsonb_set(coalesce(description, '{}'::jsonb), '{en}', to_jsonb('Threat intelligence and analysis to anticipate attacks'::text), true)
where id = '10000000-0000-0000-0000-000000000004'::uuid;

commit;
