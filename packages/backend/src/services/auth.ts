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

  /**
   * Daily Operational Sign In with Email & Password
   */
  async loginWithPassword(email: string, password: string, tenantSlug?: string, tenantId?: string): Promise<{ user: User; tenant: Tenant }> {
    const cleanEmail = email.toLowerCase().trim();
    let tenant: Tenant | null = null;
    let user: User | null = null;

    if (tenantId && tenantId.trim()) {
      tenant = await this.store.getTenantById(tenantId.trim());
      if (!tenant) {
        throw new Error('Academy not found.');
      }
      user = await this.store.getUserByEmail(tenant.id, cleanEmail);
    } else if (tenantSlug && tenantSlug.trim()) {
      tenant = await this.store.getTenantBySlug(tenantSlug.trim());
      if (!tenant) {
        throw new Error(`Academy with identifier '${tenantSlug}' not found.`);
      }
      user = await this.store.getUserByEmail(tenant.id, cleanEmail);
    } else {
      // Global domain login resolution across multiple academies
      const users = await this.store.getUserByEmailGlobal(cleanEmail);
      if (users.length === 0) {
        throw new Error('Invalid email or password.');
      }

      // Check credentials across matching accounts to find valid match
      const matchingAccounts: { user: User; tenant: Tenant }[] = [];
      for (const u of users) {
        if (verifyPassword(password, u.password_hash)) {
          const t = await this.store.getTenantById(u.tenant_id);
          if (t) matchingAccounts.push({ user: u, tenant: t });
        }
      }

      if (matchingAccounts.length === 0) {
        throw new Error('Invalid email or password.');
      }

      // Select active, non-suspended account first if available
      const activeMatch = matchingAccounts.find(m => m.tenant.status !== 'suspended' && m.user.status === 'active') || matchingAccounts[0];
      user = activeMatch.user;
      tenant = activeMatch.tenant;
    }

    if (!user || !tenant) {
      throw new Error('Invalid email or password.');
    }

    if (tenant.status === 'suspended') {
      throw new Error('This academy account is currently suspended. Please contact platform support.');
    }

    if (user.status !== 'active') {
      throw new Error(`Your account status is '${user.status}'. Please contact academy administration.`);
    }

    const isValid = verifyPassword(password, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid email or password.');
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
    otp: string;
  }): Promise<{ user: User; tenant: Tenant }> {
    const { tenantId, email, currentPassword, newPassword, otp } = params;
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
    // If invalid, throw immediately WITHOUT touching OTP attempts!
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

    // 3. Check getActiveOTP
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

    // 6. Hash new password with scrypt and update in store
    const newHash = hashPassword(newPassword);
    const updated = await this.store.updateUserPassword(tenantId, cleanEmail, newHash);
    if (!updated) {
      throw new Error('Failed to update password.');
    }

    return { user, tenant };
  }
}
