'use server';

import { createClient } from '@/lib/supabase/server';

const FROM = 'Nestora <noreply@gonestora.app>';
const SUPPORT_TO = 'support@gonestora.app';
const BRAND_COLOR = '#0F766E';

async function sendSupportNotification(opts: {
  userEmail: string;
  userRole: string | null;
  subject: string;
  message: string;
}) {
  if (!process.env.RESEND_API_KEY) return;
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const roleLabel = opts.userRole
      ? opts.userRole.charAt(0).toUpperCase() + opts.userRole.slice(1)
      : 'Unknown';

    const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0fdf4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #d1fae5;overflow:hidden">
        <tr>
          <td style="background:${BRAND_COLOR};padding:20px 32px">
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.02em">Nestora</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 24px">
            <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:${BRAND_COLOR};letter-spacing:0.06em;text-transform:uppercase">New Support Ticket</p>
            <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#111827;line-height:1.3">${opts.subject.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h1>
            <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px;background:#f9fafb;border-radius:8px;border:1px solid #f3f4f6">
              <tr>
                <td style="padding:12px 16px 6px">
                  <table cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="padding:4px 16px 4px 0;font-size:13px;color:#6b7280;white-space:nowrap">From</td>
                      <td style="padding:4px 0;font-size:13px;color:#111827;font-weight:500">${opts.userEmail.replace(/</g, '&lt;')}</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 16px 4px 0;font-size:13px;color:#6b7280;white-space:nowrap">Role</td>
                      <td style="padding:4px 0;font-size:13px;color:#111827;font-weight:500">${roleLabel}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr><td style="padding:0 16px"><div style="height:1px;background:#f3f4f6"></div></td></tr>
              <tr>
                <td style="padding:12px 16px;font-size:14px;color:#374151;line-height:1.65;white-space:pre-wrap">${opts.message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
              </tr>
            </table>
            <p style="margin:0;font-size:13px;color:#6b7280">Reply directly to this email to respond to the user.</p>
          </td>
        </tr>
        <tr><td style="padding:0 32px"><div style="height:1px;background:#f3f4f6"></div></td></tr>
        <tr>
          <td style="padding:20px 32px">
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6">
              Submitted via the Nestora in-app support form.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

    await resend.emails.send({
      from: FROM,
      to: SUPPORT_TO,
      replyTo: opts.userEmail,
      subject: `[Support] ${opts.subject}`,
      html,
    });
  } catch (err) {
    // Non-fatal — ticket is already saved; don't fail the user-facing action
    console.error('[submitSupportTicket] email send failed:', err);
  }
}

export async function submitSupportTicket(data: {
  subject: string;
  message: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'You must be signed in to send a message.' };

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const { error } = await supabase.from('support_tickets').insert({
      user_id: user.id,
      user_email: user.email ?? '',
      user_role: profile?.role ?? null,
      subject: data.subject,
      message: data.message,
    });

    if (error) {
      console.error('[submitSupportTicket]', error);
      return { success: false, error: 'Failed to send your message. Please try again.' };
    }

    // Fire-and-forget — ticket is in DB regardless of email outcome
    await sendSupportNotification({
      userEmail: user.email ?? '',
      userRole: profile?.role ?? null,
      subject: data.subject,
      message: data.message,
    });

    return { success: true };
  } catch (err) {
    console.error('[submitSupportTicket] unexpected error:', err);
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
}
