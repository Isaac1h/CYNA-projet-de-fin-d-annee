-- LOT i18n — remplissage clé "en" sur périmètre vitrine.
-- 3 carousel_slides + 3 categories (SOC/EDR/XDR) + 3 produits phares.
-- La 4e catégorie (intelligence-des-menaces) est laissée intacte
-- (traduction 'Audit' fournie mais aucun slug 'audit' en base — option (a)
-- skip retenue en concertation).
-- Idempotent : jsonb_set(..., create_if_missing=true) ne touche que le
-- chemin {en}. Rejouable sans dégât.

begin;

-- ============================================================
-- 1) carousel_slides (3 slides)
-- ============================================================
update public.carousel_slides
set
  title    = jsonb_set(coalesce(title,    '{}'::jsonb), '{en}', to_jsonb('Advanced Cybersecurity for Businesses'::text),                             true),
  subtitle = jsonb_set(coalesce(subtitle, '{}'::jsonb), '{en}', to_jsonb('Protect your infrastructure with our SOC, EDR and XDR solutions'::text),   true),
  cta_text = jsonb_set(coalesce(cta_text, '{}'::jsonb), '{en}', to_jsonb('Discover our services'::text),                                             true)
where id = '50000000-0000-0000-0000-000000000001'::uuid;

update public.carousel_slides
set
  title    = jsonb_set(coalesce(title,    '{}'::jsonb), '{en}', to_jsonb('24/7 Threat Detection'::text),                                             true),
  subtitle = jsonb_set(coalesce(subtitle, '{}'::jsonb), '{en}', to_jsonb('Our experts monitor and protect your systems around the clock'::text),     true),
  cta_text = jsonb_set(coalesce(cta_text, '{}'::jsonb), '{en}', to_jsonb('Learn more'::text),                                                        true)
where id = '50000000-0000-0000-0000-000000000002'::uuid;

update public.carousel_slides
set
  title    = jsonb_set(coalesce(title,    '{}'::jsonb), '{en}', to_jsonb('Certified Expertise'::text),                                               true),
  subtitle = jsonb_set(coalesce(subtitle, '{}'::jsonb), '{en}', to_jsonb('A team of engineers certified in cybersecurity at your service'::text),    true),
  cta_text = jsonb_set(coalesce(cta_text, '{}'::jsonb), '{en}', to_jsonb('Contact us'::text),                                                        true)
where id = '50000000-0000-0000-0000-000000000003'::uuid;

-- ============================================================
-- 2) categories (SOC / EDR / XDR — 4e catégorie non touchée)
-- ============================================================
update public.categories
set
  name        = jsonb_set(coalesce(name,        '{}'::jsonb), '{en}', to_jsonb('SOC'::text),                                                                  true),
  description = jsonb_set(coalesce(description, '{}'::jsonb), '{en}', to_jsonb('Security Operations Center — continuous monitoring of your infrastructure'::text), true)
where slug = 'soc';

update public.categories
set
  name        = jsonb_set(coalesce(name,        '{}'::jsonb), '{en}', to_jsonb('EDR'::text),                                                                  true),
  description = jsonb_set(coalesce(description, '{}'::jsonb), '{en}', to_jsonb('Endpoint Detection and Response — protection for your endpoints'::text),      true)
where slug = 'edr';

update public.categories
set
  name        = jsonb_set(coalesce(name,        '{}'::jsonb), '{en}', to_jsonb('XDR'::text),                                                                  true),
  description = jsonb_set(coalesce(description, '{}'::jsonb), '{en}', to_jsonb('Extended Detection and Response — unified cross-layer detection'::text),      true)
where slug = 'xdr';

-- ============================================================
-- 3) products (3 phares)
-- ============================================================
update public.products
set
  name        = jsonb_set(coalesce(name,        '{}'::jsonb), '{en}', to_jsonb('SecureOps Elite'::text),                                                                       true),
  description = jsonb_set(coalesce(description, '{}'::jsonb), '{en}', to_jsonb('Comprehensive managed SOC solution for large enterprises, with 24/7 monitoring and incident response.'::text), true)
where slug = 'secureops-elite';

update public.products
set
  name        = jsonb_set(coalesce(name,        '{}'::jsonb), '{en}', to_jsonb('ThreatPulse Intelligence'::text),                                                              true),
  description = jsonb_set(coalesce(description, '{}'::jsonb), '{en}', to_jsonb('Threat intelligence platform providing real-time analysis and proactive alerts.'::text),       true)
where slug = 'threatpulse-intelligence';

update public.products
set
  name        = jsonb_set(coalesce(name,        '{}'::jsonb), '{en}', to_jsonb('EndpointShield Advanced'::text),                                                               true),
  description = jsonb_set(coalesce(description, '{}'::jsonb), '{en}', to_jsonb('Advanced endpoint protection with behavioral EDR and automated response.'::text),              true)
where slug = 'endpointshield-avance';

commit;
