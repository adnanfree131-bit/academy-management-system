/**
 * Brevo OTP Mailer Service & Local Development Adapter
 */

export interface IMailerService {
  sendOTP(params: {
    toEmail: string;
    recipientName: string;
    otp: string;
    tenantName: string;
    expiresInMinutes: number;
  }): Promise<boolean>;
}

export class BrevoMailerService implements IMailerService {
  private apiKey: string;
  private senderEmail: string;
  private senderName: string;

  constructor(apiKey: string, senderEmail: string, senderName: string) {
    this.apiKey = apiKey;
    this.senderEmail = senderEmail;
    this.senderName = senderName;
  }

  async sendOTP(params: {
    toEmail: string;
    recipientName: string;
    otp: string;
    tenantName: string;
    expiresInMinutes: number;
  }): Promise<boolean> {
    const payload = {
      sender: {
        name: this.senderName || params.tenantName,
        email: this.senderEmail,
      },
      to: [{ email: params.toEmail, name: params.recipientName }],
      subject: `${params.otp} is your ${params.tenantName} Verification Code`,
      htmlContent: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <h2 style="color: #0f172a; margin-top: 0;">${params.tenantName}</h2>
          <p style="color: #475569; font-size: 14px;">Hello ${params.recipientName},</p>
          <p style="color: #475569; font-size: 14px;">Use the verification code below to log in to your ${params.tenantName} portal:</p>
          
          <div style="text-align: center; margin: 28px 0;">
            <span style="display: inline-block; font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #4338ca; background: #e0e7ff; padding: 12px 24px; border-radius: 8px; border: 1px solid #c7d2fe;">
              ${params.otp}
            </span>
          </div>

          <p style="color: #64748b; font-size: 12px;">This code will expire in ${params.expiresInMinutes} minutes. If you did not request this login, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 11px; margin-bottom: 0;">Academy Management System • edu.kampus.pk</p>
        </div>
      `,
    };

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': this.apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[BrevoMailer] Failed to send email:', response.status, errorText);
        return false;
      }

      return true;
    } catch (err) {
      console.error('[BrevoMailer] Network error sending email:', err);
      return false;
    }
  }
}

export class DevConsoleMailerService implements IMailerService {
  async sendOTP(params: {
    toEmail: string;
    recipientName: string;
    otp: string;
    tenantName: string;
    expiresInMinutes: number;
  }): Promise<boolean> {
    console.log('\n' + '━'.repeat(64));
    console.log('🔐 [DEV AUTH] BREVO OTP DISPATCH INTERCEPTOR');
    console.log(`🏢 Tenant    : ${params.tenantName}`);
    console.log(`👤 Recipient : ${params.recipientName} <${params.toEmail}>`);
    console.log(`🔑 PASSCODE  : [ ${params.otp} ]`);
    console.log(`⏳ Valid For : ${params.expiresInMinutes} minutes`);
    console.log('━'.repeat(64) + '\n');
    return true;
  }
}

export function createMailerService(): IMailerService {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'info@kampus.pk';
  const senderName = process.env.BREVO_SENDER_NAME || 'Kampus';

  if (apiKey) {
    return new BrevoMailerService(apiKey, senderEmail, senderName);
  }

  // Fallback to dev console logger
  return new DevConsoleMailerService();
}
