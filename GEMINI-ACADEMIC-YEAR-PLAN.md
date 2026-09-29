# GIVE THIS WHOLE FILE TO GEMINI

Attach or paste this entire markdown file. Use this as the first message:

> Implement **one phase only**, starting at Phase 1 if it is not already done. Read that phase’s “Done when” list and stop. Do not start the next phase. Follow section 0 on every line you touch. Work only in `packages/backend`, `packages/frontend`, and `packages/shared-types`. After the phase, run the tests named in that phase from `packages/backend` with `npx vitest run <file>`.

Then send the rest of this file. Do not summarize it. File paths, field names, button labels, and the sentences already on screen are the spec.

**Product:** Kampus / Apex Academy SIS. Live app is `packages/backend` + `packages/frontend`. Live data is the JSON snapshot in `packages/backend/src/services/store.ts` (`kampus_store_snapshot`). The SQL files under `packages/supabase` are not the database these screens use. Do not add SQL tables. Do not migrate the snapshot.

**Do not touch:** `school-erp`, `JWT_SECRET`, Render, Cloudflare, `.env`, `DashboardView.backup.tsx`, `Sidebar.backup.tsx`. Do not delete `seedTestData()`. Do not remove the doubled routes (`/api/v1/homework` and `/api/v1/homework/homework`, and the same pattern on timetable, exams, finance, saas, complaints, geofence). Frontends keep calling the path they call today.

**What this plan builds:** a clerk picks a school year and the desks show that year exactly as they did when it was live. Starting a new year copies next year’s classes, moves students into them, and leaves last year as history. One login’s year choice does not change another login’s year.

---

## 0. Design and wording — this overrides every phase

The job is to make the year workflow tell the truth. It is not a redesign.

1. Do not restyle a screen. Do not change layout, spacing, radius, shadow, font, icon set, or color of a control you are not required to add.
2. Do not introduce a new visual language. No gradients, no glass, no glow, no purple-to-pink, no oversized hero, no illustration, no empty-state drawing, no new card style, no new font (`Inter` and the monospace already on numbers stay).
3. A new control, if a phase names one, copies the `className` of the nearest button that already does that kind of job in the **same file**. Login and portal actions that are already `bg-amber-600 hover:bg-amber-700` stay that. Desk actions that are already amber, slate, or rose stay that. Do not recolor them to indigo, teal, or orange from a design document.
4. Do not apply `DESIGN.md` as a reskin. `DESIGN.md` is reference for density and anti-slop only. If a class already on the screen disagrees with `DESIGN.md`, keep the class on the screen.
5. Do not rename a button, tab, heading, or menu item that already exists. Do not replace operational words with marketing words.
6. New text is one short sentence an academy clerk would say. Allowed examples already in the product: “Please fill out this field.”, “No payment receipts recorded yet.”, “Remove this period?”.
7. Forbidden wording, even in errors, empty states, comments shown to users, and test names that get printed: muster roll, geofence (clerk-facing label; the route file may keep the name `geofence`), counseling program, journey, experience, unlock, empower, elevate, seamless, robust, streamline, delight, “Let’s”, “You’re all set”, “Nothing here yet”, lorem, and any sentence that explains the product to itself.
8. Do not add a component library, a chart library, a toast system, or a new modal shell. Use the sheet, `alert`, or inline error that file already uses.
9. Do not add features this file does not name. A missing behavior is fixed inside the control that already exists.
10. Money, dates, roll numbers, and CNIC stay `font-mono` / tabular numbers where that element already uses them. Do not decorate them.
11. Academy calendar date is `Asia/Karachi` unless `tenant.settings.timezone` is set. Use the existing `campusToday` / `campusDayOfWeek` helpers in `packages/backend/src/lib/campus-date.ts` and `packages/frontend/src/lib/campusDate.ts`. Do not add a second date helper. Do not leave a new `new Date().toISOString().split('T')[0]` on a path this plan names.
12. Permissions stay `can(user, feature, level)` in `packages/backend/src/lib/access.ts` and `canOpenScreen` in `packages/frontend/src/lib/portalAccess.ts`. Do not invent a second role matrix.
13. Student and parent password login stays father/guardian CNIC. Staff stays email. Do not make portal login accept email.
14. A student in two classes is two `StudentEnrollment` rows. Class-scoped attendance, homework, and timetable use `enrollment.batch_id` and `enrollment.roll_number`. `student.batch_id` is only the primary class **for the working year**.
15. Every store mutation this plan names calls `this.schedulePersist()` before return.
16. Classes (programs) live across years. Sections and batches belong to one year (`batch.academic_session`). Starting a new year **creates new batch rows**. It does not rewrite last year’s batch ids.
17. Promoting into a new year **creates new enrollments** and marks the old ones `completed`. It does not overwrite `enrollment.batch_id` on last year’s row.
18. The academy’s **Active** year is `tenant.settings.academic_sessions[].is_active` / `tenant.settings.academic_session`. A clerk’s **working year** is `user.metadata.working_session`. Switching working year is per login. It does not flip Active for the campus.

---

## 1. Current truth (keep these controls)

Gemini keeps every row. “Required change” is the work of later phases. “Keep” means the control stays on screen with the same label.

### 1.1 Header — `packages/frontend/src/components/Header.tsx`

| Control | Today | Required change |
|---|---|---|
| Session pill `hidden xl:flex` around lines 132–136, classes `hidden xl:flex items-center gap-1.5 px-2.5 py-1 h-9 rounded-xl text-[11px] font-medium text-slate-600 bg-slate-50 border border-[#E6ECF2]`, inner text `Session {tenant?.academic_session \|\| '2026–2027'}` | Display only | Phase 2: same wrapper becomes a `<select>` of years for staff. Students and parents keep the display-only pill. |
| Profile menu | Staff, Settings, Sign out | Phase 2: add one Session row for staff on all breakpoints, because the pill is hidden below `xl`. |
| Search, bell, avatar | Keep | Keep. |

### 1.2 Settings → Campus Profile — `packages/frontend/src/views/AcademySettingsView.tsx`

Tab `profile`. Academic Sessions block around lines 817–896.

| Control | Today | Required change |
|---|---|---|
| Label `Academic Sessions` | Keep | Keep. |
| Helper sentence “The active academic session is the global default across all batches, admissions, and fee challans. Inactive sessions can be removed.” | Keep the first sentence. Phase 2 replaces the second sentence with: “Open a year to look at that year’s classes. Set Active is the year the campus is running.” |
| Row: session name `font-mono`, `Global Default` chip when `is_active` | Keep chip | Phase 2 adds button **Open** on every row. Active row’s Open is the current working year. |
| Button `Set Active` / `Active` | Sets `is_active` in local state; saved only with **Save Academy Settings** | Keep. Saving Set Active still requires **Save Academy Settings**. It does not copy classes. That is Phase 5. |
| Trash on inactive year | Removes from local list | Phase 1: a year that already has batches or enrollments cannot be removed. Alert: “This year has class records. Keep it so history stays.” |
| Start year number + **Add** | Adds `{y}-{y+1}` | Keep. |
| **Save Academy Settings** | `px-6 py-3 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-xs font-semibold` | Keep. Phase 5 adds **Start next session** to the left of this button, same amber classes, only on the profile tab, only `tenant_admin` or `super_admin`. |

### 1.3 Classes & Batches — `packages/frontend/src/views/AcademicStructureView.tsx`

| Control | Today | Required change |
|---|---|---|
| PageHeading badge `Session {tenant?.academic_session \|\| '2026-2027'}` | Tenant active year | Phase 3: working year from auth. |
| New Class, + New Batch, + New Subject, Edit Class, Add Section, Delete, Batch Student Transfer | Always shown | Phase 4: hide write controls when the working year is not Active, or when `classes` is view-only. Batch Student Transfer stays an **in-year** move (same year, different section). Year promotion is **Start next session**, not this modal. |
| Occupancy `students.filter(s => s.batch_id === sec.id)` | Primary class only | Phase 7: count enrollments for that batch whose status is `active` or `on_leave`. |

### 1.4 Students / Admission / Fees / Timetable / Attendance / Homework / Exams

These desks already load the academy’s full lists. Phase 3 filters them by working year. Do not add a second year dropdown on each desk. The header/profile Session select is the only year switch.

---

## 2. Year model (read this before Phase 1)

### 2.1 Two years

| Name | Stored on | Meaning |
|---|---|---|
| Active year | `tenant.settings.academic_session` and the `academic_sessions[]` row with `is_active: true` | The campus is running this year. New admission, attendance marks, new homework, new exams, new timetable periods, and new challans write here. |
| Working year | `user.metadata.working_session` (staff only) | The year this login is looking at. Default = Active year. |

Student and parent logins have no working year. Their portal always uses the Active year.

### 2.2 What follows the working year

Filter these by working year:

- Classes & Batches sections/batches (`batch.academic_session`)
- Student directory (students who have an enrollment in that year’s batches)
- Student profile class/roll/subjects for that year
- Timetable slots whose `batch_id` belongs to that year
- Attendance rows whose `batch_id` belongs to that year
- Homework whose `batch_id` belongs to that year
- Exams whose `batch_id` belongs to that year
- Challans whose batch or `academic_session` is that year
- Dashboard class/batch widgets
- Teacher portal class lists
- ID card print (enrollment for that year)
- Absentee student roster (students in that year’s batches)

### 2.3 What stays on “today” (does not follow working year)

- Settings campus profile, bank, shifts, documents, departments, security
- Staff directory, staff clock in, payroll
- Feedback / complaints
- Inquiries list (admit still writes into the Active year)
- Super-admin platform
- Login

### 2.4 Closed year

If working year ≠ Active year:

- GET is allowed.
- POST/PUT/PATCH/DELETE on classes, batches, programs, groups, subjects, students (create/status/enroll), timetable, attendance marks, homework, exams, challan create/edit are blocked with 403 `YEAR_CLOSED`, message: “This year is closed. Open the active year to make changes.”
- Allowed writes in a closed year: `PATCH /api/v1/academic/working-session`, fee **payment** on an existing unpaid invoice, and the Phase 5/6 Start-next-session endpoints (admin only).
- Frontend hides the write buttons this plan names and shows one banner on year-scoped desks.

Banner copy, reuse the existing success/error alert classes from `AcademicStructureView.tsx` (emerald/rose boxes around 1085–1096) in slate:

> Viewing {year}. These records cannot be changed.

Place the banner under `PageHeading` on: Classes & Batches, Students, Timetables, Attendance, Homework, Exams, Fee Challans, Fees Receiving, Dashboard. Copy the nearest existing alert `className` in that file. Do not invent a new banner component.

### 2.5 How a record knows its year

Do not add `academic_session` columns to timetable, homework, exams, or attendance. Those records already have `batch_id`. A record belongs to a year when its batch’s `academic_session` equals the working year.

Enrollments already have `academic_session`. Backfill it from the batch if missing.

Invoices: add optional `academic_session?: string` on `StudentInvoice` in `packages/shared-types/src/index.ts`. Backfill from the invoice’s batch, then enrollment, then tenant active year. New invoices write the Active year.

### 2.6 Projected student class fields

When `GET /api/v1/sis/students` (and by-id) runs for a working year, each returned student overlays:

- `batch_id`, `program_id`, `roll_number`, `subjects`, `enrollment_id` from that year’s primary enrollment (`is_primary` among enrollments whose `academic_session` or batch year is the working year; if none is primary, the first `active`/`on_leave` enrollment in that year)
- `status` stays the person status (`active`, `on_leave`, `archived`, …) except a person with **no** enrollment in that year is omitted from the directory list
- `enrollments` on the payload includes all years; the directory row shows the working year’s class
- Person fields stay: name, admission_number, CNIC, phones, `user_id`

`student.batch_id` in the JSON snapshot remains the Active year’s primary class. The overlay is response-only. Switching working year does not rewrite stored `student.batch_id`.

---

## Phase 1 — Store the years and stop deleting old ones

**Files:** `packages/shared-types/src/index.ts`, `packages/backend/src/services/store.ts`, `packages/backend/src/app.ts`, `packages/backend/src/routes/academic.ts`, `packages/backend/src/routes/auth.ts`.

### 1.1 Keep past years

`ensureTenantSessions` in `store.ts` around 3034–3048 currently filters `academic_sessions` with `s.start_year >= minYear || s.is_active`. That drops finished years.

Required:

- Keep every session row that already exists.
- If the list is empty, still call `defaultAcademicSessions(tenant.settings.academic_session)`.
- Still copy the active row’s `name` onto `tenant.settings.academic_session`.
- Do not delete a session that has any batch or enrollment with that `academic_session`.

### 1.2 Backfill

On store load (`hydrate` / `ensureStudentEnrollments` path already in `store.ts` around 1198–1218):

- Every enrollment with empty `academic_session` gets `batch.academic_session` or tenant active year.
- Every invoice gets `academic_session` from its batch, then enrollment, then tenant active year.
- Every batch with empty `academic_session` gets tenant active year.
- Call `this.schedulePersist()` if anything changed.

### 1.3 Working year on the live user

In `authenticate` in `packages/backend/src/app.ts` after the live user is loaded:

- Read `X-Kampus-Session` header if present.
- Else `user.metadata.working_session`.
- Else tenant Active year.
- If the chosen string is not in `tenant.settings.academic_sessions[].name`, fall back to Active year.
- If role is `student` or `parent`, always Active year. Ignore the header and metadata.
- Set `request.working_session` (string).
- Set `request.year_closed` true when `request.working_session !== tenant.settings.academic_session`.
- Put `working_session` and `year_closed` on the object already assigned to `request.user` so routes can read `request.user.working_session`.

Do not put working year in the JWT. It is live metadata, same as `access` and `portal_blocked`.

### 1.4 `/me` and login payload

`GET /api/v1/auth/me` and login/session responses in `packages/backend/src/routes/auth.ts` already return `tenant.academic_session`. Add:

```
tenant.academic_session            // Active year
tenant.academic_sessions           // full list { id, name, start_year, end_year, is_active }
user.working_session               // this login’s working year
user.year_closed                   // boolean
```

Keep existing keys. Do not rename `tenant.academic_session`.

### 1.5 PATCH working year

In `academic.ts`, next to the existing settings routes:

`PATCH /api/v1/academic/working-session` and the doubled path if academic routes are mounted twice the same way other files are.

- Auth required.
- Role `student` or `parent` → 403 `YEAR_CLOSED` is wrong; use 403 `FORBIDDEN_ROLE`, message: “Student and parent views stay on the active year.”
- Body `{ academic_session: string }`. Zod min 1.
- Session name must exist on that tenant’s `academic_sessions`. Else 400 `NOT_FOUND`, message: “That year is not on this campus.”
- Write `user.metadata.working_session`.
- `schedulePersist()`.
- Return `{ working_session, year_closed, academic_session: tenant.settings.academic_session, academic_sessions }`.

Staff with any logged-in role except student/parent may call this, including teachers.

### 1.6 Helper in the store

Add `InMemoryDataStore` methods (names exact):

- `resolveWorkingSession(tenantId, user, headerValue?: string): string`
- `batchesForSession(tenantId, session: string): Batch[]` — `b.academic_session === session`
- `isYearClosed(tenantId, session: string): boolean`
- `assertYearWritable(tenantId, session: string): void` throws `Error` with message `This year is closed. Open the active year to make changes.` and a `.code = 'YEAR_CLOSED'` if you attach codes; routes catch and send 403 `YEAR_CLOSED`.

Phase 1 does **not** call `assertYearWritable` on existing POST routes yet. That is Phase 4.

**Done when:** new file `packages/backend/tests/academic_year_session.test.ts` from `packages/backend` with `npx vitest run tests/academic_year_session.test.ts`:

1. `ensureTenantSessions` keeps a session whose `start_year` is older than this calendar year when that session has a batch.
2. Enrollment missing `academic_session` is backfilled from its batch.
3. Teacher PATCH working-session to a listed year returns that year and `year_closed: true` when it is not Active.
4. Student token PATCH working-session returns 403.
5. Unknown year name returns 400.
6. `/me` after PATCH returns `user.working_session` as the chosen year and `tenant.academic_session` still the Active year.

Seed Apex data may stay. Create extra session rows on the test tenant as needed.

---

## Phase 2 — Year picker on screen

**Files:** `packages/frontend/src/context/AuthContext.tsx`, `packages/frontend/src/components/Header.tsx`, `packages/frontend/src/views/AcademySettingsView.tsx`.

Do not restyle Header or Settings. Do not add a year dropdown on every desk.

### 2.1 Auth context

Extend `UserSession`:

```
working_session?: string;
year_closed?: boolean;
```

Extend `TenantSession` (already has `academic_session`):

```
academic_sessions?: AcademicSession[];
```

Add:

```
setWorkingSession: (name: string) => Promise<void>;
```

`setWorkingSession`:

1. `PATCH /api/v1/academic/working-session` with `Authorization` and body `{ academic_session: name }`.
2. On success, set `user.working_session`, `user.year_closed`, keep `tenant.academic_session` from the response Active year.
3. Write `localStorage.setItem('kampus.working_session', name)` as a cache only. Live source is the user record.
4. Existing desks already refetch on token/user change; after setState, they refetch because `user` changed. If a desk only depends on `token`, also bump a `working_session` value they can list in `useEffect` deps. Put `working_session` on context.

Login, `/me`, `applySession` copy `working_session`, `year_closed`, and `academic_sessions` from the payload. Default working year = `user.working_session || tenant.academic_session || '2026-2027'`.

Students/parents: do not call PATCH. Do not show a select.

### 2.2 Header pill (desktop `xl+`)

Replace the inner `<span>Session …</span>` with a `<select>` **inside the same pill div** (`hidden xl:flex …`). Options are `tenant.academic_sessions` names. Selected value is `user.working_session`. Label prefix stays the word `Session` in a span before the select.

Select classes: copy a compact select already in this app, for example `text-[11px] bg-transparent border-0 text-slate-600 font-medium` so the pill chrome does not change. `onChange` calls `setWorkingSession`.

Emerald dot stays. When `year_closed`, the dot uses `bg-slate-400` instead of `bg-emerald-500`. No extra caption.

Students/parents: keep the original text pill, no select.

### 2.3 Profile menu (phone and desktop)

In the profile dropdown, after the role chip and before Staff/Settings, add one block for staff:

- Button label: `Session {working_session}`
- Same row classes as the existing Staff button: `w-full text-left px-3.5 py-2 flex items-center gap-2 text-xs text-slate-700 hover:bg-slate-50 font-semibold`
- Clicking expands the year list in the same menu (do not add a second popover). Each year is a button. Active year shows the existing `Global Default` wording in a small mono span. The working year row is `font-bold`.
- Choosing a year calls `setWorkingSession` and closes the menu.

Min height 44px on the phone rows (`min-h-[44px]` on the year buttons).

### 2.4 Settings year rows

On each session row, add **Open** to the left of **Set Active**.

- **Open** classes: copy the inactive **Set Active** button: `px-2.5 py-1 rounded-md text-[11px] font-medium border bg-white text-slate-600 border-slate-200 hover:bg-slate-50`.
- If this row is the working year, Open is disabled and the label is `Viewing`.
- Open calls `setWorkingSession(sess.name)` only. It does not change `is_active`.
- **Set Active** still only flips local `is_active`. Clerk must press **Save Academy Settings** to persist Active. Helper under the list (replace the current second sentence): “Open a year to look at that year’s classes. Set Active is the year the campus is running.”
- Removing a year: if the API/store would refuse because batches exist, `alert('This year has class records. Keep it so history stays.')`. Wire Settings trash to check `batches.some(b => b.academic_session === sess.name)` after fetching batches with the existing academic batches GET, or skip the client check and show the API error. Phase 1 store already refuses delete of a used year; Settings currently only edits local state. On Save, if the payload omits a used year, `updateTenantSettings` must put it back. Implement that restore in `updateTenantSettings` / `ensureTenantSessions`.

Do not add Start next session in this phase.

**Done when:** tests in `tests/academic_year_session.test.ts` still pass. Add:

7. After PATCH working-session, GET `/api/v1/auth/me` shows the new working year and unchanged Active year.

Verifier click list (reviewer, not Gemini):

- Staff, desktop ≥1280: header select lists years; picking a past year keeps Settings Active chip on the live year after reload of `/me`.
- Staff, 375px: profile menu Session rows are tappable; header pill stays hidden.
- Student login: no select in header or profile.
- Settings Open on a past year does not change the Active button on that list until Save.

---

## Phase 3 — Desks show the working year

**Files:** `packages/backend/src/services/store.ts`, `packages/backend/src/routes/academic.ts`, `packages/backend/src/routes/sis.ts`, `packages/backend/src/routes/timetable.ts`, `packages/backend/src/routes/attendance.ts`, `packages/backend/src/routes/homework.ts`, `packages/backend/src/routes/exams.ts`, `packages/backend/src/routes/finance.ts`, `packages/backend/src/routes/absentee.ts`, `packages/backend/src/routes/portal.ts`, `packages/frontend/src/views/AcademicStructureView.tsx` (badge only), plus any desk that reads `tenant.academic_session` for a badge.

### 3.1 Filter helper

Use `request.user.working_session` from Phase 1. In store getters, take `session: string` and filter.

| Getter | Filter |
|---|---|
| `getBatches(tenantId, programId?, cohortType?, session?)` | When `session` is passed, `b.academic_session === session`. Existing callers that omit session from **routes** must pass working session. Internal Start-next-session copy in Phase 5 may pass a specific session. |
| `getStudents(tenantId, batchId?, session?)` | No `batchId`: students who have an enrollment in `batchesForSession`. Overlay class fields from §2.6. With `batchId`: keep today’s enrollment path (that batch is already one year). |
| `getStudentById` | Overlay class fields for working year when the student has an enrollment that year. If none, still return the person (profile) with `batch_id` null overlay and `enrollments` full history. Directory GET omits them; by-id stays. |
| Timetable list | Slots whose batch is in `batchesForSession` |
| Attendance list | Rows whose batch is in that set |
| Homework list | Same |
| Exam list | Same |
| Invoice list used by challans/voucher | See 3.2 |
| Absentee roster | Students in that year’s batches |
| Teacher portal overview | Batches/homework/exams in that year ∩ teaching assignments |
| Student/parent portal | **Ignore working year. Use Active year only.** |

`GET /api/v1/academic/programs`, `/subjects`, `/groups`, `/staff` stay unfiltered by year.

`GET /api/v1/academic/batches` uses working session.

Query escape hatch for Phase 5 mapping only: `GET /api/v1/academic/batches?academic_session=2027-2028` allowed for `tenant_admin` / `super_admin` / `classes` edit. Other roles ignore the override and use working session.

### 3.2 Fees

When working year **is** the Active year: return that year’s invoices **plus** unpaid/partial invoices from older years (arrears). Paid old invoices stay in the old year view only.

When working year **is closed**: return invoices whose `academic_session` or batch year equals the working year only, including paid.

`unpaid_balance` on a student in Active year = all unpaid invoices for that person. In a closed year view = unpaid invoices for that year only.

### 3.3 Frontend badges

Any `Session {tenant?.academic_session}` on year-scoped desks (Classes PageHeading, Enrollment session chip, Exam print line, Fee challans default, Dashboard “Session …”) reads `user.working_session || tenant.academic_session`. Do not add new badges. Change the expression only.

AcademicStructureView `fetchData` already loads `/academic/batches` with the token. After Phase 1 the API filters by working year automatically. When `setWorkingSession` updates user, `fetchData` must rerun. Add `working_session` to that `useEffect` dependency (token is there today). Repeat for other desks whose `useEffect` is `[token]` only: EnrollmentView, TimetableDesk, AttendanceDeskView, HomeworkDesk, ExamDeskView, FeeDeskView, FeeChallansView, DashboardView, TeacherPortalView, StudentIDCardDesk, AbsenteeRetentionDeskView.

Do not change StaffClockInView, StaffDeskView, ComplaintsDeskView, PayrollDeskView, AcademySettingsView fetches for this.

### 3.4 New admission class dropdowns

Admission and Add Class batch dropdowns come from GET batches, now year-filtered. Empty past year = empty dropdown. Phase 4 hides New Admission when closed.

**Done when:** extend `tests/academic_year_session.test.ts`:

8. Two batches, one tagged `2025-2026` and one `2026-2027`. After PATCH working-session to `2025-2026`, GET `/academic/batches` returns only the 2025-2026 batch.
9. A student enrolled only in the 2025-2026 batch is absent from GET `/sis/students` when working year is 2026-2027, and present when working year is 2025-2026 with `batch_id` equal to the 2025-2026 batch.
10. Student token GET batches still uses Active year even if metadata.working_session is stale.
11. Active-year invoice list includes an unpaid invoice whose `academic_session` is the previous year.

Run the whole file.

Verifier: staff opens 2025-2026, Classes list shows only that year’s sections; header still lets them switch back; Students directory matches those sections.

---

## Phase 4 — Closed year cannot be edited

**Files:** `packages/backend/src/routes/academic.ts`, `sis.ts`, `timetable.ts`, `attendance.ts`, `homework.ts`, `exams.ts`, `finance.ts` (create/update invoice only), `packages/frontend/src/views/AcademicStructureView.tsx`, `EnrollmentView.tsx`, `TimetableDesk.tsx`, `AttendanceDeskView.tsx`, `HomeworkDesk.tsx`, `ExamDeskView.tsx`, `FeeChallansView.tsx`, `FeeDeskView.tsx`, `DashboardView.tsx`, `App.tsx` (optional hide New Admission).

### 4.1 API lock

At the top of each **write** handler listed below, if `request.user.year_closed` then 403 `YEAR_CLOSED` with message `This year is closed. Open the active year to make changes.`

Lock:

- academic: POST/PUT/DELETE programs, subjects, groups, batches, POST promote, PUT settings is **not** locked (Settings is year-free). PATCH working-session is not locked.
- sis: POST student, PATCH student, POST status/archive/unarchive/delete/bulk, POST enrollments, PATCH enrollments, make-primary, admit inquiry
- timetable: POST/PATCH/DELETE slots, substitute
- attendance: POST marks, POST leaves (staff). Student/parent leave POST stays allowed only on Active year (their working year is Active).
- homework: POST/PUT/DELETE assignment, POST checks
- exams: POST/PUT/DELETE exam, questions, marks
- finance: POST generate/create invoice, PUT invoice, POST discount, POST cancel. **POST payment remains allowed** on unpaid invoices in any year.

Do not lock: staff, payroll, complaints, geofence, saas, auth, inquiries create/follow-up (admit is locked).

Use one helper in `academic.ts` or `packages/backend/src/lib/access.ts`:

```
function assertYearWritable(request, reply): boolean
```

Return false after sending 403.

### 4.2 Hide write buttons

When `user.year_closed` is true:

**AcademicStructureView:** hide New Class, + New Batch, + New Subject, Edit Class, Add Section, trash, Batch Student Transfer, drag handles. Keep search and view tabs.

**EnrollmentView:** hide New admission, Admit, Archive, Delete, Bulk, Add Class, Leave Class, Make Primary, password reset. Keep search and profile view.

**TimetableDesk:** hide Schedule Class, FAB +, Edit, Remove, Assign Substitute.

**AttendanceDeskView:** hide save/mark controls. Viewing a past register stays.

**HomeworkDesk:** hide Assign Homework / save.

**ExamDeskView:** hide create/edit/marks save.

**FeeChallansView:** hide generate/create. Viewing old challans stays.

**FeeDeskView:** Receive Payment stays (arrears). Hide create challan / revise / cancel.

**App.tsx / Sidebar:** `canOpenScreen('new_admission')` becomes false when `year_closed`. Keep Students view.

Banner from §2.4 on those desks.

### 4.3 View-only `classes` permission (same phase, same hide list)

On AcademicStructureView, if `can(user, 'classes', 'edit')` is false (frontend `user.access?.classes !== 'edit'` and role is not `tenant_admin`/`super_admin`), hide the same write controls even in the Active year. Teachers with `classes: view` can open the desk and see the tree.

Do not change teacher portal.

**Done when:** tests:

12. Teacher with working year in the past: POST `/academic/batches` → 403 `YEAR_CLOSED`. GET batches → 200.
13. Same teacher POST a payment on an unpaid prior-year invoice → 200 (use existing finance payment path).
14. tenant_admin in Active year POST batch → 201.

Verifier: switch to a past year, Classes has no New Class; switch back, New Class returns. Teacher in Active year with default template: Classes opens, New Class hidden.

---

## Phase 5 — Start next session copies classes

**Files:** `packages/backend/src/routes/academic.ts`, `packages/backend/src/services/store.ts`, `packages/frontend/src/views/AcademySettingsView.tsx`, `packages/shared-types/src/index.ts`.

This phase copies structure only. It does not move students. Phase 6 moves students.

### 5.1 Button

On Settings profile tab, left of **Save Academy Settings**, `tenant_admin` or `super_admin` only:

```
Start next session
```

Classes: same as Save (`px-6 py-3 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-xs font-semibold shadow-xs`). On small screens stack full width above Save (`w-full sm:w-auto`).

Opens an existing `mobile-sheet` overlay copied from AcademicStructureView’s Batch Transfer modal chrome (`fixed inset-0 z-50 bg-slate-900/60 … mobile-sheet`). Title: `Start next session`. Subtitle: `Copy this year’s classes into the next year. Students move in the next step.`

Fields:

1. `Copy from` — text, the Active year, read-only (same read-only box as AcademicStructureView Target Academic Session, around 3902–3907).
2. `Copy into` — `<select>` of sessions where `is_active` is false. If none, sentence: “Add a year in Academic Sessions first.” and disable confirm.
3. Confirm button `Copy classes` amber. Cancel closes.

Do not copy timetable, homework, attendance, exams, invoices.

### 5.2 API

`POST /api/v1/academic/sessions/copy-classes`

Body:

```
{
  source_session: string,
  target_session: string
}
```

Rules:

- `tenant_admin` or `super_admin`.
- `source_session` must be Active year.
- `target_session` must exist and differ from source.
- If target already has any batch, 400 `YEAR_NOT_EMPTY`, message: “That year already has classes. Open it to edit them.”
- For each batch in source (section and batch): create a new batch with a new id, same `program_id`, `name`, `cohort_type`, `shift`, times, dates shifted only if you can add one year to `start_date`/`end_date` when they are `YYYY-MM-DD`; if parse fails, copy the string unchanged. Copy `billing_mode`, `fee_amount`, `room_number`, `max_capacity`, `class_teacher_id`, `class_teacher_name`, `subject_ids`, `fee_schedule`. Set `academic_session` to target. `current_enrollment` 0. `status` `active`. Store `copied_from_batch_id: source.id` on the new batch. Add `copied_from_batch_id?: string | null` to `Batch` in shared-types.
- Programs, subjects, subject groups are not duplicated. They already belong to the campus.
- `schedulePersist()`.
- Return `{ created_count, batches: [...] }`.

Do not Set Active in this phase.

### 5.3 After copy

Close the sheet. `alert` is allowed: `Copied {n} classes into {target}. Students have not been moved yet.` Keep the clerk on Settings. They Open the new year to inspect classes (Phase 2 Open). Classes desk in that year shows empty occupancy.

**Done when:** tests:

15. Copy from Active 2026-2027 with 2 batches creates 2 batches in 2027-2028 with new ids, `copied_from_batch_id` set, source batches unchanged.
16. Second copy into 2027-2028 returns 400 `YEAR_NOT_EMPTY`.
17. Teacher token POST copy-classes → 403.

Verifier: Start next session copies; Open 2027-2028 shows the new sections with 0 students; Open 2026-2027 still has the old students.

---

## Phase 6 — Move students into the new year

**Files:** same as Phase 5, plus reuse mapping UI in the Settings sheet (second step). `store.promoteStudents` is **not** used. That function overwrites `student.batch_id` for in-year transfer. Add `enrollStudentsIntoSession`.

### 6.1 Sheet step 2

After a successful copy (or if clerk opens **Start next session** and target already has batches with `copied_from_batch_id`), show step 2 in the same sheet.

Title: `Move students`

Table, one row per **source** batch (Active year):

| Column | Control |
|---|---|
| From | `{name} ({shift})` read-only |
| Students | count of enrollments `active` or `on_leave` in that batch |
| Action | select: `Move to class` \| `Stay in same class` \| `Mark as left` |
| To class | select of **target year** batches. Default: the batch whose `copied_from_batch_id` equals this source id. `Stay in same class` sets To = target batch copied from the same source (same grade next year). `Mark as left` hides To. |

Buttons: `Move students` amber, `Skip for now` slate border (closes without moving).

`Stay in same class` means retain: new-year section of the **same program**, which the copy already created.

`Mark as left` means graduate/leave: no new enrollment; source enrollment `completed`; if the student then has no `active`/`on_leave` enrollment, set person `status` to `alumni` and `portal_blocked` true.

A student with two classes appears in two rows (two source batches). Each enrollment is moved separately. The enrollment that was `is_primary` in the source year becomes `is_primary` in the target year.

### 6.2 API

`POST /api/v1/academic/sessions/move-students`

Body:

```
{
  source_session: string,
  target_session: string,
  mappings: [
    {
      source_batch_id: string,
      action: "move" | "retain" | "leave",
      target_batch_id?: string
    }
  ]
}
```

`move` and `retain` both require `target_batch_id`. They are the same write path; `retain` is only a UI label.

For each mapping, for each enrollment in source batch with status `active` or `on_leave`:

1. Capacity: target `current_enrollment` + incoming ≤ `max_capacity` or throw. Count incoming only once per target.
2. Create a **new** `StudentEnrollment`: new id, `batch_id` target, `program_id` from target batch, `academic_session` target_session, copy `roll_number` (if clash in target batch among non-archived enrollments, assign `R-{n}` like `promoteStudents` already does), copy `subjects` from target program compulsory group if present else copy old subjects, copy `fee_structure`, `billing_mode`, `is_primary` from the old enrollment, status `active` (even if old was `on_leave` — they are placed in the new year as active; clerk can set leave later).
3. Old enrollment: `status: 'completed'`, `ended_at` campus today, `is_primary: false`.
4. After all mappings, for each affected student: set `student.batch_id` / `program_id` / `roll_number` / `subjects` / `fee_structure` from the new primary enrollment in **target_session**. If action was `leave` for every enrollment they had, `status: 'alumni'`, portal blocked as above.
5. `recalculateBatchSeats` for both sessions’ batches.
6. `schedulePersist()`.

Do not generate invoices. Do not copy timetable. Do not call `promoteStudents`.

Return `{ moved, retained, left, skipped }`. `skipped` is students who already have a target-session enrollment in that batch (idempotent).

### 6.3 Set Active after move

On success, the sheet shows two buttons using existing classes:

- `Stay on {source}` slate border — closes.
- `Make {target} active` amber — sets that session `is_active`, writes `tenant.settings.academic_session`, sets this user’s `working_session` to target, `schedulePersist()`, `refreshSession()`, closes.

Clerk can also Set Active later via the existing Settings row + Save Academy Settings.

**Done when:** tests:

18. Two students in source batch A; mapping move to copied batch B; after call they have a `completed` enrollment on A and an `active` enrollment on B; `student.batch_id` is B; GET students in source year still lists them with overlay batch A; GET students in target year lists them with overlay batch B.
19. Capacity: target max_capacity 1 with one already there; moving two students throws / 400.
20. `leave` on last class sets `alumni` and `portal_blocked`.
21. Running move-students twice does not duplicate enrollments (`skipped`).

Verifier: after move, Open old year shows the old section full; Open new year shows them in the new section; attendance taken last year still sits on the old batch.

---

## Phase 7 — Occupancy, delete, and in-year transfer tell the truth

**Files:** `packages/frontend/src/views/AcademicStructureView.tsx`, `packages/backend/src/services/store.ts` (`deleteProgram`, `deleteBatch` already count enrollments — keep that), `initiateDeleteProgram` / `initiateDeleteBatch` in the view.

### 7.1 Counts

Section occupancy, class “N std”, overview occupancy, and the transfer student list use enrollments for the **working year** with status `active` or `on_leave`. Prefer `batch.current_enrollment` after `recalculateBatchSeats`, or count enrollments. Do not use `students.filter(s => s.batch_id === …)` for occupancy.

Directory already gets overlaid students from Phase 3; using that list is acceptable if Phase 3 overlay is in place.

Second class: a student with two enrollments in the working year counts in both sections. Class left-list `classStudentCount` is unique students with any enrollment in that program that year.

### 7.2 Delete confirm

`initiateDeleteProgram` / `initiateDeleteBatch` must count the same enrollments as the API. If count > 0, keep today’s `alert` sentences (they already tell the clerk to transfer). Do not offer a transfer picker here.

API already blocks delete when enrollments exist. Keep blocking even `completed` enrollments on that batch — history must stay. Update `deleteBatch` / `deleteProgram` to refuse if **any** enrollment points at the batch/program, including `completed`. Message: “This class has student history. Archive it or keep it for past years.”

Add `status: 'archived'` on the batch via Edit if the Edit form already has status. Classes desk batch filters already include archived. Add **Archive** on the section row next to Delete, same rose/slate icon button pattern. Archive sets `status: 'archived'` with PUT already allowed. Archived batches are omitted from admission dropdowns (`getBatches` default excludes `status === 'archived'` unless `?include_archived=1`). They still appear when that year is opened, grayed, no Add Section student target.

Empty unused batch with **zero** enrollments ever: Delete remains.

### 7.3 In-year Batch Student Transfer

Keep the existing modal label `Batch Transfer`. Restrict destination batches to the working year. Source student list is working-year enrollments for that batch, status `active`. API `promoteStudents` remains the in-year path (overwrites the current year’s enrollment `batch_id`). Do not use it across years. If `target` batch `academic_session` !== source batch session, 400 `YEAR_MISMATCH`, message: “Use Start next session to move students into a new year.”

**Done when:** tests:

22. Delete batch with a `completed` enrollment → 400.
23. In-year promote to a batch with a different `academic_session` → 400 `YEAR_MISMATCH`.
24. Occupancy helper or GET batches `current_enrollment` equals active+on_leave enrollments for that batch.

Verifier: past year section shows last year’s headcount; Delete alerts; Active year transfer only lists this year’s sections.

---

## Phase 8 — Portal and teacher year, then stop extras

**Files:** `packages/backend/src/routes/portal.ts`, `packages/backend/src/services/store.ts` (`getStudentParentPortalOverview`, `getTeacherPortalOverview`), `packages/frontend/src/views/StudentParentPortalView.tsx`, `TeacherPortalView.tsx`.

### 8.1 Student and parent

Always Active year. Class switcher lists enrollments whose `academic_session` is Active (or batch year is Active) and status `active` or `on_leave`. Completed last-year classes are not in the switcher.

Do not add a year select on the portal in this plan.

### 8.2 Teacher

Teacher portal uses working year (teachers can Open a past year from the header to see last year’s diary). Mark Attendance / Assign Homework in a closed year is already 403 from Phase 4. Hide those two buttons on `TeacherPortalView` when `year_closed`, same as other desks.

### 8.3 ID cards

Bulk desk and profile ID card for a staff user in a working year print that year’s enrollment (batch, roll, subjects). If the student has no enrollment that year, `alert('This student has no class in this year.')`.

**Done when:** tests:

25. Parent portal overview `classes` array has no `completed` enrollment from a prior session.
26. Teacher GET portal with working year in the past returns homework only for that year’s batches.

Run `npx vitest run tests/academic_year_session.test.ts`.

---

## Phase 9 — What you must not build

This phase is a stop list. If Phase 1 through 8 are done, do not start new work. Do not:

- Restyle login, header, settings, or any desk.
- Add Ionic, a new icon pack, a new empty-state illustration, or a new font.
- Auto-flip Active year at midnight or on a calendar date.
- Copy timetable, homework, exams, or attendance into the new year.
- Auto-generate next year’s challans during move-students.
- Let students or parents switch year.
- Delete last year’s batches after promotion.
- Use `promoteStudents` for year change.
- Filter Staff, Payroll, Complaints, or Settings by year.
- Remove doubled routes, `seedTestData()`, or backup view files.
- Drop old rows from `academic_sessions`.
- Print `Student@123` or `Parent@123`.
- Put a person’s name in a fallback string.
- Add custom-field editor, WhatsApp Business API, copy-week, or bell schedules.

**Done when:** no code changes. Reply with the list of phases already present in git diff and stop.

---

## Verifier (for the reviewer, not for Gemini to implement)

After each phase, the reviewer checks only that phase:

1. Phase 1: old year rows survive `ensureTenantSessions`; student PATCH working-session is 403; `/me` has both years.
2. Phase 2: header select on desktop; profile Session list on 375px; Open does not change Active until Save.
3. Phase 3: switching year changes Classes and Students lists; Active fees still show unpaid old challans.
4. Phase 4: past year hides New Class and returns 403 on POST batch; Receive Payment still works.
5. Phase 5: copy creates new batch ids; old batches untouched.
6. Phase 6: student has two enrollments (completed + active); old year view and new year view both look correct.
7. Phase 7: occupancy matches seats; cannot delete a batch with history; in-year transfer refuses a different year.
8. Phase 8: parent portal has no year select; teacher past year hides Mark Attendance.

Check 375px and 1280px on Header and Settings. At 375px: no horizontal page scroll, profile Session rows ≥44px, bottom nav fully visible.

---

## File checklist (every path this plan may touch)

```
packages/shared-types/src/index.ts
packages/backend/src/app.ts
packages/backend/src/lib/access.ts
packages/backend/src/routes/academic.ts
packages/backend/src/routes/auth.ts
packages/backend/src/routes/sis.ts
packages/backend/src/routes/timetable.ts
packages/backend/src/routes/attendance.ts
packages/backend/src/routes/homework.ts
packages/backend/src/routes/exams.ts
packages/backend/src/routes/finance.ts
packages/backend/src/routes/absentee.ts
packages/backend/src/routes/portal.ts
packages/backend/src/services/store.ts
packages/backend/tests/academic_year_session.test.ts
packages/frontend/src/context/AuthContext.tsx
packages/frontend/src/components/Header.tsx
packages/frontend/src/views/AcademySettingsView.tsx
packages/frontend/src/views/AcademicStructureView.tsx
packages/frontend/src/views/EnrollmentView.tsx
packages/frontend/src/views/TimetableDesk.tsx
packages/frontend/src/views/AttendanceDeskView.tsx
packages/frontend/src/views/HomeworkDesk.tsx
packages/frontend/src/views/ExamDeskView.tsx
packages/frontend/src/views/FeeDeskView.tsx
packages/frontend/src/views/FeeChallansView.tsx
packages/frontend/src/views/DashboardView.tsx
packages/frontend/src/views/TeacherPortalView.tsx
packages/frontend/src/views/StudentParentPortalView.tsx
packages/frontend/src/views/StudentIDCardDesk.tsx
packages/frontend/src/views/AbsenteeRetentionDeskView.tsx
packages/frontend/src/App.tsx
packages/frontend/src/lib/portalAccess.ts
```

Do not edit files outside this list unless a compile error forces a type import. If that happens, change only the import.

---

## Suggested clerk flow (for the reviewer)

1. Near the end of 2026-2027, Settings → Add `2027-2028` if missing.
2. **Start next session** → Copy classes into 2027-2028.
3. **Move students** → Grade 9-A maps to new Grade 9-A or Grade 10-A; last class Mark as left.
4. **Make 2027-2028 active**.
5. To see last year’s register: header Session → 2026-2027. Everything looks as it did. Nothing saves. Switch back.
