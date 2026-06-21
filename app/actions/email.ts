'use server';

/**
 * Centralized email sending via Resend for work order notifications.
 * Magic link auth emails are handled by Supabase via custom SMTP (also Resend).
 * RESEND_API_KEY is only accessed here at runtime on the server.
 */

async function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set.');
  }
  const { Resend } = await import('resend');
  return new Resend(process.env.RESEND_API_KEY);
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
  if (!data.assigned_contractor_email) return;

  const { error } = await resend.emails.send({
    from: 'Nestora <noreply@gonestora.app>',
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

Please log in to gonestora.app to view full details and accept the work order.

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
  if (!data.landlordEmail) return;

  const { error } = await resend.emails.send({
    from: 'Nestora <noreply@gonestora.app>',
    to: data.landlordEmail,
    subject: `Work Order Status Updated: ${data.title}`,
    text: `Hello,

The status of the following work order has been changed:

Title: ${data.title}
Property: ${data.propertyName || 'N/A'}
Previous Status: ${data.oldStatus}
New Status: ${data.newStatus}

Please log in to gonestora.app to view the details.

Best regards,
Nestora Team`,
  });
  if (error) console.error('[notifyLandlordStatusChange] Resend error:', error.message);
}

export async function sendContractorInvitation(data: {
  contractorEmail: string;
  inviteToken: string;
  landlordName?: string | null;
}) {
  const resend = await getResendClient();
  if (!data.contractorEmail) return;

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://gonestora.app').replace(/\/$/, '');
  const inviteUrl = `${appUrl}/accept-invite?token=${data.inviteToken}`;
  const from = data.landlordName ? `${data.landlordName} via Nestora` : 'Nestora';

  const { error } = await resend.emails.send({
    from: 'Nestora <noreply@gonestora.app>',
    to: data.contractorEmail,
    subject: `You've been invited to join as a contractor on Nestora`,
    text: `Hello,

${from} has added you as a contractor on Nestora, a property management platform.

To accept the invitation and create your account, click the link below:

${inviteUrl}

Once you've signed up, you'll be able to view and manage work orders assigned to you.

If you weren't expecting this invitation, you can safely ignore this email.

Best regards,
Nestora Team`,
  });
  if (error) console.error('[sendContractorInvitation] Resend error:', error.message);
}
