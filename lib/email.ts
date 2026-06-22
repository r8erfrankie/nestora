import { Resend } from 'resend';

// Single Resend instance — instantiated lazily at module load in server context only.
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = 'Nestora <noreply@gonestora.app>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://gonestora.app';

// Teal brand color matching the landing page (#0F766E = teal-700).
const BRAND_COLOR = '#0F766E';

export async function sendTenantAccessGrantedEmail({
  to,
  propertyName,
  landlordName,
}: {
  to: string;
  propertyName: string;
  landlordName?: string | null;
}) {
  const dashboardUrl = `${APP_URL}/tenant`;
  const eyebrow = landlordName
    ? `Approved by ${escapeHtml(landlordName)}`
    : 'Access approved';
  const intro = landlordName
    ? `<strong>${escapeHtml(landlordName)}</strong> has approved your access request for <strong>${escapeHtml(propertyName)}</strong>.`
    : `Your landlord has approved your access request for <strong>${escapeHtml(propertyName)}</strong>.`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: `You're connected to ${propertyName} — welcome to Nestora`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0fdf4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #d1fae5;overflow:hidden">

        <!-- Header -->
        <tr>
          <td style="background:${BRAND_COLOR};padding:20px 32px">
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.02em">Nestora</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 24px">
            <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:${BRAND_COLOR};letter-spacing:0.06em;text-transform:uppercase">${eyebrow}</p>
            <h1 style="margin:0 0 20px;font-size:24px;font-weight:700;color:#111827;line-height:1.25">
              You're now connected to ${escapeHtml(propertyName)}
            </h1>
            <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.65">
              ${intro}
              You can now log in to Nestora and submit maintenance requests directly — no phone calls or texts needed.
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.65">
              Click below to go to your tenant dashboard and get started.
            </p>
            <a href="${dashboardUrl}"
               style="display:inline-block;padding:13px 28px;background:${BRAND_COLOR};color:#ffffff;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;letter-spacing:0.01em">
              Go to My Dashboard
            </a>
          </td>
        </tr>

        <!-- Divider -->
        <tr><td style="padding:0 32px"><div style="height:1px;background:#f3f4f6"></div></td></tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px">
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6">
              You received this email because a landlord approved your access request on Nestora.
              If you weren't expecting this, you can safely ignore it.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
    `.trim(),
  });
}

export async function sendTenantInviteEmail({
  to,
  propertyName,
  joinCode,
  landlordName,
}: {
  to: string;
  propertyName: string;
  joinCode: string;
  landlordName?: string | null;
}) {
  // Route through /login so the tenant's email is pre-filled and redirectTo
  // carries the join code through the magic-link round-trip.
  const acceptUrl = `${APP_URL}/login?email=${encodeURIComponent(to)}&redirectTo=${encodeURIComponent(`/tenant-onboarding?join=${joinCode}`)}`;

  const eyebrow = landlordName
    ? `Invitation from ${escapeHtml(landlordName)}`
    : 'You have a new invitation';
  const headline = landlordName
    ? `${escapeHtml(landlordName)} invited you to ${escapeHtml(propertyName)}`
    : `You've been invited to join ${escapeHtml(propertyName)}`;
  const intro = landlordName
    ? `<strong>${escapeHtml(landlordName)}</strong> uses Nestora to manage maintenance at <strong>${escapeHtml(propertyName)}</strong> and has invited you to connect as a tenant.`
    : `Your landlord uses Nestora to manage maintenance at <strong>${escapeHtml(propertyName)}</strong> and has invited you to connect as a tenant.`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: landlordName
      ? `${landlordName} invited you to join ${propertyName} on Nestora`
      : `You've been invited to join ${propertyName} on Nestora`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0fdf4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #d1fae5;overflow:hidden">

        <!-- Header -->
        <tr>
          <td style="background:${BRAND_COLOR};padding:20px 32px">
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.02em">Nestora</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 24px">
            <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:${BRAND_COLOR};letter-spacing:0.06em;text-transform:uppercase">${eyebrow}</p>
            <h1 style="margin:0 0 20px;font-size:24px;font-weight:700;color:#111827;line-height:1.25">
              ${headline}
            </h1>
            <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.65">
              ${intro}
              Once you accept, you can submit and track maintenance requests directly from your phone — no calls or texts needed.
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.65">
              Setting up your account takes under two minutes.
            </p>
            <a href="${acceptUrl}"
               style="display:inline-block;padding:13px 28px;background:${BRAND_COLOR};color:#ffffff;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;letter-spacing:0.01em">
              Accept Invitation
            </a>
          </td>
        </tr>

        <!-- Divider -->
        <tr><td style="padding:0 32px"><div style="height:1px;background:#f3f4f6"></div></td></tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px">
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6">
              This invite was sent to ${escapeHtml(to)} because a landlord added you to a property on Nestora.
              If you weren't expecting this, you can safely ignore it — no account will be created without your action.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
    `.trim(),
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
