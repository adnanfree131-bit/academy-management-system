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
    tenantSlug?: string;
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
    tenantSlug?: string;
  }): Promise<boolean> {
    const digits = (params.otp || '').trim().split('');
    const digitCellsHtml = digits
      .map(
        (d) =>
          `<td style="width: 44px; height: 52px; background-color: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 28px; font-weight: 700; color: #1e1b4b; text-align: center; vertical-align: middle; font-family: -apple-system, BlinkMacSystemFont, 'SF Mono', Consolas, monospace; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">${d}</td>`
      )
      .join('<td style="width: 8px;"></td>');

    const portalUrl = params.tenantSlug
      ? `https://${params.tenantSlug}.kampus.pk`
      : 'https://edu.kampus.pk';
    const portalDisplay = params.tenantSlug
      ? `${params.tenantSlug}.kampus.pk`
      : 'edu.kampus.pk';
    const year = new Date().getFullYear();

    const subject = `[${params.otp}] Verification Code for ${params.tenantName}`;

    const textContent = `
${params.tenantName} — Single-Use Verification Code
==================================================

Dear ${params.recipientName},

We received a request to verify your administrator access for ${params.tenantName}.

VERIFICATION PASSCODE: ${params.otp}

⏱ This verification code is valid for ${params.expiresInMinutes} minutes and can only be used once.

SECURITY NOTICE:
Never share this verification code with anyone. Kampus administrators or support staff will never ask for your code. If you did not initiate this request, you can safely ignore this email.

--------------------------------------------------
Institutional Portal: ${portalUrl}
Kampus Academy Management System • Academic Administration Platform
Support: info@kampus.pk
© ${year} Kampus Technologies. All rights reserved.
    `.trim();

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${params.otp} is your verification code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 36px 16px;">
    <tr>
      <td align="center">
        <!-- Main Container Card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 540px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.05), 0 2px 4px -2px rgba(15, 23, 42, 0.05);">
          
          <!-- Top Accent Bar -->
          <tr>
            <td style="background-color: #4338ca; height: 4px; line-height: 4px; font-size: 4px;">&nbsp;</td>
          </tr>

          <!-- Header Section -->
          <tr>
            <td style="padding: 26px 32px 20px 32px; border-bottom: 1px solid #f1f5f9;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left" style="vertical-align: middle;">
                    <a href="https://edu.kampus.pk" target="_blank" style="text-decoration: none; display: inline-block;">
                      <img 
                        src="https://kampus-academy.pages.dev/kampus-logo-email.png" 
                        alt="KAMPUS" 
                        width="150" 
                        style="display: block; width: 150px; height: auto; max-height: 24px; border: 0; outline: none; text-decoration: none;" 
                      />
                    </a>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="display: inline-block; background-color: #eef2ff; border: 1px solid #c7d2fe; color: #4338ca; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; padding: 4px 10px; border-radius: 20px; text-transform: uppercase;">
                      Single-Use Passcode
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Academy Context Banner -->
          <tr>
            <td style="padding: 22px 32px 18px 32px; background-color: #fafafa; border-bottom: 1px solid #f1f5f9;">
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 4px;">Institution Access</div>
              <div style="font-size: 22px; font-weight: 700; color: #0f172a; line-height: 1.2;">${params.tenantName}</div>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 24px 32px 28px 32px;">
              <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #334155;">
                Dear ${params.recipientName},
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                We received a request to verify your administrator account for <strong>${params.tenantName}</strong>. Please enter the single-use 6-digit passcode below to authenticate and proceed:
              </p>

              <!-- Passcode Display -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 24px 16px; margin: 0 0 24px 0;">
                <tr>
                  <td align="center">
                    <div style="font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: #64748b; text-transform: uppercase; margin-bottom: 14px;">
                      Verification Passcode
                    </div>
                    
                    <!-- 6 Digit Segmented Grid -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                      <tr>
                        ${digitCellsHtml}
                      </tr>
                    </table>

                    <div style="margin-top: 14px; font-size: 12px; color: #64748b; font-weight: 500;">
                      ⏱ Expires in <strong>${params.expiresInMinutes} minutes</strong> • Single use only
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Security Notice Callout -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 0 6px 6px 0; padding: 12px 14px; margin: 0 0 20px 0;">
                <tr>
                  <td>
                    <div style="font-size: 12px; line-height: 1.5; color: #92400e;">
                      <strong>Security Tip:</strong> Never share this verification code with anyone. Kampus staff will never ask for your code. If you did not initiate this request, you can safely disregard this email.
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #64748b;">
                Need assistance? Visit the portal at <a href="${portalUrl}" style="color: #4338ca; text-decoration: none; font-weight: 600;">${portalDisplay}</a> or contact institutional support.
              </p>
            </td>
          </tr>

          <!-- Footer Section -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 11px; font-weight: 600; color: #475569;">
                Kampus Academy Management System
              </p>
              <p style="margin: 0 0 6px 0; font-size: 11px; color: #94a3b8; line-height: 1.4;">
                This administrative notification was sent from the Kampus Academic Cloud for ${params.tenantName}.
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                Support: <a href="mailto:info@kampus.pk" style="color: #64748b; text-decoration: underline;">info@kampus.pk</a> &nbsp;•&nbsp; © ${year} Kampus Technologies. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    const payload = {
      sender: {
        name: this.senderName || params.tenantName,
        email: this.senderEmail,
      },
      to: [{ email: params.toEmail, name: params.recipientName }],
      subject,
      htmlContent,
      textContent,
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
        signal: AbortSignal.timeout(8000),
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
