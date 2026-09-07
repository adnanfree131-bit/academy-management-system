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
  InquiryStage,
  Room,
  TimetableSlot,
  TimetableCollisionResult,
  DayOfWeek,
  StudentAttendanceRecord,
  AttendanceStatus,
  LeaveApplication,
  LeaveStatus,
  CampusGeofenceConfig,
  StaffAttendanceRecord,
  StaffAttendanceStatus,
  HomeworkAssignment,
  NotebookCheckRecord,
  NotebookStatus,
  ComplaintTicket,
  ComplaintStatus
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

  // --- Phase 3: Timetable & Collision Engine ---
  getRooms(tenantId: string): Promise<Room[]>;
  createRoom(data: Omit<Room, 'id' | 'created_at' | 'updated_at'>): Promise<Room>;
  getTimetable(tenantId: string, batchId?: string, day?: DayOfWeek): Promise<TimetableSlot[]>;
  checkCollision(tenantId: string, slot: {
    batchId: string;
    teacherId: string;
    roomId?: string | null;
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
    excludeSlotId?: string;
  }): Promise<TimetableCollisionResult>;
  createTimetableSlot(data: Omit<TimetableSlot, 'id' | 'created_at' | 'updated_at'>): Promise<TimetableSlot>;
  assignSubstitute(tenantId: string, slotId: string, substituteTeacherId: string): Promise<TimetableSlot>;
  getAvailableTeachers(tenantId: string, dayOfWeek: DayOfWeek, startTime: string, endTime: string): Promise<User[]>;

  // --- Phase 3: Student Attendance & Leaves ---
  getStudentAttendance(tenantId: string, batchId: string, date: string): Promise<StudentAttendanceRecord[]>;
  recordBatchAttendance(
    tenantId: string,
    batchId: string,
    date: string,
    records: Array<{ student_id: string; status: AttendanceStatus; remarks?: string }>,
    markedBy?: string
  ): Promise<StudentAttendanceRecord[]>;
  getLeaveApplications(tenantId: string, studentId?: string): Promise<LeaveApplication[]>;
  submitLeaveApplication(data: Omit<LeaveApplication, 'id' | 'status' | 'created_at' | 'updated_at'>): Promise<LeaveApplication>;
  reviewLeaveApplication(tenantId: string, leaveId: string, status: LeaveStatus, reviewNotes?: string, reviewerId?: string): Promise<LeaveApplication>;

  // --- Phase 3: Campus Geofence & Staff Attendance ---
  getGeofenceConfig(tenantId: string): Promise<CampusGeofenceConfig>;
  updateGeofenceConfig(tenantId: string, config: Partial<CampusGeofenceConfig>): Promise<CampusGeofenceConfig>;
  staffClockIn(tenantId: string, staffId: string, staffName: string, lat: number, lng: number): Promise<StaffAttendanceRecord>;
  getStaffAttendance(tenantId: string, date?: string): Promise<StaffAttendanceRecord[]>;
  adjustStaffAttendance(tenantId: string, id: string, status: StaffAttendanceStatus, notes: string): Promise<StaffAttendanceRecord>;

  // --- Phase 3: Homework Diary & Physical Notebook Checking ---
  getHomework(tenantId: string, batchId?: string): Promise<HomeworkAssignment[]>;
  createHomework(data: Omit<HomeworkAssignment, 'id' | 'created_at'>): Promise<HomeworkAssignment>;
  recordNotebookChecks(
    tenantId: string,
    assignmentId: string,
    checks: Array<{ student_id: string; status: NotebookStatus; remarks?: string }>,
    checkedBy: string
  ): Promise<NotebookCheckRecord[]>;
  getNotebookChecks(tenantId: string, assignmentId: string): Promise<NotebookCheckRecord[]>;

  // --- Phase 3: Complaints & Feedback ---
  getComplaints(tenantId: string): Promise<ComplaintTicket[]>;
  createComplaint(data: Omit<ComplaintTicket, 'id' | 'status' | 'created_at' | 'updated_at'>): Promise<ComplaintTicket>;
  updateComplaintStatus(
    tenantId: string,
    id: string,
    status: ComplaintStatus,
    resolutionReply?: string,
    internalNotes?: string,
    resolvedBy?: string
  ): Promise<ComplaintTicket>;
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

  // Phase 3 Collections
  private rooms: Room[] = [];
  private timetableSlots: TimetableSlot[] = [];
  private studentAttendance: StudentAttendanceRecord[] = [];
  private leaveApplications: LeaveApplication[] = [];
  private geofenceConfigs: Map<string, CampusGeofenceConfig> = new Map();
  private staffAttendance: StaffAttendanceRecord[] = [];
  private homeworkAssignments: HomeworkAssignment[] = [];
  private notebookChecks: NotebookCheckRecord[] = [];
  private complaints: ComplaintTicket[] = [];

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
      {
        id: 'a1000000-0000-0000-0000-000000000003',
        tenant_id: tenantA.id,
        email: 'hamza@apexacademy.edu.pk',
        full_name: 'Sir Hamza Math',
        role: 'teacher',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'a1000000-0000-0000-0000-000000000004',
        tenant_id: tenantA.id,
        email: 'ayesha@apexacademy.edu.pk',
        full_name: 'Dr. Ayesha Biology',
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

    // Seed Phase 3 Rooms
    const room1: Room = {
      id: 'r1',
      tenant_id: tenantA.id,
      name: 'Hall 1',
      capacity: 60,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const room2: Room = {
      id: 'r2',
      tenant_id: tenantA.id,
      name: 'Room 204',
      capacity: 45,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const room3: Room = {
      id: 'r3',
      tenant_id: tenantA.id,
      name: 'Physics Lab',
      capacity: 35,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.rooms.push(room1, room2, room3);

    // Seed Phase 3 Timetable Slots
    const slot1: TimetableSlot = {
      id: 'slot-1',
      tenant_id: tenantA.id,
      batch_id: batchA.id,
      subject_id: phySub.id,
      teacher_id: 'a1000000-0000-0000-0000-000000000002',
      teacher_name: 'Sir Tariq Physics',
      batch_name: 'Batch 2026-A',
      subject_name: 'Physics',
      room_id: 'r1',
      room_name: 'Hall 1',
      day_of_week: 'monday',
      start_time: '08:30',
      end_time: '09:45',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const slot2: TimetableSlot = {
      id: 'slot-2',
      tenant_id: tenantA.id,
      batch_id: batchA.id,
      subject_id: bioSub.id,
      teacher_id: 'a1000000-0000-0000-0000-000000000004',
      teacher_name: 'Dr. Ayesha Biology',
      batch_name: 'Batch 2026-A',
      subject_name: 'Biology',
      room_id: 'r1',
      room_name: 'Hall 1',
      day_of_week: 'monday',
      start_time: '10:00',
      end_time: '11:15',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.timetableSlots.push(slot1, slot2);

    // Seed Phase 3 Geofence Configs (Default Gulberg III Campus)
    this.geofenceConfigs.set(tenantA.id, {
      tenant_id: tenantA.id,
      campus_name: 'Gulberg III Campus',
      latitude: 31.5204,
      longitude: 74.3587,
      radius_meters: 150,
      shift_start_time: '08:00:00',
      grace_period_minutes: 15,
      multi_room_enabled: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    this.geofenceConfigs.set(tenantB.id, {
      tenant_id: tenantB.id,
      campus_name: 'Clifton Campus',
      latitude: 24.8138,
      longitude: 67.0300,
      radius_meters: 100,
      shift_start_time: '08:30:00',
      grace_period_minutes: 10,
      multi_room_enabled: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Seed Initial Homework Assignment
    const hw1: HomeworkAssignment = {
      id: 'hw-1',
      tenant_id: tenantA.id,
      batch_id: batchA.id,
      batch_name: 'Batch 2026-A',
      subject_id: phySub.id,
      subject_name: 'Physics',
      teacher_id: 'a1000000-0000-0000-0000-000000000002',
      teacher_name: 'Sir Tariq Physics',
      title: 'Chapter 3: Vectors & Equilibrium Numerical Problems (1-8)',
      description: 'Solve textbook practice problems on your physical registered notebooks. Physical inspection in tomorrow’s first period.',
      assigned_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      created_at: new Date().toISOString(),
    };
    this.homeworkAssignments.push(hw1);

    // Seed Initial Complaint Ticket
    const comp1: ComplaintTicket = {
      id: 'comp-1',
      tenant_id: tenantA.id,
      user_id: 'stud-1',
      user_name: 'Muhammad Ali Raza',
      category: 'facility',
      priority: 'normal',
      subject: 'Air Conditioner Cooling in Hall 1',
      description: 'The right side AC in Hall 1 has reduced cooling during midday sessions.',
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.complaints.push(comp1);
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

  // --- Phase 3: Rooms & Timetable Engine ---
  async getRooms(tenantId: string): Promise<Room[]> {
    return this.rooms.filter(r => r.tenant_id === tenantId);
  }

  async createRoom(data: Omit<Room, 'id' | 'created_at' | 'updated_at'>): Promise<Room> {
    const room: Room = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.rooms.push(room);
    return room;
  }

  async getTimetable(tenantId: string, batchId?: string, day?: DayOfWeek): Promise<TimetableSlot[]> {
    return this.timetableSlots.filter(s => 
      s.tenant_id === tenantId &&
      (!batchId || s.batch_id === batchId) &&
      (!day || s.day_of_week === day) &&
      !s.is_cancelled
    );
  }

  async checkCollision(tenantId: string, slot: {
    batchId: string;
    teacherId: string;
    roomId?: string | null;
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
    excludeSlotId?: string;
  }): Promise<TimetableCollisionResult> {
    const geofence = await this.getGeofenceConfig(tenantId);
    const multiRoom = geofence.multi_room_enabled;

    const existingSlots = this.timetableSlots.filter(s => 
      s.tenant_id === tenantId &&
      s.day_of_week === slot.dayOfWeek &&
      !s.is_cancelled &&
      s.id !== slot.excludeSlotId
    );

    for (const existing of existingSlots) {
      // Time overlap check: startA < endB && endA > startB
      const overlaps = slot.startTime < existing.end_time && slot.endTime > existing.start_time;
      if (!overlaps) continue;

      // 1. Batch conflict: Is this batch already scheduled at this time?
      if (existing.batch_id === slot.batchId) {
        return {
          has_conflict: true,
          conflict_type: 'batch_conflict',
          message: `Batch collision: Batch is already scheduled for ${existing.subject_name || 'a class'} from ${existing.start_time} to ${existing.end_time}`,
          conflicting_slot: existing,
        };
      }

      // 2. Teacher conflict: Is the teacher (or substitute) already booked elsewhere?
      const assignedTeacherId = existing.substitute_teacher_id || existing.teacher_id;
      if (assignedTeacherId === slot.teacherId) {
        return {
          has_conflict: true,
          conflict_type: 'teacher_conflict',
          message: `Teacher collision: ${existing.teacher_name || 'Teacher'} is already scheduled for ${existing.batch_name || 'another batch'} from ${existing.start_time} to ${existing.end_time}`,
          conflicting_slot: existing,
        };
      }

      // 3. Room conflict: Only if multi-room mode is enabled and physical roomId is provided
      if (multiRoom && slot.roomId && existing.room_id && existing.room_id === slot.roomId) {
        return {
          has_conflict: true,
          conflict_type: 'room_conflict',
          message: `Room collision: Room ${existing.room_name || existing.room_id} is already occupied from ${existing.start_time} to ${existing.end_time}`,
          conflicting_slot: existing,
        };
      }
    }

    return { has_conflict: false };
  }

  async createTimetableSlot(data: Omit<TimetableSlot, 'id' | 'created_at' | 'updated_at'>): Promise<TimetableSlot> {
    const collision = await this.checkCollision(data.tenant_id, {
      batchId: data.batch_id,
      teacherId: data.teacher_id,
      roomId: data.room_id,
      dayOfWeek: data.day_of_week,
      startTime: data.start_time,
      endTime: data.end_time,
    });

    if (collision.has_conflict) {
      throw new Error(`Collision detected: ${collision.message}`);
    }

    // Hydrate names if available
    const batch = this.batches.find(b => b.id === data.batch_id);
    const subject = this.subjects.find(s => s.id === data.subject_id);
    const teacher = Array.from(this.users.values()).find(u => u.id === data.teacher_id);
    const room = data.room_id ? this.rooms.find(r => r.id === data.room_id) : undefined;

    const slot: TimetableSlot = {
      ...data,
      id: crypto.randomUUID(),
      batch_name: batch?.name || data.batch_name,
      subject_name: subject?.name || data.subject_name,
      teacher_name: teacher?.full_name || data.teacher_name,
      room_name: room?.name || data.room_name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.timetableSlots.push(slot);
    return slot;
  }

  async assignSubstitute(tenantId: string, slotId: string, substituteTeacherId: string): Promise<TimetableSlot> {
    const slot = this.timetableSlots.find(s => s.id === slotId && s.tenant_id === tenantId);
    if (!slot) throw new Error('Timetable slot not found');

    const substitute = Array.from(this.users.values()).find(u => u.id === substituteTeacherId && u.tenant_id === tenantId);
    if (!substitute) throw new Error('Substitute teacher not found');

    // Check if substitute teacher is already engaged during this time
    const collision = await this.checkCollision(tenantId, {
      batchId: 'none', // skip batch collision
      teacherId: substituteTeacherId,
      dayOfWeek: slot.day_of_week,
      startTime: slot.start_time,
      endTime: slot.end_time,
      excludeSlotId: slotId,
    });

    if (collision.has_conflict && collision.conflict_type === 'teacher_conflict') {
      throw new Error(`Substitute conflict: Teacher ${substitute.full_name} is already teaching another class during this time.`);
    }

    slot.substitute_teacher_id = substituteTeacherId;
    slot.substitute_teacher_name = substitute.full_name;
    slot.updated_at = new Date().toISOString();
    return slot;
  }

  async getAvailableTeachers(tenantId: string, dayOfWeek: DayOfWeek, startTime: string, endTime: string): Promise<User[]> {
    const allTeachers = Array.from(this.users.values()).filter(u => u.tenant_id === tenantId && (u.role === 'teacher' || u.role === 'tenant_admin'));
    
    // Find teachers with conflicting slots
    const busyTeacherIds = new Set<string>();
    for (const slot of this.timetableSlots) {
      if (slot.tenant_id === tenantId && slot.day_of_week === dayOfWeek && !slot.is_cancelled) {
        const overlaps = startTime < slot.end_time && endTime > slot.start_time;
        if (overlaps) {
          busyTeacherIds.add(slot.substitute_teacher_id || slot.teacher_id);
        }
      }
    }

    return allTeachers.filter(t => !busyTeacherIds.has(t.id));
  }

  // --- Phase 3: Student Attendance & Leaves ---
  async getStudentAttendance(tenantId: string, batchId: string, date: string): Promise<StudentAttendanceRecord[]> {
    return this.studentAttendance.filter(a => 
      a.tenant_id === tenantId && a.batch_id === batchId && a.date === date
    );
  }

  async recordBatchAttendance(
    tenantId: string,
    batchId: string,
    date: string,
    records: Array<{ student_id: string; status: AttendanceStatus; remarks?: string }>,
    markedBy?: string
  ): Promise<StudentAttendanceRecord[]> {
    const results: StudentAttendanceRecord[] = [];

    // Find active leaves covering this date
    const leaves = this.leaveApplications.filter(l => 
      l.tenant_id === tenantId &&
      l.status === 'approved' &&
      l.start_date <= date &&
      l.end_date >= date
    );
    const excusedStudentIds = new Set(leaves.map(l => l.student_id));

    for (const item of records) {
      const student = this.students.find(s => s.id === item.student_id && s.tenant_id === tenantId);
      const effectiveStatus: AttendanceStatus = excusedStudentIds.has(item.student_id) ? 'excused' : item.status;

      // Upsert record
      const existingIdx = this.studentAttendance.findIndex(a => 
        a.tenant_id === tenantId && a.student_id === item.student_id && a.date === date
      );

      const record: StudentAttendanceRecord = {
        id: existingIdx >= 0 ? this.studentAttendance[existingIdx].id : crypto.randomUUID(),
        tenant_id: tenantId,
        student_id: item.student_id,
        student_name: student?.full_name,
        roll_number: student?.roll_number,
        batch_id: batchId,
        date,
        status: effectiveStatus,
        remarks: excusedStudentIds.has(item.student_id) ? 'Auto-Excused: Approved Leave' : item.remarks,
        marked_by: markedBy,
        check_in_time: effectiveStatus === 'present' ? new Date().toISOString() : undefined,
        created_at: existingIdx >= 0 ? this.studentAttendance[existingIdx].created_at : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (existingIdx >= 0) {
        this.studentAttendance[existingIdx] = record;
      } else {
        this.studentAttendance.push(record);
      }
      results.push(record);
    }

    return results;
  }

  async getLeaveApplications(tenantId: string, studentId?: string): Promise<LeaveApplication[]> {
    return this.leaveApplications.filter(l => 
      l.tenant_id === tenantId && (!studentId || l.student_id === studentId)
    );
  }

  async submitLeaveApplication(data: Omit<LeaveApplication, 'id' | 'status' | 'created_at' | 'updated_at'>): Promise<LeaveApplication> {
    const student = this.students.find(s => s.id === data.student_id && s.tenant_id === data.tenant_id);
    const batch = student?.batch_id ? this.batches.find(b => b.id === student.batch_id) : undefined;

    const leave: LeaveApplication = {
      ...data,
      id: crypto.randomUUID(),
      student_name: student?.full_name || data.student_name,
      batch_name: batch?.name || data.batch_name,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.leaveApplications.push(leave);
    return leave;
  }

  async reviewLeaveApplication(tenantId: string, leaveId: string, status: LeaveStatus, reviewNotes?: string, reviewerId?: string): Promise<LeaveApplication> {
    const leave = this.leaveApplications.find(l => l.id === leaveId && l.tenant_id === tenantId);
    if (!leave) throw new Error('Leave application not found');

    leave.status = status;
    leave.review_notes = reviewNotes;
    leave.reviewed_by = reviewerId;
    leave.updated_at = new Date().toISOString();

    // If approved, update existing attendance records within the period to 'excused'
    if (status === 'approved') {
      this.studentAttendance.forEach(att => {
        if (att.tenant_id === tenantId && att.student_id === leave.student_id && att.date >= leave.start_date && att.date <= leave.end_date) {
          att.status = 'excused';
          att.remarks = 'Auto-Excused: Approved Leave';
          att.updated_at = new Date().toISOString();
        }
      });
    }

    return leave;
  }

  // --- Phase 3: Campus Geofence & Staff Attendance ---
  async getGeofenceConfig(tenantId: string): Promise<CampusGeofenceConfig> {
    const config = this.geofenceConfigs.get(tenantId);
    if (config) return config;

    // Default configuration for tenant
    const defaultConfig: CampusGeofenceConfig = {
      tenant_id: tenantId,
      campus_name: 'Main Campus',
      latitude: 31.5204,
      longitude: 74.3587,
      radius_meters: 150,
      shift_start_time: '08:00:00',
      grace_period_minutes: 15,
      multi_room_enabled: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.geofenceConfigs.set(tenantId, defaultConfig);
    return defaultConfig;
  }

  async updateGeofenceConfig(tenantId: string, updates: Partial<CampusGeofenceConfig>): Promise<CampusGeofenceConfig> {
    const current = await this.getGeofenceConfig(tenantId);
    const updated: CampusGeofenceConfig = {
      ...current,
      ...updates,
      tenant_id: tenantId,
      updated_at: new Date().toISOString(),
    };
    this.geofenceConfigs.set(tenantId, updated);
    return updated;
  }

  async staffClockIn(tenantId: string, staffId: string, staffName: string, lat: number, lng: number): Promise<StaffAttendanceRecord> {
    const config = await this.getGeofenceConfig(tenantId);

    // Calculate distance using Haversine formula
    const R = 6371000; // Earth radius in meters
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat - config.latitude);
    const dLon = toRad(lng - config.longitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(config.latitude)) * Math.cos(toRad(lat)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceMeters = Math.round(R * c);

    if (distanceMeters > config.radius_meters) {
      throw new Error(`Clock-in rejected: Outside campus boundary (${distanceMeters}m away, maximum allowed radius is ${config.radius_meters}m)`);
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const dateStr = nowIso.split('T')[0];

    // Calculate on_time vs late
    const [startH, startM] = config.shift_start_time.split(':').map(Number);
    const cutoffMinutes = (startH || 8) * 60 + (startM || 0) + config.grace_period_minutes;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const status: StaffAttendanceStatus = currentMinutes > cutoffMinutes ? 'late' : 'on_time';

    const record: StaffAttendanceRecord = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      staff_id: staffId,
      staff_name: staffName,
      date: dateStr,
      clock_in_time: nowIso,
      clock_in_lat: lat,
      clock_in_lng: lng,
      distance_meters: distanceMeters,
      status,
      is_geofence_verified: true,
      created_at: nowIso,
      updated_at: nowIso,
    };

    this.staffAttendance.push(record);
    return record;
  }

  async getStaffAttendance(tenantId: string, date?: string): Promise<StaffAttendanceRecord[]> {
    return this.staffAttendance.filter(s => 
      s.tenant_id === tenantId && (!date || s.date === date)
    );
  }

  async adjustStaffAttendance(tenantId: string, id: string, status: StaffAttendanceStatus, notes: string): Promise<StaffAttendanceRecord> {
    const record = this.staffAttendance.find(s => s.id === id && s.tenant_id === tenantId);
    if (!record) throw new Error('Staff attendance record not found');

    record.status = status;
    record.admin_adjusted = true;
    record.admin_adjustment_notes = notes;
    record.updated_at = new Date().toISOString();
    return record;
  }

  // --- Phase 3: Homework Diary & Physical Notebook Checking ---
  async getHomework(tenantId: string, batchId?: string): Promise<HomeworkAssignment[]> {
    return this.homeworkAssignments.filter(h => 
      h.tenant_id === tenantId && (!batchId || h.batch_id === batchId)
    );
  }

  async createHomework(data: Omit<HomeworkAssignment, 'id' | 'created_at'>): Promise<HomeworkAssignment> {
    const batch = this.batches.find(b => b.id === data.batch_id);
    const subject = this.subjects.find(s => s.id === data.subject_id);

    const hw: HomeworkAssignment = {
      ...data,
      id: crypto.randomUUID(),
      batch_name: batch?.name || data.batch_name,
      subject_name: subject?.name || data.subject_name,
      created_at: new Date().toISOString(),
    };

    this.homeworkAssignments.push(hw);
    return hw;
  }

  async recordNotebookChecks(
    tenantId: string,
    assignmentId: string,
    checks: Array<{ student_id: string; status: NotebookStatus; remarks?: string }>,
    checkedBy: string
  ): Promise<NotebookCheckRecord[]> {
    const results: NotebookCheckRecord[] = [];
    const nowIso = new Date().toISOString();

    for (const item of checks) {
      const student = this.students.find(s => s.id === item.student_id && s.tenant_id === tenantId);
      const existingIdx = this.notebookChecks.findIndex(c => 
        c.tenant_id === tenantId && c.assignment_id === assignmentId && c.student_id === item.student_id
      );

      const checkRecord: NotebookCheckRecord = {
        id: existingIdx >= 0 ? this.notebookChecks[existingIdx].id : crypto.randomUUID(),
        tenant_id: tenantId,
        assignment_id: assignmentId,
        student_id: item.student_id,
        student_name: student?.full_name,
        roll_number: student?.roll_number,
        status: item.status,
        remarks: item.remarks,
        checked_by: checkedBy,
        checked_at: nowIso,
      };

      if (existingIdx >= 0) {
        this.notebookChecks[existingIdx] = checkRecord;
      } else {
        this.notebookChecks.push(checkRecord);
      }
      results.push(checkRecord);
    }

    return results;
  }

  async getNotebookChecks(tenantId: string, assignmentId: string): Promise<NotebookCheckRecord[]> {
    return this.notebookChecks.filter(c => 
      c.tenant_id === tenantId && c.assignment_id === assignmentId
    );
  }

  // --- Phase 3: Complaints & Feedback ---
  async getComplaints(tenantId: string): Promise<ComplaintTicket[]> {
    return this.complaints.filter(c => c.tenant_id === tenantId);
  }

  async createComplaint(data: Omit<ComplaintTicket, 'id' | 'status' | 'created_at' | 'updated_at'>): Promise<ComplaintTicket> {
    const count = this.complaints.filter(c => c.tenant_id === data.tenant_id).length + 1;
    const ticket: ComplaintTicket = {
      ...data,
      id: crypto.randomUUID(),
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.complaints.push(ticket);
    return ticket;
  }

  async updateComplaintStatus(
    tenantId: string,
    id: string,
    status: ComplaintStatus,
    resolutionReply?: string,
    internalNotes?: string,
    resolvedBy?: string
  ): Promise<ComplaintTicket> {
    const ticket = this.complaints.find(c => c.id === id && c.tenant_id === tenantId);
    if (!ticket) throw new Error('Complaint ticket not found');

    ticket.status = status;
    if (resolutionReply !== undefined) ticket.resolution_reply = resolutionReply;
    if (internalNotes !== undefined) ticket.internal_notes = internalNotes;
    if (resolvedBy !== undefined) ticket.resolved_by = resolvedBy;
    if (status === 'resolved') ticket.resolved_at = new Date().toISOString();
    ticket.updated_at = new Date().toISOString();

    return ticket;
  }
}
