import type { TxLike } from '../db/db.js'

export type FeeHeadInput = { name: string; priority?: number }

export async function createFeeHead(tx: TxLike, input: FeeHeadInput): Promise<string> {
  const rows = await tx.query<{ id: string }>(
    `INSERT INTO fee_heads (tenant_id, name, priority) VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2)
     RETURNING id`,
    [input.name, input.priority ?? 100],
  )
  return rows.rows[0]!.id
}

export type InvoiceLineInput = { feeHeadId: string; amount: number; description?: string }

/** Post an invoice. Posted rows are never edited — corrections are credit notes. */
export async function postInvoice(
  tx: TxLike,
  input: { personId: string; billingPeriod?: string; lines: InvoiceLineInput[]; notes?: string },
): Promise<string> {
  if (input.lines.length === 0) throw new Error('invoice needs at least one line')
  const inv = await tx.query<{ id: string }>(
    `INSERT INTO invoices (tenant_id, person_id, billing_period, notes)
     VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2, $3) RETURNING id`,
    [input.personId, input.billingPeriod ?? null, input.notes ?? ''],
  )
  const invoiceId = inv.rows[0]!.id
  for (const line of input.lines) {
    await tx.query(
      `INSERT INTO invoice_lines (tenant_id, invoice_id, fee_head_id, amount, description)
       VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2, $3, $4)`,
      [invoiceId, line.feeHeadId, line.amount, line.description ?? ''],
    )
  }
  return invoiceId
}

export type OpenCharge = { invoiceLineId: string; feeHeadId: string; feeHeadPriority: number; due: number }

/** Open (unallocated) charge lines for a person, ordered by head priority then post date (F1/F3). */
export async function openCharges(tx: TxLike, personId: string): Promise<OpenCharge[]> {
  const rows = await tx.query<{
    invoice_line_id: string
    fee_head_id: string
    priority: number
    due: string
  }>(
    `SELECT l.id AS invoice_line_id, l.fee_head_id, fh.priority,
            (l.amount - COALESCE((
               SELECT SUM(a.amount) FROM allocations a
               JOIN receipts r ON r.id = a.receipt_id
               WHERE a.invoice_line_id = l.id AND r.status IN ('CLEARED','DEPOSITED')
             ), 0)) AS due
     FROM invoice_lines l
     JOIN invoices i ON i.id = l.invoice_id AND i.status = 'POSTED'
     JOIN fee_heads fh ON fh.id = l.fee_head_id
     WHERE i.person_id = $1
       AND l.tenant_id = current_setting('app.current_tenant_id', true)::uuid
     ORDER BY fh.priority, i.posted_at, l.id`,
    [personId],
  )
  // openCharges: due > 0 filter below keeps contra-reversals from re-opening lines
  return rows.rows
    .map((r) => ({
      invoiceLineId: r.invoice_line_id,
      feeHeadId: r.fee_head_id,
      feeHeadPriority: r.priority,
      due: Number(r.due),
    }))
    .filter((c) => c.due > 0)
}

export type AllocationPlan = Array<{ invoiceLineId: string; amount: number }>

/** Deterministic split by head priority (F1). Two cashiers always produce the same plan.
 *  Allocates only up to open dues; leftover (overpayment) is returned via excess in
 *  collectPayment and becomes a student credit (F2) — never a silent extra month. */
export function planAllocation(charges: OpenCharge[], amount: number): AllocationPlan {
  const plan: AllocationPlan = []
  let remaining = amount
  for (const charge of charges) {
    if (remaining <= 0) break
    const applied = Math.min(remaining, charge.due)
    if (applied <= 0) continue
    plan.push({ invoiceLineId: charge.invoiceLineId, amount: applied })
    remaining -= applied
  }
  return plan
}

export type CollectInput = {
  personId: string
  amount: number
  method: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'CARD' | 'GATEWAY'
  reference?: string
  notes?: string
  override?: AllocationPlan | null
  cashSessionId?: string | null
  collectedBy: string
}

/**
 * Collect a payment: unique receipt serial, deterministic (or overridden)
 * allocation, all inside the caller's transaction. Overpayment goes to
 * the excess bucket (F2 — credit on account, never a silent extra month).
 */
export async function collectPayment(tx: TxLike, input: CollectInput): Promise<{
  receiptId: string
  serial: number
  allocations: AllocationPlan
  excess: number
}> {
  if (input.method === 'CASH' && !input.cashSessionId) {
    throw new Error('cash payments require an open cash session (F11)')
  }
  const serialRes = await tx.query<{ receipt_serial: string }>(
    `UPDATE tenant_serials SET receipt_serial = receipt_serial + 1
     WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid
     RETURNING receipt_serial`,
  )
  const serial = serialRes.rows[0] ? Number(serialRes.rows[0].receipt_serial) : 0
  if (serial === 0) throw new Error('tenant serials not initialised')

  const charges = await openCharges(tx, input.personId)
  const plan = input.override && input.override.length > 0 ? input.override : planAllocation(charges, input.amount)

  const totalPlanned = plan.reduce((s, a) => s + a.amount, 0)
  if (totalPlanned > input.amount + 0.001) {
    throw new Error('override allocates more than the amount received')
  }
  const excess = input.amount - totalPlanned  // F2: overpayment → student credit

  const rcpt = await tx.query<{ id: string }>(
    `INSERT INTO receipts (tenant_id, serial, person_id, method, amount, cash_session_id, reference, notes, created_by)
     VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [serial, input.personId, input.method, input.amount, input.cashSessionId ?? null, input.reference ?? '', input.notes ?? '', input.collectedBy],
  )
  const receiptId = rcpt.rows[0]!.id
  for (const a of plan) {
    if (!a.invoiceLineId) continue
    await tx.query(
      `INSERT INTO allocations (tenant_id, receipt_id, invoice_line_id, amount)
       VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2, $3)`,
      [receiptId, a.invoiceLineId, a.amount],
    )
  }
  if (excess > 0) {
    await tx.query(
      `INSERT INTO student_credits (tenant_id, person_id, receipt_id, amount)
       VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2, $3)`,
      [input.personId, receiptId, excess],
    )
  }
  return { receiptId, serial, allocations: plan, excess }
}

/** F9 — bounce: original receipt stays, gets status BOUNCED; a contra-receipt negates its allocations. */
export async function bounceReceipt(tx: TxLike, input: { receiptId: string; reason: string; byUserId: string }): Promise<void> {
  const orig = await tx.query<{ id: string; person_id: string; amount: string; serial: bigint; status: string }>(
    `SELECT id, person_id, amount, serial, status FROM receipts
     WHERE id = $1 AND tenant_id = current_setting('app.current_tenant_id', true)::uuid FOR UPDATE`,
    [input.receiptId],
  )
  const receipt = orig.rows[0]
  if (!receipt) throw new Error('receipt not found')
  if (receipt.status !== 'CLEARED' && receipt.status !== 'DEPOSITED') {
    throw new Error(`cannot bounce a ${receipt.status} receipt`)
  }
  await tx.query(`UPDATE receipts SET status = 'BOUNCED' WHERE id = $1`, [input.receiptId])

  // contra receipt (its own serial, negative marker in notes) + contra allocations
  const serialRes = await tx.query<{ receipt_serial: string }>(
    `UPDATE tenant_serials SET receipt_serial = receipt_serial + 1
     WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid RETURNING receipt_serial`,
  )
  const contraSerial = Number(serialRes.rows[0]!.receipt_serial)
  const contra = await tx.query<{ id: string }>(
    `INSERT INTO receipts (tenant_id, serial, person_id, method, amount, status, reference, notes, created_by)
     VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2, 'CHEQUE', $3, 'REVERSED',
             $4, $5, $6) RETURNING id`,
    [contraSerial, receipt.person_id, receipt.amount, `contra of R-${receipt.serial}`, `bounce: ${input.reason}`, input.byUserId],
  )
  const contraId = contra.rows[0]!.id
  await tx.query(
    `INSERT INTO allocations (tenant_id, receipt_id, invoice_line_id, amount)
     SELECT tenant_id, $1, invoice_line_id, -amount FROM allocations
     WHERE receipt_id = $2`,
    [contraId, input.receiptId],
  )
  await tx.query(
    `INSERT INTO receipt_reversals (tenant_id, original_receipt_id, contra_receipt_id, reason, created_by)
     VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2, $3, $4)`,
    [input.receiptId, contraId, input.reason, input.byUserId],
  )
}

/**
 * F16 — refusing to cancel a receipt after later months are fully paid.
 * Returns the list of later-posted invoices that are fully allocated; the
 * caller refuses when this is non-empty and directs the user to a credit note.
 */
export async function laterInvoicesFullyPaid(tx: TxLike, personId: string, beforePostedAt: string): Promise<string[]> {
  const rows = await tx.query<{ id: string }>(
    `SELECT i.id FROM invoices i
     WHERE i.person_id = $1 AND i.posted_at > $2 AND i.status = 'POSTED'
       AND i.tenant_id = current_setting('app.current_tenant_id', true)::uuid
       AND NOT EXISTS (
         SELECT 1 FROM invoice_lines l
         WHERE l.invoice_id = i.id
           AND (l.amount - COALESCE((
             SELECT SUM(a.amount) FROM allocations a
             JOIN receipts r ON r.id = a.receipt_id
             WHERE a.invoice_line_id = l.id AND r.status IN ('CLEARED','DEPOSITED')
           ), 0)) > 0
       )`,
    [personId, beforePostedAt],
  )
  return rows.rows.map((r) => r.id)
}

export async function issueCreditNote(
  tx: TxLike,
  input: { personId: string; amount: number; reason: string; invoiceId?: string; byUserId: string },
): Promise<{ id: string; serial: number }> {
  const serialRes = await tx.query<{ credit_note_serial: string }>(
    `UPDATE tenant_serials SET credit_note_serial = credit_note_serial + 1
     WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid RETURNING credit_note_serial`,
  )
  const serial = Number(serialRes.rows[0]!.credit_note_serial)
  const rows = await tx.query<{ id: string }>(
    `INSERT INTO credit_notes (tenant_id, serial, person_id, reason, amount, invoice_id, created_by)
     VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [serial, input.personId, input.reason, input.amount, input.invoiceId ?? null, input.byUserId],
  )
  return { id: rows.rows[0]!.id, serial }
}

export async function openCashSession(tx: TxLike, cashierId: string, openingFloat: number): Promise<string> {
  const rows = await tx.query<{ id: string }>(
    `INSERT INTO cash_sessions (tenant_id, cashier_id, opening_float)
     VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2) RETURNING id`,
    [cashierId, openingFloat],
  )
  return rows.rows[0]!.id
}

export async function closeCashSession(
  tx: TxLike,
  sessionId: string,
  countedTotal: number,
  varianceReason = '',
): Promise<{ variance: number }> {
  const rows = await tx.query<{ expected: string; counted_total: string | null; variance: string | null }>(
    `SELECT
       opening_float + COALESCE((SELECT SUM(amount) FROM receipts
         WHERE cash_session_id = cs.id AND method = 'CASH' AND status = 'CLEARED'), 0) AS expected,
       counted_total, variance
     FROM cash_sessions cs WHERE id = $1
       AND tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    [sessionId],
  )
  const s = rows.rows[0]
  if (!s) throw new Error('session not found')
  if (s.counted_total !== null) throw new Error('session already closed')
  const variance = countedTotal - Number(s.expected)
  await tx.query(`UPDATE cash_sessions SET counted_total = $2, variance = $3, variance_reason = $4, closed_at = now() WHERE id = $1`, [
    sessionId,
    countedTotal,
    variance,
    varianceReason,
  ])
  return { variance }
}

export type StudentBalance = { billed: number; allocated: number; balance: number }

export async function studentBalance(tx: TxLike, personId: string): Promise<StudentBalance> {
  // Subqueries, not joins: joining lines×allocations fans out and double-counts billed.
  const rows = await tx.query<{ billed: string; allocated: string }>(
    `SELECT
       (SELECT COALESCE(SUM(l.amount), 0)
        FROM invoice_lines l
        JOIN invoices i ON i.id = l.invoice_id
        WHERE i.person_id = $1 AND i.status = 'POSTED'
          AND i.tenant_id = current_setting('app.current_tenant_id', true)::uuid) AS billed,
       (SELECT COALESCE(SUM(a.amount), 0)
        FROM allocations a
        JOIN receipts r ON r.id = a.receipt_id
        JOIN invoice_lines l ON l.id = a.invoice_line_id
        JOIN invoices i ON i.id = l.invoice_id
        WHERE i.person_id = $1 AND i.status = 'POSTED'
          AND r.status IN ('CLEARED','DEPOSITED')
          AND i.tenant_id = current_setting('app.current_tenant_id', true)::uuid) AS allocated`,
    [personId],
  )
  const r = rows.rows[0]!
  const billed = Number(r.billed)
  const allocated = Number(r.allocated)
  return { billed, allocated, balance: billed - allocated }
}
