// Shared, small brand-touchpoint footer appended to every system email — a
// soft growth-loop signal for recipients (often contractors/tenants) who
// aren't Nestora customers yet.
const BRAND_TEAL = '#0F766E';

function footerRow(tagline: string) {
  return `
        <tr>
          <td style="padding:16px 32px 24px;text-align:center">
            <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6">
              Sent via <a href="https://gonestora.app" style="color:${BRAND_TEAL};text-decoration:none;font-weight:600">Nestora</a> — ${tagline}<br>
              <a href="https://gonestora.app" style="color:${BRAND_TEAL};text-decoration:none">gonestora.app</a>
            </p>
          </td>
        </tr>`;
}

export const BRAND_FOOTER = footerRow('simple maintenance management for landlords.');
export const BRAND_FOOTER_CONTRACTOR = footerRow('the easy way for landlords to send you work.');
