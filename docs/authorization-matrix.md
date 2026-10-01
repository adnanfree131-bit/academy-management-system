# System Authorization Matrix & Auditability Specification

## 1. Architectural Overview

The academy management system enforces a defense-in-depth security model:
1. **Global Identity (`auth.users`, `public.profiles`)**: User identity is managed exclusively via Supabase Auth. Passwords and credentials never touch custom application tables.
2. **Tenant Membership Boundary (`public.tenant_memberships`)**: Tenant permissions and roles are bound to tenant memberships, with foreign key integrity spanning operational entities.
3. **Database-Enforced Row Level Security (RLS)**: Every operational table enforces RLS. Context is established via session configuration (`app.current_tenant_id`, `app.current_user_id`, `app.is_super_admin`) and verified using `is_active_tenant_member(tenant_id)`.
4. **Step-Up Authentication (MFA / AAL2)**: High-risk administrative actions (fee reversals, payroll disbursement, staff permission modification, academy suspension) strictly require Authenticator Assurance Level 2 (`aal2`).
5. **Immutable Append-Only Audit Logging**: Sensitive operations produce audit records in `public.audit_logs`. Modification or deletion of audit logs is forbidden at the database engine level via triggers.

---

## 2. Institutional Role Hierarchy

| Role | Scope | Description | Allowed Operations Summary |
| :--- | :--- | :--- | :--- |
| `super_admin` | Global Platform | SaaS owner & platform administrator | All tenant management, banking configs, platform analytics, tenant suspension/activation. |
| `tenant_admin` | Tenant | Director / Academy Principal | Complete management within active academy: staff, fee structures, admissions, reversals, academic setup. |
| `accountant` | Tenant | Finance Desk Officer | Invoice generation, fee collection, cashbook entries, daily vouchers. Cannot void or pay salaries without MFA and admin approval. |
| `teacher` | Tenant | Academic Instructor | Attendance marking, homework assignments, notebook checks, exam mark entries for assigned classes. |
| `receptionist`| Tenant | Front Desk Officer | Inquiries, admission intake, visitor records, daily attendance tracking. |
| `student` | Tenant (Self) | Enrolled Student | Self portal view: class schedule, attendance record, exam marksheets, fee challans (read-only). |
| `parent` | Tenant (Ward) | Guardian / Parent | Self portal view: linked children's attendance, fee challans, exam report cards (read-only). |

---

## 3. Comprehensive Route Authorization Matrix

### 3.1 Authentication & Tenant Lifecycle

| HTTP Method | Endpoint | Min Role | Tenant Header Required | MFA (`aal2`) Required | Audit Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/auth/session` | Any authenticated | Optional | No | - |
| `GET` | `/api/v1/auth/me` | Any authenticated | Optional | No | - |
| `POST` | `/api/v1/auth/onboard-tenant` | Any authenticated | No | No | `TENANT_ONBOARDED` |
| `POST` | `/api/v1/auth/invitations` | `tenant_admin` | Yes | No | `INVITATION_CREATED` |
| `POST` | `/api/v1/auth/invitations/:id/revoke` | `tenant_admin` | Yes | No | `INVITATION_REVOKED` |
| `GET` | `/api/v1/auth/invitations/:token/inspect`| Public / Any | No | No | - |
| `POST` | `/api/v1/auth/invitations/accept` | Any authenticated | No | No | `INVITATION_ACCEPTED` |
| `POST` | `/api/v1/auth/login` | Deprecated | - | - | **410 Gone (`LEGACY_AUTH_DEPRECATED`)** |
| `POST` | `/api/v1/auth/register` | Deprecated | - | - | **410 Gone (`LEGACY_AUTH_DEPRECATED`)** |
| `POST` | `/api/v1/auth/reset-password` | Deprecated | - | - | **410 Gone (`LEGACY_AUTH_DEPRECATED`)** |
| `POST` | `/api/v1/auth/change-password` | Deprecated | - | - | **410 Gone (`LEGACY_AUTH_DEPRECATED`)** |

### 3.2 Platform SaaS Control Plane (`super_admin` Only)

| HTTP Method | Endpoint | Min Role | Tenant Header Required | MFA (`aal2`) Required | Audit Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/saas/superadmin/overview` | `super_admin` | No | No | - |
| `GET` | `/api/v1/saas/academies` | `super_admin` | No | No | - |
| `POST` | `/api/v1/saas/tenants/:id/suspend` | `super_admin` | No | **Yes** | `TENANT_SUSPENDED` |
| `POST` | `/api/v1/saas/tenants/:id/reinstate` | `super_admin` | No | **Yes** | `TENANT_REINSTATED` |
| `PUT` | `/api/v1/saas/banking-config` | `super_admin` | No | **Yes** | `PLATFORM_BANKING_UPDATED` |
| `POST` | `/api/v1/saas/receipts/:id/review` | `super_admin` | No | **Yes** | `SUBSCRIPTION_RECEIPT_REVIEWED` |

### 3.3 Academic Management

| HTTP Method | Endpoint | Min Role | Tenant Header Required | MFA (`aal2`) Required | Audit Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/academic/programs` | Any member | Yes | No | - |
| `POST` | `/api/v1/academic/programs` | `tenant_admin` | Yes | No | `PROGRAM_CREATED` |
| `GET` | `/api/v1/academic/batches` | Any member | Yes | No | - |
| `POST` | `/api/v1/academic/batches` | `tenant_admin` | Yes | No | `BATCH_CREATED` |
| `GET` | `/api/v1/academic/students` | Staff / Admin | Yes | No | - |
| `POST` | `/api/v1/academic/students` | Staff / Admin | Yes | No | `STUDENT_ADMITTED` |
| `DELETE` | `/api/v1/academic/students/:id` | `tenant_admin` | Yes | **Yes** | `STUDENT_ARCHIVED` |
| `GET` | `/api/v1/academic/staff` | `tenant_admin` | Yes | No | - |
| `POST` | `/api/v1/academic/staff` | `tenant_admin` | Yes | No | `STAFF_CREATED` |
| `PATCH`| `/api/v1/academic/staff/:id/access` | `tenant_admin` | Yes | **Yes** | `STAFF_ACCESS_UPDATED` |

### 3.4 Finance, Invoicing & Reversals

| HTTP Method | Endpoint | Min Role | Tenant Header Required | MFA (`aal2`) Required | Audit Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/finance/invoices` | Any member | Yes | No | - |
| `POST` | `/api/v1/finance/invoices` | `accountant` | Yes | No | `INVOICE_GENERATED` |
| `POST` | `/api/v1/finance/invoices/:id/cancel` | `tenant_admin` | Yes | **Yes** | `INVOICE_CANCELLED` |
| `POST` | `/api/v1/finance/invoices/:id/void` | `tenant_admin` | Yes | **Yes** | `INVOICE_VOIDED` |
| `DELETE` | `/api/v1/finance/invoices/:id` | `tenant_admin` | Yes | **Yes** | `INVOICE_DELETED` |
| `POST` | `/api/v1/finance/payments` | `accountant` | Yes | No | `PAYMENT_RECORDED` |
| `POST` | `/api/v1/finance/payments/:id/void` | `tenant_admin` | Yes | **Yes** | `PAYMENT_VOIDED` |
| `POST` | `/api/v1/finance/payments/:id/reverse` | `tenant_admin` | Yes | **Yes** | `PAYMENT_REVERSED` |
| `DELETE` | `/api/v1/finance/payments/:id` | `tenant_admin` | Yes | **Yes** | `PAYMENT_DELETED` |
| `GET` | `/api/v1/finance/cashbook` | `accountant` | Yes | No | - |
| `POST` | `/api/v1/finance/cashbook` | `accountant` | Yes | No | `CASHBOOK_ENTRY_CREATED` |

### 3.5 Payroll & Staff Disbursements

| HTTP Method | Endpoint | Min Role | Tenant Header Required | MFA (`aal2`) Required | Audit Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/payroll/payslips` | `accountant` | Yes | No | - |
| `POST` | `/api/v1/payroll/generate` | `tenant_admin` | Yes | No | `PAYSLIPS_GENERATED` |
| `POST` | `/api/v1/payroll/payslips/:id/pay` | `tenant_admin` | Yes | **Yes** | `SALARY_DISBURSED` |

### 3.6 Attendance & Physical Notebook Check

| HTTP Method | Endpoint | Min Role | Tenant Header Required | MFA (`aal2`) Required | Audit Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/attendance/daily` | Staff / Admin | Yes | No | - |
| `POST` | `/api/v1/attendance/daily` | `teacher` | Yes | No | `ATTENDANCE_MARKED` |
| `POST` | `/api/v1/attendance/correction` | `tenant_admin` | Yes | No | `ATTENDANCE_CORRECTION` |
| `POST` | `/api/v1/attendance/clock-in` | Any Staff | Yes | No | `STAFF_CLOCK_IN` |
| `POST` | `/api/v1/attendance/clock-out` | Any Staff | Yes | No | `STAFF_CLOCK_OUT` |

---

## 4. Database Entity & RLS Isolation Matrix

| Database Entity | Row Level Security (RLS) | Read Access Rule | Write Access Rule | Immutability Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `public.tenants` | Forced | Member of tenant or `super_admin` | `super_admin` (or `tenant_admin` for profile settings) | Primary keys immutable |
| `public.profiles` | Forced | Own profile (`auth_user_id`) or `super_admin` | Own profile (display info) or `super_admin` (status) | Status changes logged |
| `public.tenant_memberships` | Forced | Active member in same tenant or `super_admin` | `tenant_admin` or `super_admin` | Cannot delete without orphan audit |
| `public.tenant_invitations` | Forced | `tenant_admin` in tenant or public via token hash | `tenant_admin` (create/revoke) or system (accept) | Token hash single-use |
| `public.students` | Forced | Active member in same tenant | `tenant_admin`, `receptionist`, `accountant` | Admission number unique per tenant |
| `public.student_invoices` | Forced | Active member in same tenant | `accountant`, `tenant_admin` | Numbering sequence strictly sequential |
| `public.fee_payments` | Forced | Active member in same tenant | `accountant`, `tenant_admin` | Receipt numbers immutable; voids append new state |
| `public.staff_payslips` | Forced | `tenant_admin`, `accountant`, or owning staff | `tenant_admin`, `accountant` | Paid payslips immutable |
| `public.student_attendance` | Forced | Active member in same tenant | `teacher`, `tenant_admin` | Regularization creates audit delta |
| `public.audit_logs` | Forced | `tenant_admin` in tenant or `super_admin` | Insert only (`authenticated`, `fastify_runtime`) | **Append-Only Trigger (`trg_prevent_audit_log_modification`)** |

---

## 5. Audit Logging & Security Log Hygiene

### 5.1 Append-Only Audit Integrity
- **Database Trigger**: `trg_prevent_audit_log_modification` blocks all `UPDATE` and `DELETE` queries on `public.audit_logs`.
- **Runtime Privilege Revocation**: The runtime user roles `fastify_runtime` and `authenticated` are stripped of `UPDATE` and `DELETE` table privileges on `public.audit_logs`.
- **Atomic Transaction Logging**: All critical state changes (tenant onboarding, fee voiding, salary disbursement, attendance regularization) insert an audit log record within the same ACID database transaction. If the transaction rolls back, no detached audit record is retained.

### 5.2 Log Hygiene & Secret Redaction
- **Never Log Secrets**: Application logs, structured JSON logs, and `changes` audit columns MUST NEVER contain:
  - Cleartext passwords or hashes
  - Supabase JWT access or refresh tokens
  - Fastify session cookies or bearer headers
  - Unhashed invitation tokens or password reset links
  - Credit card numbers, CVVs, or unmasked bank credentials
- **Audit Column Standards**: The `changes` column in `public.audit_logs` stores sanitized key-value differentials:
  ```json
  {
    "previous_status": "unpaid",
    "new_status": "cancelled",
    "reason": "Administrative fee waiver granted by Principal"
  }
  ```
