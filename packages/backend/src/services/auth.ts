import crypto from 'crypto';
import { IDataStore } from './store.js';
import { IMailerService } from './mailer.js';
import { RequestOTPResponse, User, Tenant } from '@apex/shared-types';

export class AuthService {
  constructor(
    private store: IDataStore,
    private mailer: IMailerService
  ) {}

  private hashOTP(otp: string): string {
    return crypto.createHash('sha256').update(otp.trim()).digest('hex');
  }

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
      // In production ERP, we don't disclose whether user exists for privacy, but return standard message
      return {
        success: true,
        message: `If an account with ${email} exists, a 6-digit verification code has been dispatched.`,
        cooldown_seconds: 60,
        expires_in_seconds: 600,
      };
    }

    if (user.status !== 'active') {
      throw new Error(`Your account status is '${user.status}'. Please contact academy administration.`);
    }

    // When Brevo or production is active, always generate a cryptographically secure 6-digit OTP
    const isDev = process.env.NODE_ENV !== 'production' && !process.env.BREVO_API_KEY;
    const staticOtp = isDev ? (process.env.STATIC_OTP || process.env.DEV_STATIC_OTP) : undefined;
    const otp = staticOtp || crypto.randomInt(100000, 1000000).toString();

    const codeHash = this.hashOTP(otp);
    const expiresInMinutes = 10;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    await this.store.createOTP(tenant.id, user.email, codeHash, expiresAt);

    // Send via mailer (Brevo in prod / Console in dev)
    await this.mailer.sendOTP({
      toEmail: user.email,
      recipientName: user.full_name,
      otp,
      tenantName: tenant.name,
      expiresInMinutes,
    });

    return {
      success: true,
      message: `A 6-digit verification code has been dispatched to ${email}`,
      cooldown_seconds: 60,
      expires_in_seconds: expiresInMinutes * 60,
      dev_otp_preview: isDev ? otp : undefined,
    };
  }

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

    // Mark as used
    await this.store.markOTPUsed(activeOTP.id);

    return { user, tenant };
  }
}
