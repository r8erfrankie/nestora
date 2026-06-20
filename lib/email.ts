import { Resend } from 'resend';

// Single Resend instance — instantiated lazily at module load in server context only.
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = 'Nestora <noreply@gonestora.app>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://gonestora.app';

export async function sendTenantAccessGrantedEmail({
  to,
  propertyName,
}: {
  to: string;
  propertyName: string;
}) {
  const dashboardUrl = `${APP_URL}/tenant`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: `You've been granted access to ${propertyName} on Nestora`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">

        <!-- Header -->
        <tr>
          <td style="background:#09090b;padding:24px 32px">
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.02em">Nestora</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 24px">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#111827;line-height:1.3">
              You now have access to ${escapeHtml(propertyName)}
            </h1>
            <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6">
              Your landlord has granted you access to
              <strong>${escapeHtml(propertyName)}</strong>.
              You can now log in to Nestora and submit maintenance requests for this property.
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6">
              If you don't have a Nestora account yet, you'll be guided to create one when you click the button below.
            </p>
            <a href="${dashboardUrl}"
               style="display:inline-block;padding:12px 24px;background:#09090b;color:#ffffff;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none">
              Go to Nestora
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #f3f4f6">
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5">
              You received this email because a landlord granted you access to a property on Nestora.
              If this was unexpected, you can safely ignore this message.
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
}: {
  to: string;
  propertyName: string;
  joinCode: string;
}) {
  const acceptUrl = `${APP_URL}/join/${joinCode}`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: `You've been invited to join ${escapeHtml(propertyName)} on Nestora`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">

        <!-- Header -->
        <tr>
          <td style="background:#09090b;padding:24px 32px">
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.02em">Nestora</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 24px">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#111827;line-height:1.3">
              You've been invited to join ${escapeHtml(propertyName)}
            </h1>
            <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6">
              Your landlord has granted you access to
              <strong>${escapeHtml(propertyName)}</strong> on Nestora.
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6">
              Click the button below to set up your profile and start submitting
              maintenance requests right away — no approval step required.
            </p>
            <a href="${acceptUrl}"
               style="display:inline-block;padding:12px 24px;background:#09090b;color:#ffffff;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none">
              Accept Invitation
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #f3f4f6">
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5">
              You received this email because a landlord invited you to a property on Nestora.
              If this was unexpected, you can safely ignore this message.
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
