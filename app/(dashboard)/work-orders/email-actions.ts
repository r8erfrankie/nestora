'use server';

/**
 * Work order email notifications ONLY (Resend).
 *
 * HARD ISOLATION:
 * - The 'resend' package is loaded via *dynamic import inside the functions only*.
 * - email-actions.ts has **no static top-level import** of 'resend'.
 * - Callers MUST use `await import('./email-actions')` (dynamic, from inside other 'use server' files only).
 * - No client component ('use client') may import this file (statically or otherwise).
 * - The login/magic-link flow NEVER touches this (uses pure Supabase signInWithOtp in its own server action).
 * - Even requiring this module (via the dynamic import in crud) will not pull 'resend' until a notify function actually executes.
 * - Stale dev caches (.next, HMR) are the #1 cause of lingering "invalid api key" / header errors — always rm -rf .next + full dev server restart + hard browser refresh after changes.
 */

export async function notifyContractorNewWorkOrder(data: {
  title: string;
  description?: string | null;
  priority: string;
  due_date?: string | null;
  propertyName?: string | null;
  assigned_contractor_email: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set - skipping email notification');
    return;
  }

  if (!data.assigned_contractor_email) return;

  // Dynamic/lazy import of the Resend SDK itself — this file has no static dependency on 'resend'.
  // Guarantees the package is only ever required in a server execution context when a notification is sent.
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);

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
    // email send failure is non-fatal for the user flow
  }
}

export async function notifyLandlordStatusChange(data: {
  title: string;
  propertyName?: string | null;
  oldStatus: string;
  newStatus: string;
  landlordEmail: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set - skipping email notification');
    return;
  }

  if (!data.landlordEmail) return;

  // Dynamic/lazy import of the Resend SDK itself — this file has no static dependency on 'resend'.
  // Guarantees the package is only ever required in a server execution context when a notification is sent.
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);

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
    // email send failure is non-fatal for the user flow
  }
}
