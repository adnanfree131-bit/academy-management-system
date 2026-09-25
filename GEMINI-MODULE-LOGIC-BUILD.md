# GIVE THIS WHOLE FILE TO GEMINI

Attach or paste this entire markdown file. Use this as the first message:

> Implement **one phase only**, starting at Phase 1 if it is not already done. Read that phase’s “Done when” list and stop. Do not start the next phase. Follow section 0 on every line you touch. Work only in `packages/backend`, `packages/frontend`, and `packages/shared-types`. After the phase, run the tests named in that phase from `packages/backend` with `npx vitest run <file>`.

Then send the rest of this file. Do not summarize it. File paths, field names, and the sentences already on screen are the spec.

**Product:** Kampus / Apex Academy SIS. Live app is `packages/backend` + `packages/frontend`. Live data is the JSON snapshot in `packages/backend/src/services/store.ts` (`kampus_store_snapshot`). The SQL files under `packages/supabase` are not the database these screens use. Do not add SQL tables. Do not migrate the snapshot.

**Do not touch:** `school-erp`, `JWT_SECRET`, Render, Cloudflare, `.env`, `DashboardView.backup.tsx`, `Sidebar.backup.tsx`. Do not delete `seedTestData()`. Do not remove the doubled routes (`/api/v1/homework` and `/api/v1/homework/homework`, and the same pattern on timetable, exams, finance, saas, complaints, geofence). Frontends keep calling the path they call today.

---

## 0. Design and wording — this overrides every phase

The job is to make the existing workflow tell the truth. It is not a redesign.

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
14. A student in two classes is two `StudentEnrollment` rows. Class-scoped attendance, homework, and timetable use `enrollment.batch_id` and `enrollment.roll_number`. `student.batch_id` is only the primary class.
15. Every store mutation this plan names calls `this.schedulePersist()` before return.

---

## Phase 1 — Sign-in tells the truth

**Files:** `packages/frontend/src/components/LoginModal.tsx`, `packages/frontend/src/context/AuthContext.tsx`, `packages/backend/src/services/auth.ts`, `packages/backend/src/routes/auth.ts`.

### 1.1 No fake academy on a host that has no campus

`LoginModal.tsx` around 449–461: when `tenantSlug` is empty, the header still paints “The Smart Academy” and `tsa.kampus.pk`. Login then calls `loginWithPassword` without `tenant_slug`, and the API returns `Academy identifier (tenant_slug or tenant_id) is required.`

Required:

- Slug still comes only from `?campus`, `?subdomain`, or a real `*.kampus.pk` / `*.toolnestr.com` host, skipping `www`, `edu`, and `app`. Do not invent a slug from the painted label.
- When `isPlatformSignIn` is true (no slug), do not show “The Smart Academy” or `tsa.kampus.pk`. Leave the existing “Sign In” heading. Omit the domain chip. Do not add a new panel.
- When a real slug is present, keep today’s branding fetch and today’s academy name.
- The hardcoded platform email that skips the tenant check in `auth.ts` / `services/auth.ts` stays. Do not print that email in the UI. Do not add another exception.

### 1.2 Stop printing the default password

In `LoginModal.tsx` the forgot-password card (step `contact_admin_forgot_password`, around 1231–1234) renders `Default Password` / `Student@123`.

Required:

- Delete that one row only. Keep Campus Office, Office Timings, Username “Father / Guardian CNIC”, the amber note, and the existing “Return to Sign In” button (`bg-amber-600 hover:bg-amber-700`).
- Do not add password-policy copy. Do not change `Student@123` / `Parent@123` creation in `store.ts` in this phase. `must_change_password` stays.

### 1.3 One password length

`StudentParentPortalView.tsx` `handleChangePassword` allows 6 characters. `ForcePasswordChangeModal.tsx` requires 8, and a new password different from the current one.

Required:

- The portal form uses the same two checks as `ForcePasswordChangeModal`: at least 8 characters, and not equal to the current password. Keep the existing inputs and the existing error paragraph. Change only the condition and the existing error sentence to “New password must be at least 8 characters long.”
- Do not restyle either modal.

**Done when:**

- Opening `http://127.0.0.1:5173/` with no `?campus=` shows Sign In and does not show `tsa.kampus.pk`.
- Forgot password does not contain `Student@123`.
- A new test file `packages/backend/tests/module_logic_repairs.test.ts` asserts login without `tenant_slug` or `tenant_id` returns 400 `TENANT_REQUIRED`, except the existing platform-email path if that path is still in `auth.ts`. Run `npx vitest run tests/module_logic_repairs.test.ts` from `packages/backend`.

---

## Phase 2 — Student and parent portal pages that already exist

**Files:** `packages/frontend/src/views/StudentParentPortalView.tsx`, `packages/frontend/src/App.tsx`, `packages/frontend/src/lib/portalAccess.ts`, `packages/frontend/src/components/Sidebar.tsx`, `packages/frontend/src/components/MobileBottomNav.tsx`, `packages/backend/src/routes/portal.ts`, `packages/backend/src/services/store.ts` (`getStudentParentPortalOverview` and the student bind in `getStudentParentPortalHandler`).

The overview is the live page. These blocks are already in the same file and do not open today, because their buttons call `handleNavigateScreen('timetable' | 'attendance' | 'voucher' | 'homework' | 'exams')` and `canOpenScreen` allows a student or parent only `student_portal` and `complaints`:

- `currentView === 'timetable'` around line 1123
- `currentView === 'attendance'` around line 1224
- `currentView === 'voucher'` around line 1382
- `currentView === 'homework'` around line 1666
- `currentView === 'exams'` around line 1783

`forcedTab` is never passed. Do not add a prop from `App.tsx`.

### 2.1 Open the existing blocks locally

Required:

- Add one `useState` in `StudentParentPortalView` for the inner view: `'student_portal' | 'timetable' | 'attendance' | 'voucher' | 'homework' | 'exams'`. Default `'student_portal'`.
- Overview buttons that currently call `handleNavigateScreen` for those five ids set this state instead. Sidebar and `MobileBottomNav` items for a student or parent that already say Timetable, Attendance, Challans, Homework, and Exams set the same state. Do that by passing a callback from `App.tsx` into the portal, or by letting those nav clicks set `currentScreen` to those ids **only while the rendered view stays `StudentParentPortalView`**. Do not mount `TimetableDesk`, `FeeDeskView`, `HomeworkDesk`, `ExamDeskView`, or `AttendanceDeskView` for a student or parent.
- `canOpenScreen` for `student` and `parent` may allow those five screen ids **only** so the shell can remember them. `App.tsx` must still render `StudentParentPortalView` for those ids, never the staff desks. `complaints` stays `ComplaintsDeskView`.
- Each inner view gets one text button, same classes as “View Full Attendance History”, label “Back”. It returns to `'student_portal'`. Do not add a tab bar, icons, or a new heading.
- Do not change the markup inside the five blocks except the logic bugs in 2.3–2.6.

### 2.2 Bind the logged-in student to the right record

`portal.ts` around 96–117: if `user_id` and email miss, the handler matches roll number, admission number, or guardian CNIC and then writes `user_id` onto that student.

Required:

- Student role binds only `student.user_id === user.sub`, then exact `student.email === user.email`. If neither matches, return 403 `STUDENT_UNLINKED`. Do not scan by roll, admission number, or guardian CNIC. Do not write `user_id` onto a different student.
- Parent bind stays guardian CNIC, guardian email, and guardian phone, as it is now. Do not add father/mother CNIC fields in this phase.
- If the requested `student_id` is not the bound student (student role) or not in the linked children (parent role), keep the existing 403.
- If the first linked child is `portal_blocked`, skip that child and open the next linked child. Return `NO_LINKED_CHILDREN` only when every linked child is blocked or the list is empty. Still return `linked_children` for the ones that are not blocked.

### 2.3 Class switcher

The header switcher is already live. Keep it.

Required:

- The select lists only enrollments whose status is `active` or `on_leave`. A withdrawn, archived, or alumni class is not a choice.
- Timetable, homework, and attendance follow `enrollment_id`, which the overview already does.
- The headline unpaid balance on the overview stays the student total (all classes). The class switcher must not look like it changed that total. Do not add a caption. The per-class `unpaid_balance` already on each enrollment may stay in the data. Do not show cancelled invoices inside a child card: child-card unpaid uses the same status filter as `getStudentParentPortalOverview` (exclude `voided` and `cancelled`).

### 2.4 Attendance numbers on the overview

`store.ts` around 11386–11407 and the overview around `StudentParentPortalView.tsx` 335–342 and 686–694.

Required:

- Monthly percent uses the current campus month only. If that month has no countable marks, the percent is absent from the payload (`null`), and the overview shows “Not marked”, not 100%.
- Countable marks: `present` and `late` count as present. `half_day` counts as half (0.5) if the status exists, otherwise do not call it present. `excused` is excluded from the denominator. `absent` counts in the denominator.
- “This Month” uses the month records, not the 15-row preview. The 15-row list stays the recent list. Do not relabel it.
- Leave submit stays `POST /api/v1/attendance/leaves`. After success, the overview refetches so the pending leave is visible without opening another product. The existing attendance block already renders review notes. Once 2.1 opens that block, those notes show. Do not add a new notice component.

### 2.5 Fees on the overview

Required:

- Balance uses `balance_due` if it is a number, otherwise `balance_amount`. Phase 4 makes those two fields match. Until then, read `balance_amount` when `balance_due` is missing.
- Zero invoices and a zero balance shows the existing empty sentence already used for receipts (“No payment receipts recorded yet.”) in the fee area, not “All Paid” and not “All tuition fees are paid. Thank you!”.
- A real zero balance with at least one challan may keep “Fee Status: Fully Cleared”.

### 2.6 Homework preview and exam score

Required:

- The three homework cards on the overview show the existing check status text the diary already uses (`pending`, `done`, `incomplete`, `missing`). Do not invent labels.
- The exam card does not say “Latest Exam” unless the row is the one with the greatest exam date. Sort published cards by exam date descending and show the first. Rank stays the rank already stored. Do not recompute rank in the React file.

### 2.7 Feedback from a parent

`ComplaintsDeskView.tsx` posts a ticket with no `student_id`. `complaints.ts` then attaches `children[0]`.

Required:

- When the signed-in role is `parent` and the portal has a selected student, the New Ticket request includes that `student_id`. The desk already can read the current screen’s student from the hash `student_id` or from the portal selection stored before navigation. Use the student id already in component state or the hash. Do not add a child picker.
- If no child is selected, keep attaching the first linked child. Do not change the form layout.

**Done when:**

- As a student, Timetable, Attendance, Challans, Homework, and Exams in the existing portal file render, and the staff desks do not.
- A student token cannot load another student’s id (`403`).
- Two students with the same roll number do not steal each other’s `user_id`.
- A month with no attendance does not return `100`.
- Tests added to `tests/module_logic_repairs.test.ts`. Run that file.

---

## Phase 3 — Seats, opening challan, and a failed challan after save

**Files:** `packages/backend/src/services/store.ts` (`updateStudentStatus`, `createStudent`, enrollment create, `generateInvoice` / installment billing around 3874).

Required:

- `waitlisted` releases the seat the same way `withdrawn` does: enrollment status for that student becomes `withdrawn` or the seat is not counted, `recalculateBatchSeats` no longer counts them, and `portal_blocked` is set. Portal login for that student returns the existing blocked message.
- Do not backfill a waitlisted student who has no enrollment row as `active`.
- `on_leave` keeps the seat and keeps the portal open. Do not change that.
- A first installment whose amount is `0`, and which has no other lines, creates no invoice. It does not bill PKR 1000. Delete the `|| 1000` fallback.
- If admission or Add Class has already saved the student or enrollment and challan generation throws, the API response is success for the student **and** `challan_error` with the error message. The UI already shows the save result. Surface `challan_error` in the existing error paragraph of that form. Do not add a toast.
- Promotion capacity counts enrollments that are `active` or `on_leave`. An on-leave student cannot be moved into a full section.

**Done when:** tests in `tests/module_logic_repairs.test.ts` cover waitlisted seat count, no PKR 1000 invoice, and promotion blocked by an on-leave occupant. Run that file. Do not use `vitest -t` on `student_enrollment_multi_class.test.ts`.

---

## Phase 4 — Fee money

**Files:** `packages/backend/src/services/store.ts`, `packages/backend/src/routes/finance.ts`, `packages/frontend/src/views/FeeDeskView.tsx`, `packages/frontend/src/views/FeeChallansView.tsx`, `packages/frontend/src/views/FeeReversalsView.tsx`.

Do not change the cashier layout, challan print CSS, or button labels.

### 4.1 One balance

After every change to an invoice (payment, void, concession, edit, cancel, delete restore):

- Set `net_amount`, `net_total`, and `total_amount` to the same net.
- Set `balance_amount` and `balance_due` to the same balance (`net - paid`, never below 0).
- Set each line’s `balance_due` the same way.
- Status is `paid` only when balance is 0 **and** `paid_amount > 0`. A zeroed edit with nothing paid is `unpaid` if any original line remains, or the edit is rejected with the existing validation error if the client sends an empty item list. Do not mark it `paid`.
- A concession updates the header fields above, not only `balance_amount`.

### 4.2 Receipts

- An allocation on one head cannot exceed that line’s `balance_due`. Reject the payment with the existing validation shape if it would.
- `is_override` requires a non-empty `override_reason`. The fee desk already has a reason field on related dialogs. Use the reason field that is already next to the advance control. If that control has no reason input, add one input with the same classes as the notes input in that same dialog. Label: “Reason”.
- Family cheque sends `cheque_number` the same way a single cheque already does. The store keeps rejecting a cheque with an empty number.
- If a later child in a family receipt fails, roll back installment flags that this request flipped to `paid`, not only the invoices.
- Invoice and receipt numbers are not `count + 1` after deletes. Use a stored counter on the tenant or the max existing suffix + 1. A deleted number is not reused.

### 4.3 Challans

- `FeeChallansView` “already billed” is per `student_id` **and** `enrollment_id` (or batch when the invoice has `batch_id`). One class’s challan does not hide the other class.
- A student with installment amount 0 is skipped inside a batch, with their name in the existing batch result list. The rest of the batch continues. No PKR 1000.
- Deleting an installment challan sets that milestone back to `pending`.
- Cancel of a challan that rolled an older balance forward restores the older challan to `net - already paid`, not the full net.
- `GET /api/v1/finance/discounts` requires `voucher` view. Students and parents get 403.

### 4.4 Reversals desk copy

`FeeReversalsView.tsx` around 461 says receipts were deleted when the server did not delete them.

Required:

- Success text matches the call. Reverse: keep the existing reverse sentence if it says the receipt was reversed. Delete of an unpaid challan: “Challan deleted.” Do not say receipts were deleted.
- Do not add a cancel button on this desk.

**Done when:** tests in `tests/module_logic_repairs.test.ts` cover concession updating `balance_due`, empty-line edit not becoming `paid`, second-enrollment month not treated as billed, discount list 403 for a student token, cheque family payment storing `cheque_number`. Run that file.

---

## Phase 5 — Examinations

**Files:** `packages/frontend/src/views/ExamDeskView.tsx`, `packages/backend/src/routes/exams.ts`, `packages/backend/src/services/store.ts` (`evaluateStudentExam`, report card, import).

Do not redesign the marking screen. Fix the data and the one broken text node.

Required:

- The on-screen grade uses the same scale the store saves. If `tenant.settings.grading_scale` exists, both use it. Otherwise both use the store’s existing scale (80 A+, 70 A, 60 B, 50 C, 40 D, 33 E, else F). Delete the separate 90/A* ladder in `ExamDeskView.tsx` around 284–290. The label on screen is the grade that will be saved.
- Around line 1263, the badge is a JSX expression, not a string. Unanswered, Correct, and Incorrect stay the words already inside that string. The element keeps its existing color classes.
- `GET /api/v1/exams` and `GET /api/v1/exams/:id` do not include `correct_option` unless `can(user, 'exams_bank', 'view')`. Strip it from nested questions the same way a dedicated question route should. Students and parents never receive `correct_option`.
- `GET /api/v1/exams/:id/report-card/:studentId` does not include `correct_option` for `student` or `parent`. Staff who lack `exams_bank` view also do not receive it.
- `GET /api/v1/exams` for a teacher is limited to `batchScope`, the same scope evaluate already uses.
- Short score is capped at `short_total_marks`. Long score is capped at `long_total_marks`. A value over the cap is a 400 with the existing validation message shape, not a silent trim that hides a clerk’s mistake. Say “Short marks cannot exceed the short total.”
- A student with no evaluation is not invented as rank 1. The report-card response for that student is 404 with “Result is not published.” The desk shows that sentence in the existing error text. Do not add a fake F row.
- Excel/CSV import: a blank MCQ key is rejected for that row, not stored as `A`. Split columns on a delimiter the importer already documents. If it splits on commas, do not split a quoted field. A row that shifts columns is skipped and named in the existing import result, not saved with the wrong key.
- Do not add chapter, delete-question, or attach-bank buttons in this phase.

**Done when:** a student token `GET /api/v1/exams` has no `correct_option`. A percentage of 85 saves `A+` when no custom scale is set, and the desk’s derived grade string is `A+` before save. Tests in `tests/module_logic_repairs.test.ts`. Run that file.

---

## Phase 6 — Payroll and expense vouchers

**Files:** `packages/backend/src/services/store.ts` (payslip generate, mark paid, `createFinancialTransaction`), `packages/backend/src/routes/finance.ts`, `packages/frontend/src/views/PayrollDeskView.tsx`.

Do not change the payslip print layout.

Required:

- If `contract_type` is `per_lecture`, net pay is `unit rate × lecture count` plus earnings minus deductions, not `base_amount` as a monthly salary. If lecture count is missing, reject with “Lecture count is required.” Do not invent a count.
- If `contract_type` is anything else, keep `base_amount + earnings − deductions`.
- The preview in `PayrollDeskView` includes the attendance deduction the server will add, using the same absence, half-day, and late rule the store uses. The number on screen before save equals the net that will be saved when the typed lines are unchanged.
- Do not write `casual_used` onto the user until the slip is marked paid. Generating a slip does not spend leave.
- Marking paid still posts the expense. If no salary account head exists, return 400 “Add a salary head before marking paid.” Do not post under `head-salaries`.
- `POST /api/v1/finance/transactions` requires an `account_head_id` that exists on that tenant and whose type matches the voucher type. Otherwise 400 “Choose an account head.” Do not save “General”.
- Do not add voucher edit or void in this phase.

**Done when:** tests in `tests/module_logic_repairs.test.ts` cover per-lecture net, preview deduction parity can be asserted on the store function directly, casual leave unchanged after generate, and a transaction without a head returns 400. Run that file.

---

## Phase 7 — Desks that already load, but show the wrong fact

No new widgets. Change the value or the date each screen already prints.

### 7.1 Dashboard — `packages/frontend/src/views/DashboardView.tsx`

- “Overdue” counts invoices whose balance is greater than 0 **and** whose due date is before campus today. Other unpaid invoices are not in that count. Keep the word “Overdue”.
- `activeStudents` is the count of `status === 'active'` only. If it is 0, show 0. Do not fall back to `students.length`.
- Capacity does not invent `50` or `40` when the batch has no `max_capacity`. A batch with no capacity is left out of the capacity total. If none have capacity, the capacity line shows “—”.
- The donut uses real student counts per program. A program with no matching section is 0, not 100, and does not absorb `activeStudents`.
- Remove the fallback name “Director Adnan”. If `user.full_name` is empty, show the existing role label already used in the sidebar for that role. Do not type a person’s name.
- Staff on duty stays `on_time`, `present`, `late`, `half_day`. Do not change that.

### 7.2 Timetable — `TimetableDesk.tsx`, `routes/timetable.ts`, `store.ts` `checkCollision`

- Reject create and update when end time is not after start time. Existing collision banner text can say “End time must be after start time.”
- Substitute picker sends `date` (default campus today) on `available-teachers`, matching the save path which already checks that date.

### 7.3 Classes — `AcademicStructureView.tsx`, `store.ts` `createSubjectGroup`

- Saving compulsory subjects: if delete of the old group fails, do not create a second group. Show the existing error text.
- `createSubjectGroup` for type `compulsory` replaces the previous compulsory group for that program instead of inserting another. One compulsory group per class.

### 7.4 Homework — `routes/homework.ts`, `HomeworkDesk.tsx`

- A parent is matched the same way attendance matches a parent: guardian CNIC, guardian email, and guardian phone. Not CNIC only.
- A teacher with no teaching assignment does not open `batches[0]`. The section select is empty and the list is empty. Do not call the API with a section outside `batchScope`.
- Student diary without `batch_id` includes every active or on-leave enrollment, not only the primary. The portal already passes `enrollment_id` once a class is selected. Keep that.

### 7.5 Absence — `routes/absentee.ts`

- KPI and `POST /absentee/sync`, when `date` is omitted, use `campusToday(tenant timezone)`. Do not use `toISOString().split('T')[0]`.
- Do not add a Sync button.

### 7.6 Staff clock — `StaffClockInView.tsx`, `routes/geofence.ts`

- The early-exit value the form sends must be one of the trigger values the save schema already accepts. Change the option value, not the visible label, unless the visible label is the rejected token. Keep the label the clerk already sees if it is plain language.
- A missing month on monthly summary uses campus year-month, not UTC.
- Do not change the built-in campus point in this phase.

### 7.7 Complaints create

- `POST` complaints for a staff user requires `complaints` edit. Students and parents may still create their own ticket. View-only staff do not see New Ticket (hide the existing button when `can` is not edit).

### 7.8 Settings and platform bank

- `GET /api/v1/academic/settings` and `GET /api/v1/academic/academy-settings`: if the role is not `tenant_admin` or `super_admin`, omit bank fields from `settings` (`bank_name`, `account_title`, `account_number`, `iban`, `branch_code`, `raast_id`, and the same keys under `payment_settings`). The rest of settings may stay so desks keep working.
- `GET /api/v1/saas/banking-config` and `GET /api/v1/saas/saas/banking-config` require a live `super_admin`, the same check `PUT` already uses. Do not leave them public.
- Do not change the settings form. Do not force `domain_verified` in this phase.

### 7.9 Teacher reach

- Desktop sidebar already has a Teacher Portal block gated by `role === 'teacher' && !managedStaff`. `isManagedStaff` is true for every teacher, so the block never renders.
- Show that existing block for `role === 'teacher'`. Do not build a second menu. Do not change `isManagedStaff` for other roles.
- `App.tsx` must render `TeacherPortalView` when `currentScreen === 'teacher'` for a teacher. That branch already exists lower in the file (around 483). The earlier branch `teacher && !isManagedStaff` can stay for the other faculty screens. Do not duplicate `TeacherPortalView`.
- Default screen for a teacher stays `dashboard`. Do not change the landing screen.

**Done when:** tests in `tests/module_logic_repairs.test.ts` cover campus-today on absentee KPI (a fixed clock or a pure helper call), homework parent email match, banking-config 401 without a token, and settings GET without bank fields for a teacher token. Run that file.

---

## Phase 8 — What you must not build

This phase is a stop list. If Phase 1 through 7 are done, do not start new work. Do not:

- Restyle login, portal, dashboard, or any desk.
- Add Ionic, a new icon pack, a new empty-state illustration, or a new font.
- Wire `GenericModuleView` to real data. Leave it. Do not link `#mobile` in the sidebar.
- Add copy-week, WhatsApp Business API, bell schedules, or homework file upload.
- Remove doubled routes, `seedTestData()`, or backup view files.
- Print `Student@123` or `Parent@123` anywhere in the UI.
- Put a person’s name in a fallback string.

**Done when:** no code changes. Reply with the list of phases already present in git diff and stop.

---

## Verifier (for the reviewer, not for Gemini to implement)

After each phase, the reviewer checks only that phase:

1. Phase 1: localhost sign-in has no `tsa.kampus.pk` chip and no `Student@123` on forgot password. Amber button classes unchanged.
2. Phase 2: student can open the five existing portal blocks and cannot open `FeeDeskView`. Attendance month with no rows is not 100%.
3. Phase 3: waitlisted student is not holding a seat. No invoice of PKR 1000 from a zero installment.
4. Phase 4: concession changes `balance_due`. Zero-line edit is not `paid`. Student token cannot list discounts.
5. Phase 5: marking badge reads Unanswered / Correct / Incorrect, not the characters `!chosen`. Saved grade matches the on-screen grade. Student exam payload has no answer key.
6. Phase 6: payslip preview net equals saved net. No salary expense under `head-salaries`.
7. Phase 7: dashboard overdue is past due only. No “Director Adnan”. Public `GET /api/v1/saas/banking-config` is 401.
