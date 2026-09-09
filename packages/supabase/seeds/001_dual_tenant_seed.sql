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

-- Tenant B (Crescent Academy)
INSERT INTO tenants (id, name, slug, status, tier, max_students, max_staff, settings)
VALUES (
  'b0000000-0000-0000-0000-000000000002',
  'Crescent Academy Karachi',
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
  ('a1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'parent.hamza@gmail.com', '+923003334455', 'M. Hamza Guardian', 'parent', 'active'),
  ('a1000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'superadmin@kampus.pk', '+923000000000', 'Platform Super Administrator', 'super_admin', 'active'),
  ('a1000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'kampuserp@gmail.com', '+923000000001', 'Super Admin Recovery & Support', 'super_admin', 'active')
ON CONFLICT (id) DO NOTHING;

-- Tenant B Users
INSERT INTO users (id, tenant_id, email, phone, full_name, role, status)
VALUES 
  ('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'fatima@crescent.edu.pk', '+923214445566', 'Principal Fatima', 'tenant_admin', 'active'),
  ('b1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'ayesha@crescent.edu.pk', '+923215556677', 'Miss Ayesha Biology', 'teacher', 'active')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- PHASE 2 FIXTURES: ACADEMIC PROGRAMS, BATCHES, INQUIRIES & STUDENTS
-- =============================================================================

-- Tenant A Programs & Batches
INSERT INTO programs (id, tenant_id, name, code, description)
VALUES 
  ('a2000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'MDCAT Comprehensive Prep', 'MDCAT-PREP', 'Medical entry test preparation')
ON CONFLICT (id) DO NOTHING;

INSERT INTO batches (id, tenant_id, program_id, name, shift, academic_session, max_capacity, room_number)
VALUES 
  ('a3000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'MDCAT Morning - Batch A', 'morning', '2026-2027', 50, 'Hall 1')
ON CONFLICT (id) DO NOTHING;

-- Tenant A Inquiries & Students
INSERT INTO student_inquiries (id, tenant_id, inquiry_number, student_name, phone, program_id, stage, priority)
VALUES 
  ('a4000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'INQ-2026-001', 'Prospective Hamza', '+923001234567', 'a2000000-0000-0000-0000-000000000001', 'follow_up', 'high')
ON CONFLICT (id) DO NOTHING;

INSERT INTO students (id, tenant_id, admission_number, roll_number, full_name, guardian_name, guardian_phone, program_id, batch_id, status)
VALUES 
  ('a5000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'ADM-2026-001', 'A-101', 'Muhammad Ali Raza', 'Raza Ahmed', '+923009876543', 'a2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'active')
ON CONFLICT (id) DO NOTHING;

-- Tenant B Programs, Batches & Students
INSERT INTO programs (id, tenant_id, name, code, description)
VALUES 
  ('b2000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'O-Levels Science Track', 'O-SCI', 'Cambridge O-Levels sciences')
ON CONFLICT (id) DO NOTHING;

INSERT INTO batches (id, tenant_id, program_id, name, shift, academic_session, max_capacity)
VALUES 
  ('b3000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000001', 'O-Levels Morning Section 1', 'morning', '2026-2027', 30)
ON CONFLICT (id) DO NOTHING;

INSERT INTO students (id, tenant_id, admission_number, roll_number, full_name, guardian_name, guardian_phone, program_id, batch_id, status)
VALUES 
  ('b5000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'ADM-2026-B01', 'B-101', 'Zoya Tariq', 'Tariq Mehmood', '+923219988776', 'b2000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001', 'active')
ON CONFLICT (id) DO NOTHING;
