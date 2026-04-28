type VerifyEmailInput = {
  name: string | null;
  verifyLink: string;
  expiresInMinutes: number;
  shopName: string;
};

export function buildVerifyEmailTemplate(input: VerifyEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const safeName = input.name?.trim() || 'there';
  const safeShop = input.shopName.trim() || 'Shop';
  const subject = `Verify your email - ${safeShop}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      <div style="background-color: #111827; padding: 32px 24px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">
          Welcome to ${safeShop}!
        </h1>
      </div>

      <div style="padding: 32px 24px; color: #374151; font-size: 16px; line-height: 1.6;">
        <p style="margin: 0 0 16px;">Hi <strong>${safeName}</strong>,</p>
        <p style="margin: 0 0 24px;">Thanks for signing up! To get started, please verify your email address by clicking the button below.</p>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${input.verifyLink}" 
             style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 14px 32px; font-weight: 700; text-decoration: none; border-radius: 8px; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">
            Verify Email Address
          </a>
        </div>

        <p style="margin: 0 0 12px; font-size: 14px; color: #6b7280; text-align: center;">
          This link will expire in <strong>${input.expiresInMinutes} minutes</strong>.
        </p>

        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 32px 0;" />

        <p style="margin: 0; font-size: 14px; color: #9ca3af;">
          If you did not create an account, you can safely ignore this email.
        </p>
      </div>

      <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0; font-size: 13px; color: #6b7280;">
          &copy; ${new Date().getFullYear()} ${safeShop}. All rights reserved.
        </p>
      </div>
    </div>
  `;

  const text =
    `Hi ${safeName},\n\n` +
    `Thanks for registering. Please verify your email by clicking the link below (expires in ${input.expiresInMinutes} minutes):\n` +
    `${input.verifyLink}\n\n` +
    `Thank you!`;

  return { subject, html, text };
}

export function buildExistingAccountAlertTemplate(params: {
  name: string | null;
  shopName: string;
}): { subject: string; text: string; html: string } {
  const customerName = params.name?.trim() || 'bạn';
  const safeShopName = params.shopName?.trim() || 'Shop';

  const subject = `[${safeShopName}] Alert: Your email has been used to register an account`;

  const text = `Hello ${customerName}, someone just tried to register a new account at ${safeShopName} using this email. Since you already have an account, this request has been rejected to protect your information.`;

  const html = `
    <div style="font-family: sans-serif; color: #333;">
      <h2>Account Registration Alert</h2>
      <p>Hello <b>${customerName}</b>,</p>
      <p>We have received a request to register a new account at <b>${safeShopName}</b> using this email address.</p>
      <p>Since your email already exists in our system, this new registration request has been <b>rejected</b> to protect your information.</p>
      <p>If this was you, please return to the login page. If it wasn’t you, rest assured that your account is still secure.</p>
      <hr />
      <p>Best regards,<br/>The ${safeShopName} Team</p>
    </div>
  `;

  return { subject, text, html };
}

