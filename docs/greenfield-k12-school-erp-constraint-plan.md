# Greenfield K-12 School ERP — Constraint Plan

**Status:** research plan, not a build spec for the existing academy product  
**Scope:** a real school (grades, board/affiliation, academic year, legal student record, fee ledger, staff payroll)  
**Primary artifact:** production edge cases that AI-built school software misses until go-live  
**Not in scope:** coaching batches, tuition-center CRM, WhatsApp-first absentee desks, decorative dashboards  
**Verification:** a parallel deep-research run finished **Partial**. No candidate claim survived its verifier shard (two shards also failed claim-ID validation, so the pipeline itself dropped everything). The useful output is the **uncertainty list**: several things this plan originally treated as universal ERP law are actually local statute, board bye-law, vendor practice, or configurable policy. Those distinctions are now in §0.1.

This document is a **constraint-based ERP plan**. Features are downstream of invariants. If a screen cannot preserve the invariant, it is not a feature. Mixing *statute*, *interoperability standard*, *accounting practice*, and *school policy* into one “the system must” list is how AI products become unusable in a second country — or illegal in the first.

---

## 0. What “AI slop” actually is in this domain

AI-built school apps ship a **student row with a status dropdown**, plus CRUD screens named Fee, Attendance, Exam, Timetable. That model collapses the moment the school year is no longer a happy path.

A real Student Information System (SIS) / school ERP is a **legal record system with a general ledger attached**. Commercial products (PowerSchool, Infinite Campus, Skyward, SIMS/Bromcom, iSAMS, FACTS, OpenEduCat) and the Ed-Fi / OneRoster standards all separate:

| Thing | What it is | What it is not |
|---|---|---|
| Person | Durable identity. Legal name, identifiers, demographics. Survives leaving the school. | A class roster row |
| Student role | A person in relation to a school | “Active/Inactive” on the person |
| Enrollment (school membership) | Dated association: student + school + entry date + grade + entry/exit codes | A boolean “enrolled” |
| Section membership | Dated membership in a class/section (OneRoster “enrollment”) | The same as school enrollment |
| Academic year / calendar | The period that defines membership days, terms, holidays, in-session dates | A label on the student |
| Invoice / receipt | Posted financial documents | Editable amounts on a student card |
| Result | A published academic fact with a freeze | A number in a spreadsheet cell |

Infinite Campus states this explicitly: **OneRoster “enrollment” = class membership; Campus “enrollment” = school membership stored on the Enrollments tool.** AI products use one word for both and then cannot transfer a student between sections without destroying attendance history.

Ed-Fi’s documented anti-patterns are the same mistakes AI products make:

1. **Fictitious schools** created to track a programme (special ed, CTE, transport) instead of a Program association.
2. **Multi-year enrollments** that keep the original 9th-grade entry date when the student is in 11th grade. A student needs **at least one enrollment per school year and per grade level**.

Do not read the table above as “Skyward, SIMS, Bromcom, and iSAMS were inspected and require this split.” They were **not** successfully inspected in the verification run. The split is evidenced from **Ed-Fi, PowerSchool studentSchoolAssociation, Infinite Campus OneRoster mapping, and FACTS (Student / Family / Relationships / Finance, with one relative marked Financial Responsibility)**. Other vendors are likely similar; they are not proven here.

### 0.1 Constraint classes (do not collapse these)

Every rule in this plan belongs to one class. The product must store **which class a rule is**, because only Class A and some of Class B are unoverridable.

| Class | Meaning | Example | If you hard-code it |
|---|---|---|---|
| **A. Statute / regulation** | Law of a named jurisdiction | FERPA 34 CFR § 99.4: both parents have rights unless an order *specifically* revokes them. RTE 2009 s.16(4): no expulsion through elementary education | Wrong country → illegal or nonsense |
| **B. Interoperability / reporting standard** | You need this to talk to a board, state ODS, or LMS | Ed-Fi SSA keyed by student+school+entryDate; OneRoster class enrollment ≠ school enrollment; CBSE FAQ: 40 students/section without Board permission | You cannot file or sync |
| **C. Accounting integrity** | Books that auditors and cashiers can defend | Posted invoice not silently rewritten; unique receipt numbers; credit/debit notes for corrections | Not required by Ed-Fi/OneRoster. PowerSchool “permanently stored” grades can still be edited/deleted by authorised users. OpenEduCat/ERPNext *practice* uses credit notes; some school ERPs mutate `discount_amount` on the same invoice. **Choose C as a product rule**, do not claim it is SIS law |
| **D. Institution policy** | The school/trust sets it; the ERP executes and versions it | Refund 100%/75%/50%/0 vs full-year forfeit; sibling who gets the discount; late-fee slab; staff-ward %; whether unpaid fees block class | OpenEduCat treats withdrawal refund % as configured policy. There is **no worldwide prorata-vs-forfeit rule** |
| **E. Operational quality** | Stops the office from corrupting data on a busy morning | Cashier concurrency; cash session; idempotent gateway callbacks | Not a FERPA/GDPR/wage-hour mandate. Still ship it |

**What the verification run would not let us claim**

- Ed-Fi has **no universal effective-date**. Some values use optional Period (BeginDate/EndDate); that construct is even proposed for removal (DATASTD-1608). Effective-dating identity is a **product choice**, not an Ed-Fi requirement.
- Ledger “immutability” is **not** in Ed-Fi/OneRoster. FACTS separates finance and requires a financially responsible relative; it does not document posted-journal immutability.
- Unpaid prior-year tuition is **not** a uniform condition on promotion/detention in inspected state manuals. RTE s.16(4) is **elementary expulsion**, not a secondary TC/report-card rule.
- Waitlist queues (order, expiry, over-offer) were **not** found in department manuals. What *was* found: CBSE treats **40 students per section** as a ceiling needing Board permission, including late Class IX/XI admission after the last registration date.
- Skip vs repeat for a child already in school is **not** specified the way RTE s.4 specifies age-appropriate placement of a never-enrolled child. CBSE does ban admitting **above** the class the TC entitles.
- Indian statute/CBSE bye-laws inspected in the run do **not** define alumni / inactive / withdrawn / deceased as a status enum. Colorado CDE End of Year codes death as exit type 02 (obituary, parent notice, or administrator confirmation) and undocumented grade 7–12 leavers as dropouts (exit type 40). Model **exit types + documentation**, not four English adjectives.
- Official UDISE+ / PEN “reactivate the same person” workflow was **not** inspected on a Ministry primary. Do not invent a national ID merge from blogs.
- Cheque Received→Deposited→Cleared/Bounced is **not** a Fedena/OpenEduCat hard constraint. It is a product edge case. Still a good cashier workflow; not “industry law.”
- Staff-child concession is usually a **student/fee category**, not a unique posting rule.
- GST exemption flyers for Indian institutions up to higher secondary do **not** decide tax for another country or for non-core supplies.
- CBSE Examination Bye-Laws PDFs (Rules 13–14) were **access-denied** in the verification fetch. Attendance-eligibility claims in this plan that cite news circulars should be re-checked against the PDF before encoding.
- UK public qualifications are **per subject**, not a CBSE-style fail-year. JCQ clash tools detect coincident sittings; they do not auto-enforce three-hour/six-hour thresholds. Grace marks / cohort moderation are **not** an SIS automatic. JCQ special consideration is a post-assessment tariff (max 5%), not a pass-line bump.
- FERPA 99.4 does not specify how a **portal** should resolve two guardians’ conflicting access **when no court order exists**. COPPA requires verifying the adult is “the child’s parent”; it does not say which parent wins a disagreement.
- Teacher timetable load is **not** required to drive payroll. Many teachers are overtime-exempt; FLSA 516.2 records hours for covered employees. Mid-month join/leave has **no single statutory proration formula** in the inspected US texts.
- There is **no inspected primary survey** of “AI-built school apps.” That contrast is a design thesis, not a finding.
- Skyward, Capita SIMS/Bromcom, iSAMS primary go-live failures, OpenEMIS promotion procedure, Delhi School Education Rules 35/167 full text, Philippine DepEd Form 137, and North Dakota Infinite Campus conversion guide were **not** retrieved. Do not cite them as inspected.

**Implication for the kernel:** store `rule_class`, `jurisdiction`, `effective_from`, `source_citation` on every automated hold (no class, no TC, no exam file, no portal login). A hold without a class is slop.

---

## 1. Product thesis

Build a **kernel**, not a module zoo.

### Kernel (must exist before any “desk”)

1. **Person + Identity** (effective-dated; legal name history; identifiers)
2. **Education organisation** (trust / district / school / campus) — real schools only
3. **Academic year + calendar** (in-session days, terms, holidays, half-days, exam days)
4. **Enrollment** (school membership with entry/exit codes; never overwrite history)
5. **Course → Course offering → Section** (year-scoped)
6. **Roster** (section membership with start/end dates)
7. **Attendance event** (day or period; category; freeze rules)
8. **Posted finance ledger** (invoice, credit/debit note, receipt, allocation — immutable after post)
9. **Result + publication freeze** (entry → verify → publish → amend)
10. **Access + disclosure log** (who saw or changed a student record, and why)

Everything else (transport, hostel, library, homework, ID cards, parent chat, “AI insights”) is optional and must hang off the kernel without breaking it.

### First product decision (do this before schema)

**Jurisdiction pack.** School constraints are legally local. The kernel is shared; the codes and policies are not.

A first release should pick **one** operating context (example: affiliated day school, one board, one or more campuses, fee-paying + concession seats) and encode:

- Entry/exit code set
- Academic calendar rules
- Fee refund / TC policy (school policy vs statute — both must be modelled)
- Attendance → exam eligibility rule
- Result lock / recheck rule
- Parent access default (both parents unless a court order *specifically* revokes)

Do not ship a “works everywhere” product with a status enum of `active | inactive`.

---

## 2. Canonical domain (what real SIS products treat as distinct)

### 2.1 Person is not Student is not Enrollment

**PowerSchool / Ed-Fi:** `studentSchoolAssociation` is published **per enrollment instance**.

- One school, never left → one record.
- Enrolled, withdrew, re-enrolled in the same school → **two records**.
- Multiple schools → one record per enrollment.
- Concurrent enrollment at a second school is allowed and **may overlap** the primary enrollment, but the second school must be different, and ExitDate must be **greater than** EntryDate.

**Ed-Fi keys for school enrollment:** Student + School + **EntryDate**. Status is not a key. Changing grade, calendar, FTE, or primary-school flag **opens a new association**; it does not edit the old one.

**NC DPI (NCSIS) mid-year promotion/retention:** do **not** change grade on the live enrollment. End the current enrollment on the last instructional day in the old grade, then create a new enrollment on the first instructional day in the new grade. **Dates must not overlap.** Then restore or rebuild the schedule from the new start date, and **re-enter attendance that fell after the old end date**.

That last sentence is the whole product: a grade change is a **cut in the legal membership timeline**, not an UPDATE.

### 2.2 Identity is effective-dated

Infinite Campus: **only one Identity may be active at a time**; demographics APIs return the current identity. Name changes, gender marker changes, and corrected DOB are new identity versions, not overwrites.

Implications:

- Certificates, TC, marksheets, fee receipts already issued keep the name that was legal **on the document date**.
- Search must find the person by former names.
- Portal display name (preferred) is not the legal name on statutory documents.
- FERPA-style amendment: parents can request correction of **factual** errors (wrong attendance, misspelled name). Schools are **not** required to change substantive decisions (grades, discipline, IEP content). Denied amendments get a **parent statement that travels with the record forever**.

### 2.3 Guardian is a relationship with rights, not “the parent field”

FERPA 34 CFR § 99.4 (US DoE, and the same design is needed even outside the US): **both parents have full rights** unless the school has a court order, statute, or binding document that **specifically revokes** those rights. Custody or residential schedule **alone does not revoke access**.

FERPA 34 CFR § 99.32: every disclosure of personally identifiable information (except a short exception list) must be logged **with the student record for as long as the record is kept**: who received it, and the legitimate interest. Health/safety emergency disclosures must also record the articulable threat.

Design consequences:

- A student has **N guardians**, each with independent rights: view records, receive notices, pick up the child, authorise medical, pay fees, see the other parent’s contact.
- “Access” ≠ “authority.” One parent may see grades; only one may change the pickup list or approve a trip.
- Step-parents get rights only while present in the day-to-day home (US DoE Family Policy Compliance Office interpretation). When they leave the household, rights end. That is a dated relationship, not a checkbox.
- Two homes: two addresses, two emergency contacts, two report-card destinations, possibly split fee responsibility.
- A staff member can be a parent of a student in the same school: **one Person, two roles**. Portal and payroll must not share a single “user type.”

### 2.4 Calendar is the source of “membership days”

Attendance percentage is not `present / 365`. It is `present / (in-session days ∩ enrollment window ∩ applicable calendar)`.

Ed-Fi: reference the **Calendar** the student is assigned to. Different calendars exist for different grades, tracks, or programmes. A kindergarten calendar is not a high-school calendar.

PowerSchool: dates outside a defined school year are reported as school year `0` in analytics — a smell that the event was posted off-calendar.

### 2.5 Finance is double-entry, not a running total on the student

OpenEduCat (and any real fee ERP): posting an invoice **debits AR and credits deferred revenue or tuition revenue**, tagged by student, campus, term, fiscal period. A payment **debits cash/bank and credits AR**. Corrections are **credit notes / debit notes**, not edited invoices. Refunds keep the full chain: original charge, payments, credit note, approval, disbursement.

If the product cannot produce a trial balance, it is not an ERP.

---

## 3. Kernel rules (classified — not all are “the law”)

These are **product rules** for a constraint-based ERP. Class is from §0.1. A Class C/D/E rule can still be non-negotiable *for this product* without being a statute.

1. **Never delete a posted enrollment.** Mistaken entries reversed with audit; no-shows **exited with a no-show code**, not deleted. **Class B** (Ed-Fi).
2. **Never span an enrollment across school years.** Close last in-session day; open next year as a new row. **Class B** (Ed-Fi anti-pattern).
3. **At most one primary enrollment at a point in time.** Concurrent secondary enrollments explicit and coded. **Class B** (PowerSchool concurrent; Infinite Campus Partial / Cross-Site).
4. **Enrollment intervals at the same school do not overlap.** Re-entry is a new row. ExitDate > EntryDate. **Class B**.
5. **Grade, calendar, FTE, or school changes close-and-open** when the change is historical or mid-year. **Class B** (Ed-Fi recommended attributes whose change triggers a new SSA; NC DPI operational procedure).
6. **Posted invoices and receipts are not silently rewritten.** Corrections are new documents (credit/debit note, reversal). **Class C — product choice.** Not required by Ed-Fi/OneRoster. PowerSchool stored grades are archived, not cryptographically immutable; authorised users can still edit/delete them. If we ship Class C, we ship it on purpose.
7. **Receipt numbers unique, never reused** (including bounced/reversed). **Class C**. Cheque bounce as a full Received→Deposited→Cleared/Bounced machine is **Class E**, not a vendor-mandated constraint.
8. **Attendance after a reporting cutoff is frozen** for the file that was submitted. **Class A/B where a board requires it** (CBSE circulars; re-check Examination Bye-Laws PDF before encoding). Not a universal SIS property.
9. **Published board/report-card results have an amendment trail.** Recheck/moderation is a new fact, not a silent overwrite. **Class C + local board rules.** Automatic “grace marks” and cohort moderation are **not** standard SIS behaviour; UK special consideration is a post-assessment tariff, not a pass-line bump. Fail-year vs fail-subject is **CBSE-shaped (Class A/B there), not UK**.
10. **A person is never physically deleted** if they ever had an enrollment, payment, result, or disclosure. Use exit types + documentation (e.g. death with a cited evidence type), not a four-word status enum. **Class C + retention law (A).** Indian inspected texts did not define alumni/inactive/withdrawn/deceased as official statuses.
11. **Year rollover creates next-year enrollments from a promotion decision**; it does not `UPDATE grade`. Promotion flags that nightly jobs honour are **Class E** learned from live SIS (PAEC). Unpaid prior-year fees are **Class D overlay**, not a promotion invariant.
12. **Master timetable is not mutated by a substitute.** Coverage is a dated overlay. **Class E** (scheduling practice).
13. **Cashier operations serialised per cash session.** Two cashiers cannot allocate the same receipt twice. **Class E.** Not a FERPA/GDPR/wage-hour mandate.
14. **Disclosure log** for third-party access to education records. **Class A in FERPA jurisdictions** (34 CFR § 99.32). Elsewhere, still a good Class E default; do not pretend it is GDPR Article 15.

If a feature request requires violating a **Class A or B** rule for the chosen jurisdiction pack, the answer is no. Class C–E rules are product standards: change them only with an explicit decision, not a screen.

---

## 4. Edge-case catalogue (this is the product)

Each item is an acceptance test. A module is not “done” until these pass.

### 4.1 Identity, family, documents

| ID | Edge case | Required behaviour |
|---|---|---|
| I1 | Legal name change mid-year | New identity version. Past receipts, TC, marksheets unchanged. Search by old name. Statutory docs from change-date use new name. |
| I2 | Twin siblings, identical DOB, same household | Distinct person IDs. Sibling concession engine must not treat them as one child. Photos and biometrics cannot collide. |
| I3 | Duplicate admission (same child entered twice) | Merge is a first-class operation: surviving person, loser person linked, enrollments/fees/attendance moved with audit. Never “delete the duplicate.” |
| I4 | DOB correction after TC issued | Amendment record. Already-issued TC is not silently rewritten; reissue is a new document with supersedes-id. |
| I5 | Student with no email and no phone (young child) | Account is optional. Guardian is the portal actor. Do not require email to enroll. |
| I6 | Preferred name vs legal name | Class list may show preferred; board exam, TC, fee receipt, migration cert use legal. |
| I7 | Two homes, split week | Two residential addresses with dated occupancy. Transport route may differ by weekday. Attendance SMS goes to the parent on duty that day if so configured. |
| I8 | Protective order | Named adult is blocked from portal, pickup, directory, and even confirmation that the child attends this school. Log the order id and expiry. When the order expires, rights restore automatically and that restore is logged. |
| I9 | Parent A asks to hide Parent B | Refuse unless I8 document exists. Log the request and the refusal. (FERPA 99.4 / NCES Forum Guide: custodial parent cannot veto the other parent’s record rights.) |
| I10 | Step-parent moves out | Relationship end-date; portal access ends that day; historical messages remain. |
| I11 | Guardian is a grandparent (parents abroad / deceased) | Guardian relationship with acting-as-parent flag, dated, with supporting document. |
| I12 | Student turns 18 (or local age of majority) | Rights transfer to the student. Parents may retain access only under local rule (e.g. tax dependent). Explicit switch, not a surprise lockout. |
| I13 | Former student requests name/gender update on old certificates | Jurisdictional. California AB 711-style: reissue specified documents on government ID. Keep an internal mapping; do not rewrite every historical attendance cell. |

### 4.2 Admissions, capacity, waitlist, RTE / reserved seats

| ID | Edge case | Required behaviour |
|---|---|---|
| A1 | Section at capacity | Application goes to waitlist. Over-admit requires a named override, reason, and capacity-exception report. |
| A2 | Sibling of a current student applies | Priority rule is policy, not hard-coded 10%. Waitlist position can jump; every jump is logged. |
| A3 | Seat reserved (EWS / RTE / staff ward / board quota) | Seat type is on the **offer**, not a discount after the fact. Mixing a reserved-seat student into a commercial invoice without isolating the head is a legal/accounting error (Indian school ERPs treat RTE invoices as isolated). |
| A4 | Offer accepted, never attends (no-show) | Enrollment exists, then is **exited as no-show** on the policy date. Do not delete. Fees: forfeit vs refund is policy; the ledger records whichever rule fired. |
| A5 | Offer accepted, documents incomplete | Conditional enrollment. Cannot be sent to the board exam file until documents complete. |
| A6 | Age-grade mismatch | Block with override. A 5-year-old in grade 4 is a safeguarding issue, not a UI convenience. |
| A7 | Mid-year admission, term already billed for others | Pro-rata or remaining-installment invoice generated from **join date ∩ fee policy**, not a copy of the class’s original August invoice. |
| A8 | Application withdrawn after fee | Credit note + refund workflow. Admission fee vs tuition vs caution money have different refund rules. |

### 4.3 Enrollment lifecycle (the SIS heart)

| ID | Edge case | Required behaviour |
|---|---|---|
| E1 | Mid-year section transfer, same grade | Roster end-date on old section, roster start-date on new. School enrollment **unchanged**. Attendance and marks stay on the section that owned the day. |
| E2 | Mid-year grade change (promote or retain after year start) | Close enrollment, open new. No date overlap. Rebuild schedule. Re-post attendance after the cut (NC DPI). State/board membership reports must not double-count. |
| E3 | Repeat grade (detention) | Next-year enrollment in **same grade**, `repeatGradeIndicator = true`. Do not edit last year’s grade. |
| E4 | Skip grade | Same as E2/E3 with a different entry reason. Transcript still shows the skipped year as not-taken, not as failed. |
| E5 | Dual / concurrent enrollment (two schools or two campuses) | Two enrollments; exactly one primary. Cross-site section membership cannot have its service type edited by either school (Infinite Campus). Fees may be split. |
| E6 | Withdrawal after sitting exams, before result publish | Enrollment ends. Exam attempt remains. Result still publishes to the person. TC/migration must not require them to still be “active.” |
| E7 | Withdrawal on a day they were marked present | Last membership day vs last attendance day are different fields (PowerSchool: exitWithdrawDate is first day **after** last attendance, or last in-session date prior to stored ExitDate). Pick one definition and keep it. |
| E8 | Re-admission of an ex-student | **Same Person, new Enrollment.** Old fees, old results, old TC number remain. New admission number may be issued; both numbers searchable. |
| E9 | Student deceased | Specific exit code. Stop billing, stop reminders, stop portal nudges, freeze the record, notify designated staff only. Do not use “inactive.” |
| E10 | Alumni vs withdrawn vs inactive vs transferred | These are **exit types + subsequent roles**, not one status. Alumni may still need transcripts 15 years later. |
| E11 | Year-end completer | Every enrollment gets an ExitDate = last in-session day and an exit type (promoted / retained / graduated / transferred). Ed-Fi: after year-end close, **no open SSA remains**. |
| E12 | Next-year school is different (feeder pattern) | `nextYearSchool` / `nextYearGrade` on the current enrollment drive rollover. Changing the next-year row by hand without updating the promotion flag is overwritten by the nightly job (documented PAEC failure). |
| E13 | Unpaid prior-year fees at rollover | **Do not block the new enrollment in the kernel.** Block is a **policy overlay**: some schools refuse class until dues clear; courts in India have held that **TC and original certificates cannot be withheld** as a lien, and Bombay HC has quashed expulsion of an elementary child over unpaid fees under RTE 2009. The ERP must support: (a) carry dues into AR aging on the old year, (b) optional operational hold, (c) **statutory override that still issues TC**. Never encode “no TC until paid” as an unoverridable constraint. |
| E14 | Board/affiliation change (CBSE → state board mid-career) | New program / curriculum track on the new enrollment. Subject equivalences are mapped; old marks stay in old curriculum. |
| E15 | School-to-school transfer inside a board window | Punjab Board 2026-27 example: transfers after admission deadline are **online, fee-scheduled, both schools must accept**, then TC prints from the board workflow. The SIS is a participant, not the source of truth for the transfer once the board owns it. |

### 4.4 Transfer Certificate, migration, leaving documents

| ID | Edge case | Required behaviour |
|---|---|---|
| T1 | TC requested, dues outstanding | Generate TC document workflow **and** a dues statement. Policy may delay *school* clearance; statute may still require issue. Two flags: `statutory_issue_required`, `accounts_cleared`. |
| T2 | TC already issued, student returns | Re-admission (E8). Previous TC is marked superseded. You cannot have two live TCs. |
| T3 | Duplicate TC / lost TC | Reissue with new serial, watermark “duplicate,” pointer to original. |
| T4 | Countersignature | CBSE has directed schools **not** to send TCs to regional offices for countersignature between CBSE schools. State-board and de-affiliated schools may still need DEO countersignature. This is a document-type rule, not a universal checkbox. |
| T5 | TC data must match admission register | CBSE Affiliation Bye-Laws 14.19: schools must maintain an **admission and withdrawal register**. TC is a projection of that register, not a free-text letter. |
| T6 | Character / bona fide / migration | Separate document types, separate validity, separate freeze. Migration is not a TC. |

### 4.5 Fees and the ledger (where AI products die)

| ID | Edge case | Required behaviour |
|---|---|---|
| F1 | Partial payment | Deterministic allocation across heads (priority: tuition → lab → transport, or school-defined). Two cashiers must produce the **same** split. Receipt is for amount received, not for “month cleared.” |
| F2 | Overpayment | Credit on account, not a silent extra month. Parent may allocate to next installment or refund. |
| F3 | Payment against a specific installment vs FIFO | Must be explicit. A family paying “November” while August is open is either blocked or recorded as advance — never auto-closes August unless FIFO is the posted policy. |
| F4 | Sibling discount, third child leaves mid-year | Recalculate **forward** for remaining siblings (OpenEduCat: 4th child 20% → 15%; credit note or supplemental invoice). **Do not rewrite** already-posted invoices. |
| F5 | Scholarship on tuition only | Line-item scope. Transport, meals, exam fee stay full (OpenEduCat 40% merit example). |
| F6 | Concession applied after invoices posted | Credit note for the difference, approval required, aid history dated. Never “edit amount.” |
| F7 | Staff-child concession, staff resigns 17th of month | Future installments lose the concession; collected installments stay. Audit trail of who removed it (Inkwelly / school payroll practice). |
| F8 | Late fee vs grace | Late fee is a **separate posted charge** after grace, not a mutated invoice total. Daily vs slab. Cannot compound on its own late fee unless policy says so. |
| F9 | Bounced cheque / failed gateway | Original receipt remains, marked **bounced**. Reverse the allocation (credit the bank clearing, debit AR). Optional bounce penalty as new invoice. Do not delete the receipt number. |
| F10 | Duplicate gateway callback | Idempotency key. One payment, one receipt. Second callback is logged and ignored. |
| F11 | Cash drawer | Opening float, cashier session, expected vs counted, variance reason. A cash receipt without an open session is rejected. |
| F12 | Mid-year fee structure change | Already-posted invoices untouched. Remaining periods use new structure **or** a dated versioned structure. Students who already paid in full may reopen as due if policy increases remaining heads (Vawsum-style) — that must be a visible event, not a silent balance change. |
| F13 | Withdrawal refund | Policy engine: e.g. 100% week 1, 75% weeks 2–4, 50% to midpoint, 0 after (OpenEduCat). Output is a **credit note + approval + refund disbursement to original instrument when possible**. Caution money ≠ tuition. |
| F14 | Term-forfeit policy (some private schools charge the full year on withdrawal) | Model as policy, conflict-flag against statutory refund rules in that jurisdiction. The system should not silently pick the school’s preferred illegal option. |
| F15 | Installment plan | Each installment is its own due, reminder, and late-fee scope. Missing October does not freeze November reminders (OpenEduCat). |
| F16 | Cancel a receipt after a later month is fully paid | **Refuse** (Vawsum documents this as a ledger-consistency rule). Force a credit note in the current period instead of punching a hole in the paid sequence. |
| F17 | Who may reverse a receipt | Role + reason + dual control above a threshold. Reversal is a new document. Cashier who took the cash cannot be the only approver of the reversal. |
| F18 | Tax / GST on some heads only | Tax is computed on taxable heads at post time and stored. Changing the tax rate later does not rewrite old invoices. |
| F19 | Bank reconciliation | Gateway bulk deposit (40–180 payments as one bank line) must split via gateway payout file, not by the AR clerk’s memory (OpenEduCat pain point). |
| F20 | Chart of accounts | Student AR is a control account. You must be able to age 30/60/90/120 by student, head, campus. If you cannot, you do not have ERP finance. |
| F21 | Currency and offline cash | One functional currency per school books. Rounding on partial cash (no coins) posts a rounding line, not an unexplained difference. |
| F22 | Fee holiday / pandemic / strike days | Dated policy that pauses late fees without erasing dues. |

### 4.6 Attendance

| ID | Edge case | Required behaviour |
|---|---|---|
| AT1 | Daily vs period attendance | Ed-Fi has both `StudentSchoolAttendanceEvent` and `StudentSectionAttendanceEvent`. A student present in school but missing period 3 is a different fact from being absent all day. |
| AT2 | Exception-only vs affirmative | Both are valid. If exception-only, “no row” means present — until someone asks “was attendance even taken?” That is why Ed-Fi has `SectionAttendanceTakenEvent` as a **separate** fact. |
| AT3 | Half-day, tardy, medical, excused, unexcused, school-activity, suspended, work-experience | Category descriptor, not a boolean. ADA/funding and exam-eligibility use different category subsets. |
| AT4 | Holiday vs working Saturday vs exam day vs staff-only day | Calendar. Attendance cannot be marked on a non-membership day. |
| AT5 | Student enrolled from Wednesday; Monday–Tuesday must not count as absent | Membership window ∩ calendar. |
| AT6 | Mid-year grade change (E2) | Attendance before the cut stays on the old enrollment. After the cut, rebuild (NC DPI explicitly warns this is lost if you only edit grade). |
| AT7 | Exam eligibility from attendance | CBSE Rules 13–14: **75%** from start of class 10/12 teaching until the first of the month before exams. Condonation is a **board process** with documents and a deadline; below 60% only Chairman, medical. **After attendance is reported to CBSE, it cannot be changed.** The SIS must freeze and snapshot what was submitted. |
| AT8 | Leave without written request | CBSE treats it as unauthorised. The SIS should not let a teacher “fix” a dummy-candidate problem in March by back-filling February presents. |
| AT9 | Teacher marks the whole class present, then one child was on a trip | Trip/activity code must be available that day; otherwise you get false absences that wreck eligibility. |
| AT10 | Biometric / geofence vs legal register | Device event is **evidence**, not the legal mark. The legal register is the signed attendance event. Offline device sync arriving two days later cannot silently override a freeze. |

### 4.7 Timetable, rooms, substitutes, exams overlay

Hard constraints (timetabling literature + TimeTabler / aSc / school practice):

- A teacher cannot be in two rooms at once.
- A section cannot have two lessons at once (except **elective blocks**, which are parallel by definition).
- A room cannot host two lessons at once.
- Lab/PE/ground constraints.
- Part-time teacher availability.
- Required weekly periods per subject must be met.

| ID | Edge case | Required behaviour |
|---|---|---|
| TT1 | Substitute | Dated overlay. Master week unchanged. Cover teacher must pass clash check **that date**. Subject qualification is a soft then hard rule. |
| TT2 | Teacher on leave for three days | Generate cover demand for each period. Uncovered periods are a first-class work queue, not a silent hole. |
| TT3 | Exam timetable | Separate calendar overlay: regular teaching for those periods is **suspended**, not deleted. Rooms convert to halls. Clash rules change (NZQA: sequestering, extra sessions, priority order). |
| TT4 | Two board exams at the same time for one student | Candidate-level clash, not section-level. Resolution is an extra session + supervision, not “pick one subject.” |
| TT5 | Elective block | Parallel lessons sharing a period are **not** a class clash. |
| TT6 | Split grade / combined class | One teacher, two grade curricula, one room — model as one section with two course offerings or an explicit combined-section type. |
| TT7 | Publish vs draft | Drafts must not sync to LMS/parents (Infinite Campus + Schoology: syncing while schedule “trials” exist **duplicates courses**). Go-live of timetable is a dated publish. |
| TT8 | Teacher workload vs payroll | Visiting faculty paid per period actually held, not per master timetable. Cancelled period after substitute still belongs to someone. |

### 4.8 Examinations and results

| ID | Edge case | Required behaviour |
|---|---|---|
| X1 | Marks entry vs publish | States: draft → verified → published. After publish, the number is frozen. |
| X2 | Moderation / grace / scaling | Amendment with reason. Original raw marks retained. |
| X3 | Recheck / photocopy / revaluation | CBSE v Aditya Bandopadhyay (2011): examinee can inspect evaluated answer sheet under RTI. Workflow: request, fee, outcome, possible mark change as amendment. |
| X4 | Fail one subject vs fail the year | Compartment / supplementary vs Essential Repeat (CBSE: Class X fail >2 subjects → ER, not compartment). These are **result statuses**, not a boolean pass. |
| X5 | Additional subject | Passed additional subject does not rescue ER in mains; private-candidate path exists for later attempts. |
| X6 | Internal assessment missing | CBSE 2025: result **cannot be declared**; student goes Essential Repeat even if they sat the board paper. SIS must block publish, not invent IA marks. |
| X7 | Subject not affiliated / no lab / no teacher | Student cannot be offered that subject (CBSE). Catalogue ≠ permitted offering. |
| X8 | Two-year programme (IX–X, XI–XII) | Eligibility includes having studied the subject for two years. A mid-stream subject change needs an explicit exception. |
| X9 | Answer-sheet retention | CBSE 14.19: annual exam papers and answer sheets preserved until **end of September of the next academic year**, plus IA records. Deleting scans after result day is non-compliant. |
| X10 | Locked attendance after board submission | Eligibility snapshot stored with the exam registration file. Later attendance edits do not change eligibility retroactively. |
| X11 | Student transfers in during exam season | Which school owns the candidate? Board registration number is the key, not the SIS student id. |
| X12 | Malpractice | Result withheld / cancelled as a status with hearing trail. Not a deleted row. |

### 4.9 Staff, payroll, staff-as-parent

| ID | Edge case | Required behaviour |
|---|---|---|
| P1 | Join on the 12th | Pro-rata first month. Formula is jurisdictional (calendar days vs working days). Store the formula used on the payslip. |
| P2 | Relieve on the 17th | Full & final: pro-rata salary, leave encashment, gratuity eligibility, notice recovery, loan balance, TDS true-up (Indian school payroll practice). |
| P3 | Unpaid leave overlapping payroll cut-off | Leave approved after the month is closed posts as **prior-period adjustment** on the next run, not a silent rewrite of a paid payslip. |
| P4 | Casual leave quota exceeded | Excess converts to LWP. Quota is dated by leave year, which may not equal academic year or fiscal year. |
| P5 | Salary advance | Liability, then EMI or full recovery on next payroll. Cannot be “a remark.” |
| P6 | Back-dated DA / increment | Arrears calculated across closed periods, taxed in the payment month (with local relief rules). Closed payslips stay. |
| P7 | Attendance → payroll | Largest operational error source in school payroll. Unauthorised absence, late slabs, visiting-faculty session count from **actual held periods**. |
| P8 | Staff is also a parent | One Person. Payroll user ≠ parent portal user, or same login with two roles and two permission sets. Staff-ward concession (F7) uses the employment relationship, not the portal role. |
| P9 | Visiting / contractual vs permanent | Different leave, PF/ESI, timetable load. A visiting teacher should not appear as class teacher of record unless assigned. |
| P10 | Substitute paid vs unpaid cover | Cover by a salaried colleague is workload; cover by a paid substitute is a payroll event. |

### 4.10 Transport, meals, optional services

| ID | Edge case | Required behaviour |
|---|---|---|
| R1 | Route change mid-month | Fee head change from effective date; credit/debit note. Seat on old bus released. |
| R2 | Two homes (I7) | Different routes by weekday. |
| R3 | Bus full | Same as section capacity: waitlist, not silent overbook. |
| R4 | Student withdrawn but RFID still active | Access control must read enrollment end-date, not “card exists.” |
| R5 | Fee unpaid vs boarding the bus | Policy overlay, not a kernel rule. Never invent a “block at the gate” that you cannot legally enforce. |

### 4.11 Concurrency, audit, privacy, security

| ID | Edge case | Required behaviour |
|---|---|---|
| C1 | Two cashiers, one student | Optimistic concurrency on the open AR allocation. Second post fails with “ledger changed.” |
| C2 | Teacher and office mark attendance | Last legal writer is role-defined; both writes remain in history. |
| C3 | Export of class list to Excel | Disclosure log (99.32-shaped). |
| C4 | Parent prints report card | Not a disclosure to a third party. Parent B printing the same is independently allowed (I9). |
| C5 | Support vendor access | PowerSchool Dec 2024: support portal without MFA, ~62 million students and ~9.5 million teachers. **MFA on any staff/support path is a kernel requirement**, not a later hardening ticket. |
| C6 | Backup restore | Restoring Tuesday’s backup on Thursday must not resurrect a Wednesday withdrawal without a restore report. |
| C7 | Right to erasure vs student record | Education records are typically **exempt from casual deletion**. “Delete my child’s data” is a legal workflow, not a DELETE FROM students. |
| C8 | Retention | CBSE weeding rules vs forever transcripts vs fee records under tax law — different clocks. The ERP needs a retention schedule per record class. |

### 4.12 Year rollover (the annual production outage)

Rollover is the #1 go-live surprise after first implementation.

| ID | Edge case | Required behaviour |
|---|---|---|
| Y1 | Promotion default vs exceptions | Mass-assign “next grade,” then exceptions: retain, change school, do-not-enroll (graduates). Nightly job uses the **flag**, not the next-year row (PAEC). |
| Y2 | Scholarships / aid are term-based | Finalsite Enrollment: term fields **clear on rollover**. If you bulk-submit new-year contracts before uploading new aid, you bill full price. |
| Y3 | Continuous enrollment contracts | New year uses **new year’s fee rules**, not last year’s amounts. |
| Y4 | Open cash sessions / unposted invoices | Block rollover or carry them explicitly. Do not drop them. |
| Y5 | Parallel-year operation | For weeks, staff work in two years (exams of old year, orientation of new). UI must show **which year you are in** on every screen. Infinite Campus: “use caution… you are on the correct enrollment line.” |
| Y6 | LMS sync during trials | Do not publish draft sections (Schoology duplicate-course failure). |

### 4.13 Implementation / migration (why SIS projects fail)

Sourced failures, not opinions:

- **Southern Lehigh (Infinite Campus cutover, 2024):** transcripts did not survive migration from Sapphire. Counselors **hand-corrected every senior transcript**. Seniors could not apply for scholarships on time.
- **Hillsborough County (Synergy / Edupoint, bought 2019, messy rollout):** consultant found vendor under-delivery + no project management. Risks named by the board: **wrong transcripts, wrong attendance (state funding), incomplete special-needs forms (legal)**.
- **SIS Elements (higher-ed, same pattern):** data is the #1 failure; “student status” means different things in different departments; testing with clean sample data hides the mess.
- **Wayland Public Schools (PowerSchool, 2024–25):** “An SIS touches everything, and you can’t build it well until you understand how the district actually works.”

Migration rule for this product: **do not go live without**:

1. Enrollment timeline reconstructed (not a current-grade snapshot)
2. Transcript / marksheet totals matching source for a sample of graduates **and** leavers
3. Open AR matching to the last trial balance
4. Guardian relationships with rights, not a single parent name
5. Calendar membership days matching the source attendance denominators

---

## 5. What not to build (slop list)

Do not start with these. They are how AI products look finished and then fail.

- Student `status: active | inactive`
- One `parent_name` / `parent_phone`
- Editable fee total on a paid invoice
- Delete buttons on receipts, attendance, or results
- A timetable that is only a pretty grid with no clash engine
- Year rollover that `UPDATE students SET grade = grade + 1`
- Dashboards, leaderboards, “AI insights,” chatbots, gamification
- WhatsApp / SMS as the source of truth for attendance
- ID card designer before the admission register
- Homework module before enrollment timelines
- Multi-tenant SaaS chrome before the kernel works for **one** school
- “All boards, all countries” configuration with no jurisdiction pack

---

## 6. Build order (constraint-first, still not a feature list)

**Phase 0 — Jurisdiction pack**  
Board, calendar, entry/exit codes, fee policy, attendance-eligibility rule, document set (TC, marksheet), parent-rights default.

**Phase 1 — People and membership**  
Person, identity versions, organisations, calendar, enrollment close-and-open, roster start/end, no-show, re-admission, dual enrollment. Acceptance: E1–E15, I1–I13.

**Phase 2 — Legal documents**  
Admission/withdrawal register, TC/migration/bona fide as projections, serials, duplicates, statutory vs accounts-cleared.

**Phase 3 — Posted finance**  
Heads, dated structures, invoices, credit/debit notes, receipts, allocation, cashier session, bounce, refund, sibling/staff/scholarship **forward-only** recalculation. Acceptance: F1–F22.

**Phase 4 — Attendance + freeze**  
Taken-event, categories, membership-day denominator, board snapshot, eligibility. Acceptance: AT1–AT10.

**Phase 5 — Timetable kernel**  
Hard clash, publish vs draft, substitute overlay, exam overlay. Acceptance: TT1–TT8.

**Phase 6 — Assessment kernel**  
Entry → verify → publish → amend. Compartment vs ER. IA missing blocks publish. Acceptance: X1–X12.

**Phase 7 — Staff payroll**  
Pro-rata, LWP, advances, F&F, staff-as-parent, staff-ward. Acceptance: P1–P10.

**Phase 8 — Portals**  
Rights engine (access vs authority), two homes, court orders, disclosure log. Not a second app with a subset of fields.

**Phase 9 — Rollover**  
Promotion decisions, parallel years, aid reset, LMS publish gate. Acceptance: Y1–Y6.

Optional after the kernel is boring and correct: transport, hostel, library, inventory, LMS sync, payments gateway, statutory board APIs.

---

## 7. Data model sketch (for engineers — still not a build)

Use **append-only facts** for anything that is reported or paid.

```
Person
  Identity (person_id, valid_from, valid_to, legal_name, dob, identifiers, …)
  Relationship (from_person, to_person, type, rights[], valid_from, valid_to, court_order_id?)

Org (trust / school / campus)
AcademicYear
Calendar (org, year, grade-track) → CalendarDay (date, type, in_session)

Enrollment                    -- Ed-Fi StudentSchoolAssociation
  (student_id, school_id, entry_date) PK
  grade, calendar_id, entry_type, exit_date, exit_type
  primary_flag, fte, repeat_grade, next_year_* 

Section
SectionRoster                 -- OneRoster enrollment
  (section_id, student_id, start_date)
  end_date

AttendanceTaken (section or school, date, taken_by)
AttendanceEvent (student, date, period?, category, source)

Invoice (posted_at, posted_by, status=posted) → InvoiceLine
CreditNote / DebitNote → references invoice
Receipt (number unique, status=cleared|bounced|reversed)
Allocation (receipt_id, invoice_line_id, amount)
CashSession

ExamSeries / Attempt / RawMark / PublishedResult / ResultAmendment

Payslip (period, posted) / PayslipAdjustment (prior period)
```

No `UPDATE` of posted rows except `valid_to` on effective-dated identity/relationship.

---

## 8. How to use this plan

1. Pick a jurisdiction pack.  
2. Turn Section 4 into a test repository (`E1`, `F4`, `AT7`, …). A screen that cannot pass its tests is not shippable.  
3. Refuse features that do not hang off the kernel.  
4. Treat rollover and migration as **products**, not admin scripts.  
5. When someone asks for “just a status change,” require the close-and-open enrollment.

---

## 9. Sources (primary and close-primary)

**Domain / SIS**

- Ed-Fi Data Standard v6 Enrollment Domain — Best Practices (SSA keys, no-show, no multi-year SSA, fictitious-school anti-pattern, one primary school): https://docs.ed-fi.org/reference/data-exchange/data-standard/model-reference/enrollment-domain/best-practices
- Ed-Fi Student Attendance Domain (school vs section events; attendance-taken event; no stored aggregates): https://docs.ed-fi.org/reference/data-exchange/data-standard/model-reference/student-attendance-domain/overview
- PowerSchool SIS — studentSchoolAssociations, concurrent enrollment, re-enrollment = multiple records, ExitDate > EntryDate: https://ps-compliance.powerschool-docs.com/pssis-wy/latest/student-enrollment
- Infinite Campus — OneRoster 1.1 (school enrollment ≠ class enrollment; No Show excluded; inclusive vs exclusive end dates; one active Identity): https://kb.infinitecampus.com/help/oneroster-11-data-models
- Infinite Campus — cross-site / partial enrollment: https://kb.infinitecampus.com/help/enrollment-information-for-cross-site-students
- NC DPI NCSIS — mid-year promotion/retention: end enrollment, non-overlapping dates, restore schedule, re-enter attendance: https://ncdepartmentofpublicinstruction.knowledgeowl.com/home/retentionpromotion-during-school-year
- Salesforce EDA — Program Enrollment vs Course Connection: https://help.salesforce.com/s/articleView?id=sfdo.eda_model_enrollments.htm

**Finance**

- OpenEduCat fee management (credit notes, sibling recalculation, refund policy engine, double-entry, gateway bulk split): https://openeducat.org/feature-financial-management-system/
- School fee structure complexity (sibling who gets the discount; scholarship per head): https://campus24x7.in/blogs/school-fee-structure-erp-setup-guide-india
- Staff-ward concession on resignation (forward only): https://inkwelly.com/en/learn/how-to-set-up-staff-ward-discount-rules
- Finalsite Enrollment — rollover clears term aid fields: https://schooladmin.zendesk.com/hc/en-us/articles/12164707146893-Rollover-for-Continuous-Enrollment-Schools

**Law / board / records**

- FERPA 34 CFR § 99.32 disclosure log: https://www.ecfr.gov/current/title-34/subtitle-A/part-99/subpart-D/section-99.32
- FERPA 34 CFR § 99.4 both parents unless order **specifically** revokes: https://studentprivacy.ed.gov/faq/case-divorce-do-both-parents-have-rights-under-ferpa
- NCES Forum Guide, Exhibit 5-1, noncustodial parents: https://nces.ed.gov/pubs2004/privacy/exhibit_5_1.asp
- CBSE Affiliation Bye-Laws 14.19 records (admission/withdrawal register; answer-sheet retention): https://www.schoolserv.in/cbse-affiliation-bye-laws-2018
- CBSE Examination Bye-Laws Rules 13–14, 75% attendance, freeze after report, condonation SOP (2025 circulars): https://indianexpress.com/article/education/cbse-reasserts-75-pc-attendance-norm-2025-26-board-exam-sops-released-10173112/
- Internal assessment missing → Essential Repeat: https://www.telegraphindia.com/west-bengal/kolkata/cbse-makes-75-attendance-internal-assessment-mandatory-for-board-results-prnt/cid/2123617
- Kerala HC / Telangana HC: no lien on student certificates for fee recovery: https://www.thehindu.com/news/cities/Kochi/schools-cannot-withhold-tc-for-non-payment-of-fee/article67416430.ece
- Bombay HC (Feb 2026): cannot expel elementary student over unpaid fees (RTE 2009 s.16): https://indianexpress.com/article/legal-news/bombay-high-court-school-fee-transfer-certificate-rte-act-ruling-10565851/
- CBSE v Aditya Bandopadhyay (2011) 8 SCC 497 — inspected answer books
- Punjab Board school-to-school transfer schedule 2026-27: https://www.jagranjosh.com/news/punjab-board-releases-school-to-school-transfer-guidelines-and-schedule-for-academic-session-2026-27-187331

**Payroll**

- Indian school payroll (mid-month F&F, arrears, advances, attendance-payroll gap): https://inkwelly.com/en/modules/employee-payroll and https://campus24x7.in/blogs/school-staff-attendance-payroll-management-india
- UK STPCD/Burgundy Book daily rate (annual/365): https://schoolleaders.thekeysupport.com/staff/pay-and-progression/pay-and-progression-for-teachers/calculating-a-teachers-daily-rate-of-pay/

**Go-live failures / security**

- Southern Lehigh Infinite Campus transcript migration: https://slspotlight.com/opinion/2024/10/31/switch-to-infinite-campus-brings-complications/
- Hillsborough Synergy rollout: https://www.govtech.com/education/k-12/hillsborough-schools-weighs-options-after-messy-tech-rollout
- PowerSchool 2024 support-portal breach (~62M students): https://www.security.org/identity-theft/breach/powerschool/
- Schoology/Infinite Campus: do not sync draft schedule trials: https://uc.powerschool-docs.com/en/schoology/latest/infinite-campus-implementation-and-configuration-guide
- PAEC rollover job overwrites next-year enrollment if promotion flag not updated: https://paec.zendesk.com/hc/en-us/articles/23094941361421-Rollover-Rolling-Retention-Option-Grade-Promotion-Status-Good-Cause-Exemption

---

## 10. Open decisions (user, not the model)

These change the kernel. They should be chosen on purpose.

1. **Which jurisdiction pack first?** (board, country, fee-regulation regime)
2. **Day school only, or boarding + transport in v1?** (boarding creates residential custody and meal ledgers)
3. **Public-aid / RTE seats in v1?** (isolated invoices, lottery, income documents)
4. **One campus or multi-campus from day one?** (primary vs concurrent enrollment is cheap early, expensive late)
5. **Who is the legal customer?** Trust/society vs single school vs group of schools — this is the org tree

Until those five are answered, do not draw UI.

---

*This plan is independent of the existing academy-management codebase. Do not map its modules onto that product.*
