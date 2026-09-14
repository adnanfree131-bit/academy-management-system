import type { TxLike } from '../db/db.js'

export type NewStudent = {
  legalName: string
  preferredName?: string
  dateOfBirth?: string
  gender?: string
  personNo?: string
}

export type NewGuardian = {
  legalName: string
  relationLabel?: string
  canView?: boolean
  canPay?: boolean
  canPickup?: boolean
  financiallyResponsible?: boolean
  phone?: string
  email?: string
}

/** Create a student person with an initial identity version. */
export async function createStudent(tx: TxLike, input: NewStudent): Promise<string> {
  const personNo =
    input.personNo ??
    (await tx.query<{ n: string }>(
      `SELECT COALESCE(MAX(NULLIF(regexp_replace(person_no, '\\D', '', 'g'), '')::bigint), 1000) + 1 AS n
       FROM persons WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid AND is_student`,
    ).then((r) => `S${r.rows[0]!.n}`))
  const rows = await tx.query<{ id: string }>(
    `INSERT INTO persons (tenant_id, person_no, is_student)
     VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, true)
     RETURNING id`,
    [personNo],
  )
  const personId = rows.rows[0]!.id
  await tx.query(
    `INSERT INTO identities (tenant_id, person_id, legal_name, preferred_name, date_of_birth, gender)
     VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2, $3, $4, $5)`,
    [personId, input.legalName, input.preferredName ?? null, input.dateOfBirth ?? null, input.gender ?? null],
  )
  return personId
}

/** Amend identity: close the current version, open a new one (name change etc.). History is preserved. */
export async function amendIdentity(
  tx: TxLike,
  personId: string,
  patch: { legalName?: string; preferredName?: string; dateOfBirth?: string; gender?: string },
  effectiveFrom: string,
): Promise<void> {
  const current = await tx.query<{ id: string }>(
    `SELECT id FROM identities WHERE person_id = $1 AND valid_to IS NULL ORDER BY valid_from DESC LIMIT 1`,
    [personId],
  )
  const row = current.rows[0]
  if (!row) throw new Error('no current identity')
  const cur = await tx.query<{ legal_name: string; preferred_name: string | null; date_of_birth: string | null; gender: string | null }>(
    'SELECT legal_name, preferred_name, date_of_birth, gender FROM identities WHERE id = $1',
    [row.id],
  )
  const old = cur.rows[0]!
  await tx.query('UPDATE identities SET valid_to = $2 WHERE id = $1 AND valid_to IS NULL', [row.id, effectiveFrom])
  await tx.query(
    `INSERT INTO identities (tenant_id, person_id, legal_name, preferred_name, date_of_birth, gender, valid_from)
     VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2, $3, $4, $5, $6)`,
    [
      personId,
      patch.legalName ?? old.legal_name,
      patch.preferredName ?? old.preferred_name,
      patch.dateOfBirth ?? old.date_of_birth,
      patch.gender ?? old.gender,
      effectiveFrom,
    ],
  )
}

/** Link a guardian (or staff-ward) to a student with independent dated rights. */
export async function linkGuardian(
  tx: TxLike,
  studentId: string,
  guardian: NewGuardian,
  kind: 'GUARDIAN' | 'STAFF_WARD' = 'GUARDIAN',
): Promise<string> {
  const rows = await tx.query<{ id: string }>(
    `INSERT INTO persons (tenant_id, person_no, is_staff)
     VALUES (current_setting('app.current_tenant_id', true)::uuid,
             'G' || substr(gen_random_uuid()::text, 1, 8), false)
     RETURNING id`,
  )
  const guardianId = rows.rows[0]!.id
  await tx.query(
    `INSERT INTO identities (tenant_id, person_id, legal_name)
     VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2)`,
    [guardianId, guardian.legalName],
  )
  if (guardian.phone) {
    await tx.query(
      `INSERT INTO contact_points (tenant_id, person_id, kind, value, is_primary)
       VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, 'phone', $2, true)`,
      [guardianId, guardian.phone],
    )
  }
  await tx.query(
    `INSERT INTO relationships
       (tenant_id, from_person_id, to_person_id, kind, relation_label,
        can_view, can_pay, can_pickup, is_financially_responsible)
     VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      guardianId,
      studentId,
      kind,
      guardian.relationLabel ?? null,
      guardian.canView ?? true,
      guardian.canPay ?? false,
      guardian.canPickup ?? false,
      guardian.financiallyResponsible ?? false,
    ],
  )
  return guardianId
}

export type PersonSummary = {
  id: string
  person_no: string
  legal_name: string
  preferred_name: string | null
}

/** Current identity for a person (valid_to IS NULL row). */
export async function currentIdentity(tx: TxLike, personId: string): Promise<PersonSummary | null> {
  const rows = await tx.query<{
    id: string
    person_no: string
    legal_name: string
    preferred_name: string | null
  }>(
    `SELECT p.id, p.person_no, i.legal_name, i.preferred_name
     FROM persons p
     JOIN identities i ON i.person_id = p.id AND i.valid_to IS NULL
     WHERE p.id = $1`,
    [personId],
  )
  const r = rows.rows[0]
  return r ? { id: r.id, person_no: r.person_no, legal_name: r.legal_name, preferred_name: r.preferred_name } : null
}
