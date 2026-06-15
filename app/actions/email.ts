'use server';

import { Resend } from 'resend';

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
    console.warn('RESEND_API_KEY not set — skipping email send');
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendMagicLinkEmail(params: {
  to: string;
  magicLink: string;
}) {
  const resend = await getResendClient();
  if (!resend) return;

  try {
    await resend.emails.send({
      from: 'Nestora <onboarding@resend.dev>',
      to: params.to,
      subject: 'Your magic link to sign in to Nestora',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Welcome back to Nestora</h2>
          <p>Click the button below to sign in securely. This link will expire soon.</p>
          <a href="${params.magicLink}" style="display: inline-block; background: #111; color: white; padding: 12px 20px; border-radius: 6px; text-decoration: none; margin: 16px 0;">
            Sign in to Nestora
          </a>
          <p style="font-size: 13px; color: #666;">Or copy this link: <br>${params.magicLink}</p>
          <p style="font-size: 12px; color: #999;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
      text: `Sign in to Nestora: ${params.magicLink}\n\nIf you didn't request this, ignore this email.`,
    });
  } catch (err) {
    console.error('Failed to send magic link via Resend:', err);
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

  try {
    await resend.emails.send({
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
  } catch (error) {
    // non-fatal
  }
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

  try {
    await resend.emails.send({
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
  } catch (error) {
    // non-fatal
  }
}
