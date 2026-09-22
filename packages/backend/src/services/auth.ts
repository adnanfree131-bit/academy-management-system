import crypto from 'crypto';
import { IDataStore } from './store.js';
import { IMailerService } from './mailer.js';
import { RequestOTPResponse, User, Tenant } from '@apex/shared-types';
import { hashPassword, verifyPassword } from './password.js';

export class AuthService {
  constructor(
    private store: IDataStore,
    private mailer: IMailerService
  ) {}

  private hashOTP(otp: string, purpose?: string): string {
    const data = purpose ? `${purpose}:${otp.trim()}` : otp.trim();
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private cnicKey(value: string | null | undefined): string {
    return String(value || '').replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
  }

  private isPortalRole(role: string | undefined): boolean {
    return role === 'student' || role === 'parent';
  }

  private async findUsersByIdentifierInTenant(tenantId: string, cleanEmail: string): Promise<User[]> {
    const results: User[] = [];

    // Staff sign in with email. Student and parent portal accounts do not.
    if (cleanEmail.includes('@')) {
      const directUser = await this.store.getUserByEmail(tenantId, cleanEmail);
      if (directUser && !this.isPortalRole(directUser.role)) {
        results.push(directUser);
      }
      return results;
    }

    // Portal sign-in is father CNIC or the registered guardian CNIC only.
    const cleanInputCnic = this.cnicKey(cleanEmail);
    if (cleanInputCnic.length < 5) return results;

    const students = await this.store.getStudents(tenantId);
    const tenantUsers = await this.store.getTenantUsers(tenantId);

    const matchingStudents = students.filter(s => {
      if (s.status !== 'active') return false;
      const keys = [s.guardian_id_card, s.father_cnic].map(v => this.cnicKey(v)).filter(v => v.length >= 5);
      return keys.includes(cleanInputCnic);
    });

    for (const s of matchingStudents) {
      const u = s.user_id
        ? tenantUsers.find(tu => tu.id === s.user_id && tu.role === 'student')
        : undefined;
      if (u && !results.some(r => r.id === u.id)) {
        results.push(u);
      }
    }

    const parentUsers = tenantUsers.filter(u => {
      if (u.role !== 'parent') return false;
      const meta = u.metadata as any;
      const keys = [meta?.clean_guardian_id_card, meta?.guardian_id_card].map((v: string) => this.cnicKey(v)).filter((v: string) => v.length >= 5);
      return keys.includes(cleanInputCnic);
    });
    for (const pu of parentUsers) {
      if (!results.some(r => r.id === pu.id)) results.push(pu);
    }

    return results;
  }

  /**
   * Daily Operational Sign In with Email & Password
   */
  async loginWithPassword(email: string, password: string, tenantSlug?: string, tenantId?: string): Promise<{ user: User; tenant: Tenant }> {
    const cleanEmail = email.toLowerCase().trim();
    if ((!tenantId || !tenantId.trim()) && (!tenantSlug || !tenantSlug.trim())) {
      if (cleanEmail === 'kampuserp@gmail.com') {
        tenantId = 'p0000000-0000-0000-0000-000000000001';
      } else {
        throw new Error('Academy identifier (tenant_slug or tenant_id) is required.');
      }
    }

    let tenant: Tenant | null = null;
    if (tenantId && tenantId.trim()) {
      tenant = await this.store.getTenantById(tenantId.trim());
    } else if (tenantSlug && tenantSlug.trim()) {
      tenant = await this.store.getTenantBySlug(tenantSlug.trim());
    }

    if (!tenant) {
      throw new Error('Academy not found.');
    }

    // Collect candidate accounts across matching tenant scope ONLY
    const candidateAccounts: { user: User; tenant: Tenant }[] = [];

    // Staff email only. Student and parent portal accounts are CNIC-only.
    if (cleanEmail.includes('@')) {
      const directUser = await this.store.getUserByEmail(tenant.id, cleanEmail);
      if (directUser && !this.isPortalRole(directUser.role)) {
        candidateAccounts.push({ user: directUser, tenant });
      }
    }

    // CNIC and tenant-specific lookup
    const usersInTenant = await this.findUsersByIdentifierInTenant(tenant.id, cleanEmail);
    for (const u of usersInTenant) {
      if (!candidateAccounts.some(ca => ca.user.id === u.id)) {
        candidateAccounts.push({ user: u, tenant });
      }
    }

    if (candidateAccounts.length === 0) {
      throw new Error('Invalid email or password.');
    }

    // Verify password against candidate accounts (NO plaintext backdoor bypass)
    const matchingAccounts: { user: User; tenant: Tenant }[] = [];
    for (const { user: u, tenant: t } of candidateAccounts) {
      const isValid = verifyPassword(password, u.password_hash);
      if (isValid) {
        matchingAccounts.push({ user: u, tenant: t });
      }
    }

    if (matchingAccounts.length === 0) {
      throw new Error('Invalid email or password.');
    }

    // Select active, non-suspended account first
    const activeMatch = matchingAccounts.find(m => m.tenant.status !== 'suspended' && m.user.status === 'active') || matchingAccounts[0];
    const user = activeMatch.user;
    tenant = activeMatch.tenant;

    if (tenant.status === 'suspended') {
      throw new Error('This academy account is currently suspended. Please contact platform support.');
    }

    if (user.status !== 'active' || (user.metadata as any)?.portal_blocked) {
      throw new Error(`Your account status is '${user.status}' or portal access has been restricted. Please contact academy administration.`);
    }

    if (user.role === 'student') {
      const allStudents = await this.store.getStudents(tenant.id);
      const std = allStudents.find(s => s.user_id === user.id || (s.email && s.email.toLowerCase() === user.email.toLowerCase()));
      if (std) {
        const enrollments = await this.store.getStudentEnrollments(tenant.id, std.id);
        const hasActiveEnrollment = enrollments.some(e => e.status === 'active' || e.status === 'on_leave');
        if (!hasActiveEnrollment && std.status !== 'active') {
          throw new Error(`Your student enrollment status is '${std.status}'. Portal access is only available to active students.`);
        }
      }
    }

    if (user.status !== 'active') {
      throw new Error(`Your account status is '${user.status}'. Please contact academy administration.`);
    }

    user.last_login_at = new Date().toISOString();
    return { user, tenant };
  }

  /**
   * Request OTP (for registration verification or fallback)
   */
  async requestOTP(email: string, tenantSlug: string): Promise<RequestOTPResponse> {
    const tenant = await this.store.getTenantBySlug(tenantSlug);
    if (!tenant) {
      throw new Error(`Tenant with identifier '${tenantSlug}' does not exist.`);
    }

    if (tenant.status === 'suspended') {
      throw new Error(`This academy account is currently suspended. Please contact platform support.`);
    }

    const user = await this.store.getUserByEmail(tenant.id, email);
    if (!user) {
      return {
        success: true,
        message: `If an account with ${email} exists, a 6-digit verification code has been dispatched.`,
        cooldown_seconds: 60,
        expires_in_seconds: 600,
      };
    }

    if (user.status !== 'active' && user.status !== 'pending_verification') {
      throw new Error(`Your account status is '${user.status}'. Please contact academy administration.`);
    }

    const isDev = process.env.NODE_ENV !== 'production' && !process.env.BREVO_API_KEY;
    const staticOtp = isDev ? (process.env.STATIC_OTP || process.env.DEV_STATIC_OTP) : undefined;
    const otp = staticOtp || crypto.randomInt(100000, 1000000).toString();

    const codeHash = this.hashOTP(otp, 'verification');
    const expiresInMinutes = 10;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    await this.store.createOTP(tenant.id, user.email, codeHash, expiresAt, 'verification');

    const sent = await this.mailer.sendOTP({
      toEmail: user.email,
      recipientName: user.full_name,
      otp,
      tenantName: tenant.name,
      expiresInMinutes,
      tenantSlug: tenant.slug,
    });

    if (!sent && !isDev) {
      throw new Error('Failed to dispatch verification email via Brevo. Please verify email address or retry.');
    }

    return {
      success: true,
      message: `A 6-digit verification code has been dispatched to ${email}`,
      cooldown_seconds: 60,
      expires_in_seconds: expiresInMinutes * 60,
      dev_otp_preview: isDev ? otp : undefined,
    };
  }

  /**
   * Verify OTP
   */
  async verifyOTP(email: string, otp: string, tenantSlug: string): Promise<{ user: User; tenant: Tenant }> {
    const tenant = await this.store.getTenantBySlug(tenantSlug);
    if (!tenant) {
      throw new Error(`Tenant '${tenantSlug}' not found.`);
    }

    const user = await this.store.getUserByEmail(tenant.id, email);
    if (!user) {
      throw new Error('Invalid authentication credentials.');
    }

    const activeOTP = await this.store.getActiveOTP(tenant.id, email, 'verification');
    if (!activeOTP) {
      throw new Error('Verification code has expired or was not requested. Please request a new code.');
    }

    if (activeOTP.attempts >= 5) {
      throw new Error('Too many failed attempts. This verification code is locked. Please request a new one.');
    }

    const providedHash = this.hashOTP(otp, 'verification');
    if (providedHash !== activeOTP.code_hash) {
      await this.store.incrementOTPAttempts(activeOTP.id);
      const remaining = 4 - activeOTP.attempts;
      throw new Error(`Incorrect verification code. ${remaining > 0 ? remaining : 0} attempts remaining.`);
    }

    await this.store.markOTPUsed(activeOTP.id);

    // If tenant or user was in pending_verification status, activate them!
    if (user.status === 'pending_verification') {
      user.status = 'active';
    }
    if (tenant.status === 'pending_verification') {
      tenant.status = 'active';
    }

    return { user, tenant };
  }

  /**
   * Request Password Reset OTP via Brevo
   */
  async requestPasswordReset(email: string, tenantSlug?: string, tenantId?: string): Promise<RequestOTPResponse> {
    const cleanEmail = email.toLowerCase().trim();
    if ((!tenantId || !tenantId.trim()) && (!tenantSlug || !tenantSlug.trim())) {
      if (cleanEmail === 'kampuserp@gmail.com') {
        tenantId = 'p0000000-0000-0000-0000-000000000001';
      } else {
        throw new Error('Academy identifier (tenant_slug or tenant_id) is required.');
      }
    }

    let tenant: Tenant | null = null;
    if (tenantId && tenantId.trim()) {
      tenant = await this.store.getTenantById(tenantId.trim());
    } else if (tenantSlug && tenantSlug.trim()) {
      tenant = await this.store.getTenantBySlug(tenantSlug.trim());
    }

    let user: User | null = null;
    if (tenant) {
      user = await this.store.getUserByEmail(tenant.id, cleanEmail);
    }

    if (!user || !tenant) {
      // Return safe message without leaking user existence
      return {
        success: true,
        message: `If an account with ${email} exists, a password reset code has been dispatched.`,
        cooldown_seconds: 60,
        expires_in_seconds: 600,
      };
    }

    const isDev = process.env.NODE_ENV !== 'production' && !process.env.BREVO_API_KEY;
    const staticOtp = isDev ? (process.env.STATIC_OTP || process.env.DEV_STATIC_OTP) : undefined;
    const otp = staticOtp || crypto.randomInt(100000, 1000000).toString();

    const codeHash = this.hashOTP(otp, 'password_reset');
    const expiresInMinutes = 10;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    await this.store.createOTP(tenant.id, user.email, codeHash, expiresAt, 'password_reset');

    const sent = await this.mailer.sendOTP({
      toEmail: user.email,
      recipientName: user.full_name,
      otp,
      tenantName: tenant.name,
      expiresInMinutes,
      tenantSlug: tenant.slug,
    });

    if (!sent && !isDev) {
      throw new Error('Failed to dispatch verification email via Brevo. Please verify email address or retry.');
    }

    return {
      success: true,
      message: `A 6-digit password reset code has been dispatched to ${email}`,
      cooldown_seconds: 60,
      expires_in_seconds: expiresInMinutes * 60,
      dev_otp_preview: isDev ? otp : undefined,
    };
  }

  /**
   * Reset Password with OTP Verification
   */
  async resetPassword(email: string, otp: string, newPassword: string, tenantSlug?: string, tenantId?: string): Promise<boolean> {
    const cleanEmail = email.toLowerCase().trim();
    if ((!tenantId || !tenantId.trim()) && (!tenantSlug || !tenantSlug.trim())) {
      if (cleanEmail === 'kampuserp@gmail.com') {
        tenantId = 'p0000000-0000-0000-0000-000000000001';
      } else {
        throw new Error('Academy identifier (tenant_slug or tenant_id) is required.');
      }
    }

    let tenant: Tenant | null = null;
    if (tenantId && tenantId.trim()) {
      tenant = await this.store.getTenantById(tenantId.trim());
    } else if (tenantSlug && tenantSlug.trim()) {
      tenant = await this.store.getTenantBySlug(tenantSlug.trim());
    }

    let user: User | null = null;
    if (tenant) {
      user = await this.store.getUserByEmail(tenant.id, cleanEmail);
    }

    if (!user || !tenant) {
      throw new Error('Account not found.');
    }

    const activeOTP = await this.store.getActiveOTP(tenant.id, cleanEmail, 'password_reset');
    if (!activeOTP) {
      const err: any = new Error('Reset code has expired or was not requested. Please request a new code.');
      err.code = 'INVALID_OR_EXPIRED_CODE';
      throw err;
    }

    if (activeOTP.attempts >= 5) {
      const err: any = new Error('Too many failed attempts. This verification code is locked. Please request a new one.');
      err.code = 'OTP_LOCKED';
      throw err;
    }

    const providedHash = this.hashOTP(otp, 'password_reset');
    if (providedHash !== activeOTP.code_hash) {
      await this.store.incrementOTPAttempts(activeOTP.id);
      const remaining = 5 - activeOTP.attempts;
      if (remaining <= 0) {
        const err: any = new Error('Too many failed attempts. This verification code is locked. Please request a new one.');
        err.code = 'OTP_LOCKED';
        throw err;
      }
      const err: any = new Error(`Invalid or expired verification code. ${remaining} attempts remaining.`);
      err.code = 'INVALID_OR_EXPIRED_CODE';
      throw err;
    }

    await this.store.markOTPUsed(activeOTP.id);

    // Hash and update new password
    const newHash = hashPassword(newPassword);
    await this.store.updateUserPassword(tenant.id, cleanEmail, newHash);

    return true;
  }

  /**
   * Request Director Change Password OTP via Brevo
   */
  async requestChangePasswordOTP(
    tenantId: string,
    email: string
  ): Promise<{ success: boolean; cooldown_seconds: number; dev_otp_preview?: string; message: string }> {
    const tenant = await this.store.getTenantById(tenantId);
    if (!tenant) {
      throw new Error(`Tenant '${tenantId}' does not exist.`);
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await this.store.getUserByEmail(tenantId, cleanEmail);
    if (!user) {
      throw new Error('User does not exist.');
    }

    // Check 60-second cooldown from last requested OTP
    const latestOTP = await this.store.getLatestOTP(tenantId, cleanEmail, 'password_change');
    if (latestOTP && latestOTP.created_at) {
      const elapsedSeconds = Math.floor((Date.now() - latestOTP.created_at.getTime()) / 1000);
      if (elapsedSeconds < 60) {
        const remainingSeconds = 60 - elapsedSeconds;
        throw new Error(`Please wait ${remainingSeconds} seconds before requesting a new verification code.`);
      }
    }

    const isDev = process.env.NODE_ENV !== 'production' && !process.env.BREVO_API_KEY;
    const staticOtp = isDev ? (process.env.STATIC_OTP || process.env.DEV_STATIC_OTP) : undefined;
    const otp = staticOtp || crypto.randomInt(100000, 1000000).toString();

    // Salt hash with password_change:${otp}
    const codeHash = this.hashOTP(otp, 'password_change');
    const expiresInMinutes = 10;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    await this.store.createOTP(tenantId, cleanEmail, codeHash, expiresAt, 'password_change');

    const sent = await this.mailer.sendOTP({
      toEmail: user.email,
      recipientName: user.full_name,
      otp,
      tenantName: tenant.name,
      expiresInMinutes,
      tenantSlug: tenant.slug,
    });

    if (!sent && !isDev) {
      throw new Error('Failed to dispatch verification email via Brevo. Please verify email address or retry.');
    }

    return {
      success: true,
      cooldown_seconds: 60,
      dev_otp_preview: isDev ? otp : undefined,
      message: `A 6-digit verification code has been dispatched to ${user.email}.`,
    };
  }

  /**
   * Change Password with Current Password & Purpose-Bound OTP Verification
   */
  async changePassword(params: {
    tenantId: string;
    email: string;
    currentPassword: string;
    newPassword: string;
    otp?: string;
    skipOTP?: boolean;
  }): Promise<{ user: User; tenant: Tenant }> {
    const { tenantId, email, currentPassword, newPassword, otp, skipOTP } = params;
    const cleanEmail = email.toLowerCase().trim();

    const tenant = await this.store.getTenantById(tenantId);
    if (!tenant) {
      throw new Error('Tenant not found.');
    }

    const user = await this.store.getUserByEmail(tenantId, cleanEmail);
    if (!user) {
      throw new Error('User not found.');
    }

    // 1. Verify currentPassword FIRST with verifyPassword(currentPassword, user.password_hash)
    const isCurrentValid = verifyPassword(currentPassword, user.password_hash);
    if (!isCurrentValid) {
      const err: any = new Error('Current password is incorrect.');
      err.code = 'INVALID_CURRENT_PASSWORD';
      throw err;
    }

    // 2. Validate new password
    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long.');
    }
    if (newPassword === currentPassword) {
      throw new Error('New password cannot be the same as your current password.');
    }

    // 3. Verify OTP if not skipped
    const shouldCheckOTP = !skipOTP && !(user.role === 'student' && !otp);
    if (shouldCheckOTP) {
      if (!otp) {
        throw new Error('Verification code is required.');
      }
      const activeOTP = await this.store.getActiveOTP(tenantId, cleanEmail, 'password_change');
      if (!activeOTP) {
        const err: any = new Error('Verification code has expired or was not requested. Please request a new code.');
        err.code = 'INVALID_OR_EXPIRED_CODE';
        throw err;
      }

      if (activeOTP.attempts >= 5) {
        const err: any = new Error('Too many failed attempts. This verification code is locked. Please request a new one.');
        err.code = 'OTP_LOCKED';
        throw err;
      }

      // 4. Verify hash with purpose salt: password_change:${otp}
      const expectedHash = this.hashOTP(otp, 'password_change');
      if (expectedHash !== activeOTP.code_hash) {
        await this.store.incrementOTPAttempts(activeOTP.id);
        const remaining = 5 - activeOTP.attempts;
        if (remaining <= 0) {
          const err: any = new Error('Too many failed attempts. This verification code is locked. Please request a new one.');
          err.code = 'OTP_LOCKED';
          throw err;
        }
        throw new Error(`Incorrect verification code. ${remaining} attempts remaining.`);
      }

      // 5. Mark OTP as used
      await this.store.markOTPUsed(activeOTP.id);
    }

    // 6. Hash new password with scrypt and update in store
    const newHash = hashPassword(newPassword);
    user.password_hash = newHash;
    if (!user.metadata) user.metadata = {};
    (user.metadata as any).password_last_reset_at = new Date().toISOString();
    (user.metadata as any).must_change_password = false;
    (user.metadata as any).requires_password_change = false;
    user.updated_at = new Date().toISOString();

    (this.store as any).schedulePersist?.();
    return { user, tenant };
  }
}
