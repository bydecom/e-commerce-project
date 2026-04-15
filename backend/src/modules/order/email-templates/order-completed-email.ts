type OrderCompletedEmailInput = {
  shopName: string;
  orderId: number;
  customerName: string;
  orderUrl: string;
  items: Array<{ name: string; quantity: number }>;
  totalVnd: string;
  supportEmail?: string | null;
  supportPhone?: string | null;
};

export function buildOrderCompletedEmail(input: OrderCompletedEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const safeShop = input.shopName.trim() || 'Our Shop';
  const safeName = input.customerName.trim() || 'there';

  const itemsHtml = input.items
    .map(
      (it) => `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #374151; font-size: 14px;">
            <strong>${it.name}</strong>
          </td>
          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; text-align: right; width: 60px;">
            x${it.quantity}
          </td>
        </tr>`
    )
    .join('');

  const subject = `[${safeShop}] Order #${input.orderId} is Complete`;
  
  const text =
    `Hi ${safeName},\n\n` +
    `Great news! Your order #${input.orderId} has been successfully delivered and is now complete.\n` +
    `Total: ${input.totalVnd}\n\n` +
    `View your order and leave a review: ${input.orderUrl}\n` +
    (input.supportEmail || input.supportPhone
      ? `\nNeed help? Contact us: ${[input.supportEmail, input.supportPhone].filter(Boolean).join(' | ')}\n`
      : '');

  const supportLine = [input.supportEmail, input.supportPhone].filter(Boolean).join(' &bull; ');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="background-color: #f3f4f6; padding: 20px 0; margin: 0;">
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        
        <div style="background: #f0fdf4; padding: 30px 24px; text-align: center; border-bottom: 1px solid #dcfce7;">
          <div style="display: inline-block; background-color: #dcfce7; color: #166534; padding: 6px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 12px;">
            Delivered
          </div>
          <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #111827;">Order #${input.orderId} is Complete!</h1>
          <p style="margin: 8px 0 0; font-size: 14px; color: #4b5563;">${safeShop}</p>
        </div>

        <div style="padding: 32px 24px; color: #374151; font-size: 15px; line-height: 1.6;">
          <p style="margin: 0 0 16px;">Hi <strong>${safeName}</strong>,</p>
          <p style="margin: 0 0 24px;">Great news! Your package has been successfully delivered. We hope you love your new items.</p>

          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 0 0 32px;">
            <div style="font-size: 12px; color: #6b7280; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 12px;">Order Summary</div>
            
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;">
              ${itemsHtml}
            </table>
            
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding-top: 12px; font-size: 16px; font-weight: 700; color: #111827;">Total Amount</td>
                <td style="padding-top: 12px; font-size: 18px; font-weight: 800; color: #111827; text-align: right;">${input.totalVnd}</td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; margin-bottom: 10px;">
            <p style="margin: 0 0 16px; color: #4b5563;">How did we do? We'd love to hear your thoughts.</p>
            <a href="${input.orderUrl}" style="display: inline-block; background-color: #111827; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; transition: background-color 0.2s;">
              Write a Review
            </a>
          </div>
        </div>

        <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 13px; color: #6b7280;">
            Thank you for shopping with <strong>${safeShop}</strong>.
          </p>
          ${supportLine ? `
          <p style="margin: 8px 0 0; font-size: 12px; color: #9ca3af;">
            Need assistance? ${supportLine}
          </p>` : ''}
        </div>
        
      </div>
    </body>
    </html>
  `;

  return { subject, text, html };
}