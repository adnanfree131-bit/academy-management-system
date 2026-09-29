# GIVE THIS WHOLE FILE TO GEMINI

Attach or paste this entire markdown file. Use this as the first message:

> Implement **one phase only**, starting at Phase 1 if it is not already done. Read that phase’s “Done when” list and stop. Do not start the next phase. Follow section 0 on every line you touch. Work only in `packages/backend`, `packages/frontend`, and `packages/shared-types`. After a phase that names tests, run them from `packages/backend` with `npx vitest run <file>` (or `./node_modules/.bin/vitest run <file>` if PATH has no vitest).

Then send the rest of this file. Do not summarize it. File paths, field names, button labels, and the sentences already on screen are the spec.

**Product:** Kampus / Apex Academy SIS. Live app is `packages/backend` + `packages/frontend`. Live data is the JSON snapshot in `packages/backend/src/services/store.ts` (`kampus_store_snapshot`). The SQL files under `packages/supabase` are not the database these screens use. Do not add SQL tables. Do not migrate the snapshot.

**Do not touch:** `school-erp`, `JWT_SECRET`, Render, Cloudflare, `.env`, `DashboardView.backup.tsx`, `Sidebar.backup.tsx`. Do not delete `seedTestData()`. Do not remove doubled routes (`/api/v1/homework` and `/api/v1/homework/homework`, and the same pattern on timetable, exams, finance, saas, complaints, geofence). Frontends keep calling the path they call today.

**What this plan builds:** a student or parent signs in on a phone and the portal feels like a small installed school app: photo, name, class, today’s status, and tap-cards for fees, attendance, timetable, homework, and results. Desktop (≥ 768px) keeps the current portal. Staff desks are unchanged.

---

## 0. Design and wording — this overrides every phase

The job is to make the **student/parent phone portal** feel native. It is not a reskin of the staff SIS. It is not a chat app.

1. **Theme lock.** Keep Kampus classes already on these screens. Login and portal actions that are already `bg-amber-600 hover:bg-amber-700 active:bg-amber-800` stay that. White cards stay `bg-white border border-slate-200 rounded-2xl shadow-xs`. The existing dark fee box stays `bg-slate-900 text-white rounded-2xl`. Do not recolor anything to coral, pink, purple, indigo, teal, or orange from a mockup or from `DESIGN.md`. The live timetable “Full Week Timetable →” link that is `text-indigo-700` becomes `text-slate-900` (same file already uses `text-slate-900` on other “view more” links).
2. **Reference picture (Modychat-style mock).** Copy **structure only**, never its colors, illustrations, or features:
   - Phone-first stacked screens (list, then a detail with a back chevron).
   - Dark identity band + white rounded sheet sitting on it.
   - Circular photo / initial on the home identity and on child rows.
   - Segmented pills for filters (already used for timetable days).
   - List rows: leading mark, title, one-line subtitle, trailing badge.
   - Settings as grouped rows.
   Do **not** add chat, status stories, calls, camera, “Let’s Start”, illustrations, empty-state drawings, gradients, glass, glow, or a second icon pack.
3. Do not introduce a new visual language. No new font. `Inter` and the monospace already on money, rolls, CNIC, and admission numbers stay. Lucide icons already in the file stay.
4. Do not apply `DESIGN.md` as a reskin. If a class already on the screen disagrees with `DESIGN.md`, keep the class on the screen.
5. Do not rename a button, tab, heading, or menu item that already exists unless a phase names the new label. Do not replace operational words with marketing words.
6. New text is one short sentence a parent would say at the gate. Allowed examples already in the product: “Please fill out this field.”, “No payment receipts recorded yet.”, “No classes scheduled for today.”
7. Forbidden wording, even in errors, empty states, comments shown to users, and test names that get printed: muster roll, geofence (clerk-facing label; the route file may keep the name `geofence`), counseling program, journey, experience, unlock, empower, elevate, seamless, robust, streamline, delight, “Let’s”, “You’re all set”, “Nothing here yet”, lorem, and any sentence that explains the product to itself. Do not write “Let’s connect with each other”.
8. Do not add a component library, a chart library, a toast system, Ionic, Capacitor, Framer Motion, React Native, or a new modal shell. Use the existing `useMobileOverlay('sheet', …)` sheets already in `StudentParentPortalView.tsx`. Copy sheet chrome from the leave / change-password / challan sheets already in that file.
9. Do not add features this file does not name. No in-app payment gateway. No push notifications. No student photo upload from the portal (office still sets `photo_url` in `StudentProfileModal`). No year switcher for student/parent (they stay on Active year).
10. Money, dates, roll numbers, admission numbers, and CNIC stay `font-mono` where that element already uses them.
11. Academy calendar date is `Asia/Karachi` unless `tenant.settings.timezone` is set. Use `campusToday` / `campusDayOfWeek` in `packages/frontend/src/lib/campusDate.ts`. Do not add a second date helper. Do not leave a new `new Date().toISOString().split('T')[0]` on a path this plan names.
12. Permissions stay `canOpenScreen` in `packages/frontend/src/lib/portalAccess.ts` and `can(user, feature, level)` in `packages/backend/src/lib/access.ts`. Student/parent screens stay: `student_portal`, `timetable`, `attendance`, `voucher`, `homework`, `exams`, `complaints`.
13. Student and parent password login stays father/guardian CNIC. Staff stays email. Do not make portal login accept student email, roll, or admission number.
14. A student in two classes is two `StudentEnrollment` rows. Portal class switcher already exists. Keep it. Class-scoped timetable, attendance, homework, and exams follow `enrollment_id` / `batch_id`.
15. Every store mutation this plan names calls `this.schedulePersist()` before return.
16. Phone layout is `< md` (768px). Desktop `md+` keeps the current portal layout except where a phase names a shared bug (HALF_DAY type, IDOR, indigo link).
17. At 375px: no horizontal page scroll, bottom nav fully visible, tap targets `min-h-11` (44px) on new/moved controls. Do not add global `!important` CSS. Do not remount the whole app on tab change.
18. Do not edit staff desks (`EnrollmentView`, `FeeDeskView`, `TimetableDesk`, `HomeworkDesk`, `ExamDeskView`, `AttendanceDeskView`, `DashboardView`) except `Header.tsx` / `MobileBottomNav.tsx` / `LoginModal.tsx` / `App.tsx` where a phase names the student/parent branch.
19. Keep the existing mobile shell contract from `GEMINI-MOBILE-NATIVE-SHELL-PLAN.md`: one `100dvh` shell, `main` is the only scroller, bottom nav `pb-[max(0.6rem,env(safe-area-inset-bottom))]`. Do not re-open that shell plan. Do not add a second bottom nav inside the portal.

---

## 0.1 Why the phone portal still feels like a squeezed website

`StudentParentPortalView.tsx` (~2547 lines) is one desktop page with inner views. On a phone it still shows:

- A white office header card with a **rectangular ID-card photo** (`w-14 h-18 rounded-xl`) and a long wrapping sentence of class / section / shift / guardian.
- Four KPI boxes with **two different paddings and radii** (fee box `p-5 rounded-2xl`, the other three `p-3.5 rounded-xl`).
- “Parent Quick Actions” even when the login is a student.
- Full-width grey **Back** bars on timetable / attendance / fees / homework / exams (`w-full py-2 bg-slate-100`).
- **Print Timetable** on a phone.
- Command-palette **Search** and absentee **bell** in `Header.tsx` for student/parent (bell still calls `/api/v1/absentee/kpi`).
- Sibling switcher as wrapping chips; sibling cards use a letter circle and ignore `photo_url`.
- Login is a padded card. Identifier and Sign In are shorter than 44px (`py-2.5`, Sign In `h-8.5`).

Backend already returns what a native home needs: `student_profile.photo_url`, name, admission number, class, section, shift, guardian, `monthly_attendance_pct`, `today_schedule`, `unpaid_balance`, `homework_diary`, `exam_report_cards`, `recent_attendance`, `enrollments`, `linked_children`.

School apps that families actually open on a phone (PowerSchool StudentVUE / ParentVUE, Teach ’n Go, Classter, Skodefy, Fedena parent login, typical Pakistani academy apps) put **identity first** (photo + name + class), then **four taps** (fees, attendance, timetable, results/homework), then **today’s list**. ClassDojo’s lesson is one-thumb, three taps — not a new chat product.

---

## 1. Current truth (keep these controls)

Gemini keeps every row. “Required change” is the work of later phases. “Keep” means the control stays with the same label.

### 1.1 Login — `packages/frontend/src/components/LoginModal.tsx`

| Control | Today | Required change |
|---|---|---|
| Outer wrap `min-h-[100dvh] bg-slate-50 sm:bg-slate-100 flex items-center justify-center p-3 sm:p-6` | Keep | Phase 3: on `< sm` use `p-0 bg-white` so the form is full-bleed. `sm+` keeps the padded card. |
| Left marketing panel `hidden lg:flex lg:col-span-5 bg-slate-950` | Keep hidden on phone | Keep. Do not add an illustration. |
| Label `Email / Username (Father/Guardian CNIC)` | Keep | Keep. |
| Helper `Students & Guardians sign in using their registered Father/Guardian CNIC.` | Keep | Keep. |
| Identifier input classes `w-full pl-10 pr-3.5 py-2.5 text-xs … rounded-lg` | Short on phone | Phase 3: add `min-h-11` on `< sm` only (`sm:min-h-0` or keep py-2.5 at sm+). |
| Password input | Same | Same `min-h-11` on `< sm`. |
| Button `Sign In` `w-full h-8.5 … bg-amber-600 hover:bg-amber-700 active:bg-amber-800` | Keep colors | Phase 3: `min-h-11 h-11 sm:h-8.5` so phone is 44px. Label stays **Sign In**. |
| `Forgot password?` | Keep | Keep. Still the contact-admin card. Do not print `Student@123`. |
| Staff still email; portal still CNIC | Keep | Keep. Do not accept student email / roll / admission as login. |

### 1.2 App chrome for student/parent

| Control | File | Today | Required change |
|---|---|---|---|
| App Header title (academy name + screen title) | `Header.tsx` ~80–86 | Keep | Keep. Portal must **not** render a second `h1` page title on phone (Phase 1). |
| Header Search (phone icon + desktop bar) | `Header.tsx` ~90–111 | Shown to all roles | Phase 4: hide when `user.role` is `student` or `parent`. |
| Header bell | `Header.tsx` ~114 | Fetches `/api/v1/absentee/kpi` for every role except super_admin | Phase 4: do not fetch and do not render the bell for `student` / `parent`. |
| Session pill | `Header.tsx` ~135–139 | Display-only for student/parent | Keep display-only. Never a `<select>`. |
| Profile menu | `Header.tsx` | Staff / Settings / Sign out | Phase 4: student/parent keep Sign out. Hide Staff and Settings. Add **My profile** that opens the portal profile sheet (Phase 4). |
| Bottom nav | `MobileBottomNav.tsx` ~56–63 | Overview, Timetable, Challans, Homework, Menu | Keep five items. Do not add a sixth tab. Attendance and Exams stay in the sidebar Menu. |
| Sidebar student/parent items | `Sidebar.tsx` ~237–310 | Overview, Class Timetable, Attendance & Leaves, Fees & Payments, Homework, Examination Results, Faculty Feedback | Keep labels. |
| Routing | `App.tsx` ~393–401 | Student/parent always render `StudentParentPortalView` except `complaints` | Keep. Do not mount staff `TimetableDesk` / `FeeDeskView` / `HomeworkDesk` for these roles. |

### 1.3 Portal home — `packages/frontend/src/views/StudentParentPortalView.tsx`

| Control | Today | Required change |
|---|---|---|
| Root `space-y-6 max-w-7xl mx-auto` | Keep on `md+` | Phase 1: phone `space-y-3 md:space-y-6`. |
| Admin preview amber bar | Keep | Keep. |
| Identity card ~537–699: photo, name, Adm #, class/section/shift/guardian, today chip, monthly %, child chips, class chips, Change Password | Keep all data | Phase 1 rebuilds **phone** layout only. `md+` keeps this card. |
| Photo `profile.photo_url` or initial | Rectangular ID crop | Phase 1 phone: circular. `md+`: keep rectangle. |
| KPI grid `grid-cols-2 lg:grid-cols-4` | Tuition Fees, Attendance, Today's Schedule, Exam Results | Keep the four cards and their sentences. Unify phone padding. |
| Fee card rose/emerald | Keep | Keep. |
| Button sentences `View Payment Receipts` / `View Bank Details to Pay` / `View Attendance Record` / `View Full Timetable` / `View Report Cards` | Keep | Keep. Make the whole card `min-h-11` tappable on phone (Phase 1). |
| Strip `Parent Quick Actions:` + WhatsApp + `+ Request Sick Leave / Absence` | Keep both buttons | Phase 1: heading becomes `Quick Actions` (drop the word Parent). Buttons keep labels. |
| Linked children block | Letter avatar, ignores photo | Phase 1: circular `photo_url` or initial. |
| Today's Classes list | Keep | Phase 1 phone: list rows. Keep subject, teacher, time, room, Now/Next/Done chip. |
| Dark “How to Pay Tuition Fees from Home” | Keep | Keep classes. On phone it can sit under today's classes. |
| Change Password button | On the identity card | Phase 1 phone: move into profile sheet (Phase 4). Keep the button on `md+` identity card. |

### 1.4 Inner views (same file)

| View | `currentView` | Keep | Required change |
|---|---|---|---|
| Timetable | `timetable` | Day pills, period cards, substitute chip | Phase 2: phone back chevron, hide Print on phone |
| Attendance | `attendance` | Filter pills, history rows, leave button `+ Inform Academy of Sick Leave` | Phase 2: phone back chevron |
| Fees | `voucher` | Due banner, bank box, challan list, WhatsApp | Phase 2: phone back chevron |
| Homework | `homework` | Subject/status filters, assignment cards | Phase 2: phone back chevron |
| Exams | `exams` | Report cards, `View & Print Official Report Card` | Phase 2: phone back chevron; print sheet stays |
| Leave sheet | `showLeaveModal` | Existing sheet | Keep copy. `min-h-11` on submit. |
| Change password sheet | `showChangePasswordModal` | 8-character rule already in this file | Keep. |
| Challan sheet | `selectedChallanInvoice` | Keep | Keep. |
| Report print sheet | `printingReportCard` | Rank / attendance show `—` when missing | Keep. Do not invent rank 1 or 100%. |

### 1.5 APIs (keep)

| Path | Role | Keep |
|---|---|---|
| `GET /api/v1/portal/student-parent` (also `/portal/student-parent`, `/student`, `/portal/student`) | student / parent / admin preview | Keep. Student forced to own record. Parent forced to linked children. Always Active year. |
| `POST /api/v1/auth/change-password` | all | Keep. Portal UI already requires 8 characters and a different password. |
| `POST /api/v1/attendance/leaves` | student/parent | Keep. Already blocks other students (`UNAUTHORIZED_LEAVE_SUBMISSION`). |
| `GET /api/v1/auth/me` | all | Student/parent `working_session` is Active. `year_closed` false. |

Do not add a portal photo-upload route.

---

## 2. Phone architecture (read before Phase 1)

Breakpoint: `md` = 768px. Native layout is `< md`. Desktop `md+` is the current portal.

```
┌─────────────────────────────────┐
│ App Header 56px + safe-area     │  academy name + screen title (already)
├─────────────────────────────────┤
│ Identity band (slate-900)       │  circular photo, name, Adm #, class
│ white rounded sheet on top      │  today chip + monthly %
├─────────────────────────────────┤
│ main (THE ONLY scroller)        │
│  2×2 KPI cards                  │
│  today's class rows             │
│  homework / fee rows            │
│  quick actions                  │
├─────────────────────────────────┤
│ Bottom nav 5 tabs + safe-area   │  Overview · Timetable · Challans · Homework · Menu
└─────────────────────────────────┘
```

Inner screens (timetable, attendance, fees, homework, exams) on phone:

```
[ ‹ Back ]   Class Timetable
segmented pills
list rows
```

Back uses the existing `handleBackToOverview`. Replace the full-width grey bar on `< md` with a left chevron row:

```tsx
<button
  type="button"
  onClick={handleBackToOverview}
  className="md:hidden min-h-11 px-2 -ml-2 inline-flex items-center gap-1 text-xs font-bold text-slate-800"
>
  {/* Lucide ChevronLeft already available if imported; else use the existing Arrow pattern */}
  Back
</button>
```

On `md+` keep the current `w-full py-2 bg-slate-100 … Back` button.

Do not slide pages with `translateX`. Instant cut, same as the shell plan.

---

## Phase 1 — Phone home: photo, details, tap-cards

**Files:** `packages/frontend/src/views/StudentParentPortalView.tsx` only.

Do not change login, header, bottom nav, or backend in this phase.

### 1.1 Phone identity band (`< md` only)

Wrap the current identity block so:

- `md+` still renders the existing white card at lines 537–699 unchanged (photo rectangle, wrapping details, child chips, class chips, Change Password).
- `< md` renders a new block **instead**, using classes already in this file:

```tsx
<div className="md:hidden rounded-2xl overflow-hidden border border-slate-200 shadow-xs">
  <div className="bg-slate-900 text-white p-4 flex items-center gap-3">
    {/* photo */}
    {/* name + Adm # + class */}
  </div>
  <div className="bg-white px-4 py-3 flex flex-wrap items-center gap-2">
    {/* today attendance chip — keep existing chip classes */}
    {/* Monthly Attendance: {pct}% — keep existing sentence */}
  </div>
</div>
```

Photo on phone:

- If `profile.photo_url`: `<img src={profile.photo_url} alt={profile.full_name} className="w-16 h-16 rounded-full object-cover border-2 border-white shrink-0 bg-slate-100" />`
- Else: circular initial `w-16 h-16 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xl shrink-0 border-2 border-slate-600` with `profile.full_name.charAt(0)`.

Do not invent a stock photo. Empty `photo_url` stays the initial.

Name: `text-base font-bold text-white tracking-tight truncate`.
Adm chip: keep `font-mono` and the words `Adm #{admission_number || roll_number || '—'}`. On the dark band use `bg-slate-800 text-slate-100 border border-slate-700` (same family as the existing dark fee inner boxes).
Second line: `Class: {program} • {batch}` plus shift if present. Guardian on its own truncated line `Guardian: {name}`. Do not pack everything into one wrapping paragraph.

Hide the duplicate `h1` visual weight against the App Header: the phone identity name is the student name, the App Header already shows academy + “Student & Parent Overview”. That is correct.

Child switcher and class switcher on phone: horizontal scroll row `flex gap-1.5 overflow-x-auto` with the existing amber selected chip classes (`h-8 px-2.5 … bg-amber-600 text-white` / `bg-white text-slate-700`). Place them under the white chip row, not in the dark band. `min-h-11` on the chip buttons.

Do **not** put Change Password on the phone identity band. Phase 4 moves it. For Phase 1, hide it on `< md` (`hidden md:inline-flex` on the existing button).

### 1.2 KPI cards

Keep the four cards and every sentence inside them.

On `< md`:

- Grid stays `grid-cols-2`.
- Every card uses the same chrome as the current Attendance card: `bg-white rounded-2xl p-3.5 border border-slate-200 shadow-2xs space-y-1.5`.
- Fee due/cleared **background colors stay** (`bg-emerald-50/70 border-emerald-200` / `bg-rose-50/70 border-rose-200`).
- The whole card is a `<button type="button">` (or `role="button"` on the existing `<div>` with `onClick` already on the inner link). `min-h-11`. The inner “View …” text stays as a caption; tapping anywhere on the card already goes to that screen via `handleNavigateScreen`.
- Remove the extra inner `<button>` if the card itself is tappable, so there are not two tab stops. Keep the caption sentence.

On `md+` leave the four cards as they are today.

### 1.3 Today's Classes on phone

Keep the existing list on `md+`.

On `< md`, each slot is one row:

```
[time mono]  Subject
             Teacher • Room          [Now / Next / Done]
```

Copy row chrome from the current slot card: `p-3.5 rounded-xl border border-slate-200 bg-slate-50/70`. Time stays `font-mono`. Keep `getSlotTimingStatus` chips. Empty state keeps “No classes scheduled for today.” and the existing amber **View Monday–Saturday Schedule**.

### 1.4 Quick actions + siblings

- Heading `Parent Quick Actions:` → `Quick Actions` (entire heading, all breakpoints — the word Parent is wrong for a student login).
- WhatsApp and leave buttons: add `min-h-11` on `< md`. Keep `bg-emerald-600` WhatsApp and white leave button.
- Linked children cards: leading `w-8 h-8 rounded-full object-cover` from `child.photo_url`, else initial. Keep unpaid `PKR` `font-mono`. Tapping a child still calls `fetchOverview(child.id, null)`.

### 1.5 What you must not do in this phase

- Do not restyle `md+`.
- Do not change inner views (timetable/attendance/fees/homework/exams).
- Do not change login or header.
- Do not add a bottom tab.
- Do not add charts.

**Done when:**

- 375px: identity shows circular photo (or initial), name, Adm #, class; four KPI cards; today’s classes; no horizontal page scroll; bottom nav visible.
- 1280px: portal home looks like today (rectangle photo, Change Password on the identity card, original KPI paddings).
- Photo uses `profile.photo_url` when present.
- Heading no longer says “Parent Quick Actions”.

Verifier click list (reviewer, not Gemini):

- Student login, 375px: photo or initial, name, class, tap Fees card → challans inner view.
- Same student, 1280px: old identity card still has Change Password and rectangle photo.
- Parent with two children: chips scroll; each child row shows photo if `photo_url` exists.

---

## Phase 2 — Inner screens as phone lists

**Files:** `packages/frontend/src/views/StudentParentPortalView.tsx`.

Apply to `currentView` `timetable`, `attendance`, `voucher`, `homework`, `exams`.

### 2.1 Phone top row

On `< md`, replace the full-width grey Back bar with the chevron Back in section 2. Put the existing `h2` title on the same row (`flex items-center gap-2`). On `md+` keep the grey Back bar.

Hide on `< md`:

- Timetable **Print Timetable** (`hidden md:flex` on that button).
- Any `window.print()` trigger that is not inside the report-card sheet.

Keep **View & Print Official Report Card** — it opens the existing sheet, it is not a browser print of the whole page.

### 2.2 List rows

Reuse one row shape on phone (copy nearest existing `p-3.5 rounded-xl border border-slate-200 bg-slate-50/70`):

| Screen | Leading | Title | Subtitle | Trailing |
|---|---|---|---|---|
| Timetable | Period `font-mono` | `subject_name` | Teacher • `start–end` • room | Now/Next/Done chip |
| Attendance | Date `font-mono` | Present / Absent / Late / Half Day / Leave | Remarks if any | existing color chip |
| Homework | Subject initial circle `w-8 h-8 rounded-full bg-slate-200` | Title / subject | Due date | Complete / Incomplete / Missing / Pending |
| Fees (challan list) | Month `font-mono` | Invoice number | Status | `PKR` balance |
| Exams | Exam date | `exam.title` | Rank or `—` | `{obtained}/{total}` `font-mono` |

Do not invent a new badge color. Use the chips already on that screen (emerald / amber / rose / slate / orange half-day).

Day pills and attendance filter pills: `min-h-11` on `< md`, keep `overflow-x-auto`, keep amber selected (`bg-amber-600 text-white`).

Empty sentences stay: “No classes scheduled for {day}.”, “No homework assignments matching selected filter.”, “No examination report cards published yet.”, “No payment receipts recorded yet.”

### 2.3 Fees screen

Keep the due banner, the `bg-slate-900` bank box, Copy buttons, WhatsApp. On phone stack them. Copy targets stay `min-h-11`. Do not add a Pay-online button.

### 2.4 Leave and password sheets

Already sheets. On phone make primary actions `min-h-11`. Do not restyle the sheet chrome.

**Done when:**

- 375px inner screens: back chevron, no full-width grey Back, no Print Timetable, lists are rows, bottom nav visible, no horizontal page scroll.
- 1280px inner screens still have the grey Back bar and Print Timetable.
- HALF_DAY still shows as Half Day (existing `(att.status as any) === 'HALF_DAY'` stays until Phase 5 types it).

---

## Phase 3 — Login on a phone

**Files:** `packages/frontend/src/components/LoginModal.tsx` only.

### 3.1 Phone frame

Below `sm`:

- Outer: `p-0 bg-white` (drop the grey page padding).
- Inner card: `rounded-none border-0 shadow-none min-h-[100dvh]`.
- Form column: `px-5 py-8` so fields are not on the glass edge.
- Sign In `min-h-11 h-11` and `rounded-xl` (portal already uses `rounded-xl` on amber buttons). Colors stay `bg-amber-600 hover:bg-amber-700 active:bg-amber-800`.
- Identifier and password `min-h-11`.

At `sm+` keep the current centered rounded card and `h-8.5` Sign In.

### 3.2 Copy

Keep labels. Do not add “Welcome back”. Do not add an illustration. Do not split student vs staff into two tabs.

Forgot-password card stays the contact-admin wording. Do not print a default password.

**Done when:**

- 375px: full-bleed form, 44px Sign In and fields, CNIC helper visible, no horizontal scroll.
- 1280px: login still two-column with slate-950 left panel.

---

## Phase 4 — Header, bottom nav, profile sheet

**Files:** `packages/frontend/src/components/Header.tsx`, `packages/frontend/src/components/MobileBottomNav.tsx`, `packages/frontend/src/views/StudentParentPortalView.tsx`, `packages/frontend/src/App.tsx` only if a prop must be passed.

### 4.1 Header for student/parent

When `user.role === 'student' || user.role === 'parent'`:

- Do not render Search (phone icon and desktop search bar).
- Do not render the bell, and **do not** call `/api/v1/absentee/kpi`.
- Profile dropdown: keep Sign out. Hide Staff. Hide Settings (`canOpenScreen` already false; still hide the button). Add one row **My profile** (`w-full text-left px-3.5 py-2 … min-h-[44px]`, same as Session row) that calls `onSwitchScreen?.('student_portal')` and sets a query/hash the portal already understands, **or** better: a callback `onOpenPortalProfile` that StudentParentPortalView uses to open the profile sheet. Simplest allowed path: `onSwitchScreen('student_portal')` plus `window.dispatchEvent(new Event('kampus-open-portal-profile'))` is forbidden. Pass a prop: Header already has `onSwitchScreen`. Add optional `onOpenPortalProfile?: () => void` on Header, wired from App only for student/parent, which sets state in `StudentParentPortalView` via a render prop **or** open the existing change-password sheet plus details.

**Required profile sheet contents** (reuse leave-sheet overlay classes already in the portal file: `fixed inset-0 z-50 bg-slate-900/60` + `mobile-sheet`):

- Circular photo or initial (same as Phase 1).
- Name, Adm #, class, section, shift, guardian, guardian phone (`font-mono` on phone/CNIC if shown).
- Child switcher if `linked_children.length > 1`.
- Class switcher if more than one active/`on_leave` enrollment.
- Button **Change Password** — opens the existing password sheet.
- Button **Sign out** is already in Header; do not duplicate unless the sheet needs it. Skip duplicate.
- Close (X) uses the same close control as the leave sheet.

### 4.2 Bottom nav

Keep Overview / Timetable / Challans / Homework / Menu.

Active state already compares `currentScreen`. Portal innerView already follows `activeScreen`. Do not add Attendance as a sixth tab.

Menu still opens the sidebar with Attendance & Leaves, Examination Results, Faculty Feedback.

Icon sizes stay. Labels stay. `min-h` of the nav item already exists; if a target is under 44px including padding, raise the button `min-h-11` only for this role, do not restyle staff nav.

### 4.3 Complaints

Faculty Feedback stays a sidebar item and still mounts `ComplaintsDeskView`. Do not rebuild complaints in this plan.

**Done when:**

- Student/parent phone header has no search and no bell; Network tab shows no `/absentee/kpi` after login.
- My profile opens the sheet with photo + details + Change Password.
- Staff header still has search and bell.

---

## Phase 5 — Backend truth for the portal

**Files:** `packages/backend/src/routes/portal.ts`, `packages/backend/src/services/store.ts`, `packages/backend/src/routes/attendance.ts` (only if needed), `packages/shared-types/src/index.ts`, tests in `packages/backend/tests/student_portal_mobile.test.ts`.

### 5.1 `recent_attendance` status type

In `packages/shared-types/src/index.ts` `StudentParentPortalOverview.recent_attendance.status`, add `'HALF_DAY'`:

```
status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'HALF_DAY';
```

Store mapper already emits HALF_DAY. Portal UI already reads it via `as any`. After this, remove those `as any` casts in `StudentParentPortalView.tsx`.

### 5.2 Do not load every student to find “me”

`portal.ts` student branch and `attendance.ts` leave student branch call `store.getStudents(tenantId)` then find `user_id === user.sub`.

Add `store.getStudentByUserId(tenantId, userId: string): Promise<Student | null>` that finds `s.tenant_id === tenantId && s.user_id === userId` without building the directory overlay list. Use it in:

- `GET /portal/student-parent` student branch
- `POST /attendance/leaves` student branch

Keep the email fallback only if `user_id` is missing: scan students of that tenant for email match **without** calling the directory overlay. Do not use `getStudents` (that overlay is for staff directory).

### 5.3 Parent child list photos

`linked_children` already includes `photo_url`. Keep it. Do not drop it.

Admin preview `linked_children` already includes `photo_url`. Keep.

### 5.4 Portal stays on Active year

`getStudentParentPortalOverview` already uses tenant Active session for enrollments. Do not read `X-Kampus-Session` for student/parent. Ignore stale `metadata.working_session`.

Completed last-year enrollments stay out of the class switcher (already: Active + `active`/`on_leave`). Keep the fallback that excludes `completed`.

### 5.5 Leave IDOR

Already present. Add tests (Phase 6). Do not weaken the check.

### 5.6 Absentee KPI

No backend change required if Phase 4 stops calling it. Optional: if `role` is student/parent, `/api/v1/absentee/kpi` already 403s via feature flags — leave it.

**Done when:** tests in Phase 6 pass.

---

## Phase 6 — Tests

**New file:** `packages/backend/tests/student_portal_mobile.test.ts`

Run from `packages/backend`:

```
npx vitest run tests/student_portal_mobile.test.ts
```

or

```
./node_modules/.bin/vitest run tests/student_portal_mobile.test.ts
```

Seed Apex may stay. Create extra students/users as needed.

Cases:

1. Student token `GET /api/v1/portal/student-parent` returns 200, `data.student_profile.id` is that student’s id, `data.student_profile.photo_url` is the stored `photo_url` (set one in the fixture).
2. Student token `GET /api/v1/portal/student-parent?student_id={someoneElse}` returns 403 `UNAUTHORIZED_STUDENT_ACCESS`.
3. Parent token `GET` with an unrelated `student_id` returns 403 `UNAUTHORIZED_PARENT_ACCESS`.
4. Parent token without `student_id` returns 200 and `linked_children` includes only CNIC/email/phone-linked children; each child has `photo_url` key.
5. `recent_attendance` items may include `status: 'HALF_DAY'` when the store mapped a half-day mark (insert one attendance row).
6. Class switcher payload: a `completed` enrollment from a prior session is absent from `data.enrollments` filtered the way the UI filters (`active` / `on_leave`) — assert the completed row is not `active`.
7. Student token `POST /api/v1/attendance/leaves` for another student_id returns 403 `UNAUTHORIZED_LEAVE_SUBMISSION`.
8. Student token `POST /api/v1/attendance/leaves` for own id returns 201 when year is Active.
9. Student token `PATCH /api/v1/academic/working-session` still 403 `FORBIDDEN_ROLE` (already true; pin it so portal work does not reopen year switching).

**Done when:** that file is green. Frontend phases have no vitest file; reviewer uses the click lists.

---

## Phase 7 — What you must not build

This phase is a stop list. If Phase 1 through 6 are done, do not start new work. Do not:

- Restyle staff desks, teacher portal, or super-admin.
- Copy the Modychat coral buttons, chat bubbles, Status tab, Calls tab, or onboarding illustration.
- Add Ionic, Capacitor, Framer Motion, a new font, or a new icon pack.
- Add in-app JazzCash/EasyPaisa/card checkout.
- Add push notifications or WhatsApp Business API.
- Let students upload or crop their own photo.
- Let students or parents switch academic year.
- Mount `TimetableDesk`, `FeeDeskView`, `HomeworkDesk`, or `ExamDeskView` for student/parent.
- Add a sixth bottom-nav tab.
- Auto-flip Active year.
- Print `Student@123` or `Parent@123`.
- Put a person’s name in a fallback string other than `profile.full_name.charAt(0)`.
- Filter Staff, Payroll, or Settings by year (out of scope).
- Remove doubled routes, `seedTestData()`, or backup view files.

**Done when:** no code changes. Reply with the list of phases already present in git diff and stop.

---

## Verifier (for the reviewer, not for Gemini to implement)

After each phase, the reviewer checks only that phase:

1. Phase 1: 375px home shows circular photo, name, class, four cards; 1280px still has the old identity card.
2. Phase 2: 375px timetable has chevron Back and no Print; 1280px Print remains.
3. Phase 3: 375px login fields and Sign In are 44px; 1280px left slate panel remains.
4. Phase 4: student header has no search/bell; My profile sheet shows photo; staff header unchanged.
5. Phase 5–6: tests 1–9 green.
6. 375px: no horizontal page scroll, bottom nav fully visible, 44px targets on new controls.

---

## File checklist (every path this plan may touch)

```
packages/frontend/src/views/StudentParentPortalView.tsx
packages/frontend/src/components/LoginModal.tsx
packages/frontend/src/components/Header.tsx
packages/frontend/src/components/MobileBottomNav.tsx
packages/frontend/src/App.tsx
packages/backend/src/routes/portal.ts
packages/backend/src/routes/attendance.ts
packages/backend/src/services/store.ts
packages/shared-types/src/index.ts
packages/backend/tests/student_portal_mobile.test.ts
```

Do not edit files outside this list unless a compile error forces a type import. If that happens, change only the import.

---

## Suggested student flow (for the reviewer)

1. On a phone, open the academy URL. Sign In with Father/Guardian CNIC and the student password.
2. Home shows the student’s photo, name, admission number, class, today present/absent, monthly %, fees due, today’s next lecture.
3. Tap Timetable → day pills → period rows. Back returns to home.
4. Tap Challans → due amount, copy IBAN, WhatsApp screenshot.
5. Menu → Attendance & Leaves → request sick leave.
6. Header avatar → My profile → Change Password (8 characters).
7. Sign out. Parent login with the same CNIC and parent password shows child chips and the same home for the selected child.
