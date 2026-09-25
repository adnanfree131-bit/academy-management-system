# GIVE THIS WHOLE FILE TO GEMINI

Attach or paste this entire markdown file. Use this as the first message:

> Implement **one phase only**, starting at Phase 0. Check every changed screen at **375px** and at **1280px**. At 375px the page must not scroll sideways, the bottom nav must stay fully visible, and every tappable control must be at least 44px tall. Desktop at 1280px must look the same as it does now. Do not change `packages/backend`. Do not change button behavior, API calls, or permissions. Do not install Ionic, Capacitor, Framer Motion, or a new CSS framework. Do not add global `!important` rules. Do not restyle colors.

Then send the rest of this file. Do not summarize it. Class names, breakpoints, and file paths are the spec.

**Product:** Kampus staff desks for Timetables, Staff Attendance, Absence Follow-Up, Homework, Feedback, and Staff.  
**Scope:** `packages/frontend` only. Files listed in each phase.  
**Breakpoint:** phone is `< md` (under 768px). `sm` (640px) is still a phone. Desktop tables stay `hidden md:block`. Phone lists stay `md:hidden`.  
**Shell already exists:** `App.tsx` header, `MobileBottomNav`, `mobile-sheet` / `mobile-sheet-card`. Use those. Do not build a second navigation bar.

---

## 0. What “native” means on these desks

A phone screen is one column. The person sees a list, taps a row, and the next step fills the screen or rises as a bottom sheet. They never drag the page left to find a button.

Rules for every phase:

1. The document must not scroll horizontally at 375px. A chip row may scroll inside itself. Give that row `overflow-x-auto`, `min-w-0`, and `whitespace-nowrap` on each chip. The page around it stays `overflow-x-hidden`.
2. Do not add a `fixed` button over the bottom nav. The Timetable `+` FAB is removed in Phase 1. Primary actions stay in `PageHeading` children.
3. Touch height on phone is `min-h-11` (44px). Icon-only actions are `w-11 h-11`. The current `w-8 h-8` row actions are too small.
4. Sheets use the existing pattern and nothing else:

```
fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 mobile-sheet
```

Card:

```
bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[92dvh] flex flex-col mobile-sheet-card
```

Add a phone-only handle: `<div className="sm:hidden mx-auto mt-2 h-1 w-10 rounded-full bg-slate-300" />`. Sheet footer is `sticky bottom-0 bg-white border-t p-3 flex gap-2`. Each footer button is `flex-1 min-h-11`. Remove `z-[9999]`, `backdrop-blur-md`, and `animate-in zoom-in-95` from these six files. Zoom-in on a bottom sheet feels like a popup, not a phone sheet.
5. `PageHeading` on `< sm` currently hides the title and shows only the action, at `min-h-[32px]`. Keep the title hidden on the phone (the app header already shows it). Change the action strip to `min-h-11` and `[&>*]:min-h-11`. Do this once in `packages/frontend/src/components/PageHeading.tsx` in Phase 0. Do not show the long description under the title on the phone.
6. Desktop (`md` and up) markup stays. Wrap new phone blocks in `md:hidden`. Do not delete the `hidden md:block` tables.

---

## Phase 0 — Shared sheet and heading

**File:** `packages/frontend/src/components/PageHeading.tsx`

- Phone action strip: replace `[&>*]:min-h-[32px]` with `[&>*]:min-h-11`.
- Actions stay `flex-1` so one button is full width and two buttons share the row.

No other file in this phase.

**Done when:** at 375px, Schedule Class, Assign Homework, and New Ticket are 44px tall and full width. At 1280px the heading row is unchanged.

---

## Phase 1 — Timetables

**File:** `packages/frontend/src/views/TimetableDesk.tsx`

### What is wrong at 375px

- A round `+` button is `fixed` at `bottom-[calc(5rem+env(safe-area-inset-bottom))]`. It sits on the bottom nav.
- “Assign Substitute” is a long label beside two 28px icon buttons. The label wraps or crowds the card.
- The room badge (“Single-Room Facility”) sits in a row that wraps under the day select with no full-width stack.
- The schedule sheet footer buttons are `h-8.5`.

### Phone layout

- Delete the FAB (`sm:hidden fixed bottom-...`). The header action “Schedule Class” is the only create control. It is already in `PageHeading`.
- Filter block, top to bottom, each `w-full`:
  1. Batch `<select>` with label “Class” above it, not beside it.
  2. Day `<select>` (already `sm:hidden`). Keep it. Add `min-h-11 w-full`.
  3. Room line as plain text under the selects, not a pill fighting the row: “Rooms: one room” or “Rooms: several rooms”. Keep the same `multiRoomEnabled` flag. Do not change what the flag does.
- Day tabs stay `hidden sm:flex`. Do not show them on the phone.
- Each period card keeps subject, time, class, teacher, substitute, room.
- Card actions, one row:
  - “Substitute” (`flex-1 min-h-11`). Short label on `< md` only. `md+` keeps “Assign Substitute” / “Change Substitute”.
  - Edit icon `w-11 h-11`.
  - Remove icon `w-11 h-11`.
- Sheets (create, substitute, remove): apply the sheet classes in section 0. Footer Cancel + confirm are each `flex-1 min-h-11`.

**Done when:** at 375px there is no floating `+`, no sideways scroll, and a period card’s three actions are tappable without wrapping onto the time. At 1280px the card grid and day tabs are unchanged.

---

## Phase 2 — Homework

**File:** `packages/frontend/src/views/HomeworkDesk.tsx`

### What is wrong at 375px

The assignment list and the notebook roster are stacked (`grid-cols-1`). A class with many assignments forces the teacher to scroll past every card before they can mark Done / Incomplete / Missing. Save Inspection is at the top of the roster, then disappears.

### Phone layout (`md:hidden`)

One screen at a time.

- **List.** Batch select full width, `min-h-11`. Then the assignment cards. Tapping a card sets `selectedAssignment` and sets `phonePane` to `'check'`.
- **Check.** A top bar: back chevron `w-11 h-11` with `aria-label="Back"`, then the assignment title truncated to one line. Back sets `phonePane` to `'list'` and clears `selectedAssignment`.
- Counters stay the four navy boxes in `grid-cols-2`.
- Student rows stay the existing `sm:hidden` block (name, admission, three status buttons, remarks). Make each status button `min-h-11`. Remarks input `min-h-11`.
- Save bar: `sticky bottom-0 z-10 bg-white border-t px-3 py-2`. The button is `w-full min-h-11`. It is inside the check pane, not `fixed` over the tab bar. The main scroller already has bottom padding for the nav, so this bar sits at the end of the pane and stays visible while the list scrolls (`sticky` inside the check pane’s parent).
- “Assign Homework” stays the `PageHeading` action. The create sheet uses section 0. On the phone the sheet title stays “Assign Homework” / “Edit Homework”.

### Desktop

`hidden md:grid md:grid-cols-3` keeps today’s side-by-side list and roster. Do not add `phonePane` behavior at `md+`. Implement `phonePane` only when `window.matchMedia('(max-width: 767px)')` is true, or branch the JSX with `md:hidden` / `hidden md:grid` so desktop never shows the back bar.

**Done when:** at 375px, opening an assignment hides the list and shows the roster with Back and a full-width Save. Back returns to the list. At 1280px both columns are visible together and there is no Back bar.

---

## Phase 3 — Feedback

**File:** `packages/frontend/src/views/ComplaintsDeskView.tsx`

### What is wrong at 375px

The list is already one card per ticket. The card’s “Update & Resolve” / “View Ticket” button is right-aligned and short. The filter row is a wrapped desktop strip (label + select + label + select).

### Phone layout

- Search stays full width. Filter icon stays `w-11 h-11`.
- When filters are open, stack them:
  - “Category” label, then `<select class="w-full min-h-11">`
  - “Status” label, then `<select class="w-full min-h-11">`
  - “Reset Filters” as `w-full min-h-11` text button, only when a filter is active.
- On each card, the action button is `w-full min-h-11 mt-2` below `md`. At `md+` it stays right-aligned.
- New Ticket and resolution sheets use section 0. Category and Priority each full width (`grid-cols-1` under `sm`, `sm:grid-cols-2` from `sm` up).

**Done when:** at 375px a ticket card’s button is full width, filters do not sit on one cramped line, and the sheet footer buttons are 44px. At 1280px the two-column card grid is unchanged.

---

## Phase 4 — Absence follow-up

**File:** `packages/frontend/src/views/AbsenteeRetentionDeskView.tsx`

### What is wrong at 375px

The roster already has `md:hidden` cards. WhatsApp and Call are `w-8 h-8`. The filter panel is `flex-wrap` with “Date:” jammed beside a native date input. Retention cases and the template table (`overflow-x-auto` around line 1387) are wide tables on the phone. The options menu is a `w-60` dropdown that can clip the right edge.

### Phone layout

- Filter panel, when open, is three stacked fields, each label above a `w-full min-h-11` control: Date, Class, Status.
- Roster card actions:
  - Call `w-11 h-11`
  - WhatsApp `w-11 h-11`
  - “Log Call” `flex-1 min-h-11`
- Phone choice (Primary / Backup), when a backup exists, is a `w-full min-h-11` select under the guardian line, not a 10px select at the end of the line.
- Options menu: on `< md`, do not use the absolute `w-60` dropdown. Open the same items in a section-0 sheet titled “Actions”: Start calls, Absentee list, Repeat absences, Templates, This month’s report, and the overview switch. Desktop keeps the dropdown.
- Retention list: under `md`, each case is a card (name, class, percent, days, status, one `w-full min-h-11` “Set meeting” button). Keep the table `hidden md:block`.
- Templates: under `md`, each template is a card (title, category, two-line body). Keep the table `hidden md:block`. Add stays the existing button, full width on the phone via `PageHeading` or a `w-full min-h-11` button at the top of the template pane.
- Log, WhatsApp, meeting, and template sheets use section 0.

**Done when:** at 375px the roster, the repeat-absence list, and the template list do not scroll sideways. Call, WhatsApp, and Log Call are 44px. At 1280px the three tables are unchanged.

---

## Phase 5 — Staff directory

**File:** `packages/frontend/src/views/StaffDeskView.tsx`

### What is wrong at 375px

Phone rows exist (`md:hidden`), but Call, WhatsApp, Edit, and More are `w-8 h-8`. More opens an absolute menu that clips against the screen edge. The outer list has `overflow-x-auto`, so a wide menu or a long chip row scrolls the whole page. The dossier sheet tabs are `overflow-x-auto` with `px-6`, which is fine only if the sheet itself does not widen the page. The appointment letter and ID card are A4 layouts rendered in the viewport, which forces sideways scroll.

### Phone layout

- Remove `overflow-x-auto` from the outer list wrapper (the `rounded-xl` around line 1000). Horizontal scroll stays only on the desktop table’s own `overflow-x-auto`.
- Phone row: the row tap still opens Edit. The icon row becomes:
  - Call `w-11 h-11` when a phone exists
  - WhatsApp `w-11 h-11` when WhatsApp exists
  - More `w-11 h-11`
- More on `< md` opens a section-0 sheet titled with the person’s name. Items, full width, `min-h-11`, text left, icon left:
  - Classes they teach
  - What they can open (hidden unless `isAdmin`, same as now)
  - ID card
  - Appointment letter
  - Reset password (admin only)
  - Archive or Restore (admin only)
  - Delete (admin only)
  Desktop keeps the absolute menu.
- Dossier sheet uses section 0. Tabs are a chip row inside the sheet (`overflow-x-auto` on the chip row only): Personal, Job, Pay, Access. Do not let the tab row set the sheet width.
- ID card and appointment letter: on `< md` do not render the full A4 preview in the page. Show the person’s name, designation, and one button “Print”. `window.print()` stays, but the print node uses the existing `print:` layout and is `hidden` on screen under `md` (`hidden md:block` for the preview, `print:block` so paper still prints). Desktop preview stays visible.

**Done when:** at 375px the staff list does not scroll sideways, More opens a sheet instead of a clipped menu, and opening an appointment letter does not widen the page. Print still prints the letter. At 1280px the table, menu, ID preview, and letter preview are unchanged.

---

## Phase 6 — Staff attendance

**File:** `packages/frontend/src/views/StaffClockInView.tsx`

This is the screen that still feels like a spreadsheet. Daily already has `md:hidden` cards. Monthly, ledger, exceptions, audit, and the rules table are `overflow-x-auto` tables only.

### Personal clock-in (no roster access)

Already one column. Make Clock In and Clock Out `w-full min-h-11` stacked. Locate and Request stay full width under them. Do not add a map.

### Admin phone chrome

- Tab labels that fit a chip. The chip row scrolls; the page does not.

| Current label | Phone chip |
|---|---|
| Daily Attendance | Today |
| Monthly | Month |
| Reports | Reports |
| Ledger | Ledger |
| Exceptions | Exceptions |
| Audit Logs | History |
| Settings | Rules |

`md+` keeps the current labels.

- Date row: previous `w-11 h-11`, the date `flex-1 text-center`, next `w-11 h-11`, and “Today” `min-h-11`. PDF and CSV leave this row. Put them in a “Share” sheet opened by one `w-11 h-11` icon, with “Preview PDF” and “Download CSV”. Same sheet pattern for the other tabs that currently show Preview / Download / CSV in a row.
- The seven status cards (`grid-cols-2 sm:grid-cols-7`) become one scrolling chip row on `< md`: All, On time, Late, Half day, Leave, Absent, Not marked. Each chip `min-h-11 whitespace-nowrap`. The 2-column card grid is `hidden md:grid`.

### Tables that need phone cards

Keep every existing table inside `hidden md:block`. Add `md:hidden` cards.

**Today list** (already has cards around the `md:hidden` block): raise the edit control to `w-11 h-11`. Show name, code, status, arrival. Tap opens the existing edit sheet.

**Month list:** one card per person. Line 1: name and percent. Line 2: present, late, half day, leave, absent as five short figures, `grid-cols-5`, no horizontal scroll.

**Ledger:** staff `<select class="w-full min-h-11">` instead of `min-w-[220px]`. Then the same month figures as the month card for that person. Remove `min-w-[220px]`.

**Exceptions:** one card per request. Name, date, reason, then Approve and Reject each `flex-1 min-h-11`.

**History:** one card per log. Name, date, old status → new status, who changed it. No table on the phone.

**Rules:** each head is a card. Name, code, paid or unpaid, then up / down / edit / delete as four `w-11 h-11` buttons. The shift fields are already `grid-cols-1` on the phone. Keep them. “Save Changes” is `w-full min-h-11` and sticky to the bottom of the Rules pane the same way homework Save is sticky. Do not use `fixed`.

All three sheets in this file (regularization, head, manual edit) drop `z-[9999]` and use section 0.

**Done when:** at 375px, Today, Month, Ledger, Exceptions, History, and Rules show cards, not a sideways table. The tab chips scroll inside their row. Clock In is full width on the personal screen. At 1280px every table is still there and the long tab labels are unchanged.

---

## Out of scope

- Rewording the appointment letter, “muster roll”, or “geofence” beyond the phone chip shortenings in Phase 6. A separate wording pass owns that.
- Dashboard, teacher portal, and student portal.
- New features, new APIs, new empty-state sentences.
- Rebuilding `StaffClockInView` into smaller files.
- Dark mode, new fonts, new icons.

---

## VERIFIER (do not implement)

After each phase, at 375px and 1280px:

1. Open the desk. The page does not move sideways.
2. The bottom nav is fully visible and no round `+` covers it.
3. The main action (Schedule Class, Assign Homework, New Ticket, Clock In, Log Call, Save) is at least 44px tall.
4. Open the sheet used by that phase. It rises from the bottom. Cancel and the confirm button are side by side and 44px. The page behind does not scroll sideways.
5. At 1280px the original table or card grid is still the thing on screen, with the original button labels.
