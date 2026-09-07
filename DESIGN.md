# DESIGN.md — Enterprise Design System & UI/UX Standards

> **Status:** APPROVED & LOCKED  
> **Aesthetic Archetype:** Stripe / Institutional Modern  
> **Core Ethos:** High-density institutional clarity, zero AI slop, native mobile tactile precision.

---

## 1. Design System Philosophy: "Anti-AI Slop"

Most modern AI-generated web apps suffer from generic "slop": oversized purple-to-pink gradient buttons, bloated 24px rounded corners, empty whitespace, washed-out low-contrast text, and useless decorative illustrations. 

This Academy Management ERP follows the **Stripe / Institutional Modern** design standard:
1. **Institutional Authority & Density**: Enterprise software is for daily operators (registrars, cashiers, principals). Space is utilized efficiently; operational tables are dense (38–44px row heights), and financial figures are clear and right-aligned.
2. **Crisp 1px Spatial Hierarchy**: Visual structure is defined by sharp 1px borders (`border-slate-200`) and subtle slate backgrounds (`bg-slate-50`), not heavy drop shadows or blurred neon glows.
3. **Tabular Data Legibility**: All student IDs, fee amounts, timestamps, and roll numbers enforce monospace or tabular figures (`font-mono` / `font-feature-settings: 'tnum'`) so columns align vertically without optical jitter.
4. **Desktop Efficiency, Mobile Tactile**: Desktop provides dense multi-column operational desks; mobile transforms into an edge-to-edge native app experience with bottom navigation and slide-up action sheets.

---

## 2. Color Palette & Token System

### 2.1 Neutral Foundation
| Token | Hex Value | Role / Usage |
|---|---|---|
| `slate-900` | `#0F172A` | Primary headings, high-contrast dark badges, master titles |
| `slate-800` | `#1E293B` | Sidebar navigation background, primary CTA buttons |
| `slate-600` | `#475569` | Body text, table labels, secondary descriptions |
| `slate-400` | `#94A3B8` | Placeholder text, icon neutral stroke, inactive state |
| `slate-200` | `#E2E8F0` | Structural borders, dividers, table cell separators |
| `slate-100` | `#F1F5F9` | Hover states, search bar background, inactive chips |
| `slate-50` | `#F8FAFC` | Page body background, sub-panel fills |
| `white` | `#FFFFFF` | Card surface, modal surface, table rows |

### 2.2 Semantic & Accent Colors
| Token | Hex Value | Usage |
|---|---|---|
| `indigo-600` | `#4F46E5` | Primary brand accent, active navigation item, primary links |
| `indigo-700` | `#4338CA` | Hover state for primary accent buttons |
| `emerald-600` | `#059669` | Paid status, Present attendance, successful validation |
| `emerald-50` | `#ECFDF5` | Present/Paid badge background |
| `rose-600` | `#E11D48` | Defaulter status, Absent attendance, danger actions |
| `rose-50` | `#FFF1F2` | Absent/Defaulter badge background |
| `amber-500` | `#F59E0B` | Late attendance, pending approvals, warning alerts |
| `amber-50` | `#FFFBEB` | Late/Warning badge background |
| `sky-500` | `#0284C7` | Excused/Medical leave, student transfer, info alerts |
| `sky-50` | `#F0F9FF` | Excused/Info badge background |

---

## 3. Typography & Micro-Typography

- **Primary Font Family**: `Inter`, `-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`, `Roboto`, `sans-serif`
- **Numbers / Currencies / Timestamps**: Enforce tabular alignment:
  ```css
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
  ```
- **Scale**:
  - `Display / KPI`: `text-2xl` (24px) or `text-3xl` (30px), `font-bold tracking-tight text-slate-900`
  - `Page Heading`: `text-lg` (18px) to `text-xl` (20px), `font-semibold text-slate-900`
  - `Card Header / Section Title`: `text-sm` (14px), `font-semibold text-slate-900`
  - `Body / Cell Text`: `text-xs` (12px) to `text-sm` (14px), `text-slate-600`
  - `Micro Badges & Meta`: `text-[10px]` to `text-[11px]`, `font-medium uppercase tracking-wider`

---

## 4. Component Standards

### 4.1 KPI Metric Cards
- **Container**: White background, `border border-slate-200 rounded-lg p-4 shadow-sm`.
- **Top Row**: Small uppercase title (`text-[11px] font-semibold text-slate-500 uppercase tracking-wider`) + 20px contextual icon.
- **Value**: High-contrast bold numeric display (`text-2xl font-bold text-slate-900 tabular-nums`).
- **Footer**: Micro trend indicator with semantic pill (e.g. `+12.4% vs last mo` in emerald green) or progress meter.

### 4.2 Operational Data Tables
- **Container**: Bordered table enclosure (`border border-slate-200 rounded-lg overflow-hidden bg-white`).
- **Header**: `bg-slate-50 border-b border-slate-200 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500`.
- **Rows**: Fixed height 40px, `border-b border-slate-100 hover:bg-slate-50/75 transition-colors`.
- **Alignment**:
  - Text & Names: Left-aligned
  - Status Pills & Checkboxes: Centered
  - Invoices, Quantities, Prices, Timestamps: Right-aligned (`tabular-nums`)

### 4.3 Form Controls & Dynamic Inputs
- **Inputs & Selects**: Height 36px (`h-9`), `px-3 text-sm bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500`.
- **Buttons**:
  - *Primary*: `bg-slate-900 text-white hover:bg-slate-800 text-xs font-medium px-3.5 py-2 rounded-md shadow-sm active:scale-[0.98]`
  - *Accent*: `bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-medium px-3.5 py-2 rounded-md shadow-sm`
  - *Secondary / Ghost*: `bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium px-3 py-2 rounded-md`
### 4.4 Navigation Architecture: Left Sidebar & Top Status Bar
- **Left Sidebar Standard (`w-64 bg-white border-r border-slate-200`)**:
  - *Primary Theme (Stripe Crisp White)*: Seamless integration with the workspace. Pure white container, crisp 1px border (`border-slate-200`), high-density institutional typography.
  - *Active Link Style*: Subtle indigo highlight pill (`bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200 shadow-2xs`).
  - *Inactive Links*: Clean slate text (`text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium transition-colors`).
  - *Brand & Context*: Academy monogram (`Æ`), institution name, active campus & academic year pill.
  - *Categorized Desks*: High-contrast grouped sections (`Overview`, `Academic Desks`, `Finance & Billing`, `Mobile Native UX`).
  - *Operator Card*: Bottom pinned user card with avatar, role pill, and fast sign-out trigger.
- **Top Status Bar (`h-16 bg-white border-b border-slate-200`)**:
  - *Left*: Responsive sidebar hamburger toggle (`md:hidden`) + breadcrumb trail (`Apex Academy / Active Screen`).
  - *Center*: Interactive Theme Switcher (`⚪ Crisp White (Stripe)`, `🔘 Soft Slate (Linear)`, `⚫ Executive Dark`).
  - *Right*: Global command search (`⌘K`), unread notification badge, and primary quick action (`+ New Admission`).

---

## 5. Module 17: Native-Grade Mobile Architecture Standards

The web application is built to provide a 100% native mobile app feel when visited on mobile Safari/Chrome or compiled to Android APK via Capacitor.

### 5.1 Kinetic & Viewport Principles
1. **No Elastic Bounce**:
   ```css
   html, body {
     overscroll-behavior-y: none;
     -webkit-overflow-scrolling: touch;
   }
   ```
2. **Instant Zero-Latency Touch**:
   ```css
   * {
     touch-action: manipulation;
     -webkit-tap-highlight-color: transparent;
   }
   ```
3. **Safe-Area Inset Handling**:
   ```css
   .mobile-header {
     padding-top: max(12px, env(safe-area-inset-top));
   }
   .mobile-bottom-bar {
     padding-bottom: max(12px, env(safe-area-inset-bottom));
   }
   ```
4. **No Accidental Text Selection**:
   Interactive controls, roster rows, and navigation items enforce `user-select: none`.

### 5.2 Mobile UI Paradigms (Drawers over Modals)
- **Slide-Up Bottom Sheets (Drawers)**: Desktop centered dialogs are prohibited on mobile screen sizes (`< 768px`). Modals automatically render as bottom sheets sliding up from screen bottom with:
  - Top grab pill handle (`w-10 h-1 bg-slate-300 rounded-full mx-auto mb-3`)
  - Swipe-down dismiss gesture
  - Action buttons anchored to thumb zone
- **Role-Based Fixed Bottom Navigation**:
  - Always pinned with glassmorphic hardware blur (`backdrop-blur-md bg-white/95 border-t border-slate-200`)
  - Minimum 48px touch targets for thumb reach
  - Active tab highlighted in Indigo with subtle scale feedback
- **Mobile Input Optimization**:
  - OTP & PINs: `inputmode="numeric" autocomplete="one-time-code"`
  - Phone: `inputmode="tel"`
  - Currency/Fees: `inputmode="decimal"`
  - Dynamic viewport padding when keyboard opens to prevent blind typing.

---

## 6. Official Design Prototype
The interactive, browser-testable HTML prototype lives at:  
👉 `file:///home/adnan/Desktop/academy%20management%20system/design.html`
