# GIVE THIS WHOLE FILE TO GEMINI

Attach or paste this entire markdown file. Use this as the first message:

> Implement **one phase only**, starting at Phase 0 if it is not already done. Read the phase’s “Done when” list and stop. Do not start the next phase. Do not restyle screens. Do not rename existing buttons. Do not add a component library. Do not touch `school-erp`, `JWT_SECRET`, Render, Cloudflare, `DashboardView.backup.tsx`, or `Sidebar.backup.tsx`. Work only in `packages/backend`, `packages/frontend`, and `packages/shared-types`. After the phase, run the tests named in that phase.

Then send the rest of this file. Do not summarize it. Button labels, file paths, and field names are the spec.

**Product:** Kampus / Apex Academy SIS. Live app is `packages/backend` + `packages/frontend`. Data is the JSON snapshot in `packages/backend/src/services/store.ts`.  
**Screens in this plan:** Timetables, Staff Attendance, Absence Follow-Up, Homework & Notebooks, Feedback, Staff Directory, plus the dashboard / teacher portal / student portal pieces that read those records.  
**Design rule:** Keep the current Tailwind desks, amber primary buttons, `PageHeading`, `mobile-sheet`, and Lucide icons. Add only the buttons this file names. A missing behavior is fixed inside the existing control.

Sections titled **VERIFIER** are for the reviewer after Gemini finishes. They are not extra features.

---

## 0. Rules that apply to every phase

1. Academy calendar date is `Asia/Karachi`, already the tenant setting and already used inside `evaluateHead` (`store.ts` around 6058, `Intl.DateTimeFormat` with `timeZone: 'Asia/Karachi'`). Add one shared helper and call it everywhere this plan says “campus today”. Do not leave a second `new Date().toISOString().split('T')[0]` on these modules.
2. Every mutation named in a phase calls `this.schedulePersist()` before return. A write that only changes memory is a failed phase.
3. Keep the doubled routes that already exist (`/api/v1/timetable` and `/api/v1/timetable/timetable`, and the same pattern for homework, absentee, complaints, geofence). Frontends may keep calling the path they call today. New handlers go on both paths.
4. `can(user, feature, level)` in `packages/backend/src/lib/access.ts` stays the permission check. Do not invent a second role matrix.
5. Student and parent portal login stays father/guardian CNIC. Do not match portal users by email on these modules.
6. A student in two classes is two `StudentEnrollment` rows. Attendance, absence, homework, and timetable for a class use `enrollment.batch_id` and `enrollment.roll_number`. `student.batch_id` is only the primary class.
7. Do not delete `seedTestData()`. Old phase tests still expect the Apex demo seed. New tests live in `packages/backend/tests/daily_ops_modules.test.ts` and create their own tenant data.
8. Time strings stored on slots are zero-padded `HH:MM` (`08:30`). Compare overlap with minutes, not string order. `9:00` must be saved as `09:00`.
9. Empty states stay the existing sentences. Do not add “28 students” or any other hardcoded count.
10. `alert()` on timetable substitute failure may stay for this plan. Do not replace the whole toast system.

### Campus date helper

Create `packages/backend/src/lib/campus-date.ts` and a matching `packages/frontend/src/lib/campusDate.ts`:

- `campusToday(timeZone = 'Asia/Karachi'): string` returns `YYYY-MM-DD`.
- `campusDayOfWeek(date: string, timeZone = 'Asia/Karachi'): DayOfWeek` returns `monday` … `sunday` for that civil date. Do not use `new Date(date).getDay()` on a date-only string (that parses as UTC and shifts the weekday).
- `campusMinutes(iso: string, timeZone = 'Asia/Karachi'): number` is the same conversion `evaluateHead` already does. Move that logic here and call it from `evaluateHead`.

Frontend dashboard, teacher portal, staff attendance, and absence desk use `campusToday()` for the default date. Backend `staffClockIn`, `staffClockOut`, `syncDailyAbsenteeRoster`, `getTeacherPortalOverview`, `getStudentParentPortalOverview`, and WhatsApp “today” use the same helper. Read the tenant timezone from `tenant.settings.timezone` when the tenant exists, otherwise `Asia/Karachi`.

---

## 1. Button inventory (current truth)

Gemini keeps every row below. The “Required change” column is the work. “Keep” means the control already does the right thing and must still be on the screen.

### 1.1 Timetables — `packages/frontend/src/views/TimetableDesk.tsx`

| Control | Where | Today | Required change |
|---|---|---|---|
| Schedule Class | PageHeading, amber | Opens “Schedule Academic Period” | Keep. Also the label of the edit sheet when editing. |
| FAB `+` | `sm:hidden`, `bottom-[calc(5rem+env(safe-area-inset-bottom))]` | Same modal | Keep. |
| Batch `<select>` | Filter bar | `all` + each batch `Program • Name (SHIFT)` | Keep. |
| Day `<select>` | Mobile only | All Days + Monday–Saturday | Add Sunday as a real option. Default selected day is campus weekday, not hardcoded Monday (`useState` is `'monday'` today). |
| Day tabs | `hidden sm:flex` | All Days, Mon–Sat as 3 letters | Add Sun. |
| Room Allocation badge | Right of filters | Reads `multi_room_enabled` from geofence | Badge stays. It no longer gates the room dropdown. |
| Slot card | Grid | Day, time, subject, class, teacher, substitute, room | Add Edit and Remove. Keep Assign Substitute / Change Substitute. |
| Assign Substitute | Card footer, full width | Opens substitute sheet. No date, no reason. | Add date (default campus today) and optional reason. Permanent teacher is unchanged. |
| Schedule sheet: Target Batch, Day, Start, End, Subject, Assign Faculty, room or “Single-Room Default Active” | Modal | Create only. Faculty list is free teachers including tenant admins. Room hidden unless multi-room. | Same fields for create and edit. Faculty list is active staff with role `teacher` or `academic_head`, plus anyone who has a teaching assignment, excluding `tenant_admin` unless they also have a teaching assignment. Room dropdown always visible. Empty room means the batch’s own room (`batch.room_number`) and is not a clash. |
| Confirm Schedule | Sheet footer | POST `/api/v1/timetable/timetable` | Create stays POST. Edit is PATCH. Disabled while `collisionState.has_conflict`. |
| Cancel / X | Both sheets | Closes | Keep. |
| Collision banner | Sheet | Live check | Keep. Also run on edit with `excludeSlotId`. |
| No Remove control exists | — | DELETE API exists, UI never calls it | Add Remove on the card. Confirm with the existing sheet pattern: “Remove this period?” Cancel + Remove. Calls DELETE. |

There is no copy-week button. Do not add one in this plan.

### 1.2 Staff Attendance — `packages/frontend/src/views/StaffClockInView.tsx`

Personal card (every staff user who can open the screen):

| Control | Today | Required change |
|---|---|---|
| Clock In | `handlePersonalAction('in')` → GPS → POST clock-in | Keep. A teacher with `geofence` edit can clock in. After success, their own row is visible without `staff_attendance` view. |
| Clock Out | POST clock-out | Keep. |
| Locate me | `locateSelf` | Keep. |
| Request Regularization | Opens regularization modal | Keep. |
| My card PDF | `handlePreviewStaffCardPdf` | Keep. |

Regularization modal: date, clock-in, clock-out, clear buttons, reason, notes, Cancel, Submit. Keep. Approved request must keep the requested times and must set status from the chosen head, not always `on_time`.

Admin tabs (require `staff_attendance` view; hide the tab row when the user lacks it):

| Tab button | Today | Required change |
|---|---|---|
| Daily | Date step −/+, Today, head chips All / On time / Late / Half day / Leave / Absent / Not marked, PDF, CSV, per-row edit | Keep chips. Edit opens the existing manual modal. |
| Monthly | Month summary, PDF, CSV | Numbers must match `getStaffMonthlySummary`. |
| Reports | Daily, monthly, department, defaulters, staff card, audit: each has Preview, Download, CSV | Keep all six report blocks and their three buttons. |
| Ledger | Staff picker, month, CSV, row drill | Keep. |
| Exceptions | Pending regularization Approve / Reject, date step, PDF, CSV, edit | Approve sends `head_id` chosen on the request. Reject stays reject. |
| Audit logs | Preview PDF, CSV, filter | Keep. |
| Settings | Save Changes (header and dirty banner), shift fields, Apply Shift Schedule to Rules, Reset to 4 Standard Rules, Clear All, Add Custom Head, move up/down, edit head, delete head, Calibrate Location, head modal Save | Keep every settings button. `multi_room_enabled` may stay on this form. Timetable no longer reads it to hide rooms. |

Manual edit modal: status, head, clock-in, clock-out, clear, reason, Cancel, Save. Keep. Status values stay `on_time | late | half_day | absent | on_leave`. Head `category: 'present'` must be stored as status `on_time`. Head `category: 'leave'` must be stored as `on_leave`.

### 1.3 Absence Follow-Up — `packages/frontend/src/views/AbsenteeRetentionDeskView.tsx`

| Control | Today | Required change |
|---|---|---|
| Search + clear X | Name, admission, guardian | Keep. |
| Filters toggle | Date, Batch, Status | Keep. Add a “Snoozed” status only as a filter value `SNOOZED`. Default list hides rows with `is_snoozed && snooze_until >= campus today`. |
| Options menu `MoreVertical` | Start Rapid Follow-Up; Absentee Roster; Retention Desk; Templates; Overview Cards toggle | Keep all five. |
| Overview cards | KPI from `/api/v1/absentee/kpi` | Keep. Counts exclude snoozed rows. |
| Row: primary phone / backup phone | Backup is often the fake `+923210000000` | Backup button disabled unless `student.guardian_whatsapp` or the second phone on the student is non-empty and different from the primary. Never invent a number. |
| WhatsApp | Opens preview modal | Keep. Message tags use real student, class of the absence, guardian, campus today, academy name, academy phone. Do not substitute `{due_amount: '0'}`, `{exam_title: 'Term Assessment'}`, or the fixed teacher sentence. Unknown tags stay blank. |
| Log | Opens “Log Call Outcome” | Keep fields: Call Outcome, Reason Category, Parent Remarks, Expected Return Date, Convert to Approved Medical Leave, Cancel, Save Call Record. Save persists. Medical leave creates a real `LeaveApplication` for the return range (or just this date when return is empty), status `approved`, and excuses attendance on those dates. |
| Rapid queue | Previous, Open WhatsApp, Next Student, close | Keep. “Open WhatsApp” logs the audit only after `window.open` of `encoded_url` returns a window. If the popup is blocked, show the existing error path and do not mark CONTACTED. |
| Retention: Schedule | Opens Parent Counseling | Keep Meeting Date & Time and Agenda Notes, Cancel, Confirm & Schedule. Persist. Cases are generated, not seeded as the only source. |
| Templates: New | Create template | Keep Title, Category, Body, tag hint, Cancel, Save Template. Persist. |
| Back to roster buttons on retention and templates | `setActiveTab('roster')` | Keep. |

Do not add an SMS provider. WhatsApp stays `https://wa.me/{digits}?text=`.

### 1.4 Homework — `packages/frontend/src/views/HomeworkDesk.tsx`

| Control | Today | Required change |
|---|---|---|
| Assign Homework | Opens create sheet | Keep. Sheet title becomes “Edit Homework” when editing. |
| Batch `<select>` | Left column | Keep. List is batches in the user’s `batchScope`. |
| Assignment card click | Selects it | Keep. Add Edit and Delete icon buttons on the card (`stopPropagation`). Delete confirms “Remove this homework and its notebook checks?”. |
| Done / Incomplete / Missing | Per student, mobile and desktop | Keep the three buttons. Initial state is **unset**, not `done`. Unset is the slate style on all three. |
| Remarks input | Optional | Keep. |
| Save Inspection | POST checks | Sends only students whose status is set. Disabled when none are set. Success text stays the existing sentence but the count is the number saved, not `students.length`. |
| Counters Done / Incomplete / Missing | Count local state | Add a fourth counter “Not checked”. |
| Confirm Assignment | Create | Create stays. Edit is PATCH. Fields stay Target Batch, Subject, Title, Physical Checking Instructions, Assigned Date, Due Date. Due date before assigned date is rejected in the sheet before POST. |
| Cancel / X | Close | Keep. |

Roster students are active enrollments in `assignment.batch_id`, not `GET /students?batch_id` filtered only on `student.batch_id`.

### 1.5 Feedback — `packages/frontend/src/views/ComplaintsDeskView.tsx`

| Control | Today | Required change |
|---|---|---|
| New Ticket | Opens Submit Ticket | Keep. |
| Search + clear | Subject, name, description | Keep. Also matches class name and student name once those fields exist. |
| Filters | Category, Status, Reset Filters | Keep the five categories and four statuses. |
| Card button | “Update & Resolve” or “View Ticket” or “Resolution” | Label “Update & Resolve” only when `can(complaints, 'edit')`. A teacher with view-only sees “View Ticket” and the read-only panel. Today `isStaff` is every role except student and parent, so a teacher gets the edit form and a 403. |
| Submit Ticket fields | Category, Priority, Subject, Issue Details | Add optional Student `<select>` (staff only). Parent/student tickets set `student_id` from the logged-in child and hide the select. |
| Manage Resolution | Status, Official Resolution Reply, Internal Administrative Notes, Cancel, Save Resolution | Keep for editors. Persist. Parents and students never receive `internal_notes`. |
| Close | Read-only panel | Keep. |

### 1.6 Staff Directory — `packages/frontend/src/views/StaffDeskView.tsx`

Keep every existing control:

- Search and clear, Filters toggle, Options menu.
- Options: `+ Add Staff`, All Staff, Teaching Faculty, Admin & Accounts, Support Personnel, Archived Staff, Overview Cards toggle.
- Filter chips for the same five categories.
- Row Edit.
- Row menu: Teaching Workload, Portal Permissions, Print Staff ID Card, Appointment Letter, Reset Password, Soft Archive or Restore Active, Delete Staff.
- Dossier tabs: personal, employment, compensation, access.
- Access presets: teacher, accountant, academic head, clear. Drawer presets: Teacher, Finance, Academic Head, Clear. Save.
- Teaching modal: add row, remove row, Cancel, Save.
- Password reset, ID card Print, Appointment letter Print, Archive confirm, Delete confirm.

Required behavior changes, not new chrome:

- Category filters use `role` and `teaching_assignments`. Teaching Faculty = `role === 'teacher'` OR at least one teaching assignment. Admin & Accounts = `finance_manager` or `academic_head` or department Accounts/Administration. Support = everyone else who is staff. Do not require the department string to be one of Science, Mathematics, Humanities, Languages, Commerce.
- Creating staff: if the operator picked a role, store that role. Do not overwrite it from the department name.
- Teaching Workload save is what the timetable faculty picker reads.
- Leave balances on the dossier are the same numbers attendance decrements. Show casual / sick / annual as `used / allowed`. They already exist in metadata.
- Delete stays blocked when the person marked student attendance, owns a timetable slot, owns homework, or has a payslip. Say which link blocked it.
- Academic head with `classes` edit can open this screen in read-only form: list, search, teaching workload view. They cannot create, archive, delete, reset password, or change access. Those buttons are hidden. `tenant_admin` and `super_admin` keep full use.

### 1.7 Surfaces that only read these modules

| Screen | Control | Required change |
|---|---|---|
| `DashboardView.tsx` | Staff On-Campus card, “N Periods Today”, Today’s Class Schedule grid, homework snippet | Periods and the grid are slots whose `day_of_week` is campus weekday. Empty room prints the batch room, or “Room not set”. Never “Hall A”. Staff denominator is the real roster length, never `\|\| 6`. |
| `TeacherPortalView.tsx` | Name chip | `user.full_name`. Remove the `includes('Physics') ? 'Sir Tariq'` branch and the `'Sir Tariq'` fallback. |
| Same | Clock In, Clock Out | Keep. Widget reads `GET /api/v1/geofence/attendance/staff/me`. Status text uses `on_time` → Present, `late` → Late, `half_day` → Half day, `on_leave` → Leave, `absent` → Absent. No fake `08:24 AM` and no fake `18` meters. |
| Same | Mark Attendance, Diary on each period | Keep the buttons. Before navigate, `sessionStorage.setItem('kampus.pendingBatch', slot.batch_id)` and `kampus.pendingSubject` for diary. Attendance desk and homework desk read and clear those keys on mount. |
| Same | “Active Now” badge | Only on the slot whose start/end contains campus minutes now. Not always index 0. |
| Same | Check Notebooks | Keep. |
| `StudentParentPortalView.tsx` | Today schedule, weekly day tabs, Print, homework subject filter, status filter | Keep. Weekly tabs include Sunday when a Sunday slot exists. Homework status filter already understands pending/checked/incomplete/missing. `submission_status` stays `pending` until a check exists. |
| `GenericModuleView.tsx` | Fake “28 students…” | Delete the `moduleId === 'absentee'` branch. Unknown `currentScreen` shows the existing dashboard empty path, not a fake count. |
| `PayrollDeskView.tsx` | Generate payslip | No new buttons. The slip it generates uses the monthly summary. Finance manager needs `staff_attendance` view on the default finance template so the summary request stops returning 403. Add that one key to `ROLE_DEFAULT_TEMPLATES.finance_manager` in both `access.ts` files. |

---

## Phase 0 — Persist, campus date, and the permission holes

**Goal:** Existing buttons save, and “today” is the same day on every desk.

### Backend

In `packages/backend/src/services/store.ts`, call `this.schedulePersist()` at the end of:

- `createRoom`
- `createComplaint`
- `updateComplaintStatus`
- `logParentResponse`
- `scheduleRetentionMeeting`
- `createWhatsAppTemplate`
- `updateWhatsAppTemplate`
- `deleteWhatsAppTemplate`
- `logWhatsAppDispatch`

Replace campus-date reads in the functions listed in section 0 with `campusToday(tenantTimezone)`.

`GET /api/v1/geofence/attendance/staff/me?date=` returns the caller’s own record or `null`. Any authenticated staff role may call it. Students and parents receive 403. It does not return other people.

`GET /api/v1/geofence/attendance/staff` stays `staff_attendance` view.

Teacher default template does not gain the full roster. Academic head default template gains `staff_attendance: 'view'` so the academic head can see the roster. Finance manager default template gains `staff_attendance: 'view'`.

### Frontend

- `TeacherPortalView` `fetchTodayAttendance` calls `/me`.
- `campusToday()` is the default date in `AbsenteeRetentionDeskView`, `StaffClockInView`, and `DashboardView`.
- Remove the Sir Tariq name branch.
- Remove `geofence_status.clocked_in_at \|\| '08:24 AM'` and `distance_meters \|\| 18` in `getTeacherPortalOverview`. Missing punch returns `is_clocked_in: false`, `clocked_in_at: null`, `distance_meters: null`.

### Tests — `packages/backend/tests/daily_ops_modules.test.ts`

1. Create a complaint, restart is simulated by `snapshotState` + a new store `applySnapshot`, ticket is still there. Same for `logParentResponse`, a room, and a WhatsApp template.
2. `campusToday` at `2026-09-24T20:30:00.000Z` (01:30 next day in Karachi) is `2026-09-25`.

**Done when:** those two tests pass, and `npx vitest run tests/phase3_operations.test.ts tests/phase6_whatsapp_absentee.test.ts tests/staff_management.test.ts` still passes.

---

## Phase 1 — Timetable buttons do the whole period

**Files:** `packages/backend/src/routes/timetable.ts`, `store.ts` timetable methods, `packages/shared-types/src/index.ts` (`TimetableSlot` already has the fields), `TimetableDesk.tsx`, `DashboardView.tsx`, `getTeacherPortalOverview`, `getStudentParentPortalOverview`.

### API

- `PATCH /api/v1/timetable/:id` and `PATCH /api/v1/timetable/timetable/:id`. Body is the same Zod object as create. `timetable` edit required. Runs `checkCollision` with `excludeSlotId`. Rewrites hydrated names.
- `POST /rooms` persists (Phase 0). Add `PATCH /rooms/:id` (name, capacity, is_active) and `DELETE /rooms/:id`. Delete returns 409 when any slot still has that `room_id`.
- `POST /:id/substitute` already accepts `date` and `reason`. Require the UI to send them. Substitute collision stays teacher-only.
- `checkCollision` converts both times with `parseTimeToMinutes`. A slot ending at or before the other starts is free (`startA < endB && endA > startB` in minutes).
- `getAvailableTeachers` returns teaching staff as defined in section 1.1. Busy means overlap on that weekday, using the substitute for `date` when `date` is passed.
- `getTeacherPortalOverview.today_schedule` is slots where `day_of_week === campusDayOfWeek(campusToday)` and (`teacher_id === teacher` or today’s substitution names this teacher). Sort by `start_time`. Apply the substitution overlay the student portal already applies.
- `deleteTimetableSlot` stays a hard delete. The new Remove button calls it.

### Desk behavior

- `selectedDay` initial state is campus weekday if it is Monday–Saturday, else `all` on Sunday so a Sunday-closed academy is not an empty Monday.
- Sunday exists in `DAYS`.
- Room `<select>` always renders. First option: “Batch room”. Options are `getRooms`. Creating a room is a small inline row under the select: name, capacity, Add room. That is the only new control. It calls POST `/rooms`.
- Edit opens the same sheet with the slot’s values and sets `editingSlotId`. Confirm calls PATCH.
- Card Remove uses a confirm sheet, then DELETE, then `fetchBaseData()`.
- Substitute sheet adds `<input type="date">` default campus today and `<input type="text">` reason. POST body includes both.
- “Single-Room Default Active” copy is removed.

### Dashboard

`fetch('/api/v1/timetable?day=' + campusWeekday)`. The card count and the grid use that response only. Room label: `slot.room_name || batch.room_number || 'Room not set'`.

**Done when:** a test creates `09:00–10:00` and rejects a second slot `09:30–09:45` for the same batch; edit moves the first slot to `11:00–12:00` and the second then saves; teacher overview on a Thursday does not include a Monday slot; delete returns 404 the second time.

---

## Phase 2 — One staff-attendance truth, and payroll reads it

**Files:** `store.ts` (`staffClockIn`, `staffClockOut`, `reviewStaffLeave`, `reviewStaffRegularizationRequest`, `manualStaffAttendance`, `evaluateHead`, `generatePayslip`, `getStaffMonthlySummary`), `geofence.ts`, `packages/frontend/src/lib/access.ts`, `packages/backend/src/lib/access.ts`, `PayrollDeskView.tsx` only if the summary request needs no UI change (it should not), `StaffClockInView.tsx` only for the `/me` refresh after clock-in.

### Status map

`evaluateHead` returns `StaffAttendanceStatus` only:

- head category `present` → `on_time`
- `late` → `late`
- `half_day` → `half_day`
- `leave` → `on_leave`
- `absent` → `absent`

### Clock and leave

- Second clock-in the same campus day, while the first session is still open, returns the existing record and does not pretend a new arrival. The response includes `already_open: true`. The UI shows “Already clocked in at {time}”.
- A new session after a real clock-out still works (the current multi-session path).
- `reviewStaffLeave` when `approved` writes one `StaffAttendanceRecord` per campus date in the leave range that is not Sunday, status `on_leave`, `verification_mode: 'manual_regularization'`, `admin_adjusted: true`, unless a geofence punch already exists that day (leave does not erase a punch). Reject does not write rows.
- Decrement `metadata.leave_balance`. Casual reason decrements `casual_used`, sick decrements `sick_used`, anything else `annual_used`. If `used + days > allowed`, reject the approval with `INSUFFICIENT_LEAVE`. The leave request already has a reason field; map `sick` / `casual` by case-insensitive contains, else annual.
- `reviewStaffRegularizationRequest` approval calls `manualStaffAttendance` with the request’s clock times and `head_id` from the review body. Status comes from that head. It must not hardcode `on_time`.

### Payslip

`generatePayslip` calls `getStaffMonthlySummary` for that staff id and month. It copies:

- `working_days` ← `total_working_days` (not `26`)
- `present_days` ← `present_days + late_days`
- `late_count` ← `late_days`
- `absent_days` ← `absent_days`
- `approved_leaves` ← `leave_days`
- `hours_or_lectures` ← `Math.round(total_work_minutes / 60)` (not `presentDays * 2`)

Half days stay in the summary’s `half_days`. For pay, an unpaid half day counts as `0.5` absent-equivalent. Unpaid means the attendance head used that day has `paid: false`. If the record has no head, `on_leave` is paid, `absent` is unpaid, `half_day` is half paid.

Add one deduction line when the unpaid equivalent is `> 0`:

- name `Attendance deduction`
- quantity = unpaid day equivalent
- unit_rate = `profile.base_amount / working_days` (0 if working_days is 0)
- Do not add it again if `data.deductions` already contains a line whose name is `Attendance deduction`.

`late_penalty_rule`:

- `none` or missing: no extra late deduction.
- `deduct_half_day_salary`: for each group of `lates_for_leave_deduction` lates, add half a day to the unpaid equivalent.
- `deduct_full_day_salary`: same group, add one unpaid day.
- `deduct_casual_leave`: add those groups to `casual_used` and do not add salary deduction. Cap at the remaining casual balance; leftover groups become unpaid days.

The payslip screen’s existing monthly fetch is the same function, so the table and the slip match.

**Done when:** a test clocks a teacher out after 3 hours with a half-day head, monthly summary `half_days === 1`, generated slip `working_days` is the Sunday-excluded count, and net pay is base minus half a day. A second test approves a 2-day casual leave and `casual_used` increases by 2. Finance manager `can(user, 'staff_attendance', 'view')` is true on the default template.

---

## Phase 3 — Absence follow-up uses the real student

**Files:** `store.ts` absentee and WhatsApp methods, `absentee.ts`, `AbsenteeRetentionDeskView.tsx`.

### Roster sync

`syncDailyAbsenteeRoster` for each attendance row with `status === 'absent'`:

- Find the enrollment for `att.enrollment_id` or (`student_id` + `att.batch_id`).
- `batch_id`, `batch_name`, `roll_number`, `admission_number` come from that enrollment and the student. Never `'batch-1'`, `'N/A'`, or `'+923000000000'`.
- `guardian_phone` is `student.guardian_phone`. If it is empty, still create the row and leave the phone empty. The WhatsApp button is disabled and shows “No guardian phone on file”.
- `backup_phone` is `student.guardian_whatsapp` only when it is non-empty and not equal to `guardian_phone`. Otherwise `null`.
- `consecutive_days` is 1 plus the count of immediately previous campus dates that also have an absent attendance or an open follow-up, walking backward. A gap of one present or unmarked day resets to 1.
- If the attendance row is no longer `absent` (present, late, excused), set the follow-up of that student+date+batch to `RESOLVED_EXCUSED` when the new status is `excused`, otherwise delete the follow-up if it is still `PENDING` and has no `call_outcome`. A follow-up that already has a call stays, with `parent_remarks` prefixed by the existing “Attendance revised to …” sentence.
- `getAbsenteeFollowups` does not return snoozed rows unless `status=SNOOZED` or `include_snoozed=1`. Snooze is `is_snoozed && snooze_until >= date`.

### Save Call Record

`logParentResponse` persists (Phase 0) and:

- When `convert_to_medical_leave` is true, create a `LeaveApplication` with `start_date = followup.date`, `end_date = expected_return_date || followup.date`, `status: 'approved'`, `reason` from the category and remarks, `student_id` set. Then run the same excuse loop `reviewLeaveApplication` already runs, and resolve follow-ups on those dates to `RESOLVED_EXCUSED`.
- `FEE_DISPUTE` does not open a new screen. The row shows the student’s current unpaid balance from the same invoice match the fee desk uses (`tenant_id` + `student_id`). Add `unpaid_balance` on the follow-up DTO. The row renders it under the reason when the category is `FEE_DISPUTE`.

### Retention

`refreshRetentionCases(tenantId)` runs at the end of sync:

- For each active enrollment, compute this month’s attendance percent the student portal already computes (excused does not count against them).
- Open a case when consecutive absences `>= 3` OR month percent `< 75` with at least 4 marked days.
- Risk: `CRITICAL` if consecutive `>= 5` or percent `< 60`, `HIGH` if consecutive `>= 3` or percent `< 75`, else do not open.
- Upsert by `student_id + batch`. Do not duplicate. Do not reset a `SCHEDULED` case to `OPEN`. Set `RESOLVED` when the student is back under the threshold for the current month.
- The Bilal seed may remain for old tests. The refresh must not delete a case whose id is `ret-1`. New cases use UUID.

`scheduleRetentionMeeting` persists.

### WhatsApp copy

`buildDynamicMessage` fills only:

`student_name`, `admission_number`, `roll_number`, `batch_name`, `guardian_name`, `current_date`, `academy_name`, `academy_phone`.

Remove `due_amount`, `due_date`, `exam_title`, `obtained_marks`, `total_marks`, `percentage`, and the hardcoded `teacher_remarks` from the absence builder. Template save persists.

`logWhatsAppDispatch` persists and only runs when the client posts after a successful `window.open`. The desk posts to the existing dispatch endpoint only then.

### Report

The roster options menu gains one item, “This month’s report”, under Module Views. It calls `GET /api/v1/absentee/reports/resolution?month=YYYY-MM` and shows the existing KPI card row plus the reason breakdown. No new page.

**Done when:** a test marks a second-class enrollment absent, the follow-up batch is the evening class, phone is the guardian’s real phone, backup is null, a present the next day then an absent makes `consecutive_days === 1`, medical convert creates an approved leave, and a snapshot round-trip keeps the call log.

---

## Phase 4 — Homework and notebook

**Files:** `homework.ts`, `store.ts` homework methods, `HomeworkDesk.tsx`, `getStudentParentPortalOverview` (already attaches checks; keep that).

### API

- `PATCH /api/v1/homework/:id` and the doubled path. Same Zod as create. `homework` edit. Batch scope checked. Rehydrate batch and subject names. `teacher_id` stays the original author. `teacher_name` is `user.full_name` of that author, looked up on create and on patch. Never `email.split('@')[0]`.
- `DELETE /api/v1/homework/:id` removes the assignment and its `notebookChecks`. 404 when missing. Scope checked.
- `recordNotebookChecks` rejects a student who does not have an active enrollment in the assignment’s batch (`400 STUDENT_NOT_IN_CLASS`).
- If the assignment id does not exist, return 404 before writing checks. The current `if (hw && !scope)` skip is removed.
- Student `GET /homework` uses `user.student_id` / `metadata.student_id` / `student.user_id`. It does not compare emails. Returns assignments for the requested enrollment batch, or the primary enrollment when no `batch_id` is passed.
- Parent `GET /homework` resolves children the same way `getStudentParentPortalOverview` resolves a parent (guardian CNIC). Email and phone matching in `homework.ts` is removed. A parent asking for a batch none of their children attend gets 403.

### Desk

- Card Edit and Delete as in section 1.4.
- Inspection roster: `GET /api/v1/sis/students/:id/enrollments` is too heavy. Add `GET /api/v1/homework/homework/:id/roster` returning active enrolled students for that assignment’s batch (`id`, `full_name`, `admission_number`, `roll_number` from the enrollment). The desk uses this instead of `GET /api/v1/sis/students?batch_id=`.
- Local check state starts empty. Buttons paint only after a click or after a saved check loads. Loaded check fills status and remarks.
- Save sends the set rows only.
- Create form blocks due date `<` assigned date.

### Teacher name on create

`createHomework` sets `teacher_name` from the user record’s `full_name`.

**Done when:** a test patches a title, deletes it, sees the checks gone, records a check for a student not in the class and gets 400, and a parent CNIC login receives the child’s class homework without an email on the user.

---

## Phase 5 — Feedback tickets that survive and stay private

**Files:** `complaints.ts`, `store.ts` complaint methods, `packages/shared-types` `ComplaintTicket`, `ComplaintsDeskView.tsx`.

### Fields

Add optional `student_id`, `student_name`, `batch_id`, `batch_name` on `ComplaintTicket`. Old tickets keep working with those fields missing.

### API

- Create persists (Phase 0). `user_name` is `full_name` from the user record, then email, then “User”. Never only the email prefix when `full_name` exists.
- Staff may send `student_id`. Verify the student is in the tenant and copy name and primary batch. Parents and students: set `student_id` from their own child link and ignore a body `student_id` for a different child.
- `GET` for student/parent returns their tickets with `internal_notes` and `resolved_by` removed.
- `PATCH` still requires `complaints` edit.
- Update persists.

### Desk

- `canEdit = can(complaints, 'edit')` using the same access helper the frontend already uses (`resolveUserAccessMap` / the user access object on the auth context). Do not use `isStaff` for the edit form.
- Staff New Ticket shows Student select populated from `GET /api/v1/sis/students` (staff-only, already). Optional.
- Search includes `student_name` and `batch_name`.

**Done when:** a parent GET of their ticket has no `internal_notes` key, a snapshot round-trip keeps a resolved reply, and a teacher with view-only receives 403 on PATCH.

---

## Phase 6 — Staff directory is the person the other desks use

**Files:** `academic.ts` staff list filter, `store.ts` `createStaff` / `updateStaff` / `deleteStaff`, `getAvailableTeachers`, `StaffDeskView.tsx`.

### Filters

Replace the department-name buckets in `GET /api/v1/academic/staff` with the role rules in section 1.6. Query values stay `Teaching Faculty`, `Administration & Accounts`, `Support Staff` so the current frontend query strings can stay, but the frontend labels already say Teaching Faculty / Admin & Accounts / Support Personnel. Point the frontend filter at `role` client-side if the request already returns the full list (it does) and stop sending the old department assumptions. Prefer filtering the list the page already has, so the API change and the UI change agree.

### Role on create

`createStaff`: `data.role` wins. Department text does not change the role. Default role when omitted is `teacher`.

### Who may open the screen

`academic.ts` staff GET allows `tenant_admin`, `super_admin`, and anyone with `classes` edit (academic head). Mutations stay admin-only. Frontend hides Add, Archive, Delete, Reset Password, and Portal Permissions unless `role` is `tenant_admin` or `super_admin`.

### Delete

`deleteStaff` returns 409 with a message that names the blocker: `timetable`, `homework`, `payslip`, or `attendance`. Check timetable slots (`teacher_id`), homework (`teacher_id`), payslips (`staff_id`) in addition to the existing attendance-marker check.

### Timetable picker

Phase 1’s `getAvailableTeachers` reads `metadata.teaching_assignments` and role. A teacher with no assignment still appears (they can be given a period). A `tenant_admin` without an assignment does not.

### Leave numbers

Dossier employment or compensation tab already has leave fields if they are on the form. If the form does not show them, add three read-only lines on the employment tab: Casual `used/allowed`, Sick `used/allowed`, Annual `used/allowed`. Phase 2 writes `used`. Do not add an edit control for the used count.

**Done when:** staff test 1–16 still pass, a new test creates a Physics-department teacher and the Teaching Faculty filter includes them, and delete of a teacher who owns a slot returns 409 mentioning timetable.

---

## Phase 7 — The other screens that show these records

**Files:** `DashboardView.tsx`, `TeacherPortalView.tsx`, `StudentParentPortalView.tsx`, `AttendanceDeskView.tsx`, `HomeworkDesk.tsx`, `GenericModuleView.tsx`, `App.tsx` only if the fallback must change.

- Dashboard period list and count: Phase 1 rule.
- Dashboard staff “/ 6” fallback: use `totalStaffCount` from the roster. Zero is `0`, not 6.
- Teacher schedule is Phase 1’s filtered list.
- “Active Now” uses campus minutes.
- Mark Attendance and Diary write `sessionStorage` keys `kampus.pendingBatch` and, for diary, `kampus.pendingSubject`. `AttendanceDeskView` on mount, if the key is set, sets `selectedBatchId` and removes the key. `HomeworkDesk` does the same for batch and subject on the new-homework form only when the modal opens from that key; if the key is set on mount, select that batch’s latest assignment when one exists, and remove the key.
- Student portal weekly day control includes Sunday when any returned slot is Sunday. Do not dump the week into today; that path is already correct.
- Remove the absentee fake branch from `GenericModuleView`. The `App.tsx` fallback can keep rendering `GenericModuleView` for unknown ids, but that branch must not claim 28 students.

**Done when:** a Thursday teacher overview fixture with one Thursday slot and one Monday slot renders one row, and the name chip is the user’s `full_name`. This can be a frontend assertion if a test runner exists; otherwise a backend test of `getTeacherPortalOverview` is enough for the data, and the Sir Tariq string is gone from `TeacherPortalView.tsx` (search the file).

---

## Phase 8 — Tests that lock the buttons

Extend `packages/backend/tests/daily_ops_modules.test.ts` so one file runs the Done-when tests from Phases 0–6. Do not weaken `phase3_operations.test.ts`, `phase6_whatsapp_absentee.test.ts`, or `staff_management.test.ts`. If a phase-3 test asserts a string-compare collision that the minutes compare now allows or rejects differently, update that assertion to the minutes rule and leave a comment that the overlap is in minutes.

Run:

```
cd packages/backend && npx vitest run tests/daily_ops_modules.test.ts tests/phase3_operations.test.ts tests/phase6_whatsapp_absentee.test.ts tests/staff_management.test.ts
```

**Done when:** that command exits 0.

---

## Out of scope

- Redesign, new colors, new icon set, Framer Motion, Ionic, Capacitor.
- A real WhatsApp Business API. `wa.me` stays.
- Copy-week, bell schedules, period-by-period student attendance.
- Homework file upload. `attachment_url` may remain unused.
- Rewriting `StaffClockInView` or `StaffDeskView` into smaller files. Only touch the handlers and labels this plan names.
- `school-erp`.
- Student admission, fees, exams, except reading unpaid balance onto a `FEE_DISPUTE` row and reading enrollments for class rosters.
- Deleting the Apex demo seed.

---

## VERIFIER (do not implement)

After Gemini says a phase is done, the reviewer checks the “Done when” tests and these clicks. Failures go back to Gemini as a punch list. The reviewer does not restyle.

### Phase 0

- File a feedback ticket, restart the backend, the ticket is still in the list.
- Log a parent call, restart, the call outcome is still on the row.
- Add a room, restart, the room is still in the timetable dropdown.
- At 12:30am Pakistan time the absence date and the staff roster date are that Pakistan date.

### Phase 1

- Schedule Class: batch, day, 09:00–10:00, subject, teacher, room, Confirm Schedule. Card shows those values.
- Second period 09:30–09:45 same batch: Confirm Schedule stays disabled and the rose conflict banner names the first period.
- Edit the first period to 11:00–12:00. The second period then saves.
- Assign Substitute for tomorrow’s date. Today’s card still shows the permanent teacher. Tomorrow’s teacher portal shows the substitute.
- Remove asks for confirmation, then the card is gone after refresh.
- Dashboard “Periods Today” equals today’s weekday only.
- Teacher “Today’s Teaching Schedule” does not list other weekdays.
- Sunday can be selected.

### Phase 2

- Teacher Clock In on campus, then Clock Out. The widget shows the punch without opening the admin roster.
- Clock In twice: the second click says already clocked in and does not move the arrival time.
- Settings Save Changes still saves the fence and the heads.
- Approve a casual leave. Those dates show Leave on the daily roster. Casual used increases. A geofence punch already on one of those dates stays a punch.
- Approve a regularization that asked for a late head. The row is Late, not On time.
- Generate a payslip. Working days are not 26 unless that month’s Sunday-excluded count is 26. Hours are the punched minutes. An unpaid absence reduces net pay by one day of base.

### Phase 3

- Mark a student absent in Attendance. They appear on Absence Follow-Up for that class and that roll, with the guardian phone from the student profile.
- No `+923000000000` and no `+923210000000` unless that exact number is stored on the student.
- Backup toggle is off when there is no second number.
- Save Call Record with a return date. Reload. The row is snoozed and missing from the default list. Status filter Snoozed shows it.
- Convert to Approved Medical Leave. The attendance register shows excused, and a leave exists for that range.
- Three consecutive absent days open a retention case. One present day between absences does not show “Day 2”.
- Open WhatsApp uses the student’s name and class. It does not say Term Assessment or Rs. 0.
- Save Template, restart, the template is still in the list.
- This month’s report renders the reason counts.

### Phase 4

- Assign Homework. The card’s teacher is the staff full name.
- Open the roster. A student whose only enrollment is another class is absent from the list.
- Done / Incomplete / Missing start unselected. Not checked count equals the class size.
- Save Inspection. Reload. The same buttons are selected. The student portal homework row shows that status.
- Edit the title. Delete removes the card and the checks.
- Due date before assigned date does not submit.

### Phase 5

- Parent New Ticket, then View Ticket. Internal notes typed by an admin are not in the parent JSON and not on the parent screen.
- Admin Save Resolution, restart, the reply is still there.
- Teacher without complaints edit sees View Ticket, not the status dropdown.
- Optional student on a staff ticket shows that student’s name on the card.

### Phase 6

- Add Staff with department Physics and role Teacher. They appear under Teaching Faculty.
- Teaching Workload save. That teacher is in the timetable faculty list at a free time.
- Academic head can open Staff and cannot see Delete or Reset Password.
- Delete is refused while the teacher has a period, with the word timetable in the error.
- Leave lines on the employment tab match the numbers Phase 2 changed.

### Phase 7

- Teacher name chip is their real name.
- The period happening now is the one badged Active Now.
- Mark Attendance on a period opens the attendance desk on that batch.
- Diary opens homework on that batch.
- Dashboard staff total is the roster count.
- No screen says “28 students pending follow-up”.
