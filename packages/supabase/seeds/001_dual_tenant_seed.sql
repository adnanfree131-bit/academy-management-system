-- =============================================================================
-- SEED DATA: DUAL-TENANT TEST FIXTURE (TENANT A: APEX, TENANT B: CRESCENT)
-- =============================================================================

-- Tenant A (Apex Academy)
INSERT INTO tenants (id, name, slug, status, tier, max_students, max_staff, settings)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Apex Academy Lahore',
  'apex',
  'active',
  'enterprise',
  1200,
  80,
  '{"currency": "PKR", "timezone": "Asia/Karachi", "date_format": "DD/MM/YYYY", "academic_session": "2026-2027", "campus_name": "Gulberg III Campus", "phone_country_code": "+92", "features": {"mobile_pwa_enabled": true, "whatsapp_rapid_queue": true, "geofence_attendance": true}}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Tenant B (Crescent College)
INSERT INTO tenants (id, name, slug, status, tier, max_students, max_staff, settings)
VALUES (
  'b0000000-0000-0000-0000-000000000002',
  'Crescent College Karachi',
  'crescent',
  'trial',
  'starter',
  300,
  25,
  '{"currency": "PKR", "timezone": "Asia/Karachi", "date_format": "DD/MM/YYYY", "academic_session": "2026-2027", "campus_name": "Clifton Campus", "phone_country_code": "+92", "features": {"mobile_pwa_enabled": false, "whatsapp_rapid_queue": false, "geofence_attendance": false}}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Tenant A Users
INSERT INTO users (id, tenant_id, email, phone, full_name, role, status)
VALUES 
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'adnan@apexacademy.edu.pk', '+923001112233', 'Director Adnan', 'tenant_admin', 'active'),
  ('a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'tariq@apexacademy.edu.pk', '+923002223344', 'Sir Tariq Physics', 'teacher', 'active'),
  ('a1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'parent.hamza@gmail.com', '+923003334455', 'M. Hamza Guardian', 'parent', 'active')
ON CONFLICT (id) DO NOTHING;

-- Tenant B Users
INSERT INTO users (id, tenant_id, email, phone, full_name, role, status)
VALUES 
  ('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'fatima@crescent.edu.pk', '+923214445566', 'Principal Fatima', 'tenant_admin', 'active'),
  ('b1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'ayesha@crescent.edu.pk', '+923215556677', 'Miss Ayesha Biology', 'teacher', 'active')
ON CONFLICT (id) DO NOTHING;
