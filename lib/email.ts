import { Resend } from 'resend';

// Single Resend instance — instantiated lazily at module load in server context only.
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = 'Nestora <noreply@gonestora.app>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://gonestora.app';

// Teal brand color matching the landing page (#0F766E = teal-700).
const BRAND_COLOR = '#0F766E';

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

export async function sendTenantAccessGrantedEmail({
  to,
  propertyName,
  landlordName,
  magicLink,
  otpCode,
}: {
  to: string;
  propertyName: string;
  landlordName?: string | null;
  magicLink?: string | null;
  otpCode?: string | null;
}) {
  // Primary CTA: magic link → one click to sign in and land on /tenant.
  // Fallback: /login pre-filled with their email so they just click "Send code".
  const fallbackLoginUrl = `${APP_URL}/login?email=${encodeURIComponent(to)}&redirectTo=${encodeURIComponent('/tenant')}`;
  const ctaHref = magicLink ?? fallbackLoginUrl;
  const ctaLabel = magicLink ? 'Open My Dashboard' : 'Sign In to Dashboard';

  const eyebrow = landlordName
    ? `Approved by ${escapeHtml(landlordName)}`
    : 'Access approved';
  const intro = landlordName
    ? `<strong>${escapeHtml(landlordName)}</strong> has approved your access to <strong>${escapeHtml(propertyName)}</strong>.`
    : `Your landlord has approved your access to <strong>${escapeHtml(propertyName)}</strong>.`;

  // Render the OTP digits as styled boxes (works reliably across email clients).
  const otpBlock = otpCode
    ? `
        <!-- OTP fallback -->
        <tr><td style="padding:0 32px 24px">
          <div style="border-top:1px solid #f3f4f6;padding-top:24px">
            <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#6b7280;letter-spacing:0.06em;text-transform:uppercase">Sign-in code</p>
            <p style="margin:0 0 14px;font-size:13px;color:#6b7280;line-height:1.5">
              If the button doesn&apos;t work, visit
              <a href="${fallbackLoginUrl}" style="color:${BRAND_COLOR}">gonestora.app</a>,
              enter your email, and type this code when prompted.
            </p>
            <div style="display:inline-block">
              <table cellpadding="0" cellspacing="0"><tr>
                ${otpCode.split('').map(d =>
                  `<td style="padding:0 3px"><div style="width:40px;height:48px;line-height:48px;text-align:center;font-size:22px;font-weight:700;color:#111827;background:#f9fafb;border:2px solid #e5e7eb;border-radius:8px">${d}</div></td>`
                ).join('')}
              </tr></table>
            </div>
            <p style="margin:10px 0 0;font-size:12px;color:#9ca3af">This code expires in 24 hours.</p>
          </div>
        </td></tr>`
    : '';

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

        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 28px">
            <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:${BRAND_COLOR};letter-spacing:0.06em;text-transform:uppercase">${eyebrow}</p>
            <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#111827;line-height:1.25">
              You&apos;re now connected to ${escapeHtml(propertyName)}
            </h1>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.65">
              ${intro}
              You can now submit and track maintenance requests directly from your Nestora dashboard — no phone calls or texts needed.
            </p>
            <a href="${ctaHref}"
               style="display:inline-block;padding:14px 32px;background:${BRAND_COLOR};color:#ffffff;font-size:15px;font-weight:600;border-radius:8px;text-decoration:none;letter-spacing:0.01em">
              ${ctaLabel} →
            </a>
            ${magicLink ? `<p style="margin:12px 0 0;font-size:12px;color:#9ca3af">This link signs you in automatically. It can only be used once.</p>` : ''}
          </td>
        </tr>

        ${otpBlock}
        ${INSTALL_BLOCK}

        <!-- Divider -->
        <tr><td style="padding:0 32px"><div style="height:1px;background:#f3f4f6"></div></td></tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px">
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6">
              You received this because a landlord approved your access request on Nestora.
              If you weren&apos;t expecting this, you can safely ignore it.
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
  landlordName,
  magicLink,
  otpCode,
}: {
  to: string;
  propertyName: string;
  landlordName?: string | null;
  magicLink?: string | null;
  otpCode?: string | null;
}) {
  const loginUrl = `${APP_URL}/login?email=${encodeURIComponent(to)}&redirectTo=${encodeURIComponent('/tenant-onboarding')}${otpCode ? '&skipToCode=1' : ''}`;

  const eyebrow = landlordName
    ? `Invitation from ${escapeHtml(landlordName)}`
    : 'You have a new invitation';
  const headline = landlordName
    ? `${escapeHtml(landlordName)} invited you to ${escapeHtml(propertyName)}`
    : `You've been invited to join ${escapeHtml(propertyName)}`;
  const intro = landlordName
    ? `<strong>${escapeHtml(landlordName)}</strong> uses Nestora to manage maintenance at <strong>${escapeHtml(propertyName)}</strong> and has invited you to connect as a tenant.`
    : `Your landlord uses Nestora to manage maintenance at <strong>${escapeHtml(propertyName)}</strong> and has invited you to connect as a tenant.`;

  const otpBlock = otpCode
    ? `
            <!-- OTP code block -->
            <div style="margin-top:24px">
              <p style="margin:0 0 10px;font-size:13px;color:#374151;line-height:1.5">Your invitation includes a sign-in code. Enter it on the next screen:</p>
              <div style="background:#f0fdf4;border:2px solid #d1fae5;border-radius:12px;padding:20px;text-align:center">
                <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#6b7280;letter-spacing:0.1em;text-transform:uppercase">Sign-in code</p>
                <p style="margin:0;font-size:40px;font-weight:700;color:#111827;letter-spacing:0.25em;font-family:monospace">${otpCode}</p>
                <p style="margin:8px 0 0;font-size:12px;color:#9ca3af">Expires in 24 hours</p>
              </div>
            </div>`
    : '';

  const linkBlock = magicLink
    ? `
            <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;line-height:1.6">
              Prefer a one-click link?<br>
              <a href="${magicLink}" style="color:${BRAND_COLOR};word-break:break-all">${magicLink}</a>
            </p>`
    : '';

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
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.65">
              Setting up your account takes under two minutes.
            </p>
            <a href="${loginUrl}"
               style="display:inline-block;padding:13px 28px;background:${BRAND_COLOR};color:#ffffff;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;letter-spacing:0.01em">
              Accept Invitation
            </a>
            ${otpBlock}
            ${linkBlock}
          </td>
        </tr>
        ${INSTALL_BLOCK}

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

export async function sendContractorInviteEmail({
  to,
  contractorName,
  landlordName,
  inviteToken,
}: {
  to: string;
  contractorName?: string | null;
  landlordName?: string | null;
  inviteToken: string;
}) {
  const acceptUrl = `${APP_URL}/accept-invite?token=${encodeURIComponent(inviteToken)}`;

  const eyebrow = landlordName ? `Invitation from ${escapeHtml(landlordName)}` : 'You have a new invitation';
  const headline = landlordName
    ? `${escapeHtml(landlordName)} invited you to join their team`
    : "You've been added as a contractor";
  const greeting = contractorName ? `Hi ${escapeHtml(contractorName)},` : 'Hi there,';
  const body = landlordName
    ? `<strong>${escapeHtml(landlordName)}</strong> has added you as a contractor on Nestora. Once you accept, you'll be able to view and manage work orders assigned to you directly from your phone.`
    : `A property manager has added you as a contractor on Nestora. Once you accept, you'll be able to view and manage work orders assigned to you.`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: landlordName
      ? `${landlordName} invited you to join their team on Nestora`
      : "You've been added as a contractor on Nestora",
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

        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 24px">
            <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:${BRAND_COLOR};letter-spacing:0.06em;text-transform:uppercase">${eyebrow}</p>
            <h1 style="margin:0 0 20px;font-size:24px;font-weight:700;color:#111827;line-height:1.25">
              ${headline}
            </h1>
            <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.65">${greeting}</p>
            <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.65">
              ${body}
            </p>
            <a href="${acceptUrl}"
               style="display:inline-block;padding:13px 28px;background:${BRAND_COLOR};color:#ffffff;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;letter-spacing:0.01em">
              Accept Invitation
            </a>
          </td>
        </tr>
        ${INSTALL_BLOCK}

        <!-- Divider -->
        <tr><td style="padding:0 32px"><div style="height:1px;background:#f3f4f6"></div></td></tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px">
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6">
              This invite was sent to ${escapeHtml(to)}. If you weren't expecting this, you can safely ignore it — no account will be created without your action.
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
