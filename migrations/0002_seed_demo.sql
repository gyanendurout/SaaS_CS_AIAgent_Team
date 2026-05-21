-- =============================================================================
-- JOOLA AI CS Warranty Management System
-- Migration 0002: Demo Seed Data
-- Created: 2026-05-17
-- Policy version anchored: 1.0.0
--
-- Seeds: ~30 customers, ~100 orders, ~30 registrations, 280 claims
--        spread across last 30 days (weighted recent), plus drafts,
--        escalations, and case_events.
--
-- Decision distribution:
--   62% ELIGIBLE_FOR_DAMAGE_REVIEW
--   16% NOT_ELIGIBLE
--   13% HUMAN_REVIEW_REQUIRED
--    7% WARRANTY_EXPIRED
--    2% PROCESSING
--
-- Channel distribution: 42% email · 36% voice · 22% web
--
-- Every §4 edge case in cs-knowledge-base-v1.md has at least one
-- explicitly-labelled claim (search for `-- §4.x` markers).
--
-- Run AFTER 0001_initial_schema.sql.
-- Idempotent-ish: re-running will append duplicates unless cleanup is enabled.
-- =============================================================================

begin;

-- =============================================================================
-- 0. OPTIONAL CLEANUP — uncomment to wipe and re-seed.
--    Order matters: cascade from escalations -> claims -> orders -> customers.
-- =============================================================================

-- truncate table escalations, drafts, transcripts, emails, case_events,
--   claims, registrations, orders, customers restart identity cascade;
-- alter sequence claim_id_seq restart with 10001;

-- =============================================================================
-- 1. CUSTOMERS (~30 realistic JOOLA-customer-like names)
--    Mix: ~85% US, ~7% CA, ~3% PR, ~5% UK/AU/DE (these last ones produce
--    NOT_ELIGIBLE under §4.13 outside-region).
-- =============================================================================

insert into customers (id, name, email, country, phone) values
  -- US (majority)
  ('11111111-1111-1111-1111-000000000001', 'John Smith',      'john.smith@example.com',       'US', '+1 415 555 0101'),
  ('11111111-1111-1111-1111-000000000002', 'Sarah Lee',       'sarah.lee@example.com',        'US', '+1 415 555 0102'),
  ('11111111-1111-1111-1111-000000000003', 'Mike Brown',      'mike.brown@example.com',       'US', '+1 312 555 0103'),
  ('11111111-1111-1111-1111-000000000004', 'Alex Green',      'alex.green@example.com',       'US', '+1 312 555 0104'),
  ('11111111-1111-1111-1111-000000000005', 'Emily White',     'emily.white@example.com',      'US', '+1 213 555 0105'),
  ('11111111-1111-1111-1111-000000000006', 'Chris Wilson',    'chris.wilson@example.com',     'US', '+1 213 555 0106'),
  ('11111111-1111-1111-1111-000000000007', 'Maria Garcia',    'maria.garcia@example.com',     'US', '+1 305 555 0107'),
  ('11111111-1111-1111-1111-000000000008', 'David Park',      'david.park@example.com',       'US', '+1 305 555 0108'),
  ('11111111-1111-1111-1111-000000000009', 'Lauren Chen',     'lauren.chen@example.com',      'US', '+1 206 555 0109'),
  ('11111111-1111-1111-1111-000000000010', 'Hannah Cole',     'hannah.cole@example.com',      'US', '+1 206 555 0110'),
  ('11111111-1111-1111-1111-000000000011', 'Jamal Wright',    'jamal.wright@example.com',     'US', '+1 404 555 0111'),
  ('11111111-1111-1111-1111-000000000012', 'Priya Shah',      'priya.shah@example.com',       'US', '+1 404 555 0112'),
  ('11111111-1111-1111-1111-000000000013', 'Olivia Reed',     'olivia.reed@example.com',      'US', '+1 503 555 0113'),
  ('11111111-1111-1111-1111-000000000014', 'Daniel Kim',      'daniel.kim@example.com',       'US', '+1 503 555 0114'),
  ('11111111-1111-1111-1111-000000000015', 'Sofia Martinez',  'sofia.martinez@example.com',   'US', '+1 617 555 0115'),
  ('11111111-1111-1111-1111-000000000016', 'Ben Carter',      'ben.carter@example.com',       'US', '+1 617 555 0116'),
  ('11111111-1111-1111-1111-000000000017', 'Aisha Khan',      'aisha.khan@example.com',       'US', '+1 718 555 0117'),
  ('11111111-1111-1111-1111-000000000018', 'Marcus Hall',     'marcus.hall@example.com',      'US', '+1 718 555 0118'),
  ('11111111-1111-1111-1111-000000000019', 'Trevor Nguyen',   'trevor.nguyen@example.com',    'US', '+1 919 555 0119'),
  ('11111111-1111-1111-1111-000000000020', 'Nadia Costa',     'nadia.costa@example.com',      'US', '+1 919 555 0120'),
  ('11111111-1111-1111-1111-000000000021', 'Jordan West',     'jordan.west@example.com',      'US', '+1 215 555 0121'),
  ('11111111-1111-1111-1111-000000000022', 'Imani Foster',    'imani.foster@example.com',     'US', '+1 215 555 0122'),
  ('11111111-1111-1111-1111-000000000023', 'Ethan Hughes',    'ethan.hughes@example.com',     'US', '+1 480 555 0123'),
  ('11111111-1111-1111-1111-000000000024', 'Grace Liu',       'grace.liu@example.com',        'US', '+1 480 555 0124'),
  ('11111111-1111-1111-1111-000000000025', 'Tomás Rivera',    'tomas.rivera@example.com',     'US', '+1 720 555 0125'),
  -- Canada (~7%)
  ('11111111-1111-1111-1111-000000000026', 'Liam Tremblay',   'liam.tremblay@example.ca',     'CA', '+1 416 555 0126'),
  ('11111111-1111-1111-1111-000000000027', 'Charlotte Roy',   'charlotte.roy@example.ca',     'CA', '+1 604 555 0127'),
  ('11111111-1111-1111-1111-000000000028', 'Mateo Gagnon',    'mateo.gagnon@example.ca',      'CA', '+1 514 555 0128'),
  -- Puerto Rico (~3%)
  ('11111111-1111-1111-1111-000000000029', 'Carlos Vega',     'carlos.vega@example.com',      'PR', '+1 787 555 0129'),
  -- Outside warranty region (§4.13)
  ('11111111-1111-1111-1111-000000000030', 'Ravi Kumar',      'ravi.kumar@example.in',        'IN', '+91 22 5555 0130'),
  ('11111111-1111-1111-1111-000000000031', 'Oliver Bennett',  'oliver.bennett@example.co.uk', 'GB', '+44 20 5555 0131'),
  ('11111111-1111-1111-1111-000000000032', 'Lena Schmidt',    'lena.schmidt@example.de',      'DE', '+49 30 5555 0132'),
  ('11111111-1111-1111-1111-000000000033', 'Hannah Bauer',    'hannah.bauer@example.com.au',  'AU', '+61 2 5555 0133')
on conflict (email) do nothing;

-- =============================================================================
-- 2. ORDERS (~100+ — realistic JOOLA catalog, mixed sources)
--    SKU/type mapping uses real product_type enum values.
--    Sources: ~70% JOOLA_DIRECT, ~15% AUTHORIZED_RETAILER, ~10% EBAY, ~5% FB.
-- =============================================================================

insert into orders (id, order_number, customer_id, product_name, product_sku, product_type, purchase_date, source) values
  -- ---------- JOOLA_DIRECT — paddles (NFC-eligible) ----------
  ('22222222-2222-2222-2222-000000000001', 'JD-100001', '11111111-1111-1111-1111-000000000001', 'JOOLA Perseus 3 14mm',        'J-PERSEUS-014',  'PADDLE_NFC',      '2026-02-04', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000002', 'JD-100002', '11111111-1111-1111-1111-000000000002', 'JOOLA Hyperion CFS 16mm',     'J-HYPERION-016', 'PADDLE_NFC',      '2026-01-12', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000003', 'JD-100003', '11111111-1111-1111-1111-000000000003', 'JOOLA Scorpeus 4 16mm',       'J-SCORPEUS-016', 'PADDLE_NFC',      '2026-03-22', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000004', 'JD-100004', '11111111-1111-1111-1111-000000000004', 'JOOLA Vision CGS 14mm',       'J-VISION-014',   'PADDLE_NFC',      '2026-03-08', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000005', 'JD-100005', '11111111-1111-1111-1111-000000000005', 'JOOLA Perseus 3 16mm',        'J-PERSEUS-016',  'PADDLE_NFC',      '2025-12-18', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000006', 'JD-100006', '11111111-1111-1111-1111-000000000006', 'JOOLA Magnus 3 16mm',         'J-MAGNUS-016',   'PADDLE_NFC',      '2026-02-27', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000007', 'JD-100007', '11111111-1111-1111-1111-000000000007', 'JOOLA Agassi Pro IV',         'J-AGASSI-001',   'PADDLE_NFC',      '2026-04-02', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000008', 'JD-100008', '11111111-1111-1111-1111-000000000008', 'JOOLA Hyperion CAS 16mm',     'J-HYPERION-CAS', 'PADDLE_NFC',      '2026-01-30', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000009', 'JD-100009', '11111111-1111-1111-1111-000000000009', 'JOOLA Scorpeus 4 14mm',       'J-SCORPEUS-014', 'PADDLE_NFC',      '2026-02-15', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000010', 'JD-100010', '11111111-1111-1111-1111-000000000010', 'JOOLA Perseus Pro IV 16mm',   'J-PERSEUS-PRO',  'PADDLE_NFC',      '2026-03-19', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000011', 'JD-100011', '11111111-1111-1111-1111-000000000011', 'JOOLA Vision CGS 16mm',       'J-VISION-016',   'PADDLE_NFC',      '2026-04-11', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000012', 'JD-100012', '11111111-1111-1111-1111-000000000012', 'JOOLA Hyperion CFS 14mm',     'J-HYPERION-014', 'PADDLE_NFC',      '2026-02-04', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000013', 'JD-100013', '11111111-1111-1111-1111-000000000013', 'JOOLA Perseus 3 14mm',        'J-PERSEUS-014',  'PADDLE_NFC',      '2025-11-20', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000014', 'JD-100014', '11111111-1111-1111-1111-000000000014', 'JOOLA Magnus 3 14mm',         'J-MAGNUS-014',   'PADDLE_NFC',      '2026-04-25', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000015', 'JD-100015', '11111111-1111-1111-1111-000000000015', 'JOOLA Scorpeus 4 16mm',       'J-SCORPEUS-016', 'PADDLE_NFC',      '2026-03-30', 'JOOLA_DIRECT'),

  -- ---------- JOOLA_DIRECT — standard paddles (no NFC) ----------
  ('22222222-2222-2222-2222-000000000016', 'JD-100016', '11111111-1111-1111-1111-000000000016', 'JOOLA Journey Paddle',        'J-JOURNEY-001',  'PADDLE_STANDARD', '2026-04-01', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000017', 'JD-100017', '11111111-1111-1111-1111-000000000017', 'JOOLA Solaire Paddle',        'J-SOLAIRE-001',  'PADDLE_STANDARD', '2026-03-12', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000018', 'JD-100018', '11111111-1111-1111-1111-000000000018', 'JOOLA Essentials Paddle',     'J-ESSENT-001',   'PADDLE_STANDARD', '2025-10-15', 'JOOLA_DIRECT'),

  -- ---------- JOOLA_DIRECT — accessories & TT ----------
  ('22222222-2222-2222-2222-000000000019', 'JD-100019', '11111111-1111-1111-1111-000000000019', 'JOOLA Pro Net Set',           'J-NET-PRO-001',  'PICKLEBALL_NETS', '2026-02-22', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000020', 'JD-100020', '11111111-1111-1111-1111-000000000020', 'JOOLA Primo Pickleballs (12)', 'J-BALLS-012',   'PICKLEBALL_BALLS','2026-04-08', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000021', 'JD-100021', '11111111-1111-1111-1111-000000000021', 'JOOLA Tour Elite Bag',        'J-BAG-TOUR',     'BAGS',            '2026-03-15', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000022', 'JD-100022', '11111111-1111-1111-1111-000000000022', 'JOOLA Ben Johns Eyewear',     'J-EYE-BJ-001',   'EYEWEAR',         '2026-04-19', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000023', 'JD-100023', '11111111-1111-1111-1111-000000000023', 'iPong Carbon Fiber Robot',    'J-IPONG-CF',     'IPONG_ROBOT',     '2026-01-25', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000024', 'JD-100024', '11111111-1111-1111-1111-000000000024', 'JOOLA Indoor Tournament Table 3000', 'J-TT-IND-3000', 'TT_INDOOR_TABLE', '2026-02-28', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000025', 'JD-100025', '11111111-1111-1111-1111-000000000025', 'JOOLA Outdoor Pro Table',     'J-TT-OUT-PRO',   'TT_OUTDOOR_TABLE','2026-03-05', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000026', 'JD-100026', '11111111-1111-1111-1111-000000000026', 'JOOLA Rhyzm 425 Rubber',      'J-RUB-RHY-425',  'TT_RUBBERS',      '2026-04-22', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000027', 'JD-100027', '11111111-1111-1111-1111-000000000027', 'JOOLA Prime 40+ Balls (6)',   'J-TT-BALL-40',   'TT_BALLS',        '2026-04-14', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000028', 'JD-100028', '11111111-1111-1111-1111-000000000028', 'JOOLA Spirit Carbon Blade',   'J-TT-BLD-SPC',   'TT_BLADES',       '2026-03-26', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000029', 'JD-100029', '11111111-1111-1111-1111-000000000029', 'JOOLA Infinity Apparel Tee',  'J-APP-TEE-001',  'APPAREL',         '2026-04-30', 'JOOLA_DIRECT'),

  -- ---------- AUTHORIZED_RETAILER ----------
  ('22222222-2222-2222-2222-000000000030', 'AR-200001', '11111111-1111-1111-1111-000000000003', 'JOOLA Perseus 3 16mm',        'J-PERSEUS-016',  'PADDLE_NFC',      '2026-03-01', 'AUTHORIZED_RETAILER'),
  ('22222222-2222-2222-2222-000000000031', 'AR-200002', '11111111-1111-1111-1111-000000000007', 'JOOLA Hyperion CFS 16mm',     'J-HYPERION-016', 'PADDLE_NFC',      '2026-02-18', 'AUTHORIZED_RETAILER'),
  ('22222222-2222-2222-2222-000000000032', 'AR-200003', '11111111-1111-1111-1111-000000000011', 'JOOLA Tour Elite Bag',        'J-BAG-TOUR',     'BAGS',            '2026-04-10', 'AUTHORIZED_RETAILER'),
  ('22222222-2222-2222-2222-000000000033', 'AR-200004', '11111111-1111-1111-1111-000000000015', 'JOOLA Indoor Tournament Table 3000', 'J-TT-IND-3000', 'TT_INDOOR_TABLE', '2026-01-08', 'AUTHORIZED_RETAILER'),
  ('22222222-2222-2222-2222-000000000034', 'AR-200005', '11111111-1111-1111-1111-000000000019', 'JOOLA Scorpeus 4 14mm',       'J-SCORPEUS-014', 'PADDLE_NFC',      '2026-03-17', 'AUTHORIZED_RETAILER'),

  -- ---------- EBAY (unauthorized — §1.7, §2.3, §4.8) ----------
  ('22222222-2222-2222-2222-000000000035', 'EB-300001', '11111111-1111-1111-1111-000000000004', 'JOOLA Hyperion CFS 16mm',     'J-HYPERION-016', 'PADDLE_NFC',      '2025-09-18', 'EBAY'),
  ('22222222-2222-2222-2222-000000000036', 'EB-300002', '11111111-1111-1111-1111-000000000018', 'JOOLA Perseus 3 14mm',        'J-PERSEUS-014',  'PADDLE_NFC',      '2026-02-11', 'EBAY'),
  ('22222222-2222-2222-2222-000000000037', 'EB-300003', '11111111-1111-1111-1111-000000000023', 'JOOLA Scorpeus 4 16mm',       'J-SCORPEUS-016', 'PADDLE_NFC',      '2025-12-04', 'EBAY'),

  -- ---------- FACEBOOK_MARKETPLACE (unauthorized) ----------
  ('22222222-2222-2222-2222-000000000038', 'FB-400001', '11111111-1111-1111-1111-000000000020', 'JOOLA Magnus 3 16mm',         'J-MAGNUS-016',   'PADDLE_NFC',      '2025-11-22', 'FACEBOOK_MARKETPLACE'),
  ('22222222-2222-2222-2222-000000000039', 'FB-400002', '11111111-1111-1111-1111-000000000025', 'JOOLA Vision CGS 14mm',       'J-VISION-014',   'PADDLE_NFC',      '2026-01-15', 'FACEBOOK_MARKETPLACE'),

  -- ---------- Outside-region orders (§4.13) ----------
  ('22222222-2222-2222-2222-000000000040', 'JD-100040', '11111111-1111-1111-1111-000000000030', 'JOOLA Perseus 3 16mm',        'J-PERSEUS-016',  'PADDLE_NFC',      '2026-03-09', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000041', 'JD-100041', '11111111-1111-1111-1111-000000000031', 'JOOLA Hyperion CFS 16mm',     'J-HYPERION-016', 'PADDLE_NFC',      '2026-02-26', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000042', 'JD-100042', '11111111-1111-1111-1111-000000000032', 'JOOLA Scorpeus 4 14mm',       'J-SCORPEUS-014', 'PADDLE_NFC',      '2026-04-04', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000043', 'JD-100043', '11111111-1111-1111-1111-000000000033', 'JOOLA Vision CGS 16mm',       'J-VISION-016',   'PADDLE_NFC',      '2026-03-21', 'JOOLA_DIRECT'),

  -- ---------- Warranty-expired-eligible (purchased > 12mo ago, NFC-registered) ----------
  ('22222222-2222-2222-2222-000000000044', 'JD-099001', '11111111-1111-1111-1111-000000000001', 'JOOLA Hyperion Original',     'J-HYP-ORIG-001', 'PADDLE_NFC',      '2024-11-02', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000045', 'JD-099002', '11111111-1111-1111-1111-000000000005', 'JOOLA Perseus Original',      'J-PER-ORIG-001', 'PADDLE_NFC',      '2024-10-15', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000046', 'JD-099003', '11111111-1111-1111-1111-000000000010', 'JOOLA Scorpeus Original',     'J-SCO-ORIG-001', 'PADDLE_NFC',      '2024-09-28', 'JOOLA_DIRECT'),

  -- ---------- Additional fill orders to give variety on claim lookups ----------
  ('22222222-2222-2222-2222-000000000047', 'JD-100047', '11111111-1111-1111-1111-000000000001', 'JOOLA Solaire Paddle',        'J-SOLAIRE-001',  'PADDLE_STANDARD', '2026-04-06', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000048', 'JD-100048', '11111111-1111-1111-1111-000000000002', 'JOOLA Primo Pickleballs (12)', 'J-BALLS-012',   'PICKLEBALL_BALLS','2026-04-26', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000049', 'JD-100049', '11111111-1111-1111-1111-000000000003', 'JOOLA Ben Johns Eyewear',     'J-EYE-BJ-001',   'EYEWEAR',         '2026-04-12', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000050', 'JD-100050', '11111111-1111-1111-1111-000000000004', 'JOOLA Pro Net Set',           'J-NET-PRO-001',  'PICKLEBALL_NETS', '2026-03-29', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000051', 'JD-100051', '11111111-1111-1111-1111-000000000005', 'JOOLA Outdoor Pro Table',     'J-TT-OUT-PRO',   'TT_OUTDOOR_TABLE','2026-04-17', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000052', 'JD-100052', '11111111-1111-1111-1111-000000000006', 'JOOLA Spirit Carbon Blade',   'J-TT-BLD-SPC',   'TT_BLADES',       '2026-04-21', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000053', 'JD-100053', '11111111-1111-1111-1111-000000000007', 'JOOLA Rhyzm 425 Rubber',      'J-RUB-RHY-425',  'TT_RUBBERS',      '2026-04-09', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000054', 'JD-100054', '11111111-1111-1111-1111-000000000008', 'JOOLA Infinity Apparel Tee',  'J-APP-TEE-001',  'APPAREL',         '2026-04-23', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000055', 'JD-100055', '11111111-1111-1111-1111-000000000009', 'JOOLA Tour Elite Bag',        'J-BAG-TOUR',     'BAGS',            '2026-04-15', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000056', 'AR-200056', '11111111-1111-1111-1111-000000000010', 'JOOLA Indoor Tournament Table 3000', 'J-TT-IND-3000', 'TT_INDOOR_TABLE', '2026-04-02', 'AUTHORIZED_RETAILER'),
  ('22222222-2222-2222-2222-000000000057', 'JD-100057', '11111111-1111-1111-1111-000000000011', 'JOOLA Perseus 3 16mm',        'J-PERSEUS-016',  'PADDLE_NFC',      '2026-04-13', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000058', 'JD-100058', '11111111-1111-1111-1111-000000000012', 'JOOLA Hyperion CFS 16mm',     'J-HYPERION-016', 'PADDLE_NFC',      '2026-04-18', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000059', 'JD-100059', '11111111-1111-1111-1111-000000000013', 'JOOLA Scorpeus 4 16mm',       'J-SCORPEUS-016', 'PADDLE_NFC',      '2026-04-24', 'JOOLA_DIRECT'),
  ('22222222-2222-2222-2222-000000000060', 'JD-100060', '11111111-1111-1111-1111-000000000014', 'JOOLA Vision CGS 14mm',       'J-VISION-014',   'PADDLE_NFC',      '2026-04-27', 'JOOLA_DIRECT')
on conflict (order_number) do nothing;

-- =============================================================================
-- 3. REGISTRATIONS (~30, only for PADDLE_NFC orders)
--    Mix:
--      ~60% registered + within_window + receipt_approved (full 12mo NFC)
--      ~20% registered but outside 14-day window (FAIL §2.5)
--      ~15% registered but receipt_not_approved
--      ~5%  no registration at all (i.e., row absent)
-- =============================================================================

insert into registrations (order_id, registered, nfc_id, registered_at, receipt_uploaded, receipt_approved, approved_at) values
  -- ----- Fully eligible (registered within 14 days, receipt approved) -----
  ('22222222-2222-2222-2222-000000000001', true, 'NFC-4421', '2026-02-08 14:00:00+00', true, true,  '2026-02-09 10:00:00+00'),
  ('22222222-2222-2222-2222-000000000002', true, 'NFC-4422', '2026-01-18 09:00:00+00', true, true,  '2026-01-19 11:00:00+00'),
  ('22222222-2222-2222-2222-000000000003', true, 'NFC-4423', '2026-03-25 12:00:00+00', true, true,  '2026-03-26 09:00:00+00'),
  ('22222222-2222-2222-2222-000000000004', true, 'NFC-4424', '2026-03-12 16:00:00+00', true, true,  '2026-03-13 14:00:00+00'),
  ('22222222-2222-2222-2222-000000000006', true, 'NFC-4426', '2026-03-04 10:00:00+00', true, true,  '2026-03-05 09:00:00+00'),
  ('22222222-2222-2222-2222-000000000007', true, 'NFC-4427', '2026-04-08 13:00:00+00', true, true,  '2026-04-09 11:00:00+00'),
  ('22222222-2222-2222-2222-000000000008', true, 'NFC-4428', '2026-02-05 09:00:00+00', true, true,  '2026-02-06 10:00:00+00'),
  ('22222222-2222-2222-2222-000000000009', true, 'NFC-4429', '2026-02-22 18:00:00+00', true, true,  '2026-02-23 09:00:00+00'),
  ('22222222-2222-2222-2222-000000000010', true, 'NFC-4430', '2026-03-24 11:00:00+00', true, true,  '2026-03-25 09:00:00+00'),
  ('22222222-2222-2222-2222-000000000011', true, 'NFC-4431', '2026-04-15 09:00:00+00', true, true,  '2026-04-16 09:00:00+00'),
  ('22222222-2222-2222-2222-000000000012', true, 'NFC-4432', '2026-02-10 09:00:00+00', true, true,  '2026-02-11 09:00:00+00'),
  ('22222222-2222-2222-2222-000000000014', true, 'NFC-4434', '2026-04-29 09:00:00+00', true, true,  '2026-04-30 09:00:00+00'),
  ('22222222-2222-2222-2222-000000000015', true, 'NFC-4435', '2026-04-03 09:00:00+00', true, true,  '2026-04-04 09:00:00+00'),
  ('22222222-2222-2222-2222-000000000030', true, 'NFC-4436', '2026-03-05 09:00:00+00', true, true,  '2026-03-06 09:00:00+00'),
  ('22222222-2222-2222-2222-000000000031', true, 'NFC-4437', '2026-02-22 09:00:00+00', true, true,  '2026-02-23 09:00:00+00'),
  ('22222222-2222-2222-2222-000000000044', true, 'NFC-4438', '2024-11-05 09:00:00+00', true, true,  '2024-11-06 09:00:00+00'),
  ('22222222-2222-2222-2222-000000000045', true, 'NFC-4439', '2024-10-18 09:00:00+00', true, true,  '2024-10-19 09:00:00+00'),
  ('22222222-2222-2222-2222-000000000057', true, 'NFC-4440', '2026-04-15 09:00:00+00', true, true,  '2026-04-16 09:00:00+00'),
  ('22222222-2222-2222-2222-000000000058', true, 'NFC-4441', '2026-04-20 09:00:00+00', true, true,  '2026-04-21 09:00:00+00'),
  ('22222222-2222-2222-2222-000000000059', true, 'NFC-4442', '2026-04-27 09:00:00+00', true, true,  '2026-04-28 09:00:00+00'),

  -- ----- Registered but outside 14-day window (§4.5 / §2.5) -----
  ('22222222-2222-2222-2222-000000000005', true, 'NFC-5501', '2026-01-15 09:00:00+00', true, false, null),   -- purch 2025-12-18, reg 28d later
  ('22222222-2222-2222-2222-000000000013', true, 'NFC-5502', '2025-12-20 09:00:00+00', true, true,  '2025-12-21 09:00:00+00'),  -- purch 2025-11-20, reg 30d later — late but receipt approved doesn't help

  -- ----- Registered but receipt NOT approved -----
  ('22222222-2222-2222-2222-000000000040', true, 'NFC-6601', '2026-03-12 09:00:00+00', true, false, null),
  ('22222222-2222-2222-2222-000000000041', true, 'NFC-6602', '2026-02-28 09:00:00+00', true, false, null),

  -- ----- Unauthorized-source paddles: registration unavailable per §2.5 -----
  ('22222222-2222-2222-2222-000000000035', false, null, null, false, false, null),
  ('22222222-2222-2222-2222-000000000036', false, null, null, false, false, null),
  ('22222222-2222-2222-2222-000000000038', false, null, null, false, false, null),

  -- ----- Outside-region but registered (still NOT_ELIGIBLE per §4.13) -----
  ('22222222-2222-2222-2222-000000000042', true, 'NFC-7701', '2026-04-08 09:00:00+00', true, true,  '2026-04-09 09:00:00+00'),
  ('22222222-2222-2222-2222-000000000043', true, 'NFC-7702', '2026-03-24 09:00:00+00', true, true,  '2026-03-25 09:00:00+00')
on conflict (order_id) do nothing;

-- =============================================================================
-- 4. HAND-CRAFTED EDGE-CASE CLAIMS (one per §4 case)
--    These come FIRST so they get the lowest WC-ids. Each has explicit
--    comment markers (§4.x) for traceability.
--    All decisions/reason_codes/citations match the policy doc.
-- =============================================================================

-- §4.1 Past return window but in warranty
insert into claims (id, customer_id, order_id, channel, issue, status_detail, decision, reason_code, citation, primary_agent_id, sentiment, stage, created_at, closed_at)
values ('WC-10001', '11111111-1111-1111-1111-000000000001', '22222222-2222-2222-2222-000000000001', 'email',
        'Paddle face cracked after 45 days — past return window but I think still under warranty',
        'CLOSED_RESOLVED', 'ELIGIBLE_FOR_DAMAGE_REVIEW', 'WITHIN_WARRANTY_PAST_RETURN', '§4.1, §2.4', 'response', 0.71, 'closed',
        now() - interval '22 days', now() - interval '21 days 22 hours');

-- §4.2 Wants upgrade to different model
insert into claims (id, customer_id, order_id, channel, issue, status_detail, decision, reason_code, citation, primary_agent_id, sentiment, stage, created_at, closed_at)
values ('WC-10002', '11111111-1111-1111-1111-000000000002', '22222222-2222-2222-2222-000000000002', 'email',
        'My Hyperion has a defect — can I upgrade to a Perseus 3 instead under warranty?',
        'CLOSED_DECLINED', 'NOT_ELIGIBLE', 'UPGRADE_NOT_PERMITTED', '§4.2, §2.8', 'rules', 0.42, 'closed',
        now() - interval '19 days', now() - interval '18 days 22 hours');

-- §4.3 Replacement also defective (escalation: replacement-limit context)
insert into claims (id, customer_id, order_id, channel, issue, status_detail, decision, reason_code, citation, primary_agent_id, sentiment, stage, created_at)
values ('WC-10003', '11111111-1111-1111-1111-000000000005', '22222222-2222-2222-2222-000000000005', 'voice',
        'Replacement paddle has the same defect — this is my 4th warranty replacement on the Perseus',
        'ESCALATED', 'HUMAN_REVIEW_REQUIRED', 'REPLACEMENT_LIMIT_REACHED', '§4.3, §2.8 Step 5', 'esc', 0.18, 'rules',
        now() - interval '2 days');

-- §4.4 Gift recipient (non-original purchaser)
insert into claims (id, customer_id, order_id, channel, issue, status_detail, decision, reason_code, citation, primary_agent_id, sentiment, stage, created_at, closed_at)
values ('WC-10004', '11111111-1111-1111-1111-000000000017', '22222222-2222-2222-2222-000000000017', 'voice',
        'My husband gave me this paddle as a birthday gift — handle is peeling. The order is in his name.',
        'CLOSED_DECLINED', 'NOT_ELIGIBLE', 'NON_ORIGINAL_PURCHASER', '§4.4, §2.1', 'rules', 0.38, 'closed',
        now() - interval '14 days', now() - interval '13 days 23 hours');

-- §4.5 NFC missed 14-day window
insert into claims (id, customer_id, order_id, channel, issue, status_detail, decision, reason_code, citation, primary_agent_id, sentiment, stage, created_at, closed_at)
values ('WC-10005', '11111111-1111-1111-1111-000000000005', '22222222-2222-2222-2222-000000000005', 'web',
        'My NFC registration was rejected because I registered 28 days after purchase — paddle now has a dead spot',
        'CLOSED_RESOLVED', 'ELIGIBLE_FOR_DAMAGE_REVIEW', 'NFC_LATE_STANDARD_WARRANTY_APPLIES', '§4.5, §2.5', 'response', 0.55, 'closed',
        now() - interval '11 days', now() - interval '10 days 22 hours');

-- §4.6 Wants shipping refund
insert into claims (id, customer_id, order_id, channel, issue, status_detail, decision, reason_code, citation, primary_agent_id, sentiment, stage, created_at, closed_at)
values ('WC-10006', '11111111-1111-1111-1111-000000000008', '22222222-2222-2222-2222-000000000008', 'email',
        'Paddle arrived defective — please refund my $14.95 shipping charge as well',
        'CLOSED_RESOLVED', 'ELIGIBLE_FOR_DAMAGE_REVIEW', 'SHIPPING_REFUND_JOOLA_DEFECT', '§4.6, §1.3', 'response', 0.62, 'closed',
        now() - interval '9 days', now() - interval '8 days 22 hours');

-- §4.7 Opened rubber/balls
insert into claims (id, customer_id, order_id, channel, issue, status_detail, decision, reason_code, citation, primary_agent_id, sentiment, stage, created_at, closed_at)
values ('WC-10007', '11111111-1111-1111-1111-000000000026', '22222222-2222-2222-2222-000000000026', 'email',
        'I opened this Rhyzm rubber and the surface is bubbling — I want a refund',
        'CLOSED_RESOLVED', 'ELIGIBLE_FOR_DAMAGE_REVIEW', 'DEFECT_OPENED_RUBBER', '§4.7, §1.2, §2.4', 'response', 0.58, 'closed',
        now() - interval '7 days', now() - interval '6 days 22 hours');

-- §4.8 eBay purchase (unauthorized)
insert into claims (id, customer_id, order_id, channel, issue, status_detail, decision, reason_code, citation, primary_agent_id, sentiment, stage, created_at, closed_at)
values ('WC-10008', '11111111-1111-1111-1111-000000000004', '22222222-2222-2222-2222-000000000035', 'voice',
        'My Hyperion broke and I want a replacement — bought it on eBay',
        'CLOSED_DECLINED', 'NOT_ELIGIBLE', 'UNAUTHORIZED_SELLER', '§1.7, §2.3, §4.8', 'rules', 0.25, 'closed',
        now() - interval '6 days', now() - interval '5 days 23 hours');

-- §4.9 Wrong item shipped (JOOLA error)
insert into claims (id, customer_id, order_id, channel, issue, status_detail, decision, reason_code, citation, primary_agent_id, sentiment, stage, created_at, closed_at)
values ('WC-10009', '11111111-1111-1111-1111-000000000009', '22222222-2222-2222-2222-000000000009', 'email',
        'Ordered the Scorpeus 4 but received a Magnus 3 — please send the correct paddle',
        'CLOSED_RESOLVED', 'ELIGIBLE_FOR_DAMAGE_REVIEW', 'WRONG_ITEM_JOOLA_ERROR', '§4.9, §1.3', 'response', 0.69, 'closed',
        now() - interval '5 days', now() - interval '4 days 22 hours');

-- §4.10 Cancellation request
insert into claims (id, customer_id, order_id, channel, issue, status_detail, decision, reason_code, citation, primary_agent_id, sentiment, stage, created_at, closed_at)
values ('WC-10010', '11111111-1111-1111-1111-000000000020', '22222222-2222-2222-2222-000000000020', 'voice',
        'I want to cancel order JD-100020 — I placed it by mistake an hour ago',
        'CLOSED_DECLINED', 'NOT_ELIGIBLE', 'CANCELLATION_NOT_PERMITTED', '§1.5, §4.10', 'rules', 0.30, 'closed',
        now() - interval '4 days', now() - interval '3 days 23 hours');

-- §4.11 Damaged table — signed for vs refused (escalation)
insert into claims (id, customer_id, order_id, channel, issue, status_detail, decision, reason_code, citation, primary_agent_id, sentiment, stage, created_at)
values ('WC-10011', '11111111-1111-1111-1111-000000000015', '22222222-2222-2222-2222-000000000033', 'voice',
        'Indoor table arrived damaged — I signed for it before noticing the crack in the top',
        'ESCALATED', 'HUMAN_REVIEW_REQUIRED', 'TABLE_SIGNED_DAMAGED', '§4.11, §2.7, §5.2', 'esc', 0.22, 'verify',
        now() - interval '1 day');

-- §4.12 Price match on clearance
insert into claims (id, customer_id, order_id, channel, issue, status_detail, decision, reason_code, citation, primary_agent_id, sentiment, stage, created_at, closed_at)
values ('WC-10012', '11111111-1111-1111-1111-000000000016', '22222222-2222-2222-2222-000000000016', 'email',
        'I bought the Journey on clearance for $89 and now I see it at $79 — can I get a price adjustment?',
        'CLOSED_DECLINED', 'NOT_ELIGIBLE', 'NO_PRICE_MATCH_CLEARANCE', '§1.8, §4.12', 'rules', 0.35, 'closed',
        now() - interval '12 days', now() - interval '11 days 23 hours');

-- §4.13 Outside US/CA/PR
insert into claims (id, customer_id, order_id, channel, issue, status_detail, decision, reason_code, citation, primary_agent_id, sentiment, stage, created_at, closed_at)
values ('WC-10013', '11111111-1111-1111-1111-000000000030', '22222222-2222-2222-2222-000000000040', 'email',
        'I am in India — my Perseus paddle has a delamination defect, requesting warranty replacement',
        'CLOSED_DECLINED', 'NOT_ELIGIBLE', 'OUTSIDE_WARRANTY_REGION', '§2.1, §4.13', 'rules', 0.40, 'closed',
        now() - interval '8 days', now() - interval '7 days 22 hours');

-- §5.2 Safety concern (escalation)
insert into claims (id, customer_id, order_id, channel, issue, status_detail, decision, reason_code, citation, primary_agent_id, sentiment, stage, created_at)
values ('WC-10014', '11111111-1111-1111-1111-000000000022', '22222222-2222-2222-2222-000000000022', 'voice',
        'Eyewear hinge snapped mid-rally — a piece flew toward my eye, this is a safety issue',
        'ESCALATED', 'HUMAN_REVIEW_REQUIRED', 'SAFETY_CONCERN', '§5.2', 'esc', 0.15, 'verify',
        now() - interval '6 hours');

-- §1.8 Final-sale defect within 7 days
insert into claims (id, customer_id, order_id, channel, issue, status_detail, decision, reason_code, citation, primary_agent_id, sentiment, stage, created_at, closed_at)
values ('WC-10015', '11111111-1111-1111-1111-000000000029', '22222222-2222-2222-2222-000000000029', 'email',
        'Final-sale Infinity tee arrived with a torn seam — received 3 days ago',
        'CLOSED_RESOLVED', 'ELIGIBLE_FOR_DAMAGE_REVIEW', 'FINAL_SALE_DEFECT_IN_WINDOW', '§1.8', 'response', 0.60, 'closed',
        now() - interval '3 days', now() - interval '2 days 22 hours');

-- Replacement-limit reached escalation matching design's seedEscalations
insert into claims (id, customer_id, order_id, channel, issue, status_detail, decision, reason_code, citation, primary_agent_id, sentiment, stage, created_at)
values ('WC-10016', '11111111-1111-1111-1111-000000000005', '22222222-2222-2222-2222-000000000005', 'voice',
        'Replacement limit reached — 3 prior replacements on Perseus paddle. Customer asking for fourth.',
        'ESCALATED', 'HUMAN_REVIEW_REQUIRED', 'REPLACEMENT_LIMIT_REACHED', '§2.8 Step 5, §5.2', 'esc', 0.20, 'rules',
        now() - interval '4 hours');

-- Outside-region escalation (matches design seedEscalations WC-10214)
insert into claims (id, customer_id, order_id, channel, issue, status_detail, decision, reason_code, citation, primary_agent_id, sentiment, stage, created_at)
values ('WC-10017', '11111111-1111-1111-1111-000000000030', '22222222-2222-2222-2222-000000000040', 'voice',
        'Customer in India, purchased from JOOLA US site. Wants warranty replacement.',
        'ESCALATED', 'HUMAN_REVIEW_REQUIRED', 'OUTSIDE_REGION', '§2.1, §4.13, §5.2', 'esc', 0.30, 'rules',
        now() - interval '11 minutes');

-- Disputed seller escalation
insert into claims (id, customer_id, order_id, channel, issue, status_detail, decision, reason_code, citation, primary_agent_id, sentiment, stage, created_at)
values ('WC-10018', '11111111-1111-1111-1111-000000000004', '22222222-2222-2222-2222-000000000035', 'voice',
        'Disputes eBay = unauthorized. Says seller was "official" JOOLA storefront.',
        'ESCALATED', 'HUMAN_REVIEW_REQUIRED', 'DISPUTED_SELLER', '§1.7, §2.9, §5.2', 'esc', 0.25, 'verify',
        now() - interval '18 minutes');

-- Ambiguous damage escalation
insert into claims (id, customer_id, order_id, channel, issue, status_detail, decision, reason_code, citation, primary_agent_id, sentiment, stage, created_at)
values ('WC-10019', '11111111-1111-1111-1111-000000000010', '22222222-2222-2222-2222-000000000010', 'web',
        'Photos unclear — damage could be wear-and-tear or manufacturing.',
        'ESCALATED', 'HUMAN_REVIEW_REQUIRED', 'AMBIGUOUS_DAMAGE', '§2.3, §5.2', 'esc', 0.45, 'rules',
        now() - interval '32 minutes');

-- Brand-risk escalation (social media mention)
insert into claims (id, customer_id, order_id, channel, issue, status_detail, decision, reason_code, citation, primary_agent_id, sentiment, stage, created_at)
values ('WC-10020', '11111111-1111-1111-1111-000000000014', '22222222-2222-2222-2222-000000000014', 'email',
        'Customer mentioned social media — handle with care.',
        'ESCALATED', 'HUMAN_REVIEW_REQUIRED', 'BRAND_RISK', '§5.2', 'esc', 0.28, 'draft',
        now() - interval '41 minutes');

-- Bump the sequence past our hand-crafted ids so the procedural insert
-- (next block) starts at WC-10021.
select setval('claim_id_seq', 10020, true);

-- =============================================================================
-- 5. PROCEDURAL CLAIMS BULK (260 more, total -> 280)
--    Distribution targets:
--      decision: 62/16/13/7/2  channel: 42 email / 36 voice / 22 web
--    Recency: weighted toward last 7d (matches design's pow(random, 1.6)).
--    Status: most CLOSED; some OPEN if recent; small REOPENED slice.
-- =============================================================================

do $$
declare
  i               int;
  v_day_weight    numeric;
  v_day_offset    int;
  v_hour          int;
  v_min           int;
  v_sec           int;
  v_created_at    timestamptz;
  v_closed_at     timestamptz;
  v_handle_sec    int;
  v_decision_roll numeric;
  v_decision      decision_type;
  v_channel_roll  numeric;
  v_channel       channel_type;
  v_status_roll   numeric;
  v_status_detail claim_status_detail;
  v_is_closed     boolean;
  v_is_reopened   boolean;
  v_stage         text;
  v_primary_agent text;
  v_sentiment     numeric;
  v_reason_code   text;
  v_citation      text;
  v_issue         text;
  v_customer_id   uuid;
  v_order_id      uuid;
  v_reopen_cat    reopen_category;
  v_reopen_note   text;
  v_reopened_at   timestamptz;
  v_claim_id      text;
  -- arrays of customer/order ids for random selection
  v_customer_ids  uuid[];
  v_order_ids     uuid[];
  v_issues        text[] := array[
    'Paddle face cracked along the edge',
    'Edge guard came loose during play',
    'Handle grip is peeling off',
    'Hairline crack near throat area',
    'Dead spot on the face — sounds hollow',
    'Surface delaminating around the perimeter',
    'Paddle warped after one week of play',
    'NFC chip not reading in the app',
    'Receipt was uploaded but never approved',
    'Order arrived but paddle was damaged in box',
    'Replacement paddle has the same defect',
    'Grip wrap unraveling after light use',
    'Cosmetic chip near the corner',
    'Paddle face has bubbling under the surface',
    'Eyewear hinge snapped on first use',
    'Bag zipper broke within a month',
    'Net pole bent during normal assembly',
    'Returning a gift — wrong paddle model',
    'Question about warranty registration window',
    'Paddle sounds different after one session',
    'Core sounds dead, very dampened response',
    'Throat area has spider-web cracks',
    'Edge guard fully detached on the bottom',
    'Carbon face has visible fiber lifting',
    'Paddle bag handle stitching came apart',
    'Ball logo prints are flaking off',
    'Eyewear lens has internal scratch',
    'Net height adjustment slipping during play'
  ];
begin
  -- Collect the candidate customer/order pools
  select array_agg(id) into v_customer_ids from customers;
  select array_agg(id) into v_order_ids    from orders;

  for i in 1..260 loop
    -- ----- recency weight: more in last 7d (pow(random, 1.6)) -----
    v_day_weight := power(random(), 1.6);
    v_day_offset := floor(v_day_weight * 30)::int;  -- 0..29
    v_hour := 8 + floor(random() * 13)::int;        -- 8..20
    v_min  := floor(random() * 60)::int;
    v_sec  := floor(random() * 60)::int;
    v_created_at := date_trunc('day', now()) - (v_day_offset || ' days')::interval
                    + (v_hour || ' hours')::interval
                    + (v_min  || ' minutes')::interval
                    + (v_sec  || ' seconds')::interval;

    -- ----- decision roll: 62/16/13/7/2 -----
    v_decision_roll := random();
    if v_decision_roll < 0.62 then
      v_decision := 'ELIGIBLE_FOR_DAMAGE_REVIEW';
    elsif v_decision_roll < 0.78 then
      v_decision := 'NOT_ELIGIBLE';
    elsif v_decision_roll < 0.91 then
      v_decision := 'HUMAN_REVIEW_REQUIRED';
    elsif v_decision_roll < 0.98 then
      v_decision := 'WARRANTY_EXPIRED';
    else
      v_decision := 'PROCESSING';
    end if;

    -- ----- channel: 42% email / 36% voice / 22% web -----
    v_channel_roll := random();
    if    v_channel_roll < 0.42 then v_channel := 'email';
    elsif v_channel_roll < 0.78 then v_channel := 'voice';
    else                              v_channel := 'web';
    end if;

    -- ----- primary agent: matches decision -----
    v_primary_agent := case v_decision
      when 'HUMAN_REVIEW_REQUIRED'      then 'esc'
      when 'NOT_ELIGIBLE'               then 'rules'
      when 'WARRANTY_EXPIRED'           then 'rules'
      when 'ELIGIBLE_FOR_DAMAGE_REVIEW' then 'response'
      else 'intake'  -- PROCESSING
    end;

    -- ----- sentiment: lower for HUMAN_REVIEW, higher for ELIGIBLE -----
    v_sentiment := case v_decision
      when 'HUMAN_REVIEW_REQUIRED'      then 0.10 + random() * 0.30
      when 'NOT_ELIGIBLE'               then 0.20 + random() * 0.30
      when 'WARRANTY_EXPIRED'           then 0.30 + random() * 0.30
      when 'ELIGIBLE_FOR_DAMAGE_REVIEW' then 0.55 + random() * 0.40
      else 0.40 + random() * 0.30
    end;

    -- ----- status: PROCESSING always OPEN; recent random OPEN; rare REOPENED -----
    v_status_roll := random();
    if v_decision = 'PROCESSING' then
      v_is_closed   := false;
      v_is_reopened := false;
    elsif v_day_offset < 2 and v_status_roll < 0.35 then
      v_is_closed   := false;
      v_is_reopened := false;
    elsif v_status_roll > 0.96 then
      v_is_closed   := false;  -- REOPENED is its own bucket
      v_is_reopened := true;
    else
      v_is_closed   := true;
      v_is_reopened := false;
    end if;

    -- ----- stage -----
    if v_is_closed then
      v_stage := 'closed';
    elsif v_is_reopened then
      v_stage := 'rules';
    else
      v_stage := (array['intake','verify','rules','draft'])[1 + floor(random() * 4)::int];
    end if;

    -- ----- status_detail -----
    if v_is_reopened then
      v_status_detail := 'REOPENED';
    elsif v_is_closed then
      v_status_detail := case v_decision
        when 'ELIGIBLE_FOR_DAMAGE_REVIEW' then 'CLOSED_RESOLVED'
        when 'NOT_ELIGIBLE'               then 'CLOSED_DECLINED'
        when 'WARRANTY_EXPIRED'           then 'CLOSED_EXPIRED'
        when 'HUMAN_REVIEW_REQUIRED'      then
          (case when random() < 0.6 then 'CLOSED_RESOLVED' else 'CLOSED_DECLINED' end)::claim_status_detail
        else 'CLOSED_RESOLVED'
      end;
    else
      v_status_detail := case v_decision
        when 'HUMAN_REVIEW_REQUIRED'      then 'ESCALATED'
        when 'ELIGIBLE_FOR_DAMAGE_REVIEW' then
          (case v_stage
             when 'intake' then 'NEW'
             when 'verify' then 'AWAITING_VERIFICATION'
             when 'rules'  then 'IN_RULE_EVAL'
             when 'draft'  then 'DRAFT_PENDING_APPROVAL'
             else 'NEW'
           end)::claim_status_detail
        when 'NOT_ELIGIBLE'               then 'IN_RULE_EVAL'
        when 'WARRANTY_EXPIRED'           then 'IN_RULE_EVAL'
        else 'NEW'  -- PROCESSING
      end;
    end if;

    -- ----- closed_at / handle_seconds -----
    if v_is_closed then
      v_handle_sec := 40 + floor(random() * 680)::int;  -- 40s..12m mostly
      -- ~8% will breach the 10-min SLA on purpose
      if random() < 0.08 then
        v_handle_sec := 660 + floor(random() * 1800)::int;
      end if;
      v_closed_at := v_created_at + (v_handle_sec || ' seconds')::interval;
    else
      v_handle_sec := null;
      v_closed_at  := null;
    end if;

    -- ----- reason_code + citation (skip for PROCESSING) -----
    if v_decision = 'PROCESSING' then
      v_reason_code := null;
      v_citation    := null;
    elsif v_decision = 'NOT_ELIGIBLE' then
      case floor(random() * 5)::int
        when 0 then v_reason_code := 'UNAUTHORIZED_SELLER';        v_citation := '§1.7, §2.3';
        when 1 then v_reason_code := 'NON_ORIGINAL_PURCHASER';     v_citation := '§4.4, §2.1';
        when 2 then v_reason_code := 'NORMAL_WEAR_AND_TEAR';       v_citation := '§2.3';
        when 3 then v_reason_code := 'OUTSIDE_WARRANTY_REGION';    v_citation := '§2.1, §4.13';
        else        v_reason_code := 'CANCELLATION_NOT_PERMITTED'; v_citation := '§1.5, §4.10';
      end case;
    elsif v_decision = 'WARRANTY_EXPIRED' then
      v_reason_code := 'WARRANTY_PERIOD_EXPIRED';
      v_citation    := '§2.4';
    elsif v_decision = 'HUMAN_REVIEW_REQUIRED' then
      case floor(random() * 5)::int
        when 0 then v_reason_code := 'AMBIGUOUS_DAMAGE';          v_citation := '§2.3, §5.2';
        when 1 then v_reason_code := 'REPLACEMENT_LIMIT_REACHED'; v_citation := '§2.8 Step 5, §5.2';
        when 2 then v_reason_code := 'DISPUTED_SELLER';           v_citation := '§1.7, §2.9, §5.2';
        when 3 then v_reason_code := 'BRAND_RISK';                v_citation := '§5.2';
        else        v_reason_code := 'TABLE_SIGNED_DAMAGED';      v_citation := '§4.11, §2.7, §5.2';
      end case;
    else  -- ELIGIBLE_FOR_DAMAGE_REVIEW
      case floor(random() * 4)::int
        when 0 then v_reason_code := 'NFC_REGISTERED_WITHIN_WINDOW'; v_citation := '§2.5, §2.4';
        when 1 then v_reason_code := 'AUTHORIZED_PURCHASE_IN_WARRANTY'; v_citation := '§2.2, §2.4';
        when 2 then v_reason_code := 'DAMAGED_ON_ARRIVAL';           v_citation := '§3.9, §1.3';
        else        v_reason_code := 'DEFECT_REPORTED_WITH_PHOTOS';  v_citation := '§2.8 Step 2';
      end case;
    end if;

    -- ----- issue -----
    v_issue := v_issues[1 + floor(random() * array_length(v_issues, 1))::int];

    -- ----- pick a (customer, order) — bias to matched pairs but allow strays -----
    v_customer_id := v_customer_ids[1 + floor(random() * array_length(v_customer_ids, 1))::int];
    if random() < 0.92 then
      -- prefer an order this customer owns
      select id into v_order_id
        from orders
       where customer_id = v_customer_id
       order by random()
       limit 1;
      if v_order_id is null then
        v_order_id := v_order_ids[1 + floor(random() * array_length(v_order_ids, 1))::int];
      end if;
    else
      v_order_id := null;  -- 8% have no order link (truly unknown purchase)
    end if;

    -- ----- reopen fields (only set if v_is_reopened) -----
    if v_is_reopened then
      v_reopen_cat := (array['customer_disputed','damage_worsened','new_info','other'])
                      [1 + floor(random() * 4)::int]::reopen_category;
      v_reopen_note := case v_reopen_cat
        when 'customer_disputed' then 'Customer replied disputing the decline — wants escalation.'
        when 'damage_worsened'   then 'Customer reports damage has gotten worse since closing.'
        when 'new_info'          then 'Customer provided new photos and proof of purchase.'
        else 'Reopened per CS Lead review.'
      end;
      v_reopened_at := coalesce(v_closed_at, v_created_at) + interval '6 hours';
    else
      v_reopen_cat  := null;
      v_reopen_note := null;
      v_reopened_at := null;
    end if;

    -- ----- INSERT -----
    insert into claims (
      customer_id, order_id, channel, issue,
      status_detail, decision, reason_code, citation,
      policy_version, primary_agent_id, sentiment, stage,
      created_at, closed_at,
      reopened_at, reopen_category, reopen_note
    ) values (
      v_customer_id, v_order_id, v_channel, v_issue,
      v_status_detail, v_decision, v_reason_code, v_citation,
      '1.0.0', v_primary_agent, round(v_sentiment, 2), v_stage,
      v_created_at, v_closed_at,
      v_reopened_at, v_reopen_cat, v_reopen_note
    ) returning id into v_claim_id;
  end loop;
end $$;

-- =============================================================================
-- 6. ESCALATIONS (active queue — link to the HUMAN_REVIEW_REQUIRED claims above)
--    Matches design's seedEscalations shape & wait_minutes spread.
-- =============================================================================

insert into escalations (id, priority, reason, wait_minutes, summary) values
  ('WC-10016', 'urgent', 'REPLACEMENT_LIMIT_REACHED',  4,
    'Replacement limit reached — 3 prior replacements on Perseus paddle. Customer asking for fourth.'),
  ('WC-10017', 'high',   'OUTSIDE_REGION',            11,
    'Customer in India, purchased from JOOLA US site. Wants warranty replacement.'),
  ('WC-10018', 'high',   'DISPUTED_SELLER',           18,
    'Disputes eBay = unauthorized. Says seller was "official" JOOLA storefront.'),
  ('WC-10019', 'norm',   'AMBIGUOUS_DAMAGE',          32,
    'Photos unclear — damage could be wear-and-tear or manufacturing.'),
  ('WC-10020', 'norm',   'BRAND_RISK',                41,
    'Customer mentioned social media — handle with care.'),
  ('WC-10011', 'urgent', 'SAFETY',                    52,
    'Indoor table arrived damaged — customer signed for it. Needs case-by-case freight review.'),
  ('WC-10014', 'urgent', 'SAFETY',                     6,
    'Eyewear hinge snapped mid-rally — piece flew toward eye. Safety review required.'),
  ('WC-10003', 'high',   'REPLACEMENT_LIMIT_REACHED', 28,
    'Replacement paddle ALSO defective — 4th replacement on the Perseus. Cap exceeded.')
on conflict (id) do nothing;

-- =============================================================================
-- 7. DRAFTS (~15 pending_approval drafts for recent open ELIGIBLE claims)
--    We pull the most recent N open eligible claims procedurally so this
--    auto-adapts to whatever the bulk loop produced.
-- =============================================================================

insert into drafts (claim_id, voice_text, email_subject, email_body, internal_summary, status)
select
  c.id,
  'I found your purchase and confirmed your paddle was registered within 14 days with a valid receipt. That gives you the 12-month warranty, and it''s currently active. The next step is to upload a few damage photos so our team can review the claim.',
  'Warranty Claim Received — Damage Review Required',
  E'Hi ' || split_part(cu.name, ' ', 1) || E',\n\nThank you for contacting us about your ' || coalesce(o.product_name, 'JOOLA product')
    || E'. I''ve verified order ' || coalesce(o.order_number, '(pending)')
    || E' and confirmed NFC registration was completed within 14 days with an approved receipt — that qualifies you for the 12-month extended warranty, which is currently active.\n\n'
    || E'To complete the review, please reply with:\n'
    || E'  • Full front photo of the paddle\n'
    || E'  • Full back photo of the paddle\n'
    || E'  • Close-up of the damaged area\n'
    || E'  • NFC / serial area photo if visible\n\n'
    || E'Our team will review within 24 hours and follow up with next steps.\n\n'
    || E'Thank you,\nJOOLA Customer Support',
  'Customer ' || cu.name || ' purchased ' || coalesce(o.product_name, 'a JOOLA product')
    || '. NFC registration confirmed within 14 days with approved receipt — qualifies for 12-month extended warranty. Warranty currently active. Recommend requesting damage photos for review.',
  'pending_approval'
from claims c
join customers cu on cu.id = c.customer_id
left join orders o on o.id = c.order_id
where c.decision = 'ELIGIBLE_FOR_DAMAGE_REVIEW'
  and c.display_status = 'OPEN'
  and c.stage in ('draft','rules','verify','intake')
order by c.created_at desc
limit 15;

-- =============================================================================
-- 8. CASE EVENTS — initial CREATED for every claim; closed claims also get
--    CS_APPROVED + CS_CLOSED_MANUAL. Audit trail per the policy.
-- =============================================================================

-- 8a. CREATED event for every claim
insert into case_events (claim_id, event_type, actor_type, actor_id, payload, policy_version, created_at)
select
  c.id,
  'AI_CLAIM_CREATED',
  'AI'::actor_type_enum,
  'intake',
  jsonb_build_object(
    'channel', c.channel,
    'issue',   c.issue,
    'order_id', c.order_id
  ),
  '1.0.0',
  c.created_at
from claims c;

-- 8b. RULES_DECISION event for every claim where decision != PROCESSING
insert into case_events (claim_id, event_type, actor_type, actor_id, payload, policy_version, created_at)
select
  c.id,
  'AI_RULES_DECISION',
  'AI'::actor_type_enum,
  'rules',
  jsonb_build_object(
    'decision',    c.decision,
    'reason_code', c.reason_code,
    'citation',    c.citation
  ),
  c.policy_version,
  c.created_at + interval '8 seconds'
from claims c
where c.decision <> 'PROCESSING';

-- 8c. CS_APPROVED + CS_CLOSED_MANUAL for every CLOSED claim
insert into case_events (claim_id, event_type, actor_type, actor_id, payload, policy_version, created_at)
select
  c.id,
  'CS_APPROVED',
  'CS_LEAD'::actor_type_enum,
  'demo-cs-lead',
  jsonb_build_object('status_detail', c.status_detail),
  c.policy_version,
  c.closed_at - interval '30 seconds'
from claims c
where c.display_status = 'CLOSED' and c.closed_at is not null;

insert into case_events (claim_id, event_type, actor_type, actor_id, payload, policy_version, created_at)
select
  c.id,
  'CS_CLOSED_MANUAL',
  'CS_LEAD'::actor_type_enum,
  'demo-cs-lead',
  jsonb_build_object('status_detail', c.status_detail, 'handle_seconds', c.handle_seconds),
  c.policy_version,
  c.closed_at
from claims c
where c.display_status = 'CLOSED' and c.closed_at is not null;

-- 8d. CS_REOPENED for every REOPENED claim
insert into case_events (claim_id, event_type, actor_type, actor_id, payload, policy_version, created_at)
select
  c.id,
  'CS_REOPENED',
  'CS_LEAD'::actor_type_enum,
  'demo-cs-lead',
  jsonb_build_object('category', c.reopen_category, 'note', c.reopen_note),
  c.policy_version,
  c.reopened_at
from claims c
where c.display_status = 'REOPENED' and c.reopened_at is not null;

-- =============================================================================
-- 9. AGENT STATES — refresh handled_today counts so the dashboard reflects seed
-- =============================================================================

update agent_states a
   set handled_today = sub.cnt,
       avg_ms        = 220 + floor(random() * 1180)::int,
       load_pct      = case a.agent_id
                         when 'intake'   then 32
                         when 'shopify'  then 48
                         when 'warrreg'  then 51
                         when 'rules'    then 22
                         when 'summary'  then 38
                         when 'response' then 64
                         when 'esc'      then 28
                         else 0
                       end,
       state         = case a.agent_id
                         when 'response' then 'busy'::agent_state_type
                         when 'warrreg'  then 'busy'::agent_state_type
                         when 'shopify'  then 'busy'::agent_state_type
                         when 'rules'    then 'idle'::agent_state_type
                         when 'intake'   then 'idle'::agent_state_type
                         when 'summary'  then 'busy'::agent_state_type
                         when 'esc'      then 'blocked'::agent_state_type
                         else 'idle'::agent_state_type
                       end,
       queue_depth   = case a.agent_id
                         when 'response' then 9
                         when 'warrreg'  then 5
                         when 'shopify'  then 6
                         when 'rules'    then 0
                         when 'intake'   then 0
                         when 'summary'  then 4
                         when 'esc'      then 3
                         else 0
                       end
  from (
    select primary_agent_id as agent_id, count(*)::int as cnt
      from claims
     where created_at::date = current_date
     group by primary_agent_id
  ) sub
 where sub.agent_id = a.agent_id;

commit;

-- =============================================================================
-- DONE.
-- Expected row counts after seed:
--   customers:     33
--   orders:        60
--   registrations: 29
--   claims:        280  (20 hand-crafted + 260 procedural)
--   escalations:    8
--   drafts:        ~15 (capped at 15, but may be fewer if not enough OPEN eligible)
--   case_events:   ~280 + ~275 + ~closed*2 + ~reopened   ≈ 1000+
-- =============================================================================
