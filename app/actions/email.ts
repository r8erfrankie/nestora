'use server';

import { formatUnit, getLabelWord } from '@/lib/unit-label';

/**
 * Centralized email sending via Resend for work order notifications.
 * Magic link auth emails are handled by Supabase via custom SMTP (also Resend).
 * RESEND_API_KEY is only accessed here at runtime on the server.
 */

const FROM = 'Nestora <noreply@gonestora.app>';
const BRAND_COLOR = '#0F766E';
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://gonestora.app').replace(/\/$/, '');

async function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set.');
  }
  const { Resend } = await import('resend');
  return new Resend(process.env.RESEND_API_KEY);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#DC2626',
  high:   '#EA580C',
  medium: '#D97706',
  low:    '#6B7280',
};

function priorityColor(priority: string) {
  return PRIORITY_COLOR[priority.toLowerCase()] ?? '#6B7280';
}

const INSTALL_BLOCK = `
    <!-- Get the app -->
    <tr>
      <td style="padding:0 32px 28px">
        <table cellpadding="0" cellspacing="0" width="100%" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px">
          <tr>
            <td style="padding:16px 20px">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#111827;letter-spacing:0.05em;text-transform:uppercase">Get the Nestora app</p>
              <p style="margin:0 0 14px;font-size:12px;color:#6b7280;line-height:1.5">No App Store needed — install directly from your browser at <a href="https://gonestora.app" style="color:#0F766E;font-weight:600;text-decoration:none">gonestora.app</a></p>
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="width:50%;vertical-align:top;padding-right:12px">
                    <p style="margin:0 0 7px;font-size:12px;font-weight:600;color:#374151">iPhone &amp; iPad</p>
                    <p style="margin:0 0 3px;font-size:12px;color:#6b7280;line-height:1.5">1. Open in <strong>Safari</strong></p>
                    <p style="margin:0 0 3px;font-size:12px;color:#6b7280;line-height:1.5">2. Tap Share &#8593; &#8594; <strong>Add to Home Screen</strong></p>
                    <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.5">3. Tap <strong>Add</strong></p>
                  </td>
                  <td style="width:50%;vertical-align:top;padding-left:12px;border-left:1px solid #e5e7eb">
                    <p style="margin:0 0 7px;font-size:12px;font-weight:600;color:#374151">Android</p>
                    <p style="margin:0 0 3px;font-size:12px;color:#6b7280;line-height:1.5">1. Open in <strong>Chrome</strong></p>
                    <p style="margin:0 0 3px;font-size:12px;color:#6b7280;line-height:1.5">2. Tap &#8942; menu &#8594; <strong>Add to Home Screen</strong></p>
                    <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.5">3. Tap <strong>Install</strong></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;

// Shared HTML chrome — header + outer table wrappers.
function emailWrap(body: string) {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0fdf4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #d1fae5;overflow:hidden">
        <tr>
          <td style="background:${BRAND_COLOR};padding:16px 32px">
            <table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>
              <td style="padding-right:10px;vertical-align:middle">
                <img src="${APP_URL}/icons/icon-192.png" width="30" height="30" alt="" style="display:block;border-radius:6px">
              </td>
              <td style="vertical-align:middle">
                <img src="${APP_URL}/nestora-wordmark-white.png" width="84" height="28" alt="Nestora" style="display:block">
              </td>
            </tr></table>
          </td>
        </tr>
        ${body}
        <tr><td style="padding:0 32px"><div style="height:1px;background:#f3f4f6"></div></td></tr>
        <tr>
          <td style="padding:20px 32px">
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6">
              You're receiving this because you have a work order assigned to you on Nestora.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

// Detail row used inside the work order info table.
function detailRow(label: string, value: string, valueStyle = '') {
  return `
    <tr>
      <td style="padding:6px 16px 6px 0;font-size:13px;color:#6b7280;white-space:nowrap;vertical-align:top">${label}</td>
      <td style="padding:6px 0;font-size:13px;color:#111827;font-weight:500;${valueStyle}">${value}</td>
    </tr>`;
}

export async function notifyContractorNewWorkOrder(data: {
  title: string;
  description?: string | null;
  priority: string;
  due_date?: string | null;
  propertyName?: string | null;
  unit?: string | null;
  unit_label_type?: string | null;
  assigned_contractor_email: string;
  landlordName?: string | null;
}) {
  const resend = await getResendClient();
  if (!data.assigned_contractor_email) return;

  const dashboardUrl = `${APP_URL}/contractor`;
  const eyebrow = data.landlordName
    ? `Assigned by ${escapeHtml(data.landlordName)}`
    : 'New work order';

  // Build a descriptive headline that includes property + unit when available.
  const unitLabel = formatUnit(data.unit, data.unit_label_type);
  const locationParts = [
    data.propertyName ? escapeHtml(data.propertyName) : null,
    unitLabel ? escapeHtml(unitLabel) : null,
  ].filter(Boolean);
  const headline = locationParts.length
    ? `New work order at ${locationParts.join(', ')}`
    : 'New work order assigned to you';

  const intro = data.landlordName
    ? `<strong>${escapeHtml(data.landlordName)}</strong> assigned you a new work order. Log in to Nestora to view the full details, accept the job, and post updates.`
    : 'A new work order has been assigned to you. Log in to Nestora to view the full details and accept the job.';

  const pColor = priorityColor(data.priority);

  const body = `
    <tr>
      <td style="padding:32px 32px 24px">
        <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:${BRAND_COLOR};letter-spacing:0.06em;text-transform:uppercase">${eyebrow}</p>
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;line-height:1.3">
          ${escapeHtml(data.title)}
        </h1>
        <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.65">${intro}</p>

        <!-- Work order detail card -->
        <table cellpadding="0" cellspacing="0" style="width:100%;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:28px">
          <tr><td style="padding:16px 20px">
            <table cellpadding="0" cellspacing="0" style="width:100%">
              <tr>
                <td style="padding:0 0 12px;font-size:11px;font-weight:600;color:#6b7280;letter-spacing:0.06em;text-transform:uppercase">Work order details</td>
              </tr>
              ${data.propertyName ? detailRow('Property', escapeHtml(data.propertyName)) : ''}
              ${unitLabel ? detailRow(getLabelWord(data.unit_label_type), escapeHtml(unitLabel)) : ''}
              ${detailRow('Priority', escapeHtml(data.priority), `color:${pColor};font-weight:600`)}
              ${data.due_date ? detailRow('Due date', escapeHtml(data.due_date)) : ''}
              ${data.description ? detailRow('Description', escapeHtml(data.description)) : ''}
            </table>
          </td></tr>
        </table>

        <a href="${dashboardUrl}"
           style="display:inline-block;padding:13px 28px;background:${BRAND_COLOR};color:#ffffff;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;letter-spacing:0.01em">
          View Work Order
        </a>
      </td>
    </tr>${INSTALL_BLOCK}`;

  const { error } = await resend.emails.send({
    from: FROM,
    to: data.assigned_contractor_email,
    subject: data.landlordName
      ? `${data.landlordName} assigned you a work order — ${data.title}`
      : `New work order assigned: ${data.title}`,
    html: emailWrap(body),
  });
  if (error) console.error('[notifyContractorNewWorkOrder] Resend error:', error.message);
}

export async function notifyLandlordStatusChange(data: {
  title: string;
  propertyName?: string | null;
  oldStatus: string;
  newStatus: string;
  landlordEmail: string;
  contractorName?: string | null;
}) {
  const resend = await getResendClient();
  if (!data.landlordEmail) return;

  const dashboardUrl = `${APP_URL}/work-orders`;
  const eyebrow = data.contractorName
    ? `Update from ${escapeHtml(data.contractorName)}`
    : 'Work order update';
  const headline = `Status changed: ${escapeHtml(data.oldStatus)} → ${escapeHtml(data.newStatus)}`;
  const intro = data.contractorName
    ? `<strong>${escapeHtml(data.contractorName)}</strong> updated the status of a work order on your property.`
    : 'The status of a work order on your property has been updated.';

  const body = `
    <tr>
      <td style="padding:32px 32px 24px">
        <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:${BRAND_COLOR};letter-spacing:0.06em;text-transform:uppercase">${eyebrow}</p>
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;line-height:1.3">
          ${escapeHtml(data.title)}
        </h1>
        <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.65">${intro}</p>

        <table cellpadding="0" cellspacing="0" style="width:100%;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:28px">
          <tr><td style="padding:16px 20px">
            <table cellpadding="0" cellspacing="0" style="width:100%">
              <tr>
                <td style="padding:0 0 12px;font-size:11px;font-weight:600;color:#6b7280;letter-spacing:0.06em;text-transform:uppercase">Status update</td>
              </tr>
              ${data.propertyName ? detailRow('Property', escapeHtml(data.propertyName)) : ''}
              ${detailRow('Previous status', escapeHtml(data.oldStatus))}
              ${detailRow('New status', `<strong>${escapeHtml(data.newStatus)}</strong>`)}
            </table>
          </td></tr>
        </table>

        <a href="${dashboardUrl}"
           style="display:inline-block;padding:13px 28px;background:${BRAND_COLOR};color:#ffffff;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;letter-spacing:0.01em">
          View in Nestora
        </a>
      </td>
    </tr>`;

  const { error } = await resend.emails.send({
    from: FROM,
    to: data.landlordEmail,
    subject: `Work order update: "${data.title}" is now ${data.newStatus}`,
    html: emailWrap(body),
  });
  if (error) console.error('[notifyLandlordStatusChange] Resend error:', error.message);
}

export async function sendContractorInvitation(data: {
  contractorEmail: string;
  landlordName?: string;
}) {
  // Kept for backwards compatibility — new code should use sendContractorInviteEmail
  // in lib/email.ts which uses the token-based /accept-invite route.
  const resend = await getResendClient();
  const loginUrl = `${APP_URL}/contractor/welcome?email=${encodeURIComponent(data.contractorEmail)}`;
  const landlord = data.landlordName ? escapeHtml(data.landlordName) : 'A property manager';

  const body = `
    <tr>
      <td style="padding:32px 32px 24px">
        <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:${BRAND_COLOR};letter-spacing:0.06em;text-transform:uppercase">Contractor invitation</p>
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;line-height:1.3">
          You've been added as a contractor
        </h1>
        <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.65">
          ${landlord} added you as a contractor on Nestora. Sign in to start receiving and managing work orders.
        </p>
        <a href="${loginUrl}"
           style="display:inline-block;padding:13px 28px;background:${BRAND_COLOR};color:#ffffff;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;letter-spacing:0.01em">
          Get Started
        </a>
      </td>
    </tr>${INSTALL_BLOCK}`;

  const { error } = await resend.emails.send({
    from: FROM,
    to: data.contractorEmail,
    subject: "You've been added as a contractor on Nestora",
    html: emailWrap(body),
  });
  if (error) console.error('[sendContractorInvitation] Resend error:', error.message);
}

export async function sendContractorWorkOrderInvitation(data: {
  contractorEmail: string;
  landlordName?: string | null;
  workOrder: {
    title: string;
    priority: string;
    due_date?: string | null;
    propertyName?: string | null;
    unit?: string | null;
    unit_label_type?: string | null;
  };
}) {
  const resend = await getResendClient();
  const welcomeUrl = `${APP_URL}/contractor/welcome?email=${encodeURIComponent(data.contractorEmail)}`;
  const landlord = data.landlordName ?? null;
  const { title, priority, due_date, propertyName, unit, unit_label_type } = data.workOrder;
  const pColor = priorityColor(priority);

  const eyebrow = landlord ? `Invitation from ${escapeHtml(landlord)}` : 'You have a new invitation';
  const headline = landlord
    ? `${escapeHtml(landlord)} invited you — and has a job for you`
    : "You've been added as a contractor";
  const intro = landlord
    ? `<strong>${escapeHtml(landlord)}</strong> added you as a contractor on Nestora and has already assigned you a work order. Create your account to accept the job and start managing your work orders.`
    : 'A property manager added you as a contractor on Nestora and has assigned you a work order. Create your account to get started.';

  const body = `
    <tr>
      <td style="padding:32px 32px 24px">
        <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:${BRAND_COLOR};letter-spacing:0.06em;text-transform:uppercase">${eyebrow}</p>
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;line-height:1.3">
          ${headline}
        </h1>
        <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.65">${intro}</p>

        <!-- Work order preview -->
        <table cellpadding="0" cellspacing="0" style="width:100%;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:28px">
          <tr><td style="padding:16px 20px">
            <table cellpadding="0" cellspacing="0" style="width:100%">
              <tr>
                <td style="padding:0 0 12px;font-size:11px;font-weight:600;color:#6b7280;letter-spacing:0.06em;text-transform:uppercase">Your first work order</td>
              </tr>
              ${detailRow('Title', `<strong>${escapeHtml(title)}</strong>`)}
              ${propertyName ? detailRow('Property', escapeHtml(propertyName)) : ''}
              ${unit ? detailRow(getLabelWord(unit_label_type), escapeHtml(formatUnit(unit, unit_label_type)!)) : ''}
              ${detailRow('Priority', escapeHtml(priority), `color:${pColor};font-weight:600`)}
              ${due_date ? detailRow('Due date', escapeHtml(due_date)) : ''}
            </table>
          </td></tr>
        </table>

        <a href="${welcomeUrl}"
           style="display:inline-block;padding:13px 28px;background:${BRAND_COLOR};color:#ffffff;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;letter-spacing:0.01em">
          Create My Account
        </a>
      </td>
    </tr>${INSTALL_BLOCK}`;

  const { error } = await resend.emails.send({
    from: FROM,
    to: data.contractorEmail,
    subject: landlord
      ? `${landlord} added you as a contractor and has a work order for you`
      : `New work order waiting — join ${propertyName ?? 'Nestora'} as a contractor`,
    html: emailWrap(body),
  });
  if (error) console.error('[sendContractorWorkOrderInvitation] Resend error:', error.message);
}

export async function notifyLandlordNewRequest(data: {
  landlordEmail: string;
  tenantEmail: string;
  requestTitle: string;
  propertyName?: string | null;
  description?: string | null;
  priority: string;
}) {
  const resend = await getResendClient();
  if (!data.landlordEmail) return;

  const dashboardUrl = `${APP_URL}/tenants`;
  const pColor = priorityColor(data.priority);
  const propLine = data.propertyName ? ` at ${escapeHtml(data.propertyName)}` : '';

  const body = `
    <tr>
      <td style="padding:32px 32px 24px">
        <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:${BRAND_COLOR};letter-spacing:0.06em;text-transform:uppercase">New maintenance request</p>
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;line-height:1.3">
          ${escapeHtml(data.requestTitle)}
        </h1>
        <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.65">
          A tenant has submitted a new maintenance request${propLine}. Log in to review it and create a work order.
        </p>

        <table cellpadding="0" cellspacing="0" style="width:100%;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:28px">
          <tr><td style="padding:16px 20px">
            <table cellpadding="0" cellspacing="0" style="width:100%">
              <tr>
                <td style="padding:0 0 12px;font-size:11px;font-weight:600;color:#6b7280;letter-spacing:0.06em;text-transform:uppercase">Request details</td>
              </tr>
              ${data.propertyName ? detailRow('Property', escapeHtml(data.propertyName)) : ''}
              ${detailRow('Submitted by', escapeHtml(data.tenantEmail))}
              ${detailRow('Priority', escapeHtml(data.priority), `color:${pColor};font-weight:600`)}
              ${data.description ? detailRow('Description', escapeHtml(data.description)) : ''}
            </table>
          </td></tr>
        </table>

        <a href="${dashboardUrl}"
           style="display:inline-block;padding:13px 28px;background:${BRAND_COLOR};color:#ffffff;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;letter-spacing:0.01em">
          View Request
        </a>
      </td>
    </tr>${INSTALL_BLOCK}`;

  const footerHtml = `
    <tr><td style="padding:0 32px"><div style="height:1px;background:#f3f4f6"></div></td></tr>
    <tr>
      <td style="padding:20px 32px">
        <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6">
          You're receiving this because a tenant submitted a maintenance request on a property you manage in Nestora.
        </p>
      </td>
    </tr>`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0fdf4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #d1fae5;overflow:hidden">
        <tr>
          <td style="background:${BRAND_COLOR};padding:16px 32px">
            <table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>
              <td style="padding-right:10px;vertical-align:middle">
                <img src="${APP_URL}/icons/icon-192.png" width="30" height="30" alt="" style="display:block;border-radius:6px">
              </td>
              <td style="vertical-align:middle">
                <img src="${APP_URL}/nestora-wordmark-white.png" width="84" height="28" alt="Nestora" style="display:block">
              </td>
            </tr></table>
          </td>
        </tr>
        ${body}
        ${footerHtml}
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

  const { error } = await resend.emails.send({
    from: FROM,
    to: data.landlordEmail,
    subject: `New maintenance request: "${data.requestTitle}"${data.propertyName ? ` at ${data.propertyName}` : ''}`,
    html,
  });
  if (error) console.error('[notifyLandlordNewRequest] Resend error:', error.message);
}

export async function notifyLandlordWorkOrderUpdate(data: {
  landlordEmail: string;
  workOrderTitle: string;
  propertyName?: string | null;
  newStatus: string;
  contractorName?: string | null;
}) {
  const resend = await getResendClient();
  if (!data.landlordEmail) return;

  const dashboardUrl = `${APP_URL}/work-orders`;
  const eyebrow = data.contractorName
    ? `Update from ${escapeHtml(data.contractorName)}`
    : 'Work order update';
  const intro = data.contractorName
    ? `<strong>${escapeHtml(data.contractorName)}</strong> updated the status of a work order on your property.`
    : 'The status of a work order on your property has been updated.';

  const body = `
    <tr>
      <td style="padding:32px 32px 24px">
        <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:${BRAND_COLOR};letter-spacing:0.06em;text-transform:uppercase">${eyebrow}</p>
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;line-height:1.3">
          ${escapeHtml(data.workOrderTitle)}
        </h1>
        <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.65">${intro}</p>

        <table cellpadding="0" cellspacing="0" style="width:100%;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:28px">
          <tr><td style="padding:16px 20px">
            <table cellpadding="0" cellspacing="0" style="width:100%">
              <tr>
                <td style="padding:0 0 12px;font-size:11px;font-weight:600;color:#6b7280;letter-spacing:0.06em;text-transform:uppercase">Status update</td>
              </tr>
              ${data.propertyName ? detailRow('Property', escapeHtml(data.propertyName)) : ''}
              ${detailRow('New status', `<strong>${escapeHtml(data.newStatus)}</strong>`)}
            </table>
          </td></tr>
        </table>

        <a href="${dashboardUrl}"
           style="display:inline-block;padding:13px 28px;background:${BRAND_COLOR};color:#ffffff;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;letter-spacing:0.01em">
          View in Nestora
        </a>
      </td>
    </tr>`;

  const footerHtml = `
    <tr><td style="padding:0 32px"><div style="height:1px;background:#f3f4f6"></div></td></tr>
    <tr>
      <td style="padding:20px 32px">
        <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6">
          You're receiving this because a contractor updated a work order on a property you manage in Nestora.
        </p>
      </td>
    </tr>`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0fdf4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #d1fae5;overflow:hidden">
        <tr>
          <td style="background:${BRAND_COLOR};padding:16px 32px">
            <table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>
              <td style="padding-right:10px;vertical-align:middle">
                <img src="${APP_URL}/icons/icon-192.png" width="30" height="30" alt="" style="display:block;border-radius:6px">
              </td>
              <td style="vertical-align:middle">
                <img src="${APP_URL}/nestora-wordmark-white.png" width="84" height="28" alt="Nestora" style="display:block">
              </td>
            </tr></table>
          </td>
        </tr>
        ${body}
        ${footerHtml}
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

  const { error } = await resend.emails.send({
    from: FROM,
    to: data.landlordEmail,
    subject: data.contractorName
      ? `${data.contractorName} updated "${data.workOrderTitle}" → ${data.newStatus}`
      : `Work order update: "${data.workOrderTitle}" is now ${data.newStatus}`,
    html,
  });
  if (error) console.error('[notifyLandlordWorkOrderUpdate] Resend error:', error.message);
}
