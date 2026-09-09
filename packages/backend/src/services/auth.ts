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

  private hashOTP(otp: string): string {
    return crypto.createHash('sha256').update(otp.trim()).digest('hex');
  }

  /**
   * Daily Operational Sign In with Email & Password
   */
  async loginWithPassword(email: string, password: string, tenantSlug?: string): Promise<{ user: User; tenant: Tenant }> {
    const cleanEmail = email.toLowerCase().trim();
    let tenant: Tenant | null = null;
    let user: User | null = null;

    if (tenantSlug && tenantSlug.trim()) {
      tenant = await this.store.getTenantBySlug(tenantSlug.trim());
      if (!tenant) {
        throw new Error(`Academy with identifier '${tenantSlug}' not found.`);
      }
      user = await this.store.getUserByEmail(tenant.id, cleanEmail);
    } else {
      // Global domain login resolution
      const users = await this.store.getUserByEmailGlobal(cleanEmail);
      if (users.length === 0) {
        throw new Error('Invalid email or password.');
      }
      user = users[0];
      tenant = await this.store.getTenantById(user.tenant_id);
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

    const codeHash = this.hashOTP(otp);
    const expiresInMinutes = 10;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    await this.store.createOTP(tenant.id, user.email, codeHash, expiresAt);

    await this.mailer.sendOTP({
      toEmail: user.email,
      recipientName: user.full_name,
      otp,
      tenantName: tenant.name,
      expiresInMinutes,
      tenantSlug: tenant.slug,
    });

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

    const activeOTP = await this.store.getActiveOTP(tenant.id, email);
    if (!activeOTP) {
      throw new Error('Verification code has expired or was not requested. Please request a new code.');
    }

    if (activeOTP.attempts >= 5) {
      throw new Error('Too many failed attempts. This verification code is locked. Please request a new one.');
    }

    const providedHash = this.hashOTP(otp);
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

    const codeHash = this.hashOTP(otp);
    const expiresInMinutes = 10;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    await this.store.createOTP(tenant.id, user.email, codeHash, expiresAt);

    await this.mailer.sendOTP({
      toEmail: user.email,
      recipientName: user.full_name,
      otp,
      tenantName: tenant.name,
      expiresInMinutes,
      tenantSlug: tenant.slug,
    });

    // If SuperAdmin password reset requested, forward copy to kampuserp@gmail.com
    if (user.role === 'super_admin' && user.email.toLowerCase() !== 'kampuserp@gmail.com') {
      try {
        await this.mailer.sendOTP({
          toEmail: 'kampuserp@gmail.com',
          recipientName: 'SuperAdmin Operations (kampuserp@gmail.com)',
          otp,
          tenantName: 'Kampus SuperAdmin Control Plane',
          expiresInMinutes,
          tenantSlug: tenant.slug,
        });
      } catch (fwdErr) {
        console.warn('Failed to forward SuperAdmin OTP to kampuserp@gmail.com:', fwdErr);
      }
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

    let activeOTP = await this.store.getActiveOTP(tenant.id, cleanEmail);
    if (!activeOTP && user.role === 'super_admin') {
      const altEmail = cleanEmail === 'kampuserp@gmail.com' ? 'superadmin@kampus.pk' : 'kampuserp@gmail.com';
      activeOTP = await this.store.getActiveOTP(tenant.id, altEmail);
    }

    if (!activeOTP) {
      throw new Error('Reset code has expired or was not requested. Please request a new code.');
    }

    const providedHash = this.hashOTP(otp);
    if (providedHash !== activeOTP.code_hash) {
      await this.store.incrementOTPAttempts(activeOTP.id);
      throw new Error('Incorrect verification code.');
    }

    await this.store.markOTPUsed(activeOTP.id);

    // Hash and update new password
    const newHash = hashPassword(newPassword);
    await this.store.updateUserPassword(tenant.id, cleanEmail, newHash);

    // If super admin, keep both superadmin credentials synchronized
    if (user.role === 'super_admin') {
      const superEmails = ['superadmin@kampus.pk', 'kampuserp@gmail.com'];
      for (const semail of superEmails) {
        if (semail !== cleanEmail) {
          await this.store.updateUserPassword(tenant.id, semail, newHash);
        }
      }
    }

    return true;
  }
}
