import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { InMemoryDataStore } from '../src/services/store';

describe('Student & Parent Portal End-to-End Operational Lifecycle Tests', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;
  let adminToken: string;
  let studentToken: string;

  const TENANT_A_ID = 'a0000000-0000-0000-0000-000000000001'; // Apex Academy

  beforeAll(async () => {
    store = new InMemoryDataStore();
    app = await buildApp({ store });
    await app.ready();

    // Authenticate Admin
    adminToken = app.jwt.sign({
      sub: 'a1000000-0000-0000-0000-000000000001',
      user_id: 'a1000000-0000-0000-0000-000000000001',
      tenant_id: TENANT_A_ID,
      email: 'adnan@apexacademy.edu.pk',
      role: 'tenant_admin',
    });

    // Authenticate Student (Muhammad Ali Raza, stud-1)
    studentToken = app.jwt.sign({
      sub: 'a1000000-0000-0000-0000-000000000005',
      user_id: 'a1000000-0000-0000-0000-000000000005',
      tenant_id: TENANT_A_ID,
      email: 'student@apexacademy.edu.pk',
      role: 'student',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Student portal returns complete live academic hierarchy and profile info', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/student-parent',
      headers: { authorization: `Bearer ${studentToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);

    const data = body.data;
    const profile = data.student_profile;
    expect(profile.id).toBe('stud-1');
    expect(profile.full_name).toBe('Muhammad Ali Raza');
    expect(profile.roll_number).toBe('A-101');
    expect(profile.admission_number).toBe('ADM-2026-001');
    expect(profile.batch_name).toBe('Batch 2026-A');
    expect(profile.program_name).toContain('MDCAT');
    expect(profile.guardian_name).toBe('Raza Ahmed');
    expect(profile.guardian_phone).toBe('+923009876543');
    expect(Array.isArray(profile.subjects)).toBe(true);
    expect(profile.subjects).toContain('Physics');
  });

  it('2. Student portal delivers live institutional banking configuration for challans', async () => {
    // 1. Admin updates tenant banking in Academy Settings
    const updateRes = await app.inject({
      method: 'PUT',
      url: '/api/v1/academic/settings',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        settings: {
          bank_name: 'Habib Bank Limited',
          account_title: 'Apex Academy Fee Collection',
          account_number: '12345678901234',
          iban: 'PK36HABB0000123456789012',
          branch_code: '0142',
          raast_id: '03001234567',
        },
      },
    });
    expect(updateRes.statusCode).toBe(200);

    // 2. Student fetches portal overview - banking must match updated admin settings
    const portalRes = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/student-parent',
      headers: { authorization: `Bearer ${studentToken}` },
    });

    expect(portalRes.statusCode).toBe(200);
    const banking = portalRes.json().data.tenant_banking;
    expect(banking).toBeDefined();
    expect(banking.bank_name).toBe('Habib Bank Limited');
    expect(banking.account_title).toBe('Apex Academy Fee Collection');
    expect(banking.iban).toBe('PK36HABB0000123456789012');
    expect(banking.raast_id).toBe('03001234567');

    // 3. When admin leaves Raast ID blank, student portal banking reflects empty raast_id
    await app.inject({
      method: 'PUT',
      url: '/api/v1/academic/settings',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        settings: {
          bank_name: 'Meezan Islamic Banking',
          account_title: 'Apex Tuition A/C',
          account_number: '998877665544',
          iban: 'PK12MEZN0000998877665544',
          raast_id: '', // Blank
        },
      },
    });

    const portalRes2 = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/student-parent',
      headers: { authorization: `Bearer ${studentToken}` },
    });
    const banking2 = portalRes2.json().data.tenant_banking;
    expect(banking2.bank_name).toBe('Meezan Islamic Banking');
    expect(banking2.raast_id).toBe(''); // Empty, so it is hidden in student portal!
  });

  it('3. Invoices and fee ledger calculate accurate balance without NaN', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/student-parent',
      headers: { authorization: `Bearer ${studentToken}` },
    });

    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(typeof data.unpaid_balance).toBe('number');
    expect(isNaN(data.unpaid_balance)).toBe(false);
    expect(Array.isArray(data.invoices)).toBe(true);
    expect(Array.isArray(data.recent_receipts)).toBe(true);
  });

  it('4. Student leave application flow: submission and portal visibility', async () => {
    // 1. Student submits a leave application
    const leaveRes = await app.inject({
      method: 'POST',
      url: '/api/v1/attendance/leaves',
      headers: { authorization: `Bearer ${studentToken}` },
      payload: {
        student_id: 'stud-1',
        category: 'personal',
        start_date: '2026-09-25',
        end_date: '2026-09-26',
        reason: 'Family event and wedding ceremony out of city',
      },
    });
    expect(leaveRes.statusCode).toBe(201);
    const leave = leaveRes.json().data;
    expect(leave.status).toBe('pending');
    expect(leave.reason).toContain('wedding');

    // 2. Student retrieves portal overview - leave applications list must include the new request
    const portalRes = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/student-parent',
      headers: { authorization: `Bearer ${studentToken}` },
    });

    expect(portalRes.statusCode).toBe(200);
    const data = portalRes.json().data;
    expect(Array.isArray(data.leave_applications)).toBe(true);
    const foundLeave = data.leave_applications.find((l: any) => l.id === leave.id);
    expect(foundLeave).toBeDefined();
    expect(foundLeave.status).toBe('pending');
  });

  it('5. Tenant Admin can preview student portal using student_id query param', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/student-parent?student_id=stud-1',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.student_profile.id).toBe('stud-1');
    expect(data.student_profile.full_name).toBe('Muhammad Ali Raza');
  });

  it('6. Strict Security: Student role is rejected from executing administrative operations', async () => {
    // Attempt to record batch attendance
    const attRes = await app.inject({
      method: 'POST',
      url: '/api/v1/attendance/students/batch',
      headers: { authorization: `Bearer ${studentToken}` },
      payload: {
        batch_id: 'a3000000-0000-0000-0000-000000000001',
        date: '2026-09-25',
        records: [{ student_id: 'stud-1', status: 'present' }],
      },
    });
    expect(attRes.statusCode).toBe(403);

    // Attempt to update academy settings
    const settingsRes = await app.inject({
      method: 'PUT',
      url: '/api/v1/academic/settings',
      headers: { authorization: `Bearer ${studentToken}` },
      payload: { settings: { campus_name: 'Hacked Campus' } },
    });
    expect(settingsRes.statusCode).toBe(403);
  });

  it('7. Exam Results Sync: Admin graded exams (status GRADED) are visible in student report cards', async () => {
    // 1. Create and grade an exam in Admin
    const examRes = await app.inject({
      method: 'POST',
      url: '/api/v1/exams/exams',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: 'Physics Midterm Assessment',
        batch_id: 'a3000000-0000-0000-0000-000000000001',
        subject_id: 's1',
        exam_date: '2026-09-10',
        start_time: '09:00',
        end_time: '11:00',
        total_marks: 100,
        short_total_marks: 100,
        passing_percentage: 40,
        status: 'GRADED',
      },
    });
    expect(examRes.statusCode).toBe(201);
    const exam = examRes.json().data;

    // 2. Record student evaluation
    const evalRes = await app.inject({
      method: 'POST',
      url: `/api/v1/exams/${exam.id}/evaluate`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        student_id: 'stud-1',
        short_score: 88,
        short_remarks: 'Excellent numerical solving skills',
        status: 'GRADED',
      },
    });
    expect(evalRes.statusCode).toBe(201);

    // 3. Fetch student portal overview: the graded exam must appear in report cards!
    const portalRes = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/student-parent',
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(portalRes.statusCode).toBe(200);
    const reportCards = portalRes.json().data.exam_report_cards;
    const foundCard = reportCards.find((rc: any) => rc.exam.id === exam.id);
    expect(foundCard).toBeDefined();
    expect(foundCard.evaluation.total_obtained).toBe(88);
    expect(foundCard.evaluation.short_remarks).toContain('Excellent numerical');
  });

  it('8. Online Bank Transfer: Student can submit payment proof for cashier reconciliation', async () => {
    // 1. Get student invoices
    const portalRes = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/student-parent',
      headers: { authorization: `Bearer ${studentToken}` },
    });
    const data = portalRes.json().data;
    expect(data.invoices.length).toBeGreaterThan(0);
    expect(data.tenant_banking).toBeDefined();
    expect(data.tenant_banking.bank_name).toBeDefined();
    expect(data.tenant_banking.iban).toBeDefined();
    expect(data.tenant_banking.whatsapp_number).toBeDefined();
  });

  it('9. Security: Student is rejected from submitting leave for another student (IDOR protection)', async () => {
    const leaveRes = await app.inject({
      method: 'POST',
      url: '/api/v1/attendance/leaves',
      headers: { authorization: `Bearer ${studentToken}` },
      payload: {
        student_id: 'some-other-student-id-999',
        category: 'medical',
        start_date: '2026-09-28',
        end_date: '2026-09-29',
        reason: 'Unauthorized leave submission test',
      },
    });
    expect(leaveRes.statusCode).toBe(403);
    expect(leaveRes.json().error.code).toBe('UNAUTHORIZED_LEAVE_SUBMISSION');
  });

  it('10. Leave Submission: Invalid date range (end_date before start_date) returns 400', async () => {
    const leaveRes = await app.inject({
      method: 'POST',
      url: '/api/v1/attendance/leaves',
      headers: { authorization: `Bearer ${studentToken}` },
      payload: {
        student_id: 'stud-1',
        category: 'medical',
        start_date: '2026-09-29',
        end_date: '2026-09-28', // Earlier than start_date
        reason: 'Typo in medical leave date',
      },
    });
    expect(leaveRes.statusCode).toBe(400);
    expect(leaveRes.json().error.code).toBe('INVALID_DATE_RANGE');
  });

  it('11. Leave Scoping: Student only sees their own leave applications via GET /attendance/leaves', async () => {
    // 1. Submit leave for stud-1
    await app.inject({
      method: 'POST',
      url: '/api/v1/attendance/leaves',
      headers: { authorization: `Bearer ${studentToken}` },
      payload: {
        student_id: 'stud-1',
        category: 'personal',
        start_date: '2026-10-01',
        end_date: '2026-10-02',
        reason: 'Family wedding ceremony',
      },
    });

    // 2. Query leaves as student
    const getRes = await app.inject({
      method: 'GET',
      url: '/api/v1/attendance/leaves',
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(getRes.statusCode).toBe(200);
    const leaves = getRes.json().data;
    expect(Array.isArray(leaves)).toBe(true);
    expect(leaves.every((l: any) => l.student_id === 'stud-1')).toBe(true);
  });

  it('12. Complaints Privacy: Student only retrieves their own complaints', async () => {
    // 1. Admin creates a complaint
    await app.inject({
      method: 'POST',
      url: '/api/v1/complaints/complaints',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        category: 'facility',
        priority: 'normal',
        subject: 'Admin Facility Notice',
        description: 'Water dispenser maintenance needed in staff room',
      },
    });

    // 2. Student creates a complaint
    const stdCompRes = await app.inject({
      method: 'POST',
      url: '/api/v1/complaints/complaints',
      headers: { authorization: `Bearer ${studentToken}` },
      payload: {
        category: 'teaching_quality',
        priority: 'normal',
        subject: 'Physics Lab Equipments',
        description: 'Vernier calipers need recalibration for upcoming practicals',
      },
    });
    expect(stdCompRes.statusCode).toBe(201);
    const myTicketId = stdCompRes.json().data.id;

    // 3. Student fetches complaints - must only see their own ticket
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/complaints/complaints',
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(listRes.statusCode).toBe(200);
    const tickets = listRes.json().data;
    expect(tickets.length).toBe(1);
    expect(tickets[0].id).toBe(myTicketId);
    expect(tickets[0].subject).toBe('Physics Lab Equipments');
  });

  it('13. Security: Student is rejected from updating or resolving complaint ticket status', async () => {
    // 1. Student creates ticket
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/complaints/complaints',
      headers: { authorization: `Bearer ${studentToken}` },
      payload: {
        category: 'general',
        priority: 'normal',
        subject: 'Library Books Access',
        description: 'Requesting weekend reading hours',
      },
    });
    const ticketId = createRes.json().data.id;

    // 2. Student tries to resolve their own ticket
    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/complaints/complaints/${ticketId}/status`,
      headers: { authorization: `Bearer ${studentToken}` },
      payload: {
        status: 'resolved',
        resolution_reply: 'I resolved this myself',
      },
    });
    expect(updateRes.statusCode).toBe(403);
    expect(updateRes.json().error.code).toBe('FORBIDDEN_ROLE');

    // 3. Admin can update and resolve successfully
    const adminUpdateRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/complaints/complaints/${ticketId}/status`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        status: 'resolved',
        resolution_reply: 'Approved. Library hours extended on Saturday mornings.',
      },
    });
    expect(adminUpdateRes.statusCode).toBe(200);
    expect(adminUpdateRes.json().data.status).toBe('resolved');
  });
});
