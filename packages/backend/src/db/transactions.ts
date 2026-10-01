import type { Pool, PoolClient } from 'pg';
import { createHash, randomBytes } from 'crypto';
import { isReservedSlug } from '@apex/shared-types';

export interface DbContext {
  query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number }>;
}

let savepointIdCounter = 0;

export async function withTenantTransaction<T>(
  client: PoolClient | { query: (text: string, params?: any[]) => Promise<any> },
  tenantId: string,
  authUserId: string,
  callback: (db: DbContext) => Promise<T>
): Promise<T> {
  const isNested = Boolean((client as any).__in_transaction || ((client as any).__tx_depth && (client as any).__tx_depth > 0));
  const savepointName = `sp_${++savepointIdCounter}_${Date.now().toString(36)}`;

  if (isNested) {
    (client as any).__tx_depth = ((client as any).__tx_depth || 1) + 1;
    await client.query(`SAVEPOINT ${savepointName}`);
  } else {
    (client as any).__in_transaction = true;
    (client as any).__tx_depth = 1;
    await client.query('BEGIN');
  }

  try {
    await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [authUserId]);
    await client.query(`SET LOCAL ROLE authenticated`);

    const result = await callback(client as DbContext);

    if (isNested) {
      await client.query(`RELEASE SAVEPOINT ${savepointName}`);
      (client as any).__tx_depth--;
    } else {
      await client.query('COMMIT');
      (client as any).__in_transaction = false;
      (client as any).__tx_depth = 0;
    }
    return result;
  } catch (err) {
    if (isNested) {
      await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
      (client as any).__tx_depth--;
    } else {
      await client.query('ROLLBACK');
      (client as any).__in_transaction = false;
      (client as any).__tx_depth = 0;
    }
    throw err;
  }
}

export async function withPlatformTransaction<T>(
  client: PoolClient | { query: (text: string, params?: any[]) => Promise<any> },
  authUserId: string,
  callback: (db: DbContext) => Promise<T>
): Promise<T> {
  const isNested = Boolean((client as any).__in_transaction || ((client as any).__tx_depth && (client as any).__tx_depth > 0));
  const savepointName = `sp_${++savepointIdCounter}_${Date.now().toString(36)}`;

  if (isNested) {
    (client as any).__tx_depth = ((client as any).__tx_depth || 1) + 1;
    await client.query(`SAVEPOINT ${savepointName}`);
  } else {
    (client as any).__in_transaction = true;
    (client as any).__tx_depth = 1;
    await client.query('BEGIN');
  }

  try {
    await client.query(`SELECT set_config('app.is_super_admin', 'true', true)`);
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [authUserId]);
    await client.query(`SET LOCAL ROLE authenticated`);

    const result = await callback(client as DbContext);

    if (isNested) {
      await client.query(`RELEASE SAVEPOINT ${savepointName}`);
      (client as any).__tx_depth--;
    } else {
      await client.query('COMMIT');
      (client as any).__in_transaction = false;
      (client as any).__tx_depth = 0;
    }
    return result;
  } catch (err) {
    if (isNested) {
      await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
      (client as any).__tx_depth--;
    } else {
      await client.query('ROLLBACK');
      (client as any).__in_transaction = false;
      (client as any).__tx_depth = 0;
    }
    throw err;
  }
}

export async function executeAdmissionTransaction(
  client: PoolClient | any,
  params: {
    tenantId: string;
    authUserId: string;
    student: {
      admission_number: string;
      roll_number: string;
      full_name: string;
      guardian_name: string;
      guardian_phone: string;
      program_id: string;
      batch_id: string;
    };
    invoice: {
      invoice_number: string;
      subtotal_amount: number;
      net_amount: number;
      billing_month: string;
      issue_date: string;
      due_date: string;
    };
    shouldFailAfterStudent?: boolean; // For testing rollback
  }
) {
  return withTenantTransaction(client, params.tenantId, params.authUserId, async (db) => {
    // 1. Create Student
    const studentRes = await db.query(
      `INSERT INTO public.students (
        tenant_id, admission_number, roll_number, full_name,
        guardian_name, guardian_phone, program_id, batch_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
      RETURNING *`,
      [
        params.tenantId,
        params.student.admission_number,
        params.student.roll_number,
        params.student.full_name,
        params.student.guardian_name,
        params.student.guardian_phone,
        params.student.program_id,
        params.student.batch_id,
      ]
    );
    const createdStudent = studentRes.rows[0];

    if (params.shouldFailAfterStudent) {
      throw new Error('SIMULATED_ADMISSION_FAILURE');
    }

    // 2. Create Invoice
    const invoiceRes = await db.query(
      `INSERT INTO public.student_invoices (
        tenant_id, invoice_number, student_id, student_name,
        roll_number, batch_id, batch_name, billing_month,
        issue_date, due_date, subtotal_amount, discount_amount,
        net_amount, paid_amount, balance_amount, status
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, 'Batch', $7,
        $8, $9, $10, 0,
        $10, 0, $10, 'unpaid'
      ) RETURNING *`,
      [
        params.tenantId,
        params.invoice.invoice_number,
        createdStudent.id,
        createdStudent.full_name,
        createdStudent.roll_number,
        createdStudent.batch_id,
        params.invoice.billing_month,
        params.invoice.issue_date,
        params.invoice.due_date,
        params.invoice.net_amount,
      ]
    );

    return {
      student: createdStudent,
      invoice: invoiceRes.rows[0],
    };
  });
}

export async function executeInvoicePaymentTransaction(
  client: PoolClient | any,
  params: {
    tenantId: string;
    authUserId: string;
    invoiceId: string;
    paymentAmount: number;
    paymentMethod: 'cash' | 'bank_transfer' | 'cheque' | 'wallet' | 'easypaisa' | 'jazzcash';
    receiptNumber: string;
    collectedBy: string;
    shouldFailAfterLock?: boolean; // For testing rollback
  }
) {
  return withTenantTransaction(client, params.tenantId, params.authUserId, async (db) => {
    // 1. Pessimistic Lock on Invoice Row (prevents lost updates under concurrency)
    const lockRes = await db.query(
      `SELECT * FROM public.student_invoices 
       WHERE id = $1 AND tenant_id = $2 
       FOR UPDATE`,
      [params.invoiceId, params.tenantId]
    );

    if (lockRes.rows.length === 0) {
      throw new Error('INVOICE_NOT_FOUND');
    }

    const invoice = lockRes.rows[0];
    const currentBalance = Number(invoice.balance_amount);
    const currentPaid = Number(invoice.paid_amount);

    if (params.paymentAmount > currentBalance) {
      throw new Error(`PAYMENT_EXCEEDS_BALANCE: Current balance is ${currentBalance}`);
    }

    if (params.shouldFailAfterLock) {
      throw new Error('SIMULATED_PAYMENT_FAILURE');
    }

    const newPaid = currentPaid + params.paymentAmount;
    const newBalance = currentBalance - params.paymentAmount;
    const newStatus = newBalance === 0 ? 'paid' : 'partially_paid';

    // 2. Insert Payment Receipt
    const paymentRes = await db.query(
      `INSERT INTO public.fee_payments (
        tenant_id, receipt_number, invoice_id, student_id,
        student_name, roll_number, payment_date, amount_paid,
        payment_method, status, collected_by
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, $7, $8, 'paid', $9)
      RETURNING *`,
      [
        params.tenantId,
        params.receiptNumber,
        invoice.id,
        invoice.student_id,
        invoice.student_name,
        invoice.roll_number,
        params.paymentAmount,
        params.paymentMethod,
        params.collectedBy,
      ]
    );

    // 3. Update Invoice Balance
    const updatedInvoiceRes = await db.query(
      `UPDATE public.student_invoices 
       SET paid_amount = $1, balance_amount = $2, status = $3, updated_at = NOW()
       WHERE id = $4 AND tenant_id = $5
       RETURNING *`,
      [newPaid, newBalance, newStatus, invoice.id, params.tenantId]
    );

    return {
      payment: paymentRes.rows[0],
      invoice: updatedInvoiceRes.rows[0],
    };
  });
}

export async function executeAttendanceCorrectionTransaction(
  client: PoolClient | any,
  params: {
    tenantId: string;
    authUserId: string;
    attendanceId: string;
    newStatus: 'present' | 'absent' | 'late' | 'excused';
    reason: string;
    shouldFailAudit?: boolean; // For testing rollback
  }
) {
  return withTenantTransaction(client, params.tenantId, params.authUserId, async (db) => {
    // 1. Fetch current record
    const currRes = await db.query(
      `SELECT * FROM public.student_attendance WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
      [params.attendanceId, params.tenantId]
    );

    if (currRes.rows.length === 0) {
      throw new Error('ATTENDANCE_RECORD_NOT_FOUND');
    }

    const prev = currRes.rows[0];

    // 2. Update status
    const updateRes = await db.query(
      `UPDATE public.student_attendance 
       SET status = $1, remarks = $2, updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4
       RETURNING *`,
      [params.newStatus, params.reason, params.attendanceId, params.tenantId]
    );

    if (params.shouldFailAudit) {
      throw new Error('SIMULATED_AUDIT_LOG_FAILURE');
    }

    // 3. Insert audit log
    await db.query(
      `INSERT INTO public.audit_logs (
        tenant_id, action, resource, resource_id,
        changes, actor_email
      ) VALUES ($1, 'ATTENDANCE_CORRECTION', 'student_attendance', $2, $3, $4)`,
      [
        params.tenantId,
        prev.id,
        JSON.stringify({ previous_status: prev.status, new_status: params.newStatus, reason: params.reason }),
        'admin@apexacademy.edu.pk',
      ]
    );

    return updateRes.rows[0];
  });
}

export async function executeTenantOnboardingTransaction(
  client: PoolClient | any,
  params: {
    authUserId: string;
    authEmail: string;
    authDisplayName: string;
    tenantName: string;
    tenantSlug: string;
    campusName?: string;
    city?: string;
    phone?: string;
    logoUrl?: string;
    shouldFailAfterTenant?: boolean; // For testing rollback
  }
) {
  const cleanSlug = params.tenantSlug.trim().toLowerCase();

  // Validate slug constraints
  if (isReservedSlug(cleanSlug)) {
    const err: any = new Error(`The identifier '${cleanSlug}' is reserved by the platform.`);
    err.code = 'SLUG_RESERVED';
    throw err;
  }

  if (!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(cleanSlug)) {
    const err: any = new Error('Academy slug must be 3-30 lowercase alphanumeric characters and hyphens.');
    err.code = 'INVALID_SLUG';
    throw err;
  }

  return withPlatformTransaction(client, params.authUserId, async (db) => {
    // 1. Check for existing tenant slug
    const existing = await db.query(
      `SELECT id FROM public.tenants WHERE slug = $1`,
      [cleanSlug]
    );

    if (existing.rows.length > 0) {
      const err: any = new Error(`Academy slug '${cleanSlug}' is already registered.`);
      err.code = 'SLUG_ALREADY_EXISTS';
      throw err;
    }

    // 2. Create Tenant
    const tenantRes = await db.query(
      `INSERT INTO public.tenants (
        name, slug, status, tier, trial_ends_at, settings
      ) VALUES ($1, $2, 'active', 'starter', NOW() + INTERVAL '30 days', $3)
      RETURNING *`,
      [
        params.tenantName.trim(),
        cleanSlug,
        JSON.stringify({
          campus_name: params.campusName || 'Main Campus',
          city: params.city || null,
          phone: params.phone || null,
          logo_url: params.logoUrl || null,
          currency: 'PKR',
          academic_session: '2026-2027',
        }),
      ]
    );
    const createdTenant = tenantRes.rows[0];

    if (params.shouldFailAfterTenant) {
      throw new Error('SIMULATED_ONBOARDING_FAILURE');
    }

    // 3. Create Tenant Administrator Membership
    const membershipRes = await db.query(
      `INSERT INTO public.tenant_memberships (
        tenant_id, auth_user_id, email, full_name, role, status
      ) VALUES ($1, $2, $3, $4, 'tenant_admin', 'active')
      RETURNING *`,
      [
        createdTenant.id,
        params.authUserId,
        params.authEmail.trim().toLowerCase(),
        params.authDisplayName.trim(),
      ]
    );
    const createdMembership = membershipRes.rows[0];

    // 4. Audit Log
    await db.query(
      `INSERT INTO public.audit_logs (
        tenant_id, action, resource, resource_id,
        changes, actor_email
      ) VALUES ($1, 'TENANT_ONBOARDED', 'tenants', $2, $3, $4)`,
      [
        createdTenant.id,
        createdTenant.id,
        JSON.stringify({
          tenant_name: createdTenant.name,
          slug: createdTenant.slug,
          admin_email: createdMembership.email,
        }),
        params.authEmail,
      ]
    );

    return {
      tenant: createdTenant,
      membership: createdMembership,
    };
  });
}

export async function executeCreateInvitationTransaction(
  client: PoolClient | any,
  params: {
    tenantId: string;
    invitedByMembershipId: string;
    authUserId?: string;
    email: string;
    role: string;
  }
): Promise<{ invitation: any; raw_token: string }> {
  const allowedRoles = ['tenant_admin', 'academic_head', 'teacher', 'finance_manager', 'parent', 'student'];
  if (!allowedRoles.includes(params.role)) {
    const err: any = new Error(`Invalid role '${params.role}' for invitation.`);
    err.code = 'INVALID_ROLE';
    throw err;
  }

  let actorAuthUserId: string = params.authUserId || '';
  if (!actorAuthUserId) {
    const mRes = await client.query(
      `SELECT auth_user_id FROM public.tenant_memberships WHERE id = $1`,
      [params.invitedByMembershipId]
    );
    actorAuthUserId = mRes.rows[0]?.auth_user_id || params.invitedByMembershipId || '';
  }

  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  return withTenantTransaction(client, params.tenantId, actorAuthUserId, async (db) => {
    // 1. Revoke any previous active invitations for this tenant and email
    await db.query(
      `UPDATE public.tenant_invitations
       SET revoked_at = NOW(), updated_at = NOW()
       WHERE tenant_id = $1 AND LOWER(email) = LOWER($2) AND accepted_at IS NULL AND revoked_at IS NULL`,
      [params.tenantId, params.email.trim()]
    );

    // 2. Insert new invitation
    const invRes = await db.query(
      `INSERT INTO public.tenant_invitations (
        tenant_id, email, role, invited_by_membership_id, token_hash, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, tenant_id, email, role, expires_at, created_at`,
      [
        params.tenantId,
        params.email.trim().toLowerCase(),
        params.role,
        params.invitedByMembershipId,
        tokenHash,
        expiresAt.toISOString(),
      ]
    );
    const createdInvitation = invRes.rows[0];

    // 3. Audit log
    await db.query(
      `INSERT INTO public.audit_logs (
        tenant_id, action, resource, resource_id,
        changes, actor_email
      ) VALUES ($1, 'INVITATION_CREATED', 'tenant_invitations', $2, $3, $4)`,
      [
        params.tenantId,
        createdInvitation.id,
        JSON.stringify({ email: createdInvitation.email, role: createdInvitation.role }),
        params.email,
      ]
    );

    return {
      invitation: createdInvitation,
      raw_token: rawToken,
    };
  });
}

export async function executeRevokeInvitationTransaction(
  client: PoolClient | any,
  params: {
    tenantId: string;
    invitationId: string;
    revokedByMembershipId: string;
    authUserId?: string;
    revokerEmail?: string;
  }
): Promise<{ invitation: any }> {
  let actorAuthUserId: string = params.authUserId || '';
  let actorEmail = params.revokerEmail;
  if (!actorAuthUserId || !actorEmail) {
    const mRes = await client.query(
      `SELECT auth_user_id, email FROM public.tenant_memberships WHERE id = $1`,
      [params.revokedByMembershipId]
    );
    if (!actorAuthUserId) {
      actorAuthUserId = mRes.rows[0]?.auth_user_id || params.revokedByMembershipId || '';
    }
    if (!actorEmail) {
      actorEmail = mRes.rows[0]?.email || 'admin@apexacademy.edu.pk';
    }
  }

  return withTenantTransaction(client, params.tenantId, actorAuthUserId, async (db) => {
    const res = await db.query(
      `UPDATE public.tenant_invitations
       SET revoked_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND revoked_at IS NULL AND accepted_at IS NULL
       RETURNING *`,
      [params.invitationId, params.tenantId]
    );

    if (res.rows.length === 0) {
      const err: any = new Error('Invitation not found or cannot be revoked.');
      err.code = 'INVITATION_CANNOT_REVOKE';
      throw err;
    }

    const revoked = res.rows[0];

    await db.query(
      `INSERT INTO public.audit_logs (
        tenant_id, action, resource, resource_id,
        changes, actor_email
      ) VALUES ($1, 'INVITATION_REVOKED', 'tenant_invitations', $2, $3, $4)`,
      [
        params.tenantId,
        revoked.id,
        JSON.stringify({ email: revoked.email, revoked_at: revoked.revoked_at }),
        actorEmail,
      ]
    );

    return revoked;
  });
}

export async function executeAcceptInvitationTransaction(
  client: PoolClient | any,
  params: {
    rawToken: string;
    authUserId: string;
    authEmail: string;
    authDisplayName?: string;
  }
) {
  const tokenHash = createHash('sha256').update(params.rawToken.trim()).digest('hex');

  return withPlatformTransaction(client, params.authUserId, async (db) => {
    // 1. Fetch invitation with lock
    const invRes = await db.query(
      `SELECT * FROM public.tenant_invitations WHERE token_hash = $1 FOR UPDATE`,
      [tokenHash]
    );

    if (invRes.rows.length === 0) {
      const err: any = new Error('Invitation not found or token is invalid.');
      err.code = 'INVITATION_NOT_FOUND';
      throw err;
    }

    const invitation = invRes.rows[0];

    if (invitation.revoked_at) {
      const err: any = new Error('This invitation has been revoked by the administrator.');
      err.code = 'INVITATION_REVOKED';
      throw err;
    }

    if (invitation.accepted_at) {
      const err: any = new Error('This invitation has already been accepted.');
      err.code = 'INVITATION_ALREADY_ACCEPTED';
      throw err;
    }

    if (new Date(invitation.expires_at).getTime() < Date.now()) {
      const err: any = new Error('This invitation has expired.');
      err.code = 'INVITATION_EXPIRED';
      throw err;
    }

    // Email matching enforcement
    if (invitation.email.toLowerCase() !== params.authEmail.trim().toLowerCase()) {
      const err: any = new Error(
        `This invitation was issued to ${invitation.email}, but you are signed in as ${params.authEmail}.`
      );
      err.code = 'EMAIL_MISMATCH';
      throw err;
    }

    // 2. Create or activate membership
    const existingMember = await db.query(
      `SELECT * FROM public.tenant_memberships WHERE tenant_id = $1 AND (auth_user_id = $2 OR LOWER(email) = LOWER($3))`,
      [invitation.tenant_id, params.authUserId, params.authEmail]
    );

    let membership: any;

    if (existingMember.rows.length > 0) {
      // Reactivate or update role
      const updRes = await db.query(
        `UPDATE public.tenant_memberships
         SET auth_user_id = $1, role = $2, status = 'active', updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [params.authUserId, invitation.role, existingMember.rows[0].id]
      );
      membership = updRes.rows[0];
    } else {
      const insRes = await db.query(
        `INSERT INTO public.tenant_memberships (
          tenant_id, auth_user_id, email, full_name, role, status
        ) VALUES ($1, $2, $3, $4, $5, 'active')
        RETURNING *`,
        [
          invitation.tenant_id,
          params.authUserId,
          params.authEmail.trim().toLowerCase(),
          params.authDisplayName || params.authEmail.split('@')[0],
          invitation.role,
        ]
      );
      membership = insRes.rows[0];
    }

    // 3. Mark invitation accepted
    await db.query(
      `UPDATE public.tenant_invitations
       SET accepted_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [invitation.id]
    );

    // 4. Audit log
    await db.query(
      `INSERT INTO public.audit_logs (
        tenant_id, action, resource, resource_id,
        changes, actor_email
      ) VALUES ($1, 'INVITATION_ACCEPTED', 'tenant_invitations', $2, $3, $4)`,
      [
        invitation.tenant_id,
        invitation.id,
        JSON.stringify({ membership_id: membership.id, email: params.authEmail }),
        params.authEmail,
      ]
    );

    return {
      membership,
      tenant_id: invitation.tenant_id,
    };
  });
}

export async function executeCreateCustomDomainTransaction(
  client: PoolClient | any,
  params: {
    tenantId: string;
    authUserId: string;
    actorEmail: string;
    hostname: string;
    verificationTxtName?: string;
    verificationTxtValue?: string;
    status?: 'pending' | 'verifying' | 'active' | 'failed';
  }
) {
  const cleanHost = params.hostname.trim().toLowerCase();
  return withTenantTransaction(client, params.tenantId, params.authUserId, async (db) => {
    // 1. Check if domain already registered
    const existing = await db.query(
      `SELECT id, tenant_id FROM public.tenant_domains WHERE hostname = $1`,
      [cleanHost]
    );
    if (existing.rows.length > 0) {
      const err: any = new Error(`Domain '${cleanHost}' is already registered.`);
      err.code = 'DOMAIN_ALREADY_EXISTS';
      throw err;
    }

    // 2. Insert into tenant_domains
    const insRes = await db.query(
      `INSERT INTO public.tenant_domains (
        tenant_id, hostname, status, is_custom_domain,
        verification_txt_name, verification_txt_value
      ) VALUES ($1, $2, $3, true, $4, $5)
      RETURNING *`,
      [
        params.tenantId,
        cleanHost,
        params.status || 'pending',
        params.verificationTxtName || null,
        params.verificationTxtValue || null,
      ]
    );
    const domainRow = insRes.rows[0];

    // 3. Insert domain provisioning job
    await db.query(
      `INSERT INTO public.domain_provisioning_jobs (
        tenant_id, hostname, action, status
      ) VALUES ($1, $2, 'provision', 'processing')`,
      [params.tenantId, cleanHost]
    );

    // 4. Record audit log
    await db.query(
      `INSERT INTO public.audit_logs (
        tenant_id, action, resource, resource_id,
        changes, actor_email
      ) VALUES ($1, 'DOMAIN_PROVISION_INITIATED', 'tenant_domains', $2, $3, $4)`,
      [
        params.tenantId,
        domainRow.id,
        JSON.stringify({ hostname: cleanHost, status: domainRow.status }),
        params.actorEmail,
      ]
    );

    return domainRow;
  });
}

export async function executeUpdateCustomDomainStatusTransaction(
  client: PoolClient | any,
  params: {
    tenantId: string;
    authUserId: string;
    domainId: string;
    status: 'pending' | 'verifying' | 'active' | 'failed' | 'pending_cleanup';
    actorEmail: string;
    lastError?: string;
  }
) {
  return withTenantTransaction(client, params.tenantId, params.authUserId, async (db) => {
    const verifiedAtClause = params.status === 'active' ? ', verified_at = NOW()' : '';
    const updRes = await db.query(
      `UPDATE public.tenant_domains
       SET status = $1, last_error = $2, updated_at = NOW() ${verifiedAtClause}
       WHERE id = $3 AND tenant_id = $4
       RETURNING *`,
      [params.status, params.lastError || null, params.domainId, params.tenantId]
    );

    if (updRes.rows.length === 0) {
      const err: any = new Error('Domain record not found.');
      err.code = 'DOMAIN_NOT_FOUND';
      throw err;
    }

    const updated = updRes.rows[0];

    await db.query(
      `INSERT INTO public.audit_logs (
        tenant_id, action, resource, resource_id,
        changes, actor_email
      ) VALUES ($1, 'DOMAIN_STATUS_UPDATED', 'tenant_domains', $2, $3, $4)`,
      [
        params.tenantId,
        updated.id,
        JSON.stringify({ hostname: updated.hostname, status: updated.status, last_error: updated.last_error }),
        params.actorEmail,
      ]
    );

    return updated;
  });
}

export async function executeInitiateCustomDomainDeletionTransaction(
  client: PoolClient | any,
  params: {
    tenantId: string;
    authUserId: string;
    domainId: string;
    actorEmail: string;
  }
) {
  return withTenantTransaction(client, params.tenantId, params.authUserId, async (db) => {
    const updRes = await db.query(
      `UPDATE public.tenant_domains
       SET status = 'pending_cleanup', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [params.domainId, params.tenantId]
    );

    if (updRes.rows.length === 0) {
      const err: any = new Error('Domain record not found.');
      err.code = 'DOMAIN_NOT_FOUND';
      throw err;
    }

    const domain = updRes.rows[0];

    await db.query(
      `INSERT INTO public.domain_provisioning_jobs (
        tenant_id, hostname, action, status
      ) VALUES ($1, $2, 'cleanup', 'processing')`,
      [params.tenantId, domain.hostname]
    );

    await db.query(
      `INSERT INTO public.audit_logs (
        tenant_id, action, resource, resource_id,
        changes, actor_email
      ) VALUES ($1, 'DOMAIN_CLEANUP_INITIATED', 'tenant_domains', $2, $3, $4)`,
      [
        params.tenantId,
        domain.id,
        JSON.stringify({ hostname: domain.hostname, status: 'pending_cleanup' }),
        params.actorEmail,
      ]
    );

    return domain;
  });
}

export async function executeFinalizeCustomDomainDeletionTransaction(
  client: PoolClient | any,
  params: {
    tenantId: string;
    authUserId: string;
    domainId: string;
    actorEmail: string;
  }
) {
  return withTenantTransaction(client, params.tenantId, params.authUserId, async (db) => {
    const delRes = await db.query(
      `DELETE FROM public.tenant_domains
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [params.domainId, params.tenantId]
    );

    if (delRes.rows.length === 0) {
      const err: any = new Error('Domain record not found.');
      err.code = 'DOMAIN_NOT_FOUND';
      throw err;
    }

    const deleted = delRes.rows[0];

    await db.query(
      `UPDATE public.domain_provisioning_jobs
       SET status = 'completed', completed_at = NOW(), updated_at = NOW()
       WHERE tenant_id = $1 AND hostname = $2 AND action = 'cleanup' AND status = 'processing'`,
      [params.tenantId, deleted.hostname]
    );

    await db.query(
      `INSERT INTO public.audit_logs (
        tenant_id, action, resource, resource_id,
        changes, actor_email
      ) VALUES ($1, 'DOMAIN_DELETED', 'tenant_domains', $2, $3, $4)`,
      [
        params.tenantId,
        deleted.id,
        JSON.stringify({ hostname: deleted.hostname }),
        params.actorEmail,
      ]
    );

    return deleted;
  });
}

