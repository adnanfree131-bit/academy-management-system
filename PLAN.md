# Exhaustive Master Specification & Feature Blueprint: Multi-Tenant Academy Management ERP System

<!-- /autoplan restore point: /home/adnan/.gstack/projects/academymanagementsystem/master-autoplan-restore-20260907-164704.md -->

## 1. System Vision & Architecture Principles

### 1.1 Core Objectives
An enterprise-grade, cloud-native Multi-Tenant Academy Enterprise Resource Planning (ERP) platform. Designed for individual academies, multi-branch coaching centers, test-preparation institutes, tuition academies, and vocational learning centers.

### 1.3 Strict Engineering Directive: Zero Hardcoded Academic Data (Database-Driven Dynamic Flow)
> [!IMPORTANT]
> **IRON LAW: ZERO HARDCODED ACADEMIC DATA.**
> - The codebase MUST NEVER contain hardcoded mock/fallback lists of classes, subjects, groups, or tracks (e.g. no hardcoded arrays of `['Physics', 'Biology', 'Chemistry']` or `['Grade 9', 'Grade 10']` in frontend or backend code).
> - Every dropdown, select menu, table, and option in the entire system MUST be populated strictly and 100% dynamically from database queries scoped to the active `tenant_id`.
> - If an academy has just registered and has not created any subjects or groups yet:
>   - Dropdowns MUST display an empty state prompting the user: *"No subject groups created yet. Please create subject groups in Settings -> Subjects first."*
>   - The system must enforce the sequential operational setup flow:
>     **Step 1: Academy Settings** -> **Step 2: Create Classes / Grades** -> **Step 3: Create Individual Subjects** -> **Step 4: Create Compulsory & Elective Subject Groups** -> **Step 5: Create Batches** -> **Step 6: Register Students (options populate from DB)**.
> - Any violation of this rule (mock arrays, hardcoded values in templates/code) is treated as a critical production defect.

### 1.2 Tech Stack Architecture (Fully Locked)
- **Edge, DNS & SSL Gateway**: **Cloudflare**
  - Cloudflare for SaaS (Custom Hostnames / Subdomains wildcard SSL termination and DDoS protection).
  - Edge caching, security rules, and rate-limiting for OTP endpoints.
  - Workers / DNS CNAME management for tenant custom domains (`portal.oxfordacademy.edu`).
- **Database, Auth & Realtime Platform**: **Supabase (PostgreSQL 15+)**
  - Native PostgreSQL Row-Level Security (RLS) enforcing strict multi-tenant containment.
  - Supabase Auth handling user sessions, token issuance, and JWT custom claims (`app_metadata`).
  - Supabase Storage for encrypted multi-tenant file buckets (admissions documents, fee receipts, student assignments).
  - Supabase Realtime for instant in-app alerts, attendance updates, and notifications.
- **Transactional Email Engine**: **Brevo (formerly Sendinblue)**
  - High-deliverability transactional email API powering passwordless **6-digit Email OTP login**.
  - Automated parent absence alerts, monthly fee invoice delivery, PDF fee receipts, and exam report cards.
  - Webhooks for delivery, bounce, and open rate tracking.
- **Version Control & CI/CD Pipeline**: **GitHub**
  - GitHub Actions for automated linting, unit/integration testing with Supabase CLI test container, and automated staging/production deployments.
- **Application Server & Business Logic Layer**: **Node.js (TypeScript with Express / Fastify)**
  - Tenant context injection middleware (`SET LOCAL app.current_tenant_id`).
  - Business rules, payment gateway integration (Stripe / Razorpay), Brevo API orchestrator, and background worker queues.
- **Authentication Standard**: **100% Passwordless Email OTP (6-Digit One-Time Password)**
  - Zero password storage or verification.
  - Fast, modern, phishing-resistant email code login flow via Brevo API.

---

## 2. Multi-Tenancy & Security Architecture

### 2.1 Tenant Isolation Strategy
- **Shared Database, Shared Schema with PostgreSQL RLS**:
  - Every single tenant-scoped table contains `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`.
  - Every table index includes composite index `(tenant_id, id)` and `(tenant_id, created_at)`.
  - DB functions and triggers enforce `tenant_id` immutability on update operations.
- **Tenant Context Resolution Pipeline**:
  1. **Subdomain Detection**: e.g., `https://apex.academyerp.com` -> slug = `apex`.
  2. **Custom Domain Detection**: e.g., `https://portal.oxfordacademy.edu` -> mapped in `tenants.custom_domain`.
  3. **Header Fallback**: `X-Tenant-Slug` or `X-Tenant-ID` for direct API integrations / mobile clients.
  4. **Context Injection**: Node.js sets connection session context:
     ```sql
     SET LOCAL app.current_tenant_id = 'c4b28fae-4f51-4e78-9e58-3d5f3089d7b4';
     ```
  5. **Supabase RLS Policy**:
     ```sql
     CREATE POLICY tenant_isolation_all ON students
       FOR ALL
       USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
              OR tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);
     ```

### 2.2 Passwordless Email OTP Authentication Workflow (Brevo + Supabase)
- **Step 1: Request OTP**:
  - Endpoint: `POST /api/auth/send-otp`
  - Body: `{ "email": "user@example.com", "tenant_slug": "apex" }`
  - Cloudflare edge rate-limits repeated requests per IP.
  - System generates cryptographically secure 6-digit numeric token with 10-minute expiry.
  - Stored in hashed format in Supabase / Redis with attempt and resend throttling.
  - Dispatched via **Brevo Transactional Email API** using branded academy template with 6-digit code and academy logo.
- **Step 2: Verify OTP**:
  - Endpoint: `POST /api/auth/verify-otp`
  - Body: `{ "email": "user@example.com", "otp": "482910", "tenant_slug": "apex" }`
  - Validates code; checks attempt counter (lockout after 5 incorrect attempts).
  - Generates Supabase Auth Session & JWT carrying `app_metadata`:
    ```json
    {
      "sub": "user-uuid",
      "email": "user@example.com",
      "app_metadata": {
        "tenant_id": "c4b28fae-4f51-4e78-9e58-3d5f3089d7b4",
        "tenant_slug": "apex",
        "role": "TEACHER",
        "permissions": ["attendance:write", "grades:write", "timetable:read"]
      }
    }
    ```
- **Step 3: Multi-Academy Account Switching**:
  - If an email is registered across multiple academies (e.g. parent with students in Academy A and Academy B, or a visiting lecturer), the API returns all affiliated academies.
  - User selects workspace -> JWT is minted for the selected active tenant context.

---

## 3. Comprehensive Feature & Subfeature Breakdown

---

### Module 1: Super-Admin SaaS Control Plane & Simple 30-Day Trial Logic

#### 1.1 Tenant Registration & 1-Month Free Trial
- **Instant 1-Month Free Trial**:
  - Upon registration, every academy automatically gets 30 days full access (`trial_ends_at = now() + interval '30 days'`).
  - Status set to `trial`. No upfront payment or card needed.
- **Trial Expiration & Lockout Pop-up (Lock Screen)**:
  - When the 30 days expire (`now() > trial_ends_at` and account is not manually activated by Super Admin):
    - Academy portal is locked automatically.
    - A clean **Trial Expired Pop-Up Screen** appears for the Academy Admin upon login.
    - Displays:
      - Warning message: *"Your 30-day free trial has expired. To continue using the academy system, please transfer the subscription fee to the bank details below and send your receipt for immediate account activation."*
      - **Super-Admin Bank Details**: Bank Name, Account Title, Account / IBAN Number, Branch Code, WhatsApp Support Number, Support Email.
      - **Upload Receipt Button**: Academy admin can upload a screenshot of their bank transfer or payment proof directly in the modal.
- **Cloudflare Multi-Account Support**:
  - Account A (Domain Owner) points wildcard `*.academyerp.com` to Account B.
  - Account B (App/Worker/Pages) runs the application and provisions custom hostnames.

#### 1.2 Super-Admin Banking Configuration & Academy Activation
- **Bank Details Management**:
  - Super Admin has a dedicated screen to enter/update Bank Name, Account Title, IBAN / Account Number, instructions, and support WhatsApp/email.
  - Whatever Super Admin writes here is dynamically reflected on the locked academies' pop-up screen.
- **Academy Activation Queue**:
  - Super Admin views a list of academies with expired trials or pending renewal.
  - One-click **"Activate Academy"**:
    - Extends validity by 1 month, 6 months, or 1 year.
    - Instantly unlocks the academy dashboard.

#### 1.3 Super-Admin Global Command Center
- **System Metrics & KPIs**:
  - Total Registered Academies (Active, Inactive, Trial, Suspended).
  - Platform Monthly Recurring Revenue (MRR), Annual Recurring Revenue (ARR), Churn Rate.
  - Platform-wide student and teacher counts.
- **Tenant Management Console**:
  - Search and filter academies by country, plan, status, creation date.
  - "Login as Academy Admin" impersonation mode for support debugging (strictly audit-logged).
  - One-click tenant suspension / reactivation / data export.
- **Platform Audit & Compliance**:
  - Global administrative action logs.
  - GDPR/FERPA compliant tenant data purge upon cancellation.

---

### Module 2: Organization Settings, White-Labeling & RBAC
*Academy Administrators configure their academy's identity, branches, and staff permissions.*

#### 2.1 White-Labeling & Academy Customization
- **Branding Kit**:
  - Upload Academy Logo (square for avatars, rectangular for headers).
  - Upload Favicon.
  - Primary, Secondary, and Accent brand color pickers (dynamically injected CSS variables).
  - Print Letterhead & Official Stamp / Signature uploads for official PDF documents.
- **Regional & Localized Preferences**:
  - Currency symbol, placement (before/after), decimal precision.
  - Timezone and working week definition (e.g. Mon-Fri or Sun-Thu).
  - Academic term naming (Term 1/2/3 vs Semester 1/2 vs Quarter 1-4).

#### 2.2 Multi-Branch / Multi-Campus Architecture (Optional per Tenant)
- Campus/Branch creation: Campus Name, Address, Contact Info, Branch Principal.
- Centralized Academy HQ view with branch-level filtering.

#### 2.3 Clean 3-Tier RBAC with Admin Limitation Toggles
- **The 3 Core User Roles**:
  1. **Admin / Owner**: Unrestricted master control over the academy, billing, settings, and staff permissions.
  2. **Staff**: Unifies all teachers, accountants, and coordinators under one clean role with **Admin-configurable permission toggles**:
     - `[ ] Can collect fees & view billing (Accountant duties)`
     - `[ ] Can manage timetable & batches (Coordinator duties)`
     - `[ ] Can mark attendance & grade exams (Teacher duties)`
     - `[ ] Can view & manage student admissions (Admissions duties)`
     - `[ ] Can view financial expenses and cashbook`
  3. **Student / Parent**: Access to personal batch schedules, attendance history, homework submissions, fee invoices/receipts, and report cards.

#### 2.4 Passwordless Email OTP Login via Brevo
- User enters their email address.
- 6-digit verification code dispatched via Brevo API in under 2 seconds.
- Multi-tenant workspace switcher shown if an email is associated with more than one academy.
- Supabase Auth issues JWT containing `role: 'ADMIN' | 'STAFF' | 'STUDENT'` and granted permissions list.

### Module 3: Student Inquiries, Admissions & Enrollment

#### 3.1 Dynamic Enrollment Form Builder & Group-Based Subject Assignment
- **Academy-Configurable Form Designer**:
  - Academy Admin can dynamically build and customize their student enrollment form with custom cells (Text, Dropdowns, Date, Time, Number, Checkboxes).
- **Group-Based Subject Allocation Architecture (Seamless Admission Workflow)**:
  - In the Subject Settings, the academy creates two distinct types of Subject Groups:
    1. **Compulsory Group**: Linked directly to the Class/Grade (e.g. *Grade 9 Compulsory* contains English, Math, Urdu, Islamiyat).
    2. **Elective Track Groups**: Configured per track (e.g. *Track: Pre-Medical* [Biology, Physics, Chemistry], *Track: Pre-Engineering* [Adv Math, Physics, Chemistry], *Track: Computer Science* [Computer Studies, Physics, Math]).
  - **Zero-Friction Admission Registration Flow**:
    - When staff registers a student and selects the Class / Batch:
      - All **Compulsory Group** subjects are **automatically attached** to the student with zero manual clicking!
      - A clean **"Select Elective Track / Group"** dropdown appears on the form showing only the relevant tracks for that class.
      - Staff simply selects the group (e.g. *"Pre-Medical"*), and all subjects in that group are instantly linked to the student profile!
    - Completely eliminates the error-prone task of selecting 8+ individual subjects one by one.
- **Fixed Core Baseline**:
  - Student Full Name.
  - Contact Info (Email & WhatsApp / Phone).
  - **Student Photograph Upload Only** (Single passport-size photo stored in Supabase Storage).
  - *Previous educational history is completely removed.*

#### 3.2 Advanced Student Inquiry Management System
- **Inquiry Source Tracking**:
  - Track origin: Walk-in / Campus Visit, Telephone Call, Website Inquiry Form, Social Media, Student/Teacher Recommendation, Event.
- **Inquiry Progression Stages**:
  1. `New Inquiry` (Initial contact received)
  2. `Follow-up in Progress` (Counselor in active discussion)
  3. `Demo / Trial Class Scheduled` (Date and time set for trial class)
  4. `Demo Attended` (Student completed trial session)
  5. `Fee & Schedule Discussion` (Finalizing batch timing and fee structure)
  6. `Admitted / Enrolled` (Successfully enrolled into the academy)
  7. `Closed / Not Enrolled` (Mandatory reason capture: Timing Clash, Distance, Fee Constraints, etc.)
- **Counseling Call Queue & Scheduled Reminders**:
  - Schedule exact follow-up dates & times (e.g. "Follow-up call on Thursday at 3:00 PM").
  - Daily counselor workspace: Today's calls, Overdue follow-ups, Upcoming this week.
  - Counseling conversation logs with timestamped notes.
- **Inquiry Priority Indicator**:
  - Tag inquiries as **High Priority** (immediate admission interest), **Moderate**, or **General Inquiry**.
- **One-Click Student Admission**:
  - Single click on "Admit Student" transfers all prospective data directly into the academy's dynamic Enrollment Form, auto-generates Roll Number, assigns Batch, and activates the student portal.

### Module 4: Student 360° Profile & Lifecycle Management

#### 4.1 Student 360° Comprehensive Profile
- **Header Card**:
  - Student Photograph, Full Name, Student ID / Roll Number, Current Enrolled Batch, Admission Date, and Status Badge (`Active`, `On Leave`, `Suspended`, `Completed / Alumni`, `Withdrawn`).
- **Dynamic Field Information**:
  - Renders all custom responses captured via the dynamic Enrollment Form builder.
  - Contact information (Student & Guardian WhatsApp/phone, email).
- **Academic Snapshot**:
  - Live attendance percentage, enrolled subjects list, and recent assessment/exam scores.
- **Financial Status Badge**:
  - Real-time balance: Total fees billed, total collected, and current outstanding arrears.
- **Internal Academy Remarks**:
  - Confidential staff and teacher notes (behavioral, academic recommendations, counselor notes).

#### 4.2 Student Lifecycle Operations
- **Student Status Transitions**:
  - `Active` (Attending scheduled classes)
  - `On Leave` (Temporary formal leave)
  - `Suspended` (Disciplinary or fee suspension)
  - `Completed / Alumni` (Completed course/session)
  - `Withdrawn` (Left academy)
- **Batch & Section Transfer**:
  - Move student from one batch to another (e.g., Morning to Evening) with automated audit log preserving attendance and grade history.
- **Academic Promotion**:
  - Batch-wise year-end promotion to advance students to the next academic level/session.

### Module 5: Academic Hierarchy, Batches & Timetable Engine (Refined & Finalized)

#### 5.1 Clean Academic Hierarchy & Elective Tracks Engine
- **Academic Years / Sessions**: Operational session definition (e.g., `2026–2027`).
- **Programs / Grades**: e.g., `Grade 9`, `Grade 10`, `O-Levels`, `MDCAT Prep`.
- **Subject Classification & Elective Tracks Engine**:
  - **Core Mandatory Subjects**: Compulsory for all students in the batch (e.g. English, Math).
  - **Elective / Track Groups**:
    - Academy defines subject buckets (e.g. Pre-Medical, Pre-Engineering, Computer Science).
    - Students are enrolled in their chosen subjects during admission.
    - Timetable schedules elective classes in parallel slots without clashing with core subjects.

#### 5.2 Flexible Classroom / Room Management (DEFAULT: Single-Room Concept)
- **Default Mode: Single-Room / Open-Hall Setup (Active by Default)**:
  - By default, every new academy operates in **Single-Room Concept**.
  - The "Room" selector is completely hidden and disabled across the entire UI.
  - Timetable creation is fast, minimal, and friction-free: requires only `Batch + Subject + Teacher + Time`.
  - Scheduling conflict checking runs purely on Teacher & Batch availability.
- **Optional Toggle: Multi-Room Facility Mode (Disabled by Default)**:
  - Only if an academy explicitly turns on *"Enable Multi-Room Management"* in Academy Settings:
    - Room management unlocks: configure Room 1, Room 2, Lab, etc.
    - Room assignment becomes an optional field on timetable slots.
    - Room collision checking prevents double-booking a physical room.

#### 5.3 Batch Capacity & Waitlists
- **Batch Configuration**:
  - Batch Name (e.g. `Grade 10 - Alpha`, `O-Levels Evening`).
  - Maximum Capacity Limit (e.g. 30 seats).
  - Assigned Class Mentor/Coordinator.
- **Automated Waitlist Queue**:
  - When batch capacity is reached, new admissions enter an organized waitlist queue with 1-click promotion when a seat opens up.

#### 5.4 Timetable Collision Engine & Daily Dashboard
- **Real-Time Collision Checker**:
  1. **Teacher Conflict**: Blocks assigning a teacher to two batches at the same time.
  2. **Batch Conflict**: Prevents a batch from having overlapping subject periods.
  3. **Room Conflict (Only active if Multi-Room Mode is ON)**: Prevents room double-booking.
- **Teacher Workload & Fatigue Limits**:
  - Cap maximum teaching periods per day (e.g., max 5 periods/day) to prevent teacher burnout.
- **Substitute Teacher Management**:
  - When a teacher is on leave or absent, system displays an **Available Teachers List** (filtering teachers free during that exact timeslot) for instant 1-click substitution.
- **Syllabus & Lesson Progress Tracker**:
  - Subject chapters & topics checklist. Teachers check off topics as completed. Admin sees a visual progress bar (e.g. *"Physics: 70% completed"*).
- **"Today's Ongoing Class" Live Indicator**:
  - Live widget for teachers and students showing current period and countdown to next class.
- **PDF Door Printouts**: Clean printable weekly schedule exports.

### Module 6: Attendance, Leave & Complaint Management (with Firebase Push)

#### 6.1 Attendance Tracking Modes
- **Daily Batch Attendance (Default)**:
  - Attendance marked once daily per batch.
- **Period / Subject-wise Attendance (Optional)**:
  - Attendance marked at the start of each individual subject class.
- **Fast-Entry Roster**:
  - One-tap **"Mark All Present"** button.
  - Quick-toggle exceptions: `Absent`, `Late`, `Excused`.
  - Takes under 15 seconds to complete for a class of 30+ students.
- **Student ID QR Code Scanner (Optional)**:
  - Scan student digital QR badge via web camera to auto-log arrival time.

#### 6.2 Firebase Cloud Messaging (FCM) Push Notifications (Web & Future Mobile App / APK)
- **Firebase Cloud Messaging Integration**:
  - Replaces external email pushes for real-time alerts.
  - Native Push Notifications delivered directly to Web Browsers (PWA) and future Mobile Apps (Android APK / iOS).
- **Automated Absence Push Alerts**:
  - When a student is marked `Absent` without prior approved leave, a push notification is sent to the parent/student app:
    - *"Alert: [Student Name] was marked absent today for [Batch Name]."*
  - 15-minute undo grace period to allow teachers to fix accidental mis-clicks before dispatching push notifications.

#### 6.3 Leave Management System
- **Leave Submission Portal**:
  - Students or parents submit leave requests: Date Range (From/To), Reason, and Category (`Medical`, `Personal`, `Emergency`).
- **Review & Approval Queue**:
  - Admin/Teacher can `Approve` or `Reject` with remarks.
  - Approved leaves automatically register as `Excused` on the attendance grid, suppressing absent alerts.

#### 6.4 Complaint & Feedback Management System
- **Complaint Ticket Submission**:
  - Parents, Students, and Staff can submit formal complaints or suggestions.
  - Fields:
    - Category: `Academic / Teaching Quality`, `Facility / Infrastructure`, `Fee & Billing Issue`, `Disciplinary / Bullying`, `General / Other`.
    - Priority: `Urgent`, `High`, `Normal`.
    - Subject & Detailed Description.
    - Optional Anonymous toggle (if allowed by academy settings).
- **Admin Complaint Resolution Workflow**:
  - Ticket Statuses: `Open` -> `Under Investigation` -> `Action Taken` -> `Resolved / Closed`.
  - Internal Admin notes (confidential communication among staff).
  - Direct message reply to the complainant.
  - Real-time Firebase push notification sent to the parent/student when their complaint status updates or a reply is posted.
  - Resolution audit trail with resolved timestamp and resolving staff member's ID.

#### 6.5 Attendance Analytics & Defaulters
- Real-time monthly attendance percentages per student.
- Low-attendance alert filter (e.g., students below 75% threshold).
- One-click CSV / Excel / PDF export of monthly attendance registers.

### Module 7: Fee Management, Smart Auto-Distribution & Financial Reports (Audited & Hardened)

#### 7.1 Multi-Head Itemized Fee Architecture & Priority Auto-Distribution
- **Itemized Fee Heads (Categories)**:
  - `Monthly Tuition Fee`, `Previous Arrears`, `Annual Charges`, `Admission Fee`, `Exam Fee`, `Lab Fee`, `Stationery`, etc.
- **Configurable Global Payment Distribution Priority (Academy Setting)**:
  - Academy Admin sets their default liquidation priority rule using drag-and-drop:
    - *Example Priority A*: `Previous Arrears` -> `Monthly Tuition` -> `Annual Charges` -> `Exam Fee`.
    - *Example Priority B*: `Monthly Tuition` -> `Annual Charges` -> `Previous Arrears`.
- **Smart Auto-Distribution Engine with Manual Review & Override**:
  - When cashier enters a payment amount (e.g. Total Due = 10,000 across 3 heads; parent pays 4,000):
    1. System **instantly auto-distributes** the 4,000 across the fee heads based on the academy's configured priority rule.
    2. **Review & Override Modal (Zero Auto-Submit)**:
       - The distributed amounts appear in an editable table before submission.
       - Cashier can review the numbers. If the parent specifically requested: *"Please put 3,000 toward Tuition and 1,000 toward Annual Charges"*, the cashier can simply edit the cells right there.
       - **Single-Transaction Override**: Overriding this specific entry does **not** change or disrupt the master global priority rule!
       - Cashier clicks "Confirm & Collect" once satisfied.
- **Default Class/Batch Fee Baseline with Individual Student Overrides**:
  - Class default fee inherited by students; customizable on individual student profiles anytime.
- **Late Fees Fine**: *Completely removed. Zero automated late fines.*

#### 7.2 Dynamic Discounts, Waivers & Comprehensive Audit Report
- **Anytime Ad-Hoc Discounts & Concessions**:
  - Discounts are not locked to admission time only!
  - Admin/Accountant can apply a discount at any point during the academic year (e.g., mid-year hardship, special sibling concession, or promotional month waiver).
  - Discount types: Flat Amount (e.g. -2,000) or Percentage (e.g. 20% off).
  - Applicable to a single month's invoice or as a recurring monthly concession.
  - **Mandatory Approval & Reason Note**: Every discount requires a reason remark (e.g. *"Approved by Principal for 2nd sibling"* or *"Special COVID-19 relief"*).
- **Dedicated Discount & Concession History Report (PDF / Excel)**:
  - Full financial audit report tracking all granted discounts across the academy:
    - Columns: Student Name, Roll Number, Batch, Invoice Date, Original Fee, Discount Type, Discount Amount, Net Billed, Approving Admin/Staff Member, and Detailed Remarks.
    - Prevents unauthorized or fraudulent fee cuts by staff.

#### 7.3 Flexible Fee Voucher Printing Engine
- **Customizable Multi-Copy Voucher Headers**:
  - Rename copy titles freely: `Academy Copy`, `Bank Copy`, `Student Copy`, `Accounts Copy`, etc.
- **Flexible Print Layout Modes**:
  - **Layout Mode A (3-Part Voucher on 1 Sheet)**: Traditional 3-copy slip for bank/office.
  - **Layout Mode B (Paper-Saver Mode: 3 Students on 1 A4 Page)**:
    - Prints **"Only Student Copy"** formatted **3 distinct students vertically on a single A4 sheet**, cutting printing paper costs by 66%.
  - **Layout Mode C (Official Single Receipt)**: Clean receipt with academy logo, watermark, and QR verification.

#### 7.4 Advanced Financial Reports Suite (7 Print-Ready PDF & Excel Reports)
1. **Fee Head Collection Breakdown Report (PDF / Excel)**: Itemized revenue per fee head (Tuition vs Annual vs Arrears).
2. **Student-Wise Ledger Statement (PDF)**: Complete bank-style student transaction statement with chronological debits, credits, and running balance.
3. **Discount & Concession History Audit Report (PDF / Excel)**: Comprehensive tracking of all discounts given, approving staff, and remarks.
4. **Class / Batch Monthly Collection Summary (PDF / Excel)**: Single-sheet roster for entire batch showing fees, paid amounts, arrears, and payment mode.
5. **Defaulter & Overdue Aging Report (PDF / Excel)**: Overdue students grouped by >15, >30, >60 days with parent contact info for follow-ups.
6. **Daily Cashier / Day-Close Reconciliation Report (PDF)**: End-of-day register closing comparing cash drawer vs bank transfers.
7. **Expense & Profit / Loss Statement (PDF / Excel)**: Operating income vs expenses.

#### 7.5 Payment Edge Cases
- **Advance Payment & Student Wallet**: Overpayments are credited to a student wallet; future monthly vouchers automatically consume from the wallet.
- **Cheque Clearance Lifecycle**: `Received` -> `Deposited` -> `Cleared` or `Bounced`.
- **Firebase Push Notification for Payments**: Real-time push alert dispatched to parent when monthly vouchers are generated and when payments are recorded.

### Module 8: Examination, Dual Question Bank & Streamlined Assessment Engine (Audited & Finalized)

#### 8.1 Simple Exam Setup: Total Marks & Question Count Configuration
Teachers set up exams in seconds without complex form hurdles:
- **Fast Exam Setup Screen**:
  - Teacher enters basic parameters:
    - `Subject & Batch` (dynamically selected from DB).
    - `Number of MCQs` & marks per MCQ (e.g. 15 MCQs @ 1 mark = 15 marks).
    - `Total Marks for Short Questions` (e.g., Short Questions Total = 20 marks).
    - `Total Marks for Long Questions` (e.g., Long Questions Total = 15 marks).
    - Total Exam Marks auto-sums (e.g., 15 + 20 + 15 = 50 Marks).
- **Custom Question Numbering (Manual Labels)**:
  - Teacher can freely type their own question numbers and labels: e.g. `Q.1 (MCQs)`, `Q.2 (Short Questions)`, `Q.3 (Long Questions)`.

#### 8.2 Streamlined Hybrid Grading Flow with Question Remarks (Instant MCQs + Score & Feedback Entry)
Checking student exams is fast, minimal, and provides clear teacher guidance:
- **1. Objective / MCQs (100% Fully Auto-Checked)**:
  - System automatically checks and grades all MCQs in milliseconds.
  - Zero manual teacher checking required for Section A!
- **2. Short & Long Questions (Simple Manual Obtain Marks + Remarks Entry)**:
  - On the checking screen, for each student, the teacher enters the **Obtained Marks**:
    - `Short Questions Obtained Marks: [ ___ / 20 ]`
    - `Long Questions Obtained Marks: [ ___ / 15 ]`
  - **Question-Level Teacher Remarks**:
    - Right alongside the score inputs, teacher can type specific feedback remarks for that section:
      - *Short Questions Remarks Box*: e.g., *"Definitions were concise and accurate; review question 3 formula derivation."*
      - *Long Questions Remarks Box*: e.g., *"Good problem analysis; lost 2 marks on diagram labeling."*
  - System adds: `Auto-Checked MCQ Score` + `Short Questions Score` + `Long Questions Score` = **Total Final Marks**!
  - Remarks are displayed directly on the student/parent portal results view and printed on the official Report Card.

#### 8.3 Dual Question Bank Modes
- **Mode 1: Master Permanent Question Bank**: Hierarchical by `Grade -> Subject -> Chapter`. Checkbox selection to assemble tests.
- **Mode 2: Fast One-Time Quiz**: Ad-hoc 5-question test with optional "Save to Bank?" prompt.
- **In-Context Chapter Excel Upload (Flow A)**: Upload mixed question sheets directly into active chapter folders.

#### 8.4 Elective-Aware Subject Filtering & Clean Report Cards
- Students only tested on enrolled subject tracks (zero ghost subjects).
- 1-click printable PDF exam papers and official student report cards with principal stamp.
- Firebase push notifications sent to parents when results are published.

### Module 9: Homework Diary & Study Resources (Physical Checking Standard)

#### 9.1 Digital Homework Diary & Assignment Publishing
- **Teacher Assignment Publishing**:
  - Teacher selects Class/Batch & Subject (dynamically populated from DB).
  - Title (e.g., *"Chapter 4: Linear Equations - Exercise 4.2"*).
  - Detailed Instructions & Questions list.
  - Due Date.
  - Optional Attachment (PDF or Image of question paper/worksheet uploaded to Supabase Storage).
- **Instant Firebase Push Notification**:
  - The moment the homework is published, an instant Firebase push alert is sent to parents and students:
    - *"New Homework: [Teacher Name] assigned [Assignment Title] in [Subject]. Due by [Due Date]."*
  - Serves as an immutable digital student diary so parents always know what homework is due.

#### 9.2 In-Class Physical Notebook Checking (Streamlined Fast Checklist)
- **100% Physical Notebook Checking Standard**:
  - *Digital student file submission is completely removed.* Students solve homework in their physical notebooks.
- **Fast Batch Checking Roster (Under 15 Seconds)**:
  - Teacher opens the assignment on their phone or classroom screen.
  - Displays the list of students with single-tap status buttons:
    - `Done / Checked` (Default)
    - `Incomplete`
    - `Missing / Not Done`
  - Optional quick remarks per student (e.g. *"Incomplete questions 4 & 5"*).
  - Submitting the checklist sends an instant Firebase push notification to parents of any student marked `Missing` or `Incomplete`.

#### 9.3 Study Resource Vault (Digital Library)
- Organized strictly by `Subject -> Chapter`:
  - Teachers and Admins upload:
    - Chapter Notes & Summaries (PDF)
    - Past Paper Solutions (PDF)
    - Reference Video Links (YouTube / Vimeo)
    - Formula Sheets & Reference Diagrams
  - Strictly accessible only to students enrolled in that specific subject.

### Module 10: Official Notice Board & Communication Hub (Admin-Controlled)

#### 10.1 Centralized Official Announcements (Admin / Owner Only)
- **Strict Authority Control**:
  - *Teachers and Staff are restricted from posting public announcements.* Only the **Academy Admin / Owner** has the authority to publish official notices, preventing rogue, unauthorized, or conflicting circulars.
- **Targeted Audience Distribution**:
  - Admin specifies who receives the circular:
    - `Entire Academy` (All staff, students, and parents)
    - `Staff Only` (Internal staff meetings, policies, payroll notes)
    - `Specific Class / Batch Only` (e.g., only *Grade 10 - Morning Alpha*)
    - `Parents Only` (Fee notices, general meeting circulars)
- **Announcement Formatting & Attachments**:
  - Circular Title, Rich Text Body, and optional attachment (Official Circular PDF or image flyer uploaded to Supabase Storage).
  - **Pin to Top Toggle**: Urgent notices remain pinned at the top of the dashboard feed until unpinned or expired.

#### 10.2 Real-Time Firebase Cloud Messaging (FCM) Push Notifications
- When the Admin publishes an announcement:
  - An instant **Firebase Push Notification** is dispatched strictly to the targeted audience's web browsers and mobile app:
    - *"Official Notice: [Announcement Title]"*
  - Automatically updates the in-app notification bell with an unread badge counter.

#### 10.3 In-App Notification Center
- A unified notification drawer where users can review past notices, attendance alerts, exam results, and fee updates.
- 1-click **"Mark All as Read"**.

### Module 11: Dedicated Role-Based Portals & UI Architecture (Audited & Hardened)

#### 11.1 Academy Admin / Owner Command Center
- **Executive KPI Ribbon**:
  - `Active Students` & `Total Staff`.
  - `Monthly Revenue Collected` vs `Outstanding Overdue Arrears`.
  - `Today's Real-Time Student Attendance Rate` (with live present/absent headcounts).
- **"Action Required" Priority Feed (Zero-Click Triage)**:
  - High-priority operational queue showing items needing immediate attention:
    - *Complaints Awaiting Response* (highlighted in red if marked Urgent).
    - *Pending Leave Applications* (1-click Approve / Reject directly from dashboard).
    - *Orphaned Classes Today* (classes whose assigned teacher is absent or on leave, with 1-click substitute picker).
    - *High-Balance Fee Defaulters* (>30 days overdue).
- **Quick-Action Floating Command Bar**:
  - Direct shortcuts: `[+ Admit Student]`, `[Collect Fee]`, `[+ Post Official Notice]`, `[+ Create Timetable Slot]`.
- **White-Label Customization**:
  - Dynamic branding preview: logo, brand colors (CSS variables), favicon, and official letterhead.

#### 11.2 Staff / Faculty Adaptive Portal & Admin Permission Manager
- **Admin Granular Permission Manager (Anytime Enable / Disable Features)**:
  - In the Admin Panel (`Staff Management -> Permissions`), the Academy Admin can grant, revoke, or combine features for any staff member at any time with zero code changes:
    - `[x] Admissions & Inquiries Management`
    - `[x] Batch & Timetable Management`
    - `[x] Attendance Marking & Leave Approvals`
    - `[x] Fee Collection, Invoicing & Receipts`
    - `[x] Cashbook & Expense Logging`
    - `[x] Exam Creation, Marks Entry & Report Cards`
    - `[x] Notice Board Publishing (Delegated Authority)`
    - `[x] Student 360 Profile Edit Rights`
  - Admin can also create custom named permission presets (e.g. *"Senior Coordinator"*, *"Front Desk Cashier"*, *"Junior Teacher"*) and apply them with one click.
- **Dynamic Adaptive Navigation (Zero Clutter)**:
  - The staff member's sidebar menu and dashboard widgets update in real time based on the exact features enabled by the Admin.
  - Revoking a permission instantly locks and hides that section from the staff member's screen without requiring a re-login.
- **"My Schedule Today" Live Timetable Widget**:
  - Visual cards of today's periods with batch names and real-time status:
    - Ongoing class highlighted with time remaining countdown.
    - 1-tap shortcut: `[Mark Class Attendance]` -> opens the 15-second roster.
    - 1-tap shortcut: `[Check Homework Notebooks]` -> opens the physical diary checklist.
- **My Substitute Duties Banner (Edge Case Handled)**:
  - If the staff member was assigned as a substitute teacher for an absent colleague, a prominent notification banner highlights the substitute period, room, and batch.

#### 11.3 Student & Parent Unified Self-Service Portal
- **Child Switcher (For Parents with Multiple Children in the Academy)**:
  - Single tap toggles the active view between Child A (e.g. Grade 9) and Child B (e.g. Grade 7) without logging out.
  - Consolidated Family Ledger option: view combined fee dues across all children.
- **Today's Status Card**:
  - Live attendance badge for today: `Present (9:02 AM)`, `Absent`, or `Excused Leave`.
  - Ongoing & upcoming class schedule.
- **Digital Homework Diary**:
  - Daily homework assignments with instructions, due dates, and in-class notebook checking status (`Checked / Done`, `Incomplete`, `Missing`).
- **Examination Results & Official Report Cards**:
  - Instant inspection of published test marks with question-level teacher remarks.
  - 1-click download of official, signed PDF Report Cards.
- **Fee Management & Printable Vouchers**:
  - Clear real-time balance breakdown: Tuition, Arrears, Annual Charges.
  - 1-click download of the student's printable monthly fee voucher / challan.
  - Payment receipt history with downloadable PDF receipts.
- **Two-Way Complaint & Feedback Tracker**:
  - Submit formal complaints or suggestions with priority tag.
  - Live timeline showing status updates (`Under Review`, `Action Taken`, `Resolved`) and Admin direct replies.
  - Real-time Firebase push alerts on status updates.

#### 11.4 Universal Portal Security & Multi-Tenant Edge Cases
- **Multi-Academy Workspace Switcher**:
  - If a user (parent, teacher, student) belongs to multiple academies, a clean workspace selector allows switching between academies seamlessly.
- **Brute-Force Lockout & Session Security**:
  - 15-minute lockout after 5 incorrect OTP attempts.
  - Remote session invalidation and instant logout capability.
- **Strict Role Isolation Guard**:
  - Supabase RLS and Node.js route guards prevent any user from accessing another role's portal (e.g., a student attempting to hit `/api/admin/*` or `/api/staff/*` is immediately blocked with a 403 Forbidden).

### Module 12: Mobile App Readiness & Hybrid APK Packaging (Capacitor / PWA)
*Preparing the academy web portals for direct Android APK compilation and native mobile hardware.*

#### 12.1 Mobile-First PWA & Capacitor Foundation
- **Cross-Platform Single Codebase**:
  - The responsive web application is built with standard Web APIs and PWA support (offline shell, manifest, service workers).
  - Bundled with **Capacitor** to compile natively into an **Android APK** (and iOS app bundle) without maintaining a separate mobile codebase.
- **Native Device Capabilities**:
  - **Firebase Cloud Messaging (FCM)**: Native push notifications running as a background service on Android, popping up heads-up notifications even when the app is closed.
  - **Camera Integration**: Used for quick student photo capture and QR code scanning for attendance and fee receipts.
  - **Biometric Device Login (Future Option)**: Fingerprint / Face Unlock capability on the mobile app.
- **Role-Optimized Mobile Views**:
  - Compact bottom-tab navigation for Parents & Students (Home, Timetable, Attendance, Fees, Complaints).
  - Quick-action floating buttons for Teachers to mark attendance from their mobile phone during class.


### Module 13: Staff Attendance with Geofencing & GPS Verification
*Ensuring teachers and staff are physically present inside the academy before clocking in, providing clean attendance summaries for payroll.*

#### 13.1 Geolocation & Radius Verification Engine
- **Academy Campus Geo-Coordinates Setup**:
  - In Academy Settings, Admin sets the academy's exact GPS coordinates (Latitude, Longitude) and allowed radius in meters (e.g. `50m` or `100m`).
  - Option to enter coordinates manually or tap **"Use My Current Location"** while on campus.
  - Multi-branch support: Each physical campus has its own designated GPS coordinate and radius.
- **Staff Mobile Clock-In / Clock-Out**:
  - Staff opens portal/app on their smartphone.
  - Taps **"Clock In"** upon arrival and **"Clock Out"** upon departure.
  - Device GPS verified via HTML5 Geolocation API with `enableHighAccuracy: true`:
    - Computes distance using the Haversine formula.
    - **Inside Radius (<= configured radius)**: Approved with timestamp, exact coordinates, and arrival status (`On Time` or `Late Arrival` based on shift grace period).
    - **Outside Radius (> configured radius)**: Blocked with clear message: *"You are X meters away from campus. Please clock in inside the academy building."*
- **Shift & Late Arrival Tracking**:
  - Configurable expected arrival time and grace period (e.g. 15 mins). Clock-ins after the grace period are flagged as `Late Arrival` for recordkeeping.
  - If staff forgets to clock out, marked as `Missing Clock-Out` at midnight for Admin review.
- **Admin Overrides & Outdoor Duty**:
  - Admin/Principal can manually add or adjust attendance with a mandatory note (e.g. phone dead, GPS drift, official outdoor errand).
  - Clean audit trail recorded for all manual corrections.

---

### Module 14: Staff Payroll & Interactive Salary Processing
*Practical, human-in-the-loop salary processing with side-by-side attendance review, dynamic earning/deduction heads, and detailed financial reporting.*

#### 14.1 Salary Configuration & Base Structures
- **Staff Salary Profile**:
  - Each staff member has a base contract type:
    - **Fixed Monthly Salary**: Standard fixed monthly compensation.
    - **Per-Lecture / Per-Period Rate**: For visiting/adjunct teachers (rate per delivered lecture).
- **Custom Earning & Deduction Heads Catalog**:
  - Master settings to define reusable heads:
    - **Earning Heads**: `Bonus`, `Overtime`, `Transport Allowance`, `Medical Allowance`, `Performance Incentive`, `Special Addition`.
    - **Deduction Heads**: `Late Penalty`, `Unexcused Absenteeism`, `Unpaid Leave`, `Advance Salary Recovery`, `Tax / Fund Deduction`, `Custom Deduction`.

#### 14.2 Interactive Month-End Salary Processing Workflow
- **No Rigid Black-Box Auto-Deductions**:
  - Academies have vastly different rules. Instead of rigid automated deductions, the system provides a fast, transparent **Human-in-the-Loop Processing Desk**.
- **Side-by-Side Attendance & Processing Screen**:
  - Admin navigates to **Payroll Desk** and selects a staff member:
    - **Default Month Selector**: Automatically defaults to the **Previous Month** (as salaries are paid in arrears for work completed, not in advance). Admin can select any past month.
    - **Left Side — Complete Attendance Summary**:
      - Displays the full month's attendance breakdown at a glance:
        - Total Calendar Days & Total Academy Working Days.
        - Verified Present Days (from Module 13 Geolocation).
        - Total Late Arrivals (e.g. "4 Lates").
        - Approved Paid Leaves vs Unpaid Leaves vs Unexcused Absents.
        - Total Working Hours / Lectures Delivered.
    - **Right Side — Interactive Salary Calculation**:
      - Base Salary loaded automatically.
      - **Earnings Section**:
        - Dropdown to select Earning Head (e.g. `Overtime` or `Bonus`).
        - User enters **Quantity / Hours** (e.g. 5 hours) and **Unit Rate** (e.g. $15). System auto-multiplies to calculate the line total.
        - Add multiple earning lines dynamically.
      - **Deductions Section**:
        - Dropdown to select Deduction Head (e.g. `Late Penalty` or `Unpaid Absent`).
        - User sees the attendance summary on the left, decides how many units to apply (e.g. enters `3` lates, or `2` absent days).
        - User enters the **Rate / Amount per unit** (e.g. $10 per late).
        - System auto-multiplies (`Count × Rate = Line Deduction`).
        - Add multiple deduction lines dynamically.
    - **Instant Net Salary Calculation**:
      - `Net Payable = Base Salary + Total Earnings - Total Deductions`.
      - Notes field for internal admin remarks on this pay slip.
    - **1-Click "Process & Save"**:
      - Locks the payroll record for that staff for that month.
      - Status set to `Processed` (can be marked `Paid` upon actual cash/bank disbursement with payment method and reference number).

#### 14.3 Staff Pay Slips & Detailed Reporting Section
- **Professional PDF Pay Slips**:
  - Clean, print-ready PDF payslip with Academy Logo, Staff Name, Designation, Month/Year, itemized list of Earnings & Deductions, Net Payable, and payment signature blocks.
  - Staff can view and download their past monthly payslips directly from their Staff Portal.
- **Detailed Payroll Reporting Suite**:
  - **Monthly Payroll Summary Report**: Master sheet showing all staff, basic salary, total additions, total deductions, net payable, and payment status (`Paid` / `Pending`).
  - **Deduction & Penalty Breakdown Report**: Audit log of all applied late penalties, absent deductions, and loan recoveries.
  - **Department / Staff-Wise Historical Ledger**: Complete yearly salary ledger per teacher for tax or institutional audits.
  - **Cash / Bank Disbursement Sheet**: Formatted list of net salaries for direct bank transfer upload or cash counter payout.

---

### Module 15: WhatsApp Direct Messaging Engine with Dynamic Tags
*Instant one-click WhatsApp messaging using standard web/mobile WhatsApp links without costly third-party API subscriptions.*

#### 15.1 Dynamic Tag-Based Message Template Builder
- **Customizable Message Templates**:
  - Admin creates reusable message templates in Settings:
    - *Fee Due Reminder*: e.g. *"Dear {guardian_name}, this is a gentle reminder that the monthly fee of {due_amount} for {student_name} (Roll: {roll_number}) in batch {batch_name} is due by {due_date}. Academy: {academy_name}."*
    - *Absence Alert*: e.g. *"Dear {guardian_name}, your child {student_name} was marked absent today ({current_date}) in {batch_name}. Please contact {academy_phone}."*
    - *Exam Result Announcement*: e.g. *"Dear {guardian_name}, results for {exam_title} have been published. {student_name} scored {obtained_marks}/{total_marks} ({percentage}%). Remarks: {teacher_remarks}."*
- **Supported Dynamic Tag Variables**:
  - `{student_name}`, `{roll_number}`, `{batch_name}`, `{guardian_name}`
  - `{due_amount}`, `{due_date}`, `{receipt_number}`, `{paid_amount}`
  - `{exam_title}`, `{obtained_marks}`, `{total_marks}`, `{percentage}`, `{teacher_remarks}`
  - `{academy_name}`, `{academy_phone}`

#### 15.2 Primary / Default vs Backup Phone Number Selector
- **Default WhatsApp Number Selection during Admission**:
  - In the dynamic student enrollment form, staff records:
    - `Primary WhatsApp Number` (Default for all automated communication).
    - `Secondary / Backup Number` (Father, Mother, or Guardian's alternate phone, with labeled relation e.g. Mother, Father, Uncle).
- **Target Number Switcher on Sending Screen**:
  - When staff clicks to send a WhatsApp message:
    - System defaults to the **Primary WhatsApp Number**.
    - Staff can click a quick toggle to send to the **Backup / Alternate Number** if the primary is unreachable!
    - If no backup number is recorded on file, the toggle is cleanly disabled with a hint: *"No backup number on file (Click to add in Student Profile)"*.

#### 15.3 1-Click WhatsApp App Deep-Linking & Edge Case Engine
- **Zero Third-Party API Cost Architecture**:
  - System generates standard universal deep-links: `https://wa.me/{selected_phone}?text={encoded_message}`.
  - On mobile: Automatically opens the native WhatsApp / WhatsApp Business app with the chat and message pre-filled.
  - On desktop web: Opens WhatsApp Web in a browser tab with the chat and message pre-filled.
  - Staff simply presses the green **"Send"** button inside WhatsApp (100% free, no Meta Cloud API recurring fees, no risk of number bans).
- **Automated Phone Number Sanitization**:
  - Admin configures the Academy's **Default Country Calling Code** (e.g. `+92`).
  - System automatically strips hyphens, spaces, and leading zeros (`0300-1234567` -> `923001234567`) before assembling the URL.
  - Corrupted/short numbers are highlighted with a warning badge.
- **Smart Dynamic Tag Fallbacks & Markdown Formatting**:
  - All text is fully UTF-8 `encodeURIComponent` encoded (supporting emojis, newlines, Urdu/Arabic script).
  - Native WhatsApp formatting supported (`*bold*`, `_italic_`). Live chat bubble preview shown in the modal before opening WhatsApp.
  - Missing/blank fields (like empty `{teacher_remarks}`) are either replaced with clean fallbacks or omit the trailing phrase completely to avoid ugly punctuation.
- **Duplicate Message Prevention & Audit Trail**:
  - When a message link is opened, the ERP records an audit timestamp: *"Alert opened by [Staff] on [Date/Time]"*.
  - The button turns into a badge: *"Sent Today at 10:15 AM"*.
  - If another staff member attempts to send an alert on the same day, a confirmation alert warns: *"A reminder was already dispatched today. Send again?"*
- **Rapid Queue Mode for Batch Sending**:
  - For morning absentee alerts or fee due lists, staff can launch the **WhatsApp Rapid Queue**:
    - Displays Student #1 with pre-filled message -> Staff clicks "Open WhatsApp" -> Clicks "Next Student ➔" to immediately load Student #2 without navigating back and forth between screens.
- **Consolidated Sibling / Family Fee Reminders**:
  - For parents with multiple children enrolled, staff can choose between a single child's reminder or a consolidated family invoice reminder (`{family_due_amount}`, `{family_students_list}`).

---

### Module 16: Dedicated Absentee Follow-Up & Student Retention Desk
*Structured tracking, rapid communication, and resolution of student absenteeism.*

#### 16.1 Daily Morning Absentee Follow-Up Desk
- **Instant Auto-Population**:
  - As soon as teachers submit morning/period attendance, the Absentee Desk auto-populates with all students marked `Absent` today.
  - Filterable by Class, Batch, or assigned Staff Counselor.
- **Consecutive Absent Days Badge**:
  - Highlights persistence: `Day 1` (Blue), `Day 2` (Orange), `Day 3+ Critical Risk` (Flashing Red ⚠️).
- **Front-Desk Follow-Up Workflow & Call Logging**:
  - Staff opens the Absentee Desk with 3 contextual quick-actions:
    - 💬 **WhatsApp Absence Alert**: Launches Module 15 pre-filled message (`Primary` or `Backup` number).
    - 📞 **Phone Call Launcher**: 1-click phone dialer to call the parent immediately.
    - 📝 **Log Parent Response Modal**:
      - **Call Outcome**: `Connected & Spoke with Parent`, `Ringing / No Answer`, `Phone Switched Off / Busy`, `WhatsApp Message Sent`.
      - **Reason Category**: `Medical / Sick`, `Family Emergency / Out of City`, `Transportation / Rain`, `Fee Dispute / Thinking of Leaving`, `Woke up Late / Truancy`, `Other`.
      - **Parent Remarks**: Notes field (e.g. *"Fever, doctor recommended rest until Thursday"*).
      - **Expected Return Date**: Calendar picker (e.g. *Thursday, Sep 10*).
- **1-Click Conversion to Approved Medical / Excused Leave**:
  - If a parent confirms illness or submits an excuse, staff can click **"Convert to Approved Medical Leave"** directly from this desk.
  - Automatically updates the official attendance record from `Absent` to `Excused / Medical Leave` without requiring the teacher to reopen and re-edit the attendance sheet!
- **Smart Excused Snoozing (No Annoying Duplicate Calls)**:
  - When an `Expected Return Date` is set (e.g. *Returning next Monday*), the system marks the student as `Excused Sick until Monday`.
  - The student is temporarily snoozed from the daily morning follow-up call roster so staff does not annoy the parent with repetitive calls every morning.
  - If the student fails to arrive on Monday, the system automatically reactivates them on the desk with a prominent badge: *"Expected Return Was Today — Follow Up!"*

#### 16.2 Chronic Absenteeism, Retention Analytics & Admin Accountability
- **Live Follow-Up Accountability Progress Bar**:
  - Top of the desk displays a live progress counter for the Academy Director:
    * *"Today's Absentees: 28 | Contacted: 22 (78%) | Unreachable: 4 | Pending: 2"*
  - Ensures front-desk staff actually completes their morning calls and does not neglect absent students.
- **Dropout Risk & Parent Counseling Desk**:
  - Automatically flags students whose monthly attendance drops below 70% or who have 4+ consecutive unexplained absences.
  - 1-click **"Schedule Parent Counseling Meeting"** button to invite parents to an in-person meeting with the Principal to prevent dropouts.
- **Absentee Resolution Audit Report**:
  - Monthly analytical report showing total absences, follow-up completion percentage, breakdown of reported reasons (medical vs transport vs unexplained), and dropout prevention stats.

---

### Module 17: Native-Grade Mobile-Responsive Architecture (100% Native App Feel)
*Engineered so the web application running in any smartphone browser (or compiled via Capacitor into an Android APK) feels completely indistinguishable from a high-performance native mobile app.*

#### 17.1 Viewport, Touch & Kinetic Performance Engineering
- **Zero Web Elastic Bounce & Edge-to-Edge Display**:
  - `viewport-fit=cover` taking full advantage of the display notch, camera cutouts, and bottom Android navigation pills.
  - Safe-area insets: `padding-top: env(safe-area-inset-top)`, `padding-bottom: env(safe-area-inset-bottom)`.
  - `overscroll-behavior-y: none`: Eliminates the rubber-band pull-down effect of web browsers, locking the UI firmly like a native Cocoa/Android view.
  - `touch-action: manipulation`: Removes the 300ms double-tap delay on mobile browsers for instant zero-latency touch response.
  - `-webkit-tap-highlight-color: transparent`: Eliminates the default browser tap rectangle when tapping cards or buttons.
  - `user-select: none`: Applied to navigation, action buttons, table rows, and status chips to prevent accidental text selection highlighting while swiping.

#### 17.2 Native Navigation Paradigms: Role-Based Bottom Tab Bar & Collapsible Header
- **Dynamic Native Bottom Navigation Bar**:
  - Pinned to the bottom with hardware blur background (`backdrop-blur-md bg-white/95 border-t border-slate-200`).
  - Automatically adapts to the active user role:
    - **Teacher Bottom Tabs**: `Batches`, `Attendance (Active)`, `Timetable`, `Notebooks`, `Profile`.
    - **Parent / Student Bottom Tabs**: `Home`, `Attendance`, `Fee Due (Badge)`, `Report Cards`, `Profile`.
    - **Admin Bottom Tabs**: `Dashboard`, `Attendance Triage`, `Absentee Desk`, `Collections`, `Settings`.
  - Active tab indicators with micro-spring animations and red notification badges (e.g. `1 Unpaid Fee` or `3 New Notices`).
- **Native Top App Bar (Header)**:
  - Sticky, lightweight title bar with back button (`←`), current context title, tenant logo, and profile avatar.
  - Automatically collapses / shrinks smoothly on scroll to maximize screen real estate.

#### 17.3 Native Mobile Touch Patterns: Bottom Sheets & Gesture Drawers
- **Zero Awkward Centered Popups / Modals**:
  - Desktop-style centered modal popups look broken on mobile. All mobile modals convert into **Slide-Up Bottom Sheets (Drawers)** (using Vaul / Radix Sheet).
  - Bottom sheets slide up smoothly from the bottom with a gesture grab handle (`w-10 h-1 bg-slate-300 rounded-full mx-auto mb-3`).
  - Dismissible with a downward swipe gesture.
- **Swipeable Action Rows**:
  - In student rosters: Swiping a student card right marks `Present (Green)`, swiping left marks `Absent (Red)`.
- **Pull-to-Refresh**:
  - Natural pull-down gesture to refresh live attendance data or fee invoice status with a native spinner.
- **Minimum 48px x 48px Thumb Touch Targets**:
  - Every interactive button, radio toggle, and dropdown satisfies the Apple HIG / Android Material 48px minimum touch target size to prevent mis-taps while walking or teaching.

#### 17.4 Native Keypad & Mobile Input Optimization
- **Smart `inputmode` Adaptation**:
  - OTP inputs: `inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*"` (triggers large numeric keypad, auto-fills OTP from SMS/Email).
  - Phone inputs: `inputmode="tel"`.
  - Currency & fee amounts: `inputmode="decimal"`.
  - Search & Student Names: `inputmode="text" autocapitalize="words"`.
- **Keyboard-Avoiding Layout Engine**:
  - Automatically shifts active form fields above the mobile virtual keyboard so the user never types blind behind the keyboard.

#### 17.5 Offline Resilience & Progressive Web App (PWA) Shell
- **PWA Manifest & App Icons**:
  - Academy logo as standalone launch icon (`display: standalone`).
  - Removes browser URL bar and navigation buttons when added to Home Screen.
- **Service Worker Local Offline Cache**:
  - Caches application shell (HTML/CSS/JS) and critical offline data (batch student list).
  - If a teacher enters a basement classroom with no cellular reception, attendance can still be marked and queued locally (`IndexedDB`), syncing automatically to Supabase as soon as connection is restored.

#### 17.6 Desktop-to-Mobile Responsive Dual-Navigation Contract
- **Desktop Viewport (`>= 768px`)**:
  - Pinned dark left sidebar (`w-64 bg-slate-900 border-r border-slate-800`), collapsible with hamburger toggle.
  - Top status bar with global command search (`⌘K`), quick admissions button, and notifications.
  - Multi-column data layouts, dense 40px table rows, centered modal dialogs.
- **Mobile Viewport (`< 768px`)**:
  - Left sidebar automatically stashes into an off-canvas slide-out drawer (accessible via top-left hamburger or edge swipe).
  - Primary navigation transfers entirely to the **Fixed Bottom Tab Bar** positioned in the natural thumb reach zone.
  - Centered modal dialogs automatically transform into **Slide-Up Bottom Sheets (Drawers)**.

#### 17.7 Web Haptics & Native Hardware Back-Button Interception
- **Tactile Web Haptic Feedback (`navigator.vibrate`)**:
  - Micro-vibration (`10ms`) on attendance status toggle (Green `Present` / Red `Absent`) providing instant tactile confirmation without looking.
  - Double pulse (`[30ms, 40ms, 30ms]`) on critical actions (e.g. Defaulter alert, fee receipt cancellation).
- **Hardware Back-Button / Swipe-Back Interception (History API Trap)**:
  - When a slide-up bottom drawer or modal is active, tapping the Android physical/gesture Back button or doing an iOS edge swipe closes the drawer instead of navigating back in browser history.

---

## 4. Engineering Architecture & Implementation Roadmap

### 4.1 Monorepo Structure & Package Boundaries
```
academy-management-system/
├── packages/
│   ├── shared-types/             # Shared TypeScript schemas, DTOs, and Zod validators
│   │   ├── src/
│   │   │   ├── tenant.ts         # Multi-tenant context, config, trial types
│   │   │   ├── auth.ts           # Brevo OTP payloads, JWT app_metadata, RBAC
│   │   │   ├── student.ts        # Enrollment, dynamic forms, 360 profile
│   │   │   ├── academic.ts       # Classes, subjects, groups, timetable
│   │   │   ├── finance.ts        # Invoices, fee heads, allocations, ledger
│   │   │   ├── attendance.ts     # Batch attendance, GPS clock-in, absentee
│   │   │   ├── payroll.ts        # Dynamic heads, multipliers, payslips
│   │   │   └── exam.ts           # Question bank, quizzes, chapter tree
│   │   └── package.json
│   │
│   ├── supabase/                 # PostgreSQL migrations, RLS policies, seed scripts
│   │   ├── migrations/           # Versioned SQL migration files
│   │   │   ├── 00001_tenants_and_core_auth.sql
│   │   │   ├── 00002_academic_hierarchy_and_rls.sql
│   │   │   ├── 00003_enrollment_and_students.sql
│   │   │   ├── 00004_timetable_and_collisions.sql
│   │   │   ├── 00005_attendance_and_geofence.sql
│   │   │   ├── 00006_fees_invoicing_ledger.sql
│   │   │   ├── 00007_exams_and_question_bank.sql
│   │   │   ├── 00008_payroll_and_salary.sql
│   │   │   └── 00009_absentee_followup_and_notices.sql
│   │   ├── tests/                # Real PostgreSQL RLS dual-tenant leak tests
│   │   └── seed.sql              # Minimal development seed data
│   │
│   ├── backend/                  # Fastify (TypeScript) API Engine
│   │   ├── src/
│   │   │   ├── plugins/          # Fastify plugins (Supabase client, CORS, Rate-limit)
│   │   │   ├── middleware/       # Tenant resolver (subdomain/custom domain -> SET LOCAL)
│   │   │   ├── modules/
│   │   │   │   ├── auth/         # Brevo OTP dispatch & verification
│   │   │   │   ├── superadmin/   # 30-day trial lockout, billing receipts, tenant activation
│   │   │   │   ├── academics/    # Dynamic classes, groups, timetable engine
│   │   │   │   ├── students/     # Dynamic form renderer, admissions, 360 profile
│   │   │   │   ├── attendance/   # Batch student check, Haversine GPS staff clock-in
│   │   │   │   ├── finance/      # Fee generation, priority distribution, PDF renderer
│   │   │   │   ├── payroll/      # Side-by-side processor, dynamic heads auto-multiplier
│   │   │   │   ├── whatsapp/     # Sanitization, dynamic tag compiler, rapid queue
│   │   │   │   └── exams/        # Excel parser, MCQ auto-grader, marks entry
│   │   │   └── server.ts
│   │   └── package.json
│   │
│   └── frontend/                 # React (Vite + TypeScript) Web & Capacitor App
│       ├── src/
│       │   ├── components/ui/    # shadcn/ui components (Radix + Tailwind)
│       │   ├── layouts/          # Portal layouts (Admin, Staff, Student/Parent, SuperAdmin)
│       │   ├── modules/          # Feature desks matching the 16 ERP modules
│       │   ├── hooks/            # Dynamic DB queries, Supabase auth, tenant context
│       │   └── lib/              # API clients, print formats, WhatsApp URL generator
│       ├── capacitor.config.ts   # Android APK wrapper configuration
│       └── package.json
│
├── package.json                  # Root npm/pnpm workspace configuration
└── README.md
```

---

### 4.2 Multi-Tenant Request & RLS Execution Pipeline
```
[ Incoming HTTP Request ]
         │
         ▼
[ Cloudflare Gateway ] (SSL Termination, Custom Hostname resolution, Rate Limiting)
         │
         ▼
[ Fastify Tenant Middleware ]
  ├─ 1. Extracts subdomain or custom domain (e.g. apex.academyerp.com)
  ├─ 2. Resolves tenant_id from cache / DB
  ├─ 3. Verifies active subscription status (checks 30-day trial validity)
  │     └─ If Expired & Not SuperAdmin ➔ Injects Lockout Headers
  ▼
[ Database Connection Hook ]
  ├─ Runs: SET LOCAL app.current_tenant_id = 'tenant-uuid';
  ▼
[ PostgreSQL Engine with Row-Level Security (RLS) ]
  ├─ Every table: WHERE tenant_id = current_setting('app.current_tenant_id')::uuid
  ├─ ZERO cross-tenant data leaks physically possible at the DB engine level
  ▼
[ Fastify Business Logic & Response ] ➔ [ React Client ]
```

---

### 4.3 Phase-by-Phase Implementation Milestones

```
Phase 1: Foundation, Database Migrations, Strict RLS & Brevo OTP Auth
   │
   ▼
Phase 2: Academic Hierarchy (Dynamic DB-Driven), Form Builder & Inquiries Desk
   │
   ▼
Phase 3: Timetable Collision Engine, Attendance, Geofencing & Homework Diary
   │
   ▼
Phase 4: Fees Engine, Priority Auto-Distribution, 3-Slip Paper-Saver & Reports
   │
   ▼
Phase 5: Examination Bank, Excel Chapter Upload & Question-Level Remarks
   │
   ▼
Phase 6: Staff Interactive Payroll Desk, WhatsApp Engine & Absentee Desk
   │
   ▼
Phase 7: Multi-Portal Dashboards, SaaS Billing Lockout & Capacitor Android APK
```

#### Detailed Phase Specifications:

- **Phase 1: Core Foundation, Multi-Tenant Schema, Strict RLS & Brevo OTP**
  - Scaffold monorepo (`shared-types`, `supabase`, `backend`, `frontend`).
  - Write SQL migrations for `tenants`, `users`, `roles`, `permissions`, `audit_logs`.
  - Implement strict PostgreSQL RLS policies with tenant isolation triggers.
  - Setup dual-tenant integration tests in Vitest verifying cross-tenant query isolation.
  - Build Fastify Brevo OTP authentication engine (`send-otp`, `verify-otp`, JWT issuance).
  - *Exit Gate*: Dual-tenant test passes: Tenant A cannot read or write Tenant B's data under any condition.

- **Phase 2: Academic Hierarchy & Dynamic Enrollment Desk**
  - Implement zero-hardcoding academic data tables (`classes`, `subjects`, `subject_groups`, `batches`).
  - Build dynamic form builder backend & frontend schema renderer.
  - Build Academic Inquiries Desk with stages, follow-up alerts, and 1-click admission.
  - Build Student 360° Profile & Lifecycle Management (batch transfer, promotion).
  - *Exit Gate*: Academy admin creates custom subjects/groups, dynamic form fields, and enrolls student without a single hardcoded list.

- **Phase 3: Timetable Engine, Attendance, Geofencing & Homework Diary**
  - Build 4-way collision engine (teacher, batch, room, time slot) with single-room default.
  - Build Batch Student Attendance desk (<15s speed) with FCM push triggers.
  - Implement Staff Geofencing attendance with Haversine formula and accuracy validation.
  - Build 100% Physical Notebook checking checklist (`Done` / `Incomplete` / `Missing`).
  - *Exit Gate*: Timetable actively blocks conflicting teacher/room schedules; staff clock-in validates physical radius.

- **Phase 4: Fees, Priority Auto-Distribution & Paper-Saver Invoicing**
  - Implement fee structures (`Tuition`, `Arrears`, `Annual`).
  - Build Priority Auto-Distribution engine with 1-time admin manual override.
  - Build Paper-Saver 3-slip vertical A4 PDF generator (Academy, Student, Bank copies on single sheet).
  - Implement 7 dedicated financial accounting PDF reports with zero late-fee fines.
  - *Exit Gate*: Fee payment distributes accurately across heads and renders 3 clean slips on one A4 print.

- **Phase 5: Examination Bank, Chapter Upload & Evaluation**
  - Build Chapter Tree Question Bank & Fast One-Time Quiz tables.
  - Implement Excel Upload Flow A (Chapter format auto-parsed into database).
  - Build MCQ instant auto-grading engine.
  - Build manual marks entry with question-level teacher remarks.
  - *Exit Gate*: Admin uploads Excel chapter question bank, creates exam, and enters marks with teacher remarks.

- **Phase 6: Interactive Payroll, WhatsApp Engine & Absentee Desk**
  - Build interactive side-by-side Payroll Desk (left: attendance summary; right: dynamic earning/deduction heads with auto-multiplication).
  - Generate professional PDF payslips and monthly payroll summary ledger.
  - Build WhatsApp direct-link generator with phone sanitization, dynamic tags, and Rapid Queue mode.
  - Build Morning Absentee Desk with 1-click medical leave conversion and smart snoozing.
  - *Exit Gate*: Admin processes monthly payroll seeing live attendance and dispatches WhatsApp alerts without API fees.

- **Phase 7: Role Portals, SaaS Lockout & Capacitor Android Packaging**
  - Build Admin Priority Triage Dashboard, Staff Adaptive Portal, and Student/Parent Portal.
  - Implement Super-Admin 30-day trial expiry lockout modal with bank details & receipt upload.
  - Super-Admin global activation console.
  - Configure Capacitor for Android APK packaging with mobile bottom tabs and FCM background push service.
  - *Exit Gate*: Full end-to-end user test across Admin, Teacher, Parent, and Super-Admin roles; Android APK builds cleanly.

---

## GSTACK REVIEW REPORT

- **Review Type**: plan-eng-review (Engineering Architecture & Execution Review)
- **Target**: PLAN.md (Comprehensive 16-Module Cathedral & 7-Phase Execution Plan)
- **Status**: PASSED & LOCKED
- **Key Engineering Decisions Approved**:
  - D1: Monorepo workspace (`/packages/backend`, `/packages/frontend`, `/packages/supabase`, `/packages/shared-types`).
  - D2: Fastify (TypeScript) application server with async lifecycle RLS tenant injection.
  - D3: Real PostgreSQL dual-tenant RLS integration test suite in CI/CD.
  - D4: React (Vite) + Tailwind CSS + shadcn/ui + Lucide Icons + Capacitor Android wrapper.
  - Architecture: Zero hardcoded academic data, shared database with PostgreSQL RLS, 100% passwordless Brevo OTP.


