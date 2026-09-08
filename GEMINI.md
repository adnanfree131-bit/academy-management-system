# GEMINI.md

## 🧠 Codebase Memory MCP
**CRITICAL RULE:** For this project, **ALWAYS** use `codebase-memory-mcp` for code discovery, symbol lookups, architecture inspection, and tracing relationships before falling back to grep/find.

See [AGENTS.md](./AGENTS.md) for full gstack workflows, skill commands, and engineering guidelines.

---

## 🚫 STRICT RULE: ZERO AI SLOP IN TEXT, UI & DESIGN

To ensure an authentic, institutional ERP experience for real school and college administrators, **NEVER** introduce AI slop patterns in wording, design, or layout.

### 1. Wording & Text Blacklist (No AI Buzzwords or Grasping Phrasing)
* **Never use grandiose, marketing, or sci-fi buzzwords**:
  * ❌ Prohibited: `"Command Center"`, `"Mission Control"`, `"360° SIS Profile"`, `"Curriculum Hub"`, `"Buckets"`, `"Liquidation Engine"`, `"Cutting-edge"`, `"State-of-the-art"`, `"Seamlessly manage"`, `"Unlock the power of"`.
  * ✅ Required Institutional Terms: `"Student Profile"`, `"Academic Structure"`, `"Classes & Batches"`, `"Fee Ledger & Challans"`, `"Payment Allocation"`, `"Attendance History"`, `"Examination Results"`, `"Notebook Checking"`.
* **Never use fake or exaggerated academic remarks**:
  * ❌ Prohibited: *"Outstanding analytical problem solving in Newtonian mechanics"*, *"Exemplary historical timeline comprehension and Quranic references"*, *"Exceptional conceptual grasping"*.
  * ✅ Required Realistic Remarks: *"Good conceptual understanding and lab work"*, *"Classwork and numericals complete"*, *"Satisfactory performance in practicals"*, *"Needs improvement in homework consistency"*.
* **Never use financial bankruptcy/debt recovery jargon for school fees**:
  * ❌ Prohibited: `"Fee Liquidation"`, `"Automatic Sub-head Liquidation Engine"`.
  * ✅ Required Terms: `"Fee Invoicing & Payment Allocation"`, `"Payment Allocation Order"`, `"Receive Payment"`.

### 2. Visual Design Slop Blacklist
* ❌ **No Gradient Avatars or Candy Badges**: Never wrap avatars in `bg-gradient-to-tr from-indigo-500 to-purple-600` or use dark banners with glowing pastel pill badges. Use standard 3:4 passport-ratio portrait frames with subtle neutral borders (`border-slate-300`).
* ❌ **No Numbered Navigation Tabs**: Never label tabs as `"1. Academic Placement"`, `"2. Financial Ledger"`, `"3. Quick Fee Collection"`. Tabs must be unnumbered, clean, and natural.
* ❌ **No Fragmented Cashier Workflows**: Operational actions must live where the data lives. Do NOT split fee collection into an isolated tab—embed an interactive cashier drawer directly inside the Fee Ledger.
* ❌ **No Symmetrical 3-Card Pastel Grids**: Avoid the classic AI 3-column feature grid (green/gray/red pastel boxes with huge centered numbers). Use high-density tabular registers and clear summary strips instead.
* ❌ **No Emojis as Design Decor**: Do not use rocket, sparkle, or fire emojis in headers, cards, or tables.
* ✅ **Maintain Institutional Document-Grade Density**: Clean sans-serif typography, monospaced tabular numerals (`font-mono`), crisp borders (`border-slate-200`), and dedicated `@media print` stylesheets for A4 documents (duplex ID cards and 3-part bank challans).

---

## 🏛️ STRICT RULE: INTERCONNECTED ERP HIERARCHY & DATA FLOW

Features must **NEVER** be built as standalone, disconnected islands. All modules must maintain end-to-end hierarchy:
1. **Academic Hierarchy**:
   * **Program / Class** (e.g. Class 10, F.Sc Pre-Medical)
   * ↳ **Batch / Section** (with Shift [Morning/Evening], Classroom #, Capacity, Academic Session)
   * ↳ **Curriculum Groups**: Mandatory Compulsory Core (Islamiyat, Pak Studies, English, Urdu) vs. Elective Track Streams (Pre-Medical, Pre-Engineering, Computer Science).
   * ↳ **Students**: Roll #, Admission #, Enrolled Subjects matching selected elective stream.
   * ↳ **Fee Structure**: Class/Batch baseline tuition, admission, exam fees + individual approved concessions/scholarships.
   * ↳ **Fee Invoices & Bank Challans**: Itemized 3-part challans (Bank Copy, Academy Copy, Student Copy) honoring payment allocation order.
   * ↳ **Attendance & Examination Marksheets**: Linked directly to enrolled subjects, batches, and terms.
2. **Zero-Hardcoding Financials**:
   * Account heads for income and expenses must be dynamically user-defined (no hardcoded category lists).
   * Support daily cashbook vouchers, payment methods (Cash, Meezan IBFT, EasyPaisa, JazzCash, Cheque), and monthly profit & loss reporting.
3. **Dual-Mode Attendance & Geofencing**:
   * Campus geofencing must always support **both** HTML5 GPS auto-detection and manual latitude/longitude input.
