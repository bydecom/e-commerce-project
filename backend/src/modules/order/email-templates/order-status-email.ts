type OrderStatusEmailInput = {
  shopName: string;
  orderId: number;
  customerName: string;
  orderUrl: string;
  oldStatus: string;
  newStatus: string;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING:   'Pending',
  CONFIRMED: 'Confirmed',
  SHIPPING:  'Shipping',
  DONE:      'Done',
  CANCELLED: 'Cancelled',
};

const STATUS_COLOR: Record<string, { bg: string; text: string; badge: string }> = {
  CONFIRMED: { bg: '#eff6ff', text: '#1d4ed8', badge: '#dbeafe' },
  SHIPPING:  { bg: '#fff7ed', text: '#c2410c', badge: '#ffedd5' },
  CANCELLED: { bg: '#fef2f2', text: '#b91c1c', badge: '#fee2e2' },
};

const DEFAULT_COLOR = { bg: '#f9fafb', text: '#374151', badge: '#e5e7eb' };

export function buildOrderStatusEmail(input: OrderStatusEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const safeShop = input.shopName.trim() || 'Our Shop';
  const safeName = input.customerName.trim() || 'there';
  const newLabel = STATUS_LABEL[input.newStatus] ?? input.newStatus;
  const oldLabel = STATUS_LABEL[input.oldStatus] ?? input.oldStatus;
  const color = STATUS_COLOR[input.newStatus] ?? DEFAULT_COLOR;

  const subject = `[${safeShop}] Order #${input.orderId} is now ${newLabel}`;

  const text =
    `Hi ${safeName},\n\n` +
    `Your order #${input.orderId} status has been updated from ${oldLabel} to ${newLabel}.\n\n` +
    `View order details: ${input.orderUrl}\n\n` +
    `Thank you for shopping with ${safeShop}.`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="background-color: #f3f4f6; padding: 20px 0; margin: 0;">
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">

        <div style="background: ${color.bg}; padding: 30px 24px; text-align: center; border-bottom: 1px solid ${color.badge};">
          <div style="display: inline-block; background-color: ${color.badge}; color: ${color.text}; padding: 6px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 12px;">
            ${newLabel}
          </div>
          <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #111827;">Order #${input.orderId} Updated</h1>
          <p style="margin: 8px 0 0; font-size: 14px; color: #4b5563;">${safeShop}</p>
        </div>

        <div style="padding: 32px 24px; color: #374151; font-size: 15px; line-height: 1.6;">
          <p style="margin: 0 0 16px;">Hi <strong>${safeName}</strong>,</p>
          <p style="margin: 0 0 24px;">Your order status has been updated:</p>

          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 0 0 32px; display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 14px; color: #6b7280;">${oldLabel}</span>
            <span style="font-size: 18px; color: #9ca3af;">→</span>
            <span style="font-size: 15px; font-weight: 700; color: ${color.text};">${newLabel}</span>
          </div>

          <div style="text-align: center; margin-bottom: 10px;">
            <a href="${input.orderUrl}" style="display: inline-block; background-color: #111827; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px;">
              View Order Details
            </a>
          </div>
        </div>

        <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 13px; color: #6b7280;">
            Thank you for shopping with <strong>${safeShop}</strong>.
          </p>
        </div>

      </div>
    </body>
    </html>
  `;

  return { subject, text, html };
}
