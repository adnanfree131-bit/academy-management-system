# GIVE THIS WHOLE FILE TO GEMINI

Attach or paste this entire markdown file. Use this as the first message:

> Implement Phase A of this plan in `packages/frontend` only, commit order in section 9. After each commit, check 375px width: no horizontal page scroll, bottom nav fully visible. Do not add global `!important` CSS. Do not remount views on tab change. Do not animate the main pane with translateX. Do not install Ionic. Do not install Capacitor until Phase A section 11 is green; keep every overlay and safe-area rule Capacitor-ready for Phase B (section 14).

Then send the rest of this file. Do not summarize it for Gemini. The button lists, class names, and file paths are the spec.

---

# Kampus Mobile Native Shell — Gemini Build Plan

**Product:** Kampus / Apex Academy SIS  
**Scope:** `packages/frontend` only. Do not touch `packages/backend`, `school-erp`, `DashboardView.backup.tsx`, `Sidebar.backup.tsx`, JWT, Render, or Cloudflare.  
**Goal:** Phone (< 768px) must feel like one installed app: one chrome, one scroller, one drawer, one sheet system, no horizontal page-slide, no overlapping bars. Desktop (≥ 768px) stays the current staff SIS. This shell is the **Capacitor APK foundation**. An APK of the current overlay would still look like a squeezed website.  
**Breakpoint:** `md` = 768px. Bottom nav + drawer + phone lists are `< md`. Desktop sidebar is `md+`.  
**Stack:** Keep hash screens (`#dashboard`, `#enrollment`, …). Keep Tailwind + Lucide + `hapticLight` / `hapticSelection` / `hapticSuccess` in `packages/frontend/src/lib/haptics.ts`. Do not add React Native, Ionic, Framer Motion, a second CSS framework, or React Router.  
**Capacitor:** This pass does **not** `npm install @capacitor/core` until the shell in sections 1–8 is done. Every layout, safe-area, and Back-button rule below is written so Phase B (section 14) can wrap the same build into an Android APK. Do not add Ionic (`ion-app`, `ion-tabs`, `ion-nav`). Kampus already has Header, Sidebar, and MobileBottomNav; Ionic would duplicate them and restyle every screen.

---

## 0A. Capacitor vs Ionic (why this order)

| Tool | Role | This project |
|---|---|---|
| **This plan (web shell)** | One scroller, safe areas, tab bar, drawer, sheets, hardware Back | Required first. Capacitor only displays whatever the WebView loads. |
| **Capacitor** | Android/iOS WebView, APK/AAB, StatusBar, BackButton, Haptics, filesystem | Phase B after the shell. Official path to Play Store APK. |
| **Ionic UI** | Ready-made `ion-header` / `ion-tabs` / `ion-modal` | Skip. Conflicts with existing Tailwind desks (Enrollment, FeeDesk, Profile). Capacitor does not need Ionic. |
| **React Native / Expo** | Rewrite in native views | Skip. Would rebuild SIS from zero. |

**APK v1 strategy (Phase B):** Capacitor `server.url` points at the live Cloudflare Pages host (`https://edu.kampus.pk` or the academy subdomain the user signs into). The APK is a standalone WebView of the hosted app, so `/api` still goes through existing Pages Functions. Do not bundle `dist` and call Render `/api` until CORS and a public API origin are a separate backend task.

**What must be true before `npx cap add android`:**
- `100dvh` shell + `env(safe-area-inset-*)` on header and bottom nav (WebView + Android gesture nav).
- One scroll container (Capacitor WebView rubber-bands if `body` and `main` both scroll).
- No `history.pushState` drawer trap (Android Back must close overlay then leave the screen).
- Overlays classified (sheet / drawer / full-screen) so Back can close the top overlay.
- Bottom nav and FABs use safe-area offsets (3-button Android nav bar).
- Existing `haptics.ts` stays a no-op-safe wrapper; Phase B can call `@capacitor/haptics` inside it without changing buttons.

---

## 0. Why the current app still feels broken

The live UI is a **desktop SIS with a mobile overlay**, not a phone app.

| Layer | Current file | What is wrong |
|---|---|---|
| Viewport | `packages/frontend/index.html` | PWA meta is already set (`viewport-fit=cover`, `standalone`). Chrome is the problem. |
| Root layout | `App.tsx` `MainLayout` | `min-h-screen` on outer **and** content column, `main` is a second `overflow-y-auto` with `pb-20`. Body also scrolls. Two scrollers = rubber-band, header bounce, bottom-nav overlap. |
| Screen switch | `App.tsx` `handleSwitchScreen` | `setScreenNavKey(k => k + 1)` remounts the whole view via `<ErrorBoundary key={...}>`. Every tab looks like a new page load, not a native tab. |
| Drawer | `Sidebar.tsx` | `transition-transform duration-300` + `-translate-x-full`. Also `pushState({ drawer: 'sidebar' })` on open. Combined with hash routing this fights the Back button and feels like a sliding page. |
| Bottom bar | `MobileBottomNav.tsx` | Four copy-pasted `<nav>` trees. `fixed bottom-0 z-40`. |
| Competing bars | Attendance / Fees / Exams / Timetable / Income | Extra `fixed bottom-14` or `bottom-20` FABs sit on top of the tab bar. |
| CSS engine | `index.css` lines ~230–427 | Universal `!important` sheet engine matches **any** `.fixed.inset-0[class*="z-"]`. It also catches the **sidebar backdrop**, some toasts, and nested wrappers. That is the source of “bad sliding effects”. |
| Typography hammer | `index.css` `@media (max-width: 640px)` | Forces `h1/.text-3xl` to 18px and `.p-6` to 14px globally. Breaks desktop-designed cards without a real layout. |
| Giant desks | Enrollment 6340 lines, FeeDesk 6524, StudentProfileModal 5119 | Phone patches (`md:hidden` cards) sit next to desktop tables. New CSS cannot fix nested overflow inside these files. |

Gemini must **replace the shell**, then **align each screen to that shell**. Do not add another global CSS engine.

---

## 1. Target phone architecture

```
┌─────────────────────────────────┐
│ Header 56px + safe-area-top     │  sticky, never translates
├─────────────────────────────────┤
│                                 │
│ Main (THE ONLY scroller)        │  overflow-y: auto; overscroll-none
│ content width 100%; no X scroll │
│                                 │
├─────────────────────────────────┤
│ Bottom nav 56px + safe-area-bot │  fixed, never covered by content
└─────────────────────────────────┘
Drawer: overlay from LEFT, 78vw max 260px, dim scrim, no body translate.
Sheets: overlay from BOTTOM, 90dvh max, drag handle, dim scrim.
Search: full-screen on phone (already `no-sheet-overlay`).
Tabs: instant content swap. No slide-left/right between screens.
```

### 1.1 Root DOM contract (mandatory)

In `App.tsx` `MainLayout`, replace the current wrappers with this exact structure and classes (Tailwind tokens may match existing palette; structure must match):

```tsx
<div className="h-[100dvh] max-h-[100dvh] overflow-hidden flex bg-[#F4F8FC] font-sans text-slate-800">
  <Sidebar ... />
  <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
    <Header ... />
    <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-none px-3 sm:px-5 lg:px-6 py-3 md:pb-6 pb-[calc(4.25rem+env(safe-area-inset-bottom))]">
      {/* views */}
    </main>
    <MobileBottomNav ... />
  </div>
</div>
```

Rules:
- Outer shell: `h-[100dvh] overflow-hidden`. Never `min-h-screen` on the authenticated shell.
- `html, body, #root`: `height: 100%; overflow: hidden` on authenticated app. Login screen is allowed to scroll the page.
- `main` is the **only** vertical scroller for screen content.
- Views must not set `h-screen`, `min-h-screen`, or `overflow-y-auto` on their root. Exception: inner lists inside sheets/modals.
- Remove `screenNavKey` from the ErrorBoundary key. Use `key={currentScreen}` only if you must reset a crashed view; default is **keep the view mounted** and switch with `currentScreen`. Preferred: no key change on tab press.
- `handleSwitchScreen` still updates hash + `localStorage['apex_active_screen']`. Do not add React Router.

### 1.2 Motion contract (mandatory)

| Interaction | Animation | Duration | Forbidden |
|---|---|---|---|
| Bottom-nav tab change | Instant cut (opacity 0→1 optional, 80ms max) | 0–80ms | `translateX`, page carousel, `slide-in-from-left/right` |
| Sidebar open/close | `translateX` of **drawer only** | 220ms ease-out | Moving `<main>` or Header |
| Sheet open | `translateY(100% → 0)` of sheet card | 280ms cubic-bezier(0.16,1,0.3,1) | Sliding the page behind |
| Sheet close | reverse | 200ms | |
| Search | fade scrim + full-screen panel | 150ms | bottom-sheet conversion |
| Toast | fade + slight `translateY` from **top**, 12px below header | 150ms | `fixed top-4 right-4` covering header; never a sheet |
| Button press | existing `.touch-press` scale(0.97) | 80ms | bounce, spring libraries |

Android back / iOS swipe-back (Capacitor-ready):
- Open drawer: **do not** `history.pushState`. **Remove** the current `pushState({ drawer: 'sidebar' })` trap in `Sidebar.tsx` (lines 51–62). Hardware Back must close the drawer in JS, then pop hash screens, then minimize the APK.
- Open sheet: close with Close, scrim tap, or Escape. Do not push history for sheets.
- Hash back: existing `hashchange` listener stays.
- Add a tiny overlay stack in `App.tsx` (or `lib/mobileOverlay.ts`): `drawer` | `search` | `sheet` | `none`. Phase B Capacitor `App.addListener('backButton')` will call, in order: close sheet → close search → close drawer → if hash is not the role default, `handleSwitchScreen(default)` → else `App.minimizeApp()`. Wire the same function to `window.popstate` for browser testing before Capacitor exists.

### 1.3 Touch and type contract

| Token | Value |
|---|---|
| Icon-only hit target | min 44×44px |
| Text button | min height 44px, horizontal padding ≥ 12px |
| Bottom nav item | min 56×48px (already) |
| Form input on phone | font-size **16px** (already in CSS; keep) |
| Horizontal page scroll | **forbidden** on `body`/`main` |
| Table on phone | hide table; show card list. If a matrix must stay (monthly attendance, timetable), wrap **only that widget** in `.mobile-table-scroll` |
| Safe area | header `pt-[env(safe-area-inset-top)]`; bottom nav `pb-[max(0.6rem,env(safe-area-inset-bottom))]`; main padding accounts for both |

Colors stay Kampus: navy `#081A2F` / `#0E2A47`, amber `#B88634` / `amber-600`, page `#F4F8FC`, borders `#E6ECF2`.

---

## 2. CSS cleanup (`packages/frontend/src/index.css`)

### KEEP
- Font imports, Tailwind layers
- `overscroll-behavior-y: none` and `touch-action: manipulation` on `html, body`
- 16px inputs under 768px (Safari zoom guard)
- `.no-scrollbar`, `.touch-press`, `.safe-top`, `.safe-bottom`, `.safe-pb-nav`
- `.fixed.inset-0 { margin: 0 }` (prevents sibling margin collapse)
- `@keyframes mobileSlideUpSheet`
- `.mobile-table-scroll`

### DELETE or shrink (this is the sliding-bug source)
Delete the entire block titled **“UNIVERSAL MOBILE NATIVE BOTTOM SHEET & FORM ENGINE”** (`@media (max-width: 767px)` rules that target `.fixed.inset-0[class*="z-"]` with `!important`, including:
- forcing every overlay to `align-items: flex-end`
- forcing every white child into a sheet with `animation: mobileSlideUpSheet`
- `::before` drag-handle on arbitrary white cards
- forcing every form/overflow child `padding-bottom: max(3rem, …)`
- `table { display: block !important; overflow-x: auto }`
- button columns `flex-direction: column-reverse`

Replace with **opt-in** classes only:

```css
/* Opt-in sheet. Add className="mobile-sheet" to the overlay, "mobile-sheet-card" to the panel. */
@media (max-width: 767px) {
  .mobile-sheet {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 0;
    overflow: hidden;
  }
  .mobile-sheet-card {
    width: 100%;
    max-height: 90dvh;
    border-radius: 1.5rem 1.5rem 0 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: mobileSlideUpSheet 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .mobile-sheet-card::before {
    content: '';
    display: block;
    width: 36px; height: 4px;
    background: #cbd5e1;
    border-radius: 9999px;
    margin: 10px auto 6px;
    flex-shrink: 0;
  }
}
```

Also **stop** the 640px hammer that rewrites all `.p-6`, `.text-3xl`, `h1`. If compact type is needed, apply it on `PageHeading` and view roots, not globally.

Login, CommandPalette (`no-sheet-overlay`), toasts, sidebar backdrop, TrialExpiredLockoutModal, ForcePasswordChangeModal must **never** receive `mobile-sheet`.

---

## 3. Chrome — every control

### 3.1 Header (`packages/frontend/src/components/Header.tsx`)

Phone layout (`md:hidden` left cluster + always-visible right cluster):

| Order | Control | Visible | Action | Spec |
|---|---|---|---|---|
| L1 | Hamburger `Menu` | phone only | `onOpenSidebar()` + `hapticLight()` | 44×44, border `#E6ECF2`, rounded-xl, `aria-label="Open Navigation"` |
| L2 | Screen title | phone only | none | `text-xs font-bold truncate`, from `currentScreenTitle` |
| R1 | Search `Search` | phone only | `onOpenSearch()` + haptic | 36×36 icon button, `aria-label="Search"` |
| R2 | Bell `Bell` | all | student/parent → `#student_portal`; else if `canOpenScreen(..., 'absentee')` → `#absentee`; else no-op | 36×36. Keep rose dot **only if** absentee pending > 0. Today the dot is always on — wire it to the same pending count Sidebar already fetches, or hide the dot when 0. |
| R3 | New Admission | `lg+` and roles `tenant_admin` \| `academic_head` | `onNewAdmission()` → `#new_admission` | Hidden on phone (bottom nav Students + dashboard chip cover this). |
| R4 | Session pill | `xl+` only | none | Keep desktop. Hidden on phone. |
| R5 | Avatar button | all | toggle profile menu | Avatar 32px amber circle + chevron. Name/role text `hidden sm:block`. |

Profile dropdown (when open):

| Item | Who | Action |
|---|---|---|
| Name + email + role badge | all | display |
| Staff | `tenant_admin` | `#staff`, close menu |
| Settings | `tenant_admin` | `#settings`, close menu |
| Sign Out | all | `logout()` |

Phone profile menu: right-aligned, `w-60`, never clipped by viewport (`right-0`, `max-w-[calc(100vw-1.5rem)]`). Tapping outside closes it. Add a document click listener.

Desktop search bar (`hidden md:flex`) stays as today.

Header is `sticky` **inside** the column, `z-30`, `h-14`, `pt-[env(safe-area-inset-top)]`. It must not use `fixed` (fixed + dvh shell double-counts safe area).

### 3.2 Mobile bottom nav (`MobileBottomNav.tsx`)

Refactor to **one** `<nav>` + a role tab list. Same `data-testid="mobile-bottom-nav"`. Classes: `fixed bottom-0 inset-x-0 z-40 md:hidden bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-lg pb-[max(0.6rem,env(safe-area-inset-bottom))]`. Super-admin uses `bg-slate-900/95 border-slate-800`.

Exactly **5 items**. Active = `text-amber-800 bg-amber-50 font-bold` (super-admin: `text-amber-400 bg-slate-800`). Inactive = `text-slate-500`. Each `onClick` = `hapticSelection()` + `onSelectScreen(id)` except Menu = `hapticLight()` + `onOpenMenu()`.

**Tenant admin / staff (default)**

| # | Label | Icon | Screen | Active also when |
|---|---|---|---|---|
| 1 | Dashboard | `LayoutDashboard` | `dashboard` | |
| 2 | Attendance | `CheckSquare` | `attendance` | |
| 3 | Students | `Users` | `enrollment` | `new_admission`, `id_cards` |
| 4 | Fees | `CreditCard` | `voucher` | |
| 5 | Menu | `Menu` | opens sidebar | never “active” |

**Teacher** (unmanaged faculty)

| # | Label | Icon | Screen |
|---|---|---|---|
| 1 | Faculty | `GraduationCap` | `teacher` |
| 2 | Schedule | `Calendar` | `timetable` |
| 3 | Attendance | `CheckSquare` | `attendance` |
| 4 | Geofence | `MapPin` | `geofence` |
| 5 | Menu | `Menu` | drawer |

**Student / parent**

| # | Label | Icon | Screen |
|---|---|---|---|
| 1 | Overview | `UserCheck` | `student_portal` |
| 2 | Timetable | `Calendar` | `timetable` |
| 3 | Challans | `CreditCard` | `voucher` |
| 4 | Homework | `BookOpen` | `homework` |
| 5 | Menu | `Menu` | drawer |

Attendance, exams, help stay in the **drawer** for portal users (already in Sidebar). Do not add a 6th tab.

**Super admin** — fix the dead Receipts tab. Today item 3 is `voucher` but `MainLayout` super-admin branch never renders `FeeDeskView`.

| # | Label | Icon | Screen |
|---|---|---|---|
| 1 | Platform | `ShieldAlert` | `superadmin` |
| 2 | Campuses | `LayoutDashboard` | `dashboard` |
| 3 | Menu | `Menu` | drawer |

Use 3 tabs, `justify-around`. Do not keep a fake Fees tab.

### 3.3 Sidebar drawer (`Sidebar.tsx`)

Phone: overlay drawer. Desktop: sticky `md:w-[232px]` as today.

| Part | Spec |
|---|---|
| Backdrop | `fixed inset-0 z-50 md:hidden bg-slate-900/60` click = `onClose()`. No `mobile-sheet`. Add `no-sheet-overlay`. |
| Panel | `fixed top-0 left-0 z-50 h-[100dvh] w-[78vw] max-w-[260px] md:sticky md:h-screen`. Transform **panel only**: open `translate-x-0`, closed `-translate-x-full md:translate-x-0`. 220ms. |
| Inner aside | Keep navy `#081A2F`, rounded-tr/br-2xl, `pt-[max(1rem,env(safe-area-inset-top))]`, `pb-[max(1rem,env(safe-area-inset-bottom))]`. |
| Close X | phone only, 44×44, `aria-label="Close navigation"`, top-right of brand row. |
| Nav buttons | keep every existing button and `allow()` gate. Hit area `py-2.5` on phone (min 44px). |
| Sign out | bottom `LogOut` icon button, 44×44, `title="Sign Out"`. |

**Do not change labels or destinations.** Inventory (already implemented — preserve):

Teacher: Faculty Overview `teacher`, Class Schedule `timetable`, Take Attendance `attendance`, Homework & Notebooks `homework`, Grade Examinations `exams`, Staff Attendance `geofence`, Faculty Feedback `complaints`.

Student/parent: Overview / Child Overview `student_portal`, Class Timetable `timetable`, Attendance & Leaves `attendance`, Fees & Payments `voucher`, Homework Diary `homework`, Exams & Results `exams`, Help & Messages `complaints`.

Super admin: Academy Directory `superadmin`.

Tenant admin / managed staff (each wrapped in `allow()` except Staff which is `tenant_admin` only):

- Overview: Dashboard `dashboard`
- Academic: Students `enrollment`, Student ID Cards `id_cards`, Classes & Batches `classes`, Timetables `timetable`
- Daily: Attendance `attendance`, Absence Follow-Up `absentee` (+ pending badge), Homework `homework`, Staff Attendance `geofence`, Feedback `complaints`
- Examinations: Examinations `exams`
- Finance: Fees Receiving `voucher`, Fee Challans `challans`, Fee Reversals `fee_reversals`, Income & Expenses `expenses`, Payroll `payroll`
- Administration: Staff `staff`, Settings `settings`

Brand row: AcademyLogo + tenant name (or Kampus logo for super admin). Keep.

Remove `history.pushState` drawer trap.

On nav click: `hapticSelection()`, `onSelectScreen`, `onClose()` if `window.innerWidth < 768` (already).

### 3.4 Command palette / Search (`CommandPalette.tsx`)

Already `no-sheet-overlay` and full-screen on phone. Keep.

| Control | Phone spec |
|---|---|
| Overlay | tap = `onClose()` |
| Input | type=search, 16px font, autofocus |
| Clear X | show when query non-empty |
| Cancel | phone text button “Cancel” (already) |
| Desktop X | `hidden md:block` (already) |
| Result row | min height 48px, tap chooses module / student / invoice |

Arrow keys stay for desktop.

---

## 4. Login (`LoginModal.tsx`)

Unauthenticated. Full-page, **not** a sheet.

Phone:
- Hide left navy marketing column (`hidden lg:flex` already).
- Form column is the whole screen: logo + academy name + mode switcher + form.
- `min-h-[100dvh]`, inner form may scroll.
- Primary submit button full width, height 48px.
- Mode switcher (Sign in / Register / etc.) stays in the top bar; buttons min 44px.
- OTP / password visibility eye buttons 44×44.
- Keyboard: inputs 16px.

Do not wrap Login in `mobile-sheet`. Do not show bottom nav or header.

Same for `ForcePasswordChangeModal` and `TrialExpiredLockoutModal`: centered card, max-width 28rem, padding 16px, buttons 48px full width. Class `no-sheet-overlay` on the overlay.

`AnnouncementPopupModal`: phone = bottom sheet **opt-in** (`mobile-sheet` + `mobile-sheet-card`). Close X 44×44.

---

## 5. Shared page heading (`PageHeading.tsx`)

Today desktop heading is `hidden sm:flex` and phone only shows `children` (action buttons). That hides the page title on phone because Header already shows the title — **keep that**.

Phone action strip:
- `flex flex-wrap gap-2 w-full`
- Every child button: min-height 40px, `flex-1` if 1–2 actions, wrap if more.
- Do not overflow horizontally.

---

## 6. Screen-by-screen phone UI

For each screen: **one column**, card lists instead of tables, sticky in-page action bars **above** the bottom nav (never `bottom-14` overlapping it).

Offset formula for any in-page sticky footer or FAB:

```
bottom: calc(4.25rem + env(safe-area-inset-bottom))
```

Never `bottom-14` or `bottom-20`.

### 6.1 Dashboard — `DashboardView.tsx` — `#dashboard`

Keep data loading. Phone structure top → bottom:

1. Welcome line (Header already has “Dashboard”; keep the welcome `h1` at 18px, one line truncate).
2. Row: **Sync** icon button (44×44, spinning `RefreshCw` when `refreshing`) + date chip. No “Sync” text on phone (already `hidden md:inline`).
3. Quick chips (keep, make them wrap or 2×2 grid, **stop** horizontal chip scroll if chips fit):  
   - Attendance → `#attendance`  
   - Receive Fee → `#voucher`  
   - New Admission → `#new_admission`  
   - Challans → `#challans`  
   Each chip min-height 40px.
4. Daily Operational Overview 2×2 tiles (keep). Taps: Attendance, Fees, Students, Faculty/geofence. Whole tile is the button (`role="button"` + keyboard).
5. Stream donut card: hide “Hover segments…” on phone. Keep Directory button.
6. Weekly sessions card: keep Full Matrix → `#timetable`.
7. Operational Execution list: keep; allow copy as-is.
8. Recent activity list if present: stacked cards.

Hide radial gauges on phone (`hidden sm:grid` already). Do not introduce a page-slide between dashboard sections.

### 6.2 Students directory — `EnrollmentView.tsx` — `#enrollment`

Mobile tab chips (keep, horizontal snap **of chips only**):

| Chip | Tab | Extra |
|---|---|---|
| Directory (N) | `directory` | |
| Inquiries (N) | `inquiries` | |
| New Admission | `new_admission` | |
| ID Cards | `id_cards` | |

Directory phone:
- Search input full width, 44px height.
- Filters 2-col grid (already): All Classes, Section/Batch, Status.
- **Hide** desktop `<table>` (`hidden md:block` — add if the table is still visible under 768; today mobile cards are `md:hidden` and table is in a sibling — confirm table wrapper is `hidden md:block`).
- Card row (keep) as the row button → opens `StudentProfileModal`. Controls on the card:
  - Checkbox (stopPropagation) select
  - Avatar + name + admission #
  - Status pill
  - Class/batch + guardian
  - **Call** `tel:` if `guardian_phone`
  - **WhatsApp** → existing `setContactStudentModal`
  - Overflow **Delete/Archive** (same menu as desktop: Delete Student, Archive / Restore)
- Bulk bar when selection > 0: sticky **inside main**, above bottom nav, with existing bulk actions (do not change API). Buttons 44px.

Inquiries / New Admission / ID Cards: stack forms; primary submit 48px full width. ID card preview uses horizontal scroll **inside the preview only**.

### 6.3 Student profile sheet — `StudentProfileModal.tsx`

This is the most important sheet.

Overlay: `fixed inset-0 z-[9990] mobile-sheet` (plus existing fade).  
Card: `mobile-sheet-card max-h-[92dvh]`. Remove competing `slide-in-from-bottom-5` if the CSS animation already runs.

Header row (sticky in card):
- Drag handle (CSS `::before`)
- Student name + admission #, 1 line each
- Close X 44×44
- Existing actions that are icon/text buttons must wrap: ID Card, Print, etc. Phone: horizontal chip scroller under the title, min-height 40px each. Do not put 8 icons in one 320px row without scroll.

Tabs (keep order, shorten **visible label** on phone, keep `aria-label` full):

| Tab id | Phone label | Desktop label (unchanged) |
|---|---|---|
| `academic` | Academic | Academic Placement |
| `finance` | Fees | Fee Ledger & Invoices |
| `attendance` | Attendance | Attendance History |
| `exams` | Exams | Examination Results |
| `notebook` | Notebook | Notebook Checking |
| `status` | Status | Status & Standing |

Tabs: `overflow-x-auto no-scrollbar`, each tab min-height 44px, `px-3`.

Tab bodies: stacked fields, no 3-column grids. Tables inside tabs → card list or `.mobile-table-scroll`. Footer actions (Save, Archive, Reset password, Delete) full-width 48px, stacked, primary amber / danger rose. Gate Archive/Reset/Delete with existing `isAdmin`.

Nested modals (add class, ID card, password, delete confirm): another `mobile-sheet` at `z-[10000]`. Confirm buttons 48px.

### 6.4 Attendance — `AttendanceDeskView.tsx` — `#attendance`

Keep batch picker, date, search, status chips.

Roster:
- Desktop table `hidden md:block`
- Phone cards (already `md:hidden`): name, adm #, guardian, **Present / Late / Absent / Excused** as a 4-segment control, each segment min 44px height. Call/WhatsApp 40px.

**Save bar (broken today):** replace

`className="sm:hidden fixed bottom-14 ..."`

with

`className="sm:hidden sticky bottom-0 ... mb-0"` **inside main**,  
or `fixed` with `bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30`.

Buttons: count text + **Save Roster** 48px.

Empty states: keep **Go to Classes & Batches** and **Go to Admissions Desk**.

Monthly matrix: `.mobile-table-scroll`, first column sticky.

### 6.5 Fees receiving — `FeeDeskView.tsx` — `#voucher`

Header buttons on phone become chips in `PageHeading` children:
- **Fee Heads & Priority**
- **Bulk Fee Revision**

Both min-height 40px; wrap.

Segmented tabs (keep): Fees Receiving | Fee Defaulters (count) | Finance Reports. `min-w-[120px]` causes horizontal scroll — on phone use `flex-1 min-w-0` and **short labels**: Receiving | Defaulters | Reports.

Cashier: search 44px, student result **cards** (already `sm:hidden` in places). Collect / print / concession buttons 48px full width in the dossier.

Toast: move from `fixed top-4 right-4` to `fixed left-3 right-3 top-[calc(3.5rem+env(safe-area-inset-top)+0.5rem)] z-50` so it sits under the header and is not turned into a sheet.

### 6.6 Challans / reversals / expenses / payroll

Same pattern:
- Desktop table hidden on phone
- Card list (`md:hidden` already on payroll, income)
- FABs: `IncomeExpenseDeskView` and others use `fixed bottom-20 right-4`. Change to `right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30`.
- Primary create buttons 56×56 circle, never covered by tab bar.

### 6.7 Classes & batches — `AcademicStructureView.tsx` — `#classes`

Phone: accordion list of programs → batches. Keep existing `sm:hidden space-y-2.5` blocks. Create/Edit modals: add `mobile-sheet` / `mobile-sheet-card`. Submit 48px.

### 6.8 Timetable — `TimetableDesk.tsx` — `#timetable`

Phone: day chips (Mon–Sat) horizontal; slots as cards (time, subject, teacher, room). FAB Add Slot uses new bottom offset. Grid matrix stays desktop-only.

Student/parent timetable is **inside** `StudentParentPortalView` when `currentView === 'timetable'` — style that list as cards, day chips 44px.

### 6.9 Homework / Exams / Absentee / Staff clock-in / Complaints / Staff desk / Settings

| Screen | File | Phone rules |
|---|---|---|
| Homework | `HomeworkDesk.tsx` | Filters stack; assignment cards; create FAB offset; no nested `max-h-[calc(100vh-22rem)]` on phone (use natural main scroll) |
| Exams | `ExamDeskView.tsx` | Card list already `md:hidden`; FAB offset; sheets for create/grade |
| Absentee | `AbsenteeRetentionDeskView.tsx` | 3 KPI tiles already; follow-up cards; Call/WhatsApp 40px; status buttons 44px |
| Geofence | `StaffClockInView.tsx` | Keep clock-in primary 56px; lists as cards (`md:hidden` exists) |
| Feedback | `ComplaintsDeskView.tsx` | Thread list cards; composer sheet |
| Staff | `StaffDeskView.tsx` | Directory cards; access drawer = `mobile-sheet` |
| Settings | `AcademySettingsView.tsx` | Single column sections; saves 48px sticky in main |
| Super admin | `SuperAdminControlPlaneView.tsx` | Campus cards; backup buttons 44px; no bottom-sheet on lockout |

### 6.10 Student / parent portal — `StudentParentPortalView.tsx`

`MainLayout` already renders this for all student/parent screens except `complaints`. `activeScreen` maps:

| `activeScreen` | Block around line |
|---|---|
| `student_portal` | ~618 Overview |
| `timetable` | ~1097 |
| `attendance` | ~1198 |
| `voucher` | ~1356 |
| `homework` | ~1640 |
| `exams` | ~1757 |

Phone overview:
- Child switcher (parent) full-width select 44px
- Class switcher if multi-enrollment 44px
- Stat tiles 2×2
- Quick actions: Timetable, Fees, Homework, Attendance — 44px
- Password: **Change password** button opens modal (not a sheet of the whole portal)

Challans: card list (`md:hidden` already ~1529). Pay/print keep existing handlers.

Leave modal: `mobile-sheet`. Fields stacked. Submit 48px.

Do not render a second bottom nav inside the portal.

### 6.11 Teacher portal — `TeacherPortalView.tsx` — `#teacher`

Phone home: today’s classes cards, Take Attendance CTA 48px, Schedule, Homework. No desktop tables.

---

## 7. Overlay classification (apply to every `fixed inset-0`)

Add one of these class pairs. No silent defaults.

| Overlay | Classes | Examples |
|---|---|---|
| Left drawer | `no-sheet-overlay` on scrim; panel is the sidebar | `Sidebar` |
| Full screen | `no-sheet-overlay` | `CommandPalette`, Login, lockout, force password |
| Bottom sheet | `mobile-sheet` + child `mobile-sheet-card` | Student profile, fee collect, create batch, leave apply, confirm delete, announcement |
| Toast / popover | neither; `z-50`, positioned under header | FeeDesk toast, Header profile menu, select menus (`ModernSelect`) |

`ModernSelect` dropdown stays anchored to the field (`absolute`), never a sheet, never `fixed inset-0`.

PDF viewer `InPortalPdfViewerModal`: full screen `no-sheet-overlay` on phone (reading surface), close 44×44.

---

## 8. PWA bits (small, required for “app like”)

`packages/frontend/public/manifest.json`:
- `theme_color`: `#081A2F` (match `index.html`, not `#4f46e5`)
- `background_color`: `#F4F8FC`
- `display`: `standalone` (keep)
- `orientation`: `portrait` (keep)
- Add 512×512 icon if a file exists; do not invent binary assets.

`index.html`: keep viewport, apple-mobile-web-app-*, `theme-color #081A2F`.

Do not add a service worker in this pass.

---

## 9. Implementation order (PRs / commits)

Do these in order. After each, phone Chrome 375×812 and 390×844: no horizontal page scroll, bottom nav fully visible, header fully visible.

1. **Shell** — `App.tsx` dvh layout; remove `screenNavKey` remount; overlay stack (`drawer` | `search` | `sheet` | `none`) for Back; `index.css` delete universal sheet engine; html/body/#root overflow.
2. **Chrome** — Header, Sidebar (remove pushState), MobileBottomNav refactor + super-admin tabs, CommandPalette untouched except z-index.
3. **Login + lockouts** — `no-sheet-overlay`, 48px primary buttons.
4. **Opt-in sheets** — StudentProfileModal, then every `fixed inset-0` in views tagged sheet vs full-screen. Grep `fixed inset-0` under `packages/frontend/src` and classify each.
5. **Fix overlapping bars** — Attendance save bar; FABs in Exam, Timetable, IncomeExpense; FeeDesk toast.
6. **Directory / attendance / fees / portal lists** — guarantee `hidden md:block` on tables and card lists on phone; 44px actions.
7. **Remaining desks** — classes, homework, exams, absentee, staff, settings, superadmin.
8. **Manifest theme_color**.

---

## 10. Explicit non-goals (Phase A — web shell)

- No backend/API changes, no new endpoints, no CORS work on Render.
- No `school-erp`.
- No Ionic, React Native, Expo, or Cordova.
- No `npm install @capacitor/*` until Phase B (section 14) and Phase A checklist is green.
- No splitting Enrollment/Fee/Profile into new packages unless a file becomes impossible to edit; prefer className/layout edits inside existing components.
- No new animation library.
- No horizontal page transitions.
- No extra global `!important` CSS.
- Do not change role permission logic (`canOpenScreen`, `allow()`, `isAdmin`).
- Do not change fee/attendance/enrollment business rules or copy except shortened **phone tab labels** listed above.
- Do not enable `user-scalable` (keep no-zoom to avoid iOS input zoom; 16px inputs already compensate).

---

## 11. Acceptance checklist (Gemini must run)

Device widths: **375×812** (iPhone SE/13 mini class) and **390×844** (iPhone 12/13). Also 360×800 Android.

Authenticated as tenant_admin, then teacher, then student (or parent).

For each role:
- [ ] Header never overlaps content; title matches `getScreenMeta`.
- [ ] Bottom nav never overlaps primary actions; every tab switches **instantly** (no lateral slide).
- [ ] Opening Menu slides **only** the navy drawer; main content stays still; scrim tap closes; Close X closes; Sign Out works.
- [ ] Hardware/browser Back does **not** require two presses to leave a screen after opening the drawer.
- [ ] Search opens full screen; Cancel closes; picking a student opens enrollment/profile flow.
- [ ] No horizontal scroll on Dashboard, Students, Attendance, Fees, Portal Overview (`document.documentElement.scrollWidth === innerWidth`).
- [ ] Login: no drawer, no bottom nav, submit reachable above the keyboard.
- [ ] Student profile: sheet from bottom, tabs swipe **horizontally inside the tab bar only**, Save/Close reachable.
- [ ] Attendance Save Roster sits above the tab bar and saves.
- [ ] Fee toast does not become a bottom sheet.
- [ ] Desktop 1280px: sidebar sticky, no bottom nav, tables still visible.

Console: no new errors. Existing hash deep links (`#voucher`, `#enrollment?student_id=`) still work.

---

## 12. File list (expected edits)

```
packages/frontend/index.html                          # only if theme/body height needed
packages/frontend/public/manifest.json                # theme_color, background_color
packages/frontend/src/index.css                       # delete universal engine; opt-in sheet; html/body/#root
packages/frontend/src/App.tsx                         # dvh shell; stop remount; overlay stack; main padding
packages/frontend/src/lib/mobileOverlay.ts            # optional: drawer|search|sheet|none for Back (Phase A)
packages/frontend/src/lib/haptics.ts                  # Phase B only: Capacitor Haptics inside existing helpers
packages/frontend/src/components/Header.tsx           # 44px hits; bell dot; profile outside-click
packages/frontend/src/components/Sidebar.tsx          # remove pushState; 44px rows; no-sheet-overlay
packages/frontend/src/components/MobileBottomNav.tsx  # single nav; super-admin 3 tabs
packages/frontend/src/components/CommandPalette.tsx   # keep; confirm no-sheet-overlay
packages/frontend/src/components/PageHeading.tsx      # wrap actions
packages/frontend/src/components/LoginModal.tsx       # 48px CTA; 100dvh
packages/frontend/src/components/ForcePasswordChangeModal.tsx
packages/frontend/src/components/TrialExpiredLockoutModal.tsx
packages/frontend/src/components/AnnouncementPopupModal.tsx
packages/frontend/src/components/StudentProfileModal.tsx
packages/frontend/src/components/StudentIDCardModal.tsx
packages/frontend/src/components/InPortalPdfViewerModal.tsx
packages/frontend/src/views/DashboardView.tsx
packages/frontend/src/views/EnrollmentView.tsx
packages/frontend/src/views/AttendanceDeskView.tsx
packages/frontend/src/views/FeeDeskView.tsx
packages/frontend/src/views/FeeChallansView.tsx
packages/frontend/src/views/FeeReversalsView.tsx
packages/frontend/src/views/IncomeExpenseDeskView.tsx
packages/frontend/src/views/PayrollDeskView.tsx
packages/frontend/src/views/AcademicStructureView.tsx
packages/frontend/src/views/TimetableDesk.tsx
packages/frontend/src/views/HomeworkDesk.tsx
packages/frontend/src/views/ExamDeskView.tsx
packages/frontend/src/views/AbsenteeRetentionDeskView.tsx
packages/frontend/src/views/StaffClockInView.tsx
packages/frontend/src/views/StaffDeskView.tsx
packages/frontend/src/views/ComplaintsDeskView.tsx
packages/frontend/src/views/AcademySettingsView.tsx
packages/frontend/src/views/StudentParentPortalView.tsx
packages/frontend/src/views/TeacherPortalView.tsx
packages/frontend/src/views/SuperAdminControlPlaneView.tsx
```

Grep before finishing:

```
fixed bottom-14
fixed bottom-20
pushState
screenNavKey
UNIVERSAL MOBILE NATIVE
slide-in-from-left
slide-in-from-right
min-h-screen
```

Zero hits for `bottom-14` / `bottom-20` / drawer `pushState` / universal engine when done.

---

## 13. How to send this to Gemini

Paste this whole document. First message:

> Implement Phase A of this plan in `packages/frontend` only, commit order in section 9. After each commit, check 375px width: no horizontal page scroll, bottom nav fully visible. Do not add global `!important` CSS. Do not remount views on tab change. Do not animate the main pane with translateX. Do not install Ionic. Do not install Capacitor until Phase A section 11 is green; keep every overlay and safe-area rule Capacitor-ready for Phase B (section 14).

When Gemini returns a diff, verify against sections 1.1, 1.2, 3.2 (super-admin tabs), 6.4 (attendance bar), 7, 11, and 0A (no Ionic, Capacitor-ready Back stack).

---

## 14. Phase B — Capacitor Android APK (after Phase A is green)

Do this only when section 11 passes on 375px Chrome. Phase B is a **wrapper**, not a redesign.

### 14.1 Install (frontend package)

Working directory: `packages/frontend`.

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/app @capacitor/status-bar @capacitor/haptics @capacitor/keyboard
npx cap init "Kampus" "pk.kampus.app" --web-dir dist
npx cap add android
```

`capacitor.config.ts`:

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'pk.kampus.app',
  appName: 'Kampus',
  webDir: 'dist',
  server: {
    // v1 APK: load the hosted PWA so /api Pages Functions keep working
    url: 'https://edu.kampus.pk',
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#081A2F',
  },
  plugins: {
    StatusBar: { style: 'DARK', backgroundColor: '#081A2F' },
    Keyboard: { resize: 'body' },
  },
};
export default config;
```

Tenant academies: v1 can stay on `edu.kampus.pk` login (slug/domain as today). Later, `server.url` can be the academy subdomain if you ship per-campus APKs.

### 14.2 Back button (required)

New file `packages/frontend/src/lib/capacitorBack.ts`, called from `MainLayout` `useEffect`:

```
on backButton:
  if sheetOpen -> closeSheet(); preventDefault
  else if searchOpen -> setSearchOpen(false); preventDefault
  else if sidebarOpen -> setSidebarOpen(false); preventDefault
  else if currentScreen !== getDefaultScreenForRole(...) -> handleSwitchScreen(default); preventDefault
  else App.minimizeApp()
```

Guard with `Capacitor.isNativePlatform()`. Browser keeps using the overlay stack from section 1.2.

### 14.3 Status bar, keyboard, haptics

- On native boot: `StatusBar.setOverlaysWebView({ overlay: true })` so `env(safe-area-inset-top)` is real. Header already pads `safe-area-inset-top`.
- Keyboard: `Keyboard` resize body so Login and fee collect inputs stay above the keyboard.
- `packages/frontend/src/lib/haptics.ts`: if native, call `Haptics.impact({ style: ImpactStyle.Light })` inside existing `hapticLight` / `hapticSelection` / `hapticSuccess`. Same function names; no button rewrites.

### 14.4 Android project hygiene

- `android/app/src/main/AndroidManifest.xml`: `android:windowSoftInputMode="adjustResize"`; portrait; `INTERNET`.
- Splash background `#081A2F`.
- Do not commit keystores. Play signing is later.
- Build: `npm run build` is still the Vite web build; hosted `server.url` means `webDir` is unused at runtime for v1. Keep `webDir: dist` so a later offline bundle is one config change (`server.url` removed).

### 14.5 What Phase B must not do

- Must not introduce Ionic components.
- Must not point the WebView at `http://localhost:4000` or the Render API host (CORS + no Pages `/api` proxy).
- Must not change SIS business logic.
- iOS (`npx cap add ios`) is a later store pass; Android APK first.

### 14.6 Phase B acceptance

- Install APK on a real Android phone.
- Cold start shows Kampus login (or session if WebView storage persisted).
- Android Back: sheet → search → drawer → previous hash screen → Home (minimize).
- Bottom nav clears the 3-button nav bar / gesture inset.
- Status bar navy, content not hidden under the notch/cutout.
- Collect fee / mark attendance / open student profile still hit `/api/v1/...` 200s.
