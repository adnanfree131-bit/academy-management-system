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

  private async findUsersByIdentifierInTenant(tenantId: string, cleanEmail: string): Promise<User[]> {
    const results: User[] = [];
    const directUser = await this.store.getUserByEmail(tenantId, cleanEmail);
    if (directUser) results.push(directUser);

    const cleanInputCnic = cleanEmail.replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
    const students = await this.store.getStudents(tenantId);
    const tenantUsers = await this.store.getTenantUsers(tenantId);

    // 1. Check students with matching guardian_id_card, roll_number, admission_number, or student email
    const matchingStudents = students.filter(s => {
      if (cleanInputCnic.length >= 5 && s.guardian_id_card) {
        const stdCnic = s.guardian_id_card.replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
        if (stdCnic === cleanInputCnic) return true;
      }
      if (s.roll_number && s.roll_number.toLowerCase() === cleanEmail) return true;
      if (s.admission_number && s.admission_number.toLowerCase().replace(/[^0-9a-zA-Z]/g, '') === cleanInputCnic) return true;
      if (s.email && s.email.toLowerCase() === cleanEmail) return true;
      return false;
    });

    for (const s of matchingStudents) {
      let u: User | undefined;
      if (s.user_id) {
        u = tenantUsers.find(tu => tu.id === s.user_id);
      }
      if (!u) {
        // Provision student user on-the-fly and persist linkage to store
        const studentUserId = s.user_id || crypto.randomUUID();
        const userEmail = (s.email && s.email.trim()) ? s.email.toLowerCase() : `std.${s.roll_number.toLowerCase()}@kampus.pk`;
        const newStudentUser: User = {
          id: studentUserId,
          tenant_id: tenantId,
          email: userEmail,
          full_name: s.full_name,
          role: 'student',
          status: 'active',
          password_hash: hashPassword('Student@123'),
          phone: s.phone || s.guardian_phone || undefined,
          metadata: {
            guardian_id_card: s.guardian_id_card,
            clean_guardian_id_card: s.guardian_id_card ? s.guardian_id_card.replace(/[^0-9a-zA-Z]/g, '').toLowerCase() : undefined,
            roll_number: s.roll_number,
            admission_number: s.admission_number,
            default_password: 'Student@123',
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        (this.store as any).users.set(studentUserId, newStudentUser);
        (this.store as any).users.set(`${tenantId}:${userEmail.toLowerCase()}`, newStudentUser);
        await this.store.updateStudent(tenantId, s.id, { user_id: studentUserId });
        s.user_id = studentUserId;
        (this.store as any).schedulePersist();
        u = newStudentUser;
      }
      if (u && !results.some(r => r.id === u!.id)) {
        results.push(u);
      }
    }

    if (cleanInputCnic.length >= 5) {
      // 2. Check parent users
      const parentUsers = tenantUsers.filter(u => 
        u.role === 'parent' && (
          (u.metadata as any)?.clean_guardian_id_card === cleanInputCnic ||
          u.email.toLowerCase() === `guardian.${cleanInputCnic}@kampus.pk`
        )
      );
      for (const pu of parentUsers) {
        if (!results.some(r => r.id === pu.id)) results.push(pu);
      }

      // 3. Check direct match in tenantUsers
      const directUsers = tenantUsers.filter(u => 
        (u.metadata as any)?.clean_guardian_id_card === cleanInputCnic ||
        u.email.toLowerCase() === `guardian.${cleanInputCnic}@kampus.pk` ||
        u.email.toLowerCase() === `cnic.${cleanInputCnic}@kampus.pk`
      );
      for (const du of directUsers) {
        if (!results.some(r => r.id === du.id)) results.push(du);
      }
    }

    return results;
  }

  /**
   * Daily Operational Sign In with Email & Password
   */
  async loginWithPassword(email: string, password: string, tenantSlug?: string, tenantId?: string): Promise<{ user: User; tenant: Tenant }> {
    const cleanEmail = email.toLowerCase().trim();
    let candidateTenants: Tenant[] = [];

    if (tenantId && tenantId.trim()) {
      const t = await this.store.getTenantById(tenantId.trim());
      if (!t) throw new Error('Academy not found.');
      candidateTenants = [t];
    } else if (tenantSlug && tenantSlug.trim()) {
      const t = await this.store.getTenantBySlug(tenantSlug.trim());
      if (!t) throw new Error(`Academy with identifier '${tenantSlug}' not found.`);
      candidateTenants = [t];
    } else {
      candidateTenants = await this.store.listTenants();
    }

    // Collect candidate accounts across matching tenant scopes
    const candidateAccounts: { user: User; tenant: Tenant }[] = [];

    // Direct email global lookup
    const directUsers = await this.store.getUserByEmailGlobal(cleanEmail);
    for (const u of directUsers) {
      const t = candidateTenants.find(ct => ct.id === u.tenant_id);
      if (t && !candidateAccounts.some(ca => ca.user.id === u.id)) {
        candidateAccounts.push({ user: u, tenant: t });
      }
    }

    // CNIC and tenant-specific lookup
    for (const t of candidateTenants) {
      const usersInTenant = await this.findUsersByIdentifierInTenant(t.id, cleanEmail);
      for (const u of usersInTenant) {
        if (!candidateAccounts.some(ca => ca.user.id === u.id)) {
          candidateAccounts.push({ user: u, tenant: t });
        }
      }
    }

    if (candidateAccounts.length === 0) {
      throw new Error('Invalid email or password.');
    }

    // Verify password against candidate accounts
    const matchingAccounts: { user: User; tenant: Tenant }[] = [];
    for (const { user: u, tenant: t } of candidateAccounts) {
      let isValid = verifyPassword(password, u.password_hash);
      if (!isValid && (u.role === 'student' || u.role === 'parent') && !(u.metadata as any)?.password_last_reset_at) {
        if ((u.role === 'student' && password === 'Student@123') || (u.role === 'parent' && password === 'Parent@123')) {
          isValid = true;
        }
      }
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
    const tenant = activeMatch.tenant;

    if (tenant.status === 'suspended') {
      throw new Error('This academy account is currently suspended. Please contact platform support.');
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
  async requestPasswordReset(email: string, tenantSlug?: string): Promise<RequestOTPResponse> {
    const cleanEmail = email.toLowerCase().trim();
    let tenant: Tenant | null = null;
    let user: User | null = null;

    if (tenantSlug && tenantSlug.trim()) {
      tenant = await this.store.getTenantBySlug(tenantSlug.trim());
      if (tenant) {
        user = await this.store.getUserByEmail(tenant.id, cleanEmail);
      }
    } else {
      const users = await this.store.getUserByEmailGlobal(cleanEmail);
      if (users.length > 0) {
        user = users[0];
        tenant = await this.store.getTenantById(user.tenant_id);
      }
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
  async resetPassword(email: string, otp: string, newPassword: string, tenantSlug?: string): Promise<boolean> {
    const cleanEmail = email.toLowerCase().trim();
    let tenant: Tenant | null = null;
    let user: User | null = null;

    if (tenantSlug && tenantSlug.trim()) {
      tenant = await this.store.getTenantBySlug(tenantSlug.trim());
      if (tenant) {
        user = await this.store.getUserByEmail(tenant.id, cleanEmail);
      }
    } else {
      const users = await this.store.getUserByEmailGlobal(cleanEmail);
      if (users.length > 0) {
        user = users[0];
        tenant = await this.store.getTenantById(user.tenant_id);
      }
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
    let isCurrentValid = verifyPassword(currentPassword, user.password_hash);
    if (!isCurrentValid && (user.role === 'student' || user.role === 'parent') && !(user.metadata as any)?.password_last_reset_at) {
      if (currentPassword === 'Student@123' || currentPassword === 'Parent@123') {
        isCurrentValid = true;
      }
    }
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
    user.updated_at = new Date().toISOString();

    // Synchronize if guardian CNIC is linked
    const cleanCnic = (user.metadata as any)?.clean_guardian_id_card;
    if (cleanCnic) {
      const allUsers = await this.store.getTenantUsers(tenantId);
      for (const otherUser of allUsers) {
        if (otherUser.id !== user.id && (
          (otherUser.metadata as any)?.clean_guardian_id_card === cleanCnic ||
          otherUser.email.toLowerCase() === `cnic.${cleanCnic}@kampus.pk` ||
          otherUser.email.toLowerCase() === `guardian.${cleanCnic}@kampus.pk`
        )) {
          otherUser.password_hash = newHash;
          if (!otherUser.metadata) otherUser.metadata = {};
          (otherUser.metadata as any).password_last_reset_at = new Date().toISOString();
          otherUser.updated_at = new Date().toISOString();
        }
      }
    }

    (this.store as any).schedulePersist?.();
    return { user, tenant };
  }
}
