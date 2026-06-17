'use server';

/**
 * Centralized email sending using Resend.
 *
 * All usage is strictly inside Server Actions.
 * - Imported via dynamic `await import` from other server action modules only.
 * - No client component ever imports this file or 'resend'.
 * - RESEND_API_KEY is only accessed here at runtime on the server.
 *
 * Used for:
 * - Magic link sign-in emails (from app/login/actions.ts)
 * - Work order notifications (from app/(dashboard)/work-orders/crud-actions.ts )
 */

async function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set.');
  }
  const { Resend } = await import('resend');
  return new Resend(process.env.RESEND_API_KEY);
}

// Returns undefined on success, throws on failure.
export async function sendMagicLinkEmail(params: {
  to: string;
  magicLink: string;
}) {
  const resend = await getResendClient();

  // Resend v6 returns { data, error } — it does NOT throw on API errors.
  const { error } = await resend.emails.send({
    from: 'Nestora <onboarding@resend.dev>',
    to: params.to,
    subject: 'Your Nestora sign-in link',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Sign in to Nestora</h2>
        <p>Click the button below to sign in. This link expires soon and can only be used once.</p>
        <a href="${params.magicLink}" style="display: inline-block; background: #111; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 16px 0; font-size: 15px;">
          Sign in to Nestora
        </a>
        <p style="font-size: 13px; color: #666;">Or paste this link into your browser:<br><a href="${params.magicLink}" style="color:#555;">${params.magicLink}</a></p>
        <p style="font-size: 12px; color: #999;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
    text: `Sign in to Nestora: ${params.magicLink}\n\nIf you didn't request this, ignore this email.`,
  });

  if (error) {
    throw new Error(error.message ?? 'Resend returned an error without a message.');
  }
}

export async function notifyContractorNewWorkOrder(data: {
  title: string;
  description?: string | null;
  priority: string;
  due_date?: string | null;
  propertyName?: string | null;
  assigned_contractor_email: string;
}) {
  const resend = await getResendClient();
  if (!resend) return;

  if (!data.assigned_contractor_email) return;

  const { error } = await resend.emails.send({
    from: 'Nestora <onboarding@resend.dev>',
    to: data.assigned_contractor_email,
    subject: `New Work Order Assigned: ${data.title}`,
    text: `Hello,

A new work order has been created and assigned to you.

Title: ${data.title}
Property: ${data.propertyName || 'N/A'}
Priority: ${data.priority}
Due Date: ${data.due_date || 'Not specified'}

Description:
${data.description || 'No description provided.'}

Please log in to Nestora to view full details and accept the work order.

Best regards,
Nestora Team`,
  });
  if (error) console.error('[notifyContractorNewWorkOrder] Resend error:', error.message);
}

export async function notifyLandlordStatusChange(data: {
  title: string;
  propertyName?: string | null;
  oldStatus: string;
  newStatus: string;
  landlordEmail: string;
}) {
  const resend = await getResendClient();
  if (!resend) return;

  if (!data.landlordEmail) return;

  const { error } = await resend.emails.send({
    from: 'Nestora <onboarding@resend.dev>',
    to: data.landlordEmail,
    subject: `Work Order Status Updated: ${data.title}`,
    text: `Hello,

The status of the following work order has been changed:

Title: ${data.title}
Property: ${data.propertyName || 'N/A'}
Previous Status: ${data.oldStatus}
New Status: ${data.newStatus}

Please log in to Nestora to view the details.

Best regards,
Nestora Team`,
  });
  if (error) console.error('[notifyLandlordStatusChange] Resend error:', error.message);
}
