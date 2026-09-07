import { 
  Tenant, 
  User, 
  AcademicProgram, 
  Subject, 
  SubjectGroup, 
  Batch, 
  CustomFieldDefinition, 
  StudentInquiry, 
  Student, 
  InquiryStage 
} from '@apex/shared-types';

export interface StoredOTP {
  id: string;
  tenant_id: string;
  email: string;
  code_hash: string;
  attempts: number;
  expires_at: Date;
  used_at?: Date | null;
}

export interface IDataStore {
  // Tenancy & Auth
  getTenantBySlug(slug: string): Promise<Tenant | null>;
  getTenantById(id: string): Promise<Tenant | null>;
  getUserByEmail(tenantId: string, email: string): Promise<User | null>;
  createOTP(tenantId: string, email: string, codeHash: string, expiresAt: Date): Promise<StoredOTP>;
  getActiveOTP(tenantId: string, email: string): Promise<StoredOTP | null>;
  incrementOTPAttempts(id: string): Promise<void>;
  markOTPUsed(id: string): Promise<void>;

  // Academic Hierarchy (Phase 2)
  getPrograms(tenantId: string): Promise<AcademicProgram[]>;
  createProgram(data: Omit<AcademicProgram, 'id' | 'created_at' | 'updated_at'>): Promise<AcademicProgram>;
  
  getSubjects(tenantId: string): Promise<Subject[]>;
  createSubject(data: Omit<Subject, 'id' | 'created_at'>): Promise<Subject>;

  getSubjectGroups(tenantId: string, programId?: string): Promise<SubjectGroup[]>;
  createSubjectGroup(data: Omit<SubjectGroup, 'id' | 'created_at'>): Promise<SubjectGroup>;

  getBatches(tenantId: string, programId?: string): Promise<Batch[]>;
  createBatch(data: Omit<Batch, 'id' | 'created_at' | 'updated_at' | 'current_enrollment'>): Promise<Batch>;

  // Custom Fields (Phase 2)
  getCustomFields(tenantId: string, entityType: 'student' | 'inquiry'): Promise<CustomFieldDefinition[]>;
  createCustomField(data: Omit<CustomFieldDefinition, 'id' | 'created_at'>): Promise<CustomFieldDefinition>;

  // Inquiries Desk (Phase 2)
  getInquiries(tenantId: string): Promise<StudentInquiry[]>;
  createInquiry(data: Omit<StudentInquiry, 'id' | 'inquiry_number' | 'created_at' | 'updated_at'>): Promise<StudentInquiry>;
  updateInquiryStage(tenantId: string, id: string, stage: InquiryStage): Promise<StudentInquiry | null>;

  // Student SIS (Phase 2)
  getStudents(tenantId: string, batchId?: string): Promise<Student[]>;
  createStudent(data: Omit<Student, 'id' | 'admission_number' | 'roll_number' | 'admission_date' | 'created_at' | 'updated_at'>): Promise<Student>;
  admitInquiry(tenantId: string, inquiryId: string, batchId: string, electiveGroupId?: string): Promise<Student>;
}

export class InMemoryDataStore implements IDataStore {
  private tenants: Map<string, Tenant> = new Map();
  private users: Map<string, User> = new Map();
  private otps: StoredOTP[] = [];

  // Phase 2 Collections
  private programs: AcademicProgram[] = [];
  private subjects: Subject[] = [];
  private subjectGroups: SubjectGroup[] = [];
  private batches: Batch[] = [];
  private customFields: CustomFieldDefinition[] = [];
  private inquiries: StudentInquiry[] = [];
  private students: Student[] = [];

  constructor() {
    // 1. Seed Tenants
    const tenantA: Tenant = {
      id: 'a0000000-0000-0000-0000-000000000001',
      name: 'Apex Academy Lahore',
      slug: 'apex',
      domain: 'apex.edu.pk',
      status: 'active',
      tier: 'enterprise',
      max_students: 1200,
      max_staff: 80,
      trial_ends_at: new Date(Date.now() + 86400000 * 30).toISOString(),
      settings: {
        currency: 'PKR',
        timezone: 'Asia/Karachi',
        date_format: 'DD/MM/YYYY',
        academic_session: '2026-2027',
        campus_name: 'Gulberg III Campus',
        phone_country_code: '+92',
        features: {
          mobile_pwa_enabled: true,
          whatsapp_rapid_queue: true,
          geofence_attendance: true,
        },
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const tenantB: Tenant = {
      id: 'b0000000-0000-0000-0000-000000000002',
      name: 'Crescent College Karachi',
      slug: 'crescent',
      status: 'trial',
      tier: 'starter',
      max_students: 300,
      max_staff: 25,
      trial_ends_at: new Date(Date.now() + 86400000 * 30).toISOString(),
      settings: {
        currency: 'PKR',
        timezone: 'Asia/Karachi',
        date_format: 'DD/MM/YYYY',
        academic_session: '2026-2027',
        campus_name: 'Clifton Campus',
        phone_country_code: '+92',
        features: {
          mobile_pwa_enabled: false,
          whatsapp_rapid_queue: false,
          geofence_attendance: false,
        },
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.tenants.set(tenantA.id, tenantA);
    this.tenants.set(tenantB.id, tenantB);

    // 2. Seed Users
    const users: User[] = [
      {
        id: 'a1000000-0000-0000-0000-000000000001',
        tenant_id: tenantA.id,
        email: 'adnan@apexacademy.edu.pk',
        full_name: 'Director Adnan',
        role: 'tenant_admin',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'a1000000-0000-0000-0000-000000000002',
        tenant_id: tenantA.id,
        email: 'tariq@apexacademy.edu.pk',
        full_name: 'Sir Tariq Physics',
        role: 'teacher',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    users.forEach(u => this.users.set(`${u.tenant_id}:${u.email.toLowerCase()}`, u));

    // 3. Seed Phase 2 Academic Hierarchy for Tenant A
    const mdcatProg: AcademicProgram = {
      id: 'a2000000-0000-0000-0000-000000000001',
      tenant_id: tenantA.id,
      name: 'MDCAT Comprehensive Prep',
      code: 'MDCAT-2026',
      description: 'Pre-Medical college entrance preparation',
      sort_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const fscProg: AcademicProgram = {
      id: 'a2000000-0000-0000-0000-000000000002',
      tenant_id: tenantA.id,
      name: 'FSc Pre-Engineering',
      code: 'FSC-ENG',
      description: 'Higher Secondary School Certificate in Pre-Engineering',
      sort_order: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.programs.push(mdcatProg, fscProg);

    // Tenant B Program
    const crescentProg: AcademicProgram = {
      id: 'b2000000-0000-0000-0000-000000000001',
      tenant_id: tenantB.id,
      name: 'O-Level Science Track',
      code: 'O-SCI',
      description: 'Cambridge O-Levels sciences',
      sort_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.programs.push(crescentProg);

    const phySub: Subject = { id: 's1', tenant_id: tenantA.id, name: 'Physics', code: 'PHY', is_core: true, created_at: new Date().toISOString() };
    const chmSub: Subject = { id: 's2', tenant_id: tenantA.id, name: 'Chemistry', code: 'CHM', is_core: true, created_at: new Date().toISOString() };
    const bioSub: Subject = { id: 's3', tenant_id: tenantA.id, name: 'Biology', code: 'BIO', is_core: true, created_at: new Date().toISOString() };
    const mthSub: Subject = { id: 's4', tenant_id: tenantA.id, name: 'Mathematics', code: 'MTH', is_core: true, created_at: new Date().toISOString() };
    const engSub: Subject = { id: 's5', tenant_id: tenantA.id, name: 'English', code: 'ENG', is_core: false, created_at: new Date().toISOString() };
    this.subjects.push(phySub, chmSub, bioSub, mthSub, engSub);

    const compGroup: SubjectGroup = {
      id: 'g1',
      tenant_id: tenantA.id,
      program_id: mdcatProg.id,
      name: 'Core Medical Group',
      type: 'compulsory',
      subject_ids: [phySub.id, chmSub.id, bioSub.id],
      created_at: new Date().toISOString(),
    };
    const elecGroup: SubjectGroup = {
      id: 'g2',
      tenant_id: tenantA.id,
      program_id: fscProg.id,
      name: 'Pre-Eng Elective Track',
      type: 'elective_track',
      subject_ids: [phySub.id, chmSub.id, mthSub.id],
      created_at: new Date().toISOString(),
    };
    this.subjectGroups.push(compGroup, elecGroup);

    const batchA: Batch = {
      id: 'a3000000-0000-0000-0000-000000000001',
      tenant_id: tenantA.id,
      program_id: mdcatProg.id,
      name: 'Batch 2026-A',
      shift: 'morning',
      academic_session: '2026-2027',
      max_capacity: 50,
      current_enrollment: 1,
      room_number: 'Hall 1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const batchB: Batch = {
      id: 'a3000000-0000-0000-0000-000000000002',
      tenant_id: tenantA.id,
      program_id: fscProg.id,
      name: 'FSc Morning - Alpha',
      shift: 'morning',
      academic_session: '2026-2027',
      max_capacity: 40,
      current_enrollment: 0,
      room_number: 'Room 204',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const crescentBatch: Batch = {
      id: 'b3000000-0000-0000-0000-000000000001',
      tenant_id: tenantB.id,
      program_id: crescentProg.id,
      name: 'O-Levels Morning Section 1',
      shift: 'morning',
      academic_session: '2026-2027',
      max_capacity: 30,
      current_enrollment: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.batches.push(batchA, batchB, crescentBatch);

    // Custom Fields
    this.customFields.push(
      {
        id: 'cf-1',
        tenant_id: tenantA.id,
        entity_type: 'student',
        field_key: 'blood_group',
        label: 'Blood Group',
        field_type: 'select',
        options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
        is_required: false,
        sort_order: 1,
        created_at: new Date().toISOString(),
      },
      {
        id: 'cf-2',
        tenant_id: tenantA.id,
        entity_type: 'student',
        field_key: 'transport_route',
        label: 'Bus Route',
        field_type: 'select',
        options: ['Route 1 - Gulberg', 'Route 2 - DHA', 'Route 3 - Johar Town', 'Self Commute'],
        is_required: false,
        sort_order: 2,
        created_at: new Date().toISOString(),
      },
      {
        id: 'cf-3',
        tenant_id: tenantA.id,
        entity_type: 'student',
        field_key: 'previous_school',
        label: 'Previous School / College',
        field_type: 'text',
        is_required: false,
        sort_order: 3,
        created_at: new Date().toISOString(),
      }
    );

    // Seed Inquiries
    this.inquiries.push({
      id: 'inq-1',
      tenant_id: tenantA.id,
      inquiry_number: 'INQ-2026-001',
      student_name: 'Usman Farooq',
      phone: '+923001234567',
      email: 'usman@gmail.com',
      guardian_name: 'Farooq Ahmed',
      guardian_phone: '+923009988771',
      program_id: mdcatProg.id,
      source: 'Walk-in Campus Visit',
      stage: 'new',
      priority: 'high',
      notes: 'Interested in morning batch, requested fee discount discussion.',
      next_follow_up_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Seed Enrolled Students
    this.students.push({
      id: 'stud-1',
      tenant_id: tenantA.id,
      admission_number: 'ADM-2026-001',
      roll_number: 'A-101',
      full_name: 'Muhammad Ali Raza',
      email: 'ali.raza@gmail.com',
      phone: '+923001122334',
      guardian_name: 'Raza Ahmed',
      guardian_phone: '+923009876543',
      guardian_whatsapp: '+923009876543',
      program_id: mdcatProg.id,
      batch_id: batchA.id,
      elective_group_id: compGroup.id,
      status: 'active',
      custom_field_values: { emergency_phone: '+923009876543', blood_group: 'B+' },
      subjects: [phySub.id, chmSub.id, bioSub.id],
      admission_date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  // --- Auth & Tenant Methods ---
  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    for (const tenant of this.tenants.values()) {
      if (tenant.slug.toLowerCase() === slug.toLowerCase()) return tenant;
    }
    return null;
  }

  async getTenantById(id: string): Promise<Tenant | null> {
    return this.tenants.get(id) || null;
  }

  async getUserByEmail(tenantId: string, email: string): Promise<User | null> {
    return this.users.get(`${tenantId}:${email.toLowerCase()}`) || null;
  }

  async createOTP(tenantId: string, email: string, codeHash: string, expiresAt: Date): Promise<StoredOTP> {
    const entry: StoredOTP = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      email: email.toLowerCase(),
      code_hash: codeHash,
      attempts: 0,
      expires_at: expiresAt,
      used_at: null,
    };
    this.otps.push(entry);
    return entry;
  }

  async getActiveOTP(tenantId: string, email: string): Promise<StoredOTP | null> {
    const now = new Date();
    const valid = this.otps
      .filter(o => o.tenant_id === tenantId && o.email === email.toLowerCase() && !o.used_at && o.expires_at > now)
      .sort((a, b) => b.expires_at.getTime() - a.expires_at.getTime());
    return valid[0] || null;
  }

  async incrementOTPAttempts(id: string): Promise<void> {
    const otp = this.otps.find(o => o.id === id);
    if (otp) otp.attempts += 1;
  }

  async markOTPUsed(id: string): Promise<void> {
    const otp = this.otps.find(o => o.id === id);
    if (otp) otp.used_at = new Date();
  }

  // --- Academic Hierarchy Methods ---
  async getPrograms(tenantId: string): Promise<AcademicProgram[]> {
    return this.programs.filter(p => p.tenant_id === tenantId);
  }

  async createProgram(data: Omit<AcademicProgram, 'id' | 'created_at' | 'updated_at'>): Promise<AcademicProgram> {
    const program: AcademicProgram = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.programs.push(program);
    return program;
  }

  async getSubjects(tenantId: string): Promise<Subject[]> {
    return this.subjects.filter(s => s.tenant_id === tenantId);
  }

  async createSubject(data: Omit<Subject, 'id' | 'created_at'>): Promise<Subject> {
    const subject: Subject = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    this.subjects.push(subject);
    return subject;
  }

  async getSubjectGroups(tenantId: string, programId?: string): Promise<SubjectGroup[]> {
    return this.subjectGroups.filter(g => 
      g.tenant_id === tenantId && (!programId || g.program_id === programId)
    );
  }

  async createSubjectGroup(data: Omit<SubjectGroup, 'id' | 'created_at'>): Promise<SubjectGroup> {
    const group: SubjectGroup = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    this.subjectGroups.push(group);
    return group;
  }

  async getBatches(tenantId: string, programId?: string): Promise<Batch[]> {
    return this.batches.filter(b => 
      b.tenant_id === tenantId && (!programId || b.program_id === programId)
    );
  }

  async createBatch(data: Omit<Batch, 'id' | 'created_at' | 'updated_at' | 'current_enrollment'>): Promise<Batch> {
    const batch: Batch = {
      ...data,
      id: crypto.randomUUID(),
      current_enrollment: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.batches.push(batch);
    return batch;
  }

  // --- Custom Fields Methods ---
  async getCustomFields(tenantId: string, entityType: 'student' | 'inquiry'): Promise<CustomFieldDefinition[]> {
    return this.customFields
      .filter(f => f.tenant_id === tenantId && f.entity_type === entityType)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  async createCustomField(data: Omit<CustomFieldDefinition, 'id' | 'created_at'>): Promise<CustomFieldDefinition> {
    const field: CustomFieldDefinition = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    this.customFields.push(field);
    return field;
  }

  // --- Inquiries Methods ---
  async getInquiries(tenantId: string): Promise<StudentInquiry[]> {
    return this.inquiries.filter(i => i.tenant_id === tenantId);
  }

  async createInquiry(data: Omit<StudentInquiry, 'id' | 'inquiry_number' | 'created_at' | 'updated_at'>): Promise<StudentInquiry> {
    const count = this.inquiries.filter(i => i.tenant_id === data.tenant_id).length + 1;
    const inquiry: StudentInquiry = {
      ...data,
      id: crypto.randomUUID(),
      inquiry_number: `INQ-2026-${count.toString().padStart(3, '0')}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.inquiries.push(inquiry);
    return inquiry;
  }

  async updateInquiryStage(tenantId: string, id: string, stage: InquiryStage): Promise<StudentInquiry | null> {
    const inq = this.inquiries.find(i => i.id === id && i.tenant_id === tenantId);
    if (!inq) return null;
    inq.stage = stage;
    inq.updated_at = new Date().toISOString();
    return inq;
  }

  // --- Student SIS Methods ---
  async getStudents(tenantId: string, batchId?: string): Promise<Student[]> {
    return this.students.filter(s => 
      s.tenant_id === tenantId && (!batchId || s.batch_id === batchId)
    );
  }

  async createStudent(data: Omit<Student, 'id' | 'admission_number' | 'roll_number' | 'admission_date' | 'created_at' | 'updated_at'>): Promise<Student> {
    const batchStudents = this.students.filter(s => s.tenant_id === data.tenant_id && s.batch_id === data.batch_id);
    const count = this.students.filter(s => s.tenant_id === data.tenant_id).length + 1;

    const student: Student = {
      ...data,
      id: crypto.randomUUID(),
      admission_number: `ADM-2026-${count.toString().padStart(3, '0')}`,
      roll_number: `R-${(batchStudents.length + 101).toString()}`,
      admission_date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.students.push(student);

    // Increment batch enrollment
    const batch = this.batches.find(b => b.id === data.batch_id);
    if (batch) batch.current_enrollment += 1;

    return student;
  }

  async admitInquiry(tenantId: string, inquiryId: string, batchId: string, electiveGroupId?: string): Promise<Student> {
    const inq = await this.updateInquiryStage(tenantId, inquiryId, 'admitted');
    if (!inq) throw new Error('Inquiry not found');

    const batch = this.batches.find(b => b.id === batchId && b.tenant_id === tenantId);
    if (!batch) throw new Error('Batch not found');

    // Get compulsory subjects for the program
    const compGroup = this.subjectGroups.find(g => g.tenant_id === tenantId && g.program_id === batch.program_id && g.type === 'compulsory');
    let subjects = compGroup ? [...compGroup.subject_ids] : [];

    if (electiveGroupId) {
      const elecGroup = this.subjectGroups.find(g => g.id === electiveGroupId && g.tenant_id === tenantId);
      if (elecGroup) {
        subjects = [...subjects, ...elecGroup.subject_ids];
      }
    }

    return this.createStudent({
      tenant_id: tenantId,
      full_name: inq.student_name,
      phone: inq.phone,
      email: inq.email,
      guardian_name: inq.guardian_name || 'Guardian',
      guardian_phone: inq.guardian_phone || inq.phone,
      program_id: batch.program_id,
      batch_id: batch.id,
      elective_group_id: electiveGroupId,
      status: 'active',
      custom_field_values: {},
      subjects,
    });
  }
}
