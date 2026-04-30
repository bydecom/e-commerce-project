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

export function buildOtpLoginTemplate(params: {
  name: string | null;
  otp: string;
  expiresInMinutes: number;
  shopName: string;
}): { subject: string; html: string; text: string } {
  const safeName = params.name?.trim() || 'there';
  const safeShop = params.shopName.trim() || 'Shop';
  const subject = `Your login verification code - ${safeShop}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      <div style="background-color: #111827; padding: 32px 24px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">
          ${safeShop} — Login Verification
        </h1>
      </div>

      <div style="padding: 32px 24px; color: #374151; font-size: 16px; line-height: 1.6;">
        <p style="margin: 0 0 16px;">Hi <strong>${safeName}</strong>,</p>
        <p style="margin: 0 0 24px;">We detected multiple failed login attempts on your account. Use the code below to verify your identity and continue.</p>

        <div style="text-align: center; margin: 32px 0;">
          <div style="display: inline-block; background-color: #f3f4f6; border: 2px dashed #d1d5db; border-radius: 12px; padding: 20px 40px;">
            <span style="font-size: 36px; font-weight: 800; letter-spacing: 0.15em; color: #111827;">${params.otp}</span>
          </div>
        </div>

        <p style="margin: 0 0 12px; font-size: 14px; color: #6b7280; text-align: center;">
          This code expires in <strong>${params.expiresInMinutes} minutes</strong> and can only be used once.
        </p>

        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 32px 0;" />

        <p style="margin: 0; font-size: 14px; color: #9ca3af;">
          If you did not attempt to log in, someone may be trying to access your account. You can safely ignore this email — your account remains secure.
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
    `Your login verification code is: ${params.otp}\n\n` +
    `It expires in ${params.expiresInMinutes} minutes and can only be used once.\n\n` +
    `If you did not attempt to log in, you can safely ignore this email.`;

  return { subject, html, text };
}

export function buildExistingAccountAlertTemplate(params: {
  name: string | null;
  shopName: string;
}): { subject: string; text: string; html: string } {
  const safeName = params.name?.trim() || ‘there’;
  const safeShop = params.shopName?.trim() || ‘Shop’;

  const subject = `Security alert: registration attempt detected - ${safeShop}`;

  const text =
    `Hi ${safeName},\n\n` +
    `Someone just tried to register a new account at ${safeShop} using your email address.\n\n` +
    `Because an account already exists for this email, the registration was blocked and no changes were made to your account.\n\n` +
    `If this was you, simply log in to your existing account. If it wasn’t, no action is needed — your account is still secure.\n\n` +
    `The ${safeShop} Team`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, ‘Segoe UI’, Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      <div style="background-color: #111827; padding: 32px 24px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">
          ${safeShop} — Security Alert
        </h1>
      </div>

      <div style="padding: 32px 24px; color: #374151; font-size: 16px; line-height: 1.6;">
        <p style="margin: 0 0 16px;">Hi <strong>${safeName}</strong>,</p>
        <p style="margin: 0 0 24px;">Someone just tried to register a new account at <strong>${safeShop}</strong> using your email address. Because your account already exists, the registration was blocked and no changes were made.</p>

        <div style="background-color: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px;">
          <p style="margin: 0; font-size: 14px; color: #92400e;">
            <strong>Was this you?</strong> Simply log in to your existing account.<br/>
            <strong>Wasn’t you?</strong> No action needed — your account is still secure.
          </p>
        </div>

        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 32px 0;" />

        <p style="margin: 0; font-size: 14px; color: #9ca3af;">
          You received this email because a registration attempt was made using your address. If you have concerns about your account security, please change your password.
        </p>
      </div>

      <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0; font-size: 13px; color: #6b7280;">
          &copy; ${new Date().getFullYear()} ${safeShop}. All rights reserved.
        </p>
      </div>
    </div>
  `;

  return { subject, text, html };
}

