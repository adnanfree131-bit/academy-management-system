import { Tenant, User } from '@apex/shared-types';

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
  getTenantBySlug(slug: string): Promise<Tenant | null>;
  getTenantById(id: string): Promise<Tenant | null>;
  getUserByEmail(tenantId: string, email: string): Promise<User | null>;
  createOTP(tenantId: string, email: string, codeHash: string, expiresAt: Date): Promise<StoredOTP>;
  getActiveOTP(tenantId: string, email: string): Promise<StoredOTP | null>;
  incrementOTPAttempts(id: string): Promise<void>;
  markOTPUsed(id: string): Promise<void>;
}

/**
 * In-Memory Store populated with Phase 1 dual-tenant fixtures
 * Used for instant dev & testing without external database dependencies
 */
export class InMemoryDataStore implements IDataStore {
  private tenants: Map<string, Tenant> = new Map();
  private users: Map<string, User> = new Map();
  private otps: StoredOTP[] = [];

  constructor() {
    // Seed Tenant A: Apex Academy
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

    // Seed Tenant B: Crescent College
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

    // Seed Users
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
        id: 'b1000000-0000-0000-0000-000000000001',
        tenant_id: tenantB.id,
        email: 'fatima@crescent.edu.pk',
        full_name: 'Principal Fatima',
        role: 'tenant_admin',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    users.forEach(u => this.users.set(`${u.tenant_id}:${u.email.toLowerCase()}`, u));
  }

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
    // Return newest unexpired, unused OTP
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
}
