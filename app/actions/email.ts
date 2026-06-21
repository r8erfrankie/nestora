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
  landlordName?: string;
}) {
  const resend = await getResendClient();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://gonestora.app').replace(/\/$/, '');

  const landlord = data.landlordName || 'A landlord';
  const loginUrl = `${appUrl}/contractor/welcome?email=${encodeURIComponent(data.contractorEmail)}`;

  const { error } = await resend.emails.send({
    from: 'Nestora <noreply@gonestora.app>',
    to: data.contractorEmail,
    subject: "You've been added as a contractor on Nestora",
    html: `
      <p>${landlord} added you as a contractor on Nestora.</p>
      <p>Click the link below to get started:</p>
      <p><a href="${loginUrl}" style="color: #000; text-decoration: underline;">Sign in to Nestora</a></p>
      <p style="color: #666; font-size: 14px;">If you weren't expecting this invitation, you can ignore this email.</p>
    `,
  });
  if (error) console.error('[sendContractorInvitation] Resend error:', error.message);
}

// Sent to contractors who are invited AND already have a work order waiting for them.
// Combines the invitation message with work order context so they understand why they're receiving this.
export async function sendContractorWorkOrderInvitation(data: {
  contractorEmail: string;
  landlordName?: string | null;
  workOrder: {
    title: string;
    priority: string;
    due_date?: string | null;
    propertyName?: string | null;
  };
}) {
  const resend = await getResendClient();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://gonestora.app').replace(/\/$/, '');

  const landlord = data.landlordName || 'A property manager';
  const welcomeUrl = `${appUrl}/contractor/welcome?email=${encodeURIComponent(data.contractorEmail)}`;
  const { title, priority, due_date, propertyName } = data.workOrder;

  const { error } = await resend.emails.send({
    from: 'Nestora <noreply@gonestora.app>',
    to: data.contractorEmail,
    subject: `${landlord} added you as a contractor and assigned you a work order`,
    html: `
      <p>${landlord} added you as a contractor on Nestora and assigned you a new work order.</p>
      <table style="border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:4px 12px 4px 0;color:#666;font-size:14px;">Work order</td><td style="padding:4px 0;font-size:14px;font-weight:600;">${title}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666;font-size:14px;">Property</td><td style="padding:4px 0;font-size:14px;">${propertyName || 'N/A'}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666;font-size:14px;">Priority</td><td style="padding:4px 0;font-size:14px;">${priority}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666;font-size:14px;">Due date</td><td style="padding:4px 0;font-size:14px;">${due_date || 'Not specified'}</td></tr>
      </table>
      <p>Create your account to view the full details and accept the work order:</p>
      <p><a href="${welcomeUrl}" style="color:#000;text-decoration:underline;">Get started on Nestora</a></p>
      <p style="color:#666;font-size:14px;">If you weren't expecting this, you can safely ignore this email.</p>
    `,
  });
  if (error) console.error('[sendContractorWorkOrderInvitation] Resend error:', error.message);
}
