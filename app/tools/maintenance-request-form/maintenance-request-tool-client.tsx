'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Building2,
  User,
  Mail,
  Download,
  Copy,
  Camera,
  Clock,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

const CATEGORIES = [
  'Plumbing',
  'Electrical',
  'HVAC',
  'Appliance',
  'Structural',
  'Pest',
  'Other',
] as const;

const URGENCY = ['Emergency', 'Urgent', 'Routine'] as const;

type Mode = 'builder' | 'tenant';

function buildSubject(propertyName: string, category: string, urgency: string) {
  const base = `Maintenance Request — ${propertyName || 'Property'} (${category}`;
  if (urgency === 'Emergency') return `${base}, EMERGENCY)`;
  if (urgency === 'Urgent') return `${base}, URGENT)`;
  return `${base})`;
}

function buildEmailBody(fields: {
  propertyName: string;
  propertyAddress: string;
  tenantName: string;
  unit: string;
  tenantContact: string;
  category: string;
  urgency: string;
  accessTimes: string;
  description: string;
  photoName: string | null;
}) {
  const lines: string[] = ['New maintenance request submitted via Nestora:', '', 'PROPERTY'];
  lines.push(`Property: ${fields.propertyName || '—'}`);
  if (fields.propertyAddress) lines.push(`Address: ${fields.propertyAddress}`);

  lines.push('', 'TENANT', `Name: ${fields.tenantName || '—'}`);
  if (fields.unit) lines.push(`Unit: ${fields.unit}`);
  lines.push(`Contact: ${fields.tenantContact || '—'}`);

  lines.push('', 'ISSUE', `Category: ${fields.category}`, `Urgency: ${fields.urgency}`);
  if (fields.accessTimes) lines.push(`Preferred access: ${fields.accessTimes}`);
  lines.push('Description:', fields.description || '—');

  if (fields.photoName) {
    lines.push(
      '',
      `Note: Attach the photo "${fields.photoName}" to this email before sending — it can't be attached automatically.`
    );
  }

  lines.push('', '—', 'Sent via Nestora · gonestora.app');
  return lines.join('\n');
}

function openMailto(mailto: string) {
  window.location.href = mailto;
}

// Print-only field rendering: browsers commonly paint an empty/disabled input's
// `placeholder` attribute as real text when printing, which can't be reliably
// suppressed with print CSS since it's native control rendering, not decorable
// content. So printed output never touches the actual <input>/<textarea> — it
// renders this parallel, plain-text view instead: real value, or a blank ruled
// line to write on.
function PrintField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-700">{label}</p>
      {value ? (
        <p className="mt-1 text-sm text-gray-900">{value}</p>
      ) : (
        <div className="mt-3 border-b border-gray-400" />
      )}
    </div>
  );
}

function PrintTextArea({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-700">{label}</p>
      {value ? (
        <p className="mt-1 text-sm whitespace-pre-wrap text-gray-900">{value}</p>
      ) : (
        <div className="mt-3 space-y-4">
          <div className="border-b border-gray-400" />
          <div className="border-b border-gray-400" />
          <div className="border-b border-gray-400" />
        </div>
      )}
    </div>
  );
}

function buildShareUrl(fields: {
  propertyName: string;
  propertyAddress: string;
  landlordName: string;
  landlordEmail: string;
}) {
  const params = new URLSearchParams();
  if (fields.propertyName) params.set('p', fields.propertyName);
  if (fields.propertyAddress) params.set('a', fields.propertyAddress);
  if (fields.landlordName) params.set('n', fields.landlordName);
  if (fields.landlordEmail) params.set('e', fields.landlordEmail);
  return params.toString();
}

type ShareState = {
  mode: Mode;
  propertyName: string;
  propertyAddress: string;
  landlordName: string;
  landlordEmail: string;
};

export function MaintenanceRequestToolClient() {
  // Mode + landlord/property fields resolve together from the URL in one shot —
  // kept as a single state object so the mount effect fires exactly one setState
  // call instead of several in a row.
  const [share, setShare] = useState<ShareState | null>(null);

  // Tenant-facing fields (live in the preview; fully interactive in tenant mode).
  const [tenantName, setTenantName] = useState('');
  const [unit, setUnit] = useState('');
  const [tenantContact, setTenantContact] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [urgency, setUrgency] = useState<string>('Routine');
  const [description, setDescription] = useState('');
  const [accessTimes, setAccessTimes] = useState('');
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submittedBody, setSubmittedBody] = useState('');
  const [copied, setCopied] = useState(false);

  // Determine mode from the URL on mount — a shared link carries property/landlord
  // details as query params and switches this same page into tenant-fill mode.
  // window.location isn't available during SSR, so this genuinely can't be computed
  // during render; it has to resolve client-side after mount.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasShareParams = params.has('p') || params.has('n') || params.has('e');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShare({
      mode: hasShareParams ? 'tenant' : 'builder',
      propertyName: params.get('p') ?? '',
      propertyAddress: params.get('a') ?? '',
      landlordName: params.get('n') ?? '',
      landlordEmail: params.get('e') ?? '',
    });
  }, []);

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoName(file.name);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const handleCopyLink = async () => {
    const query = buildShareUrl({ propertyName, propertyAddress, landlordName, landlordEmail });
    const url = `${window.location.origin}${window.location.pathname}${query ? `?${query}` : ''}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied — send it to your tenant.');
    } catch {
      toast.error('Could not copy automatically. Select the link from your address bar instead.');
    }
  };

  const handleDownloadPdf = () => {
    window.print();
  };

  const handleTenantSubmit = (e: FormEvent) => {
    e.preventDefault();
    const subject = buildSubject(propertyName, category, urgency);
    const body = buildEmailBody({
      propertyName,
      propertyAddress,
      tenantName,
      unit,
      tenantContact,
      category,
      urgency,
      accessTimes,
      description,
      photoName,
    });

    const mailto = `mailto:${encodeURIComponent(landlordEmail)}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    setSubmittedBody(body);
    setSubmitted(true);
    openMailto(mailto);
  };

  const handleCopyRequest = async () => {
    try {
      await navigator.clipboard.writeText(submittedBody);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy automatically. Select the text and copy it manually.');
    }
  };

  // Avoid a layout jump while we determine mode from the URL on the client.
  if (share === null) {
    return <div className="h-[600px] w-full animate-pulse rounded-2xl bg-slate-100" />;
  }

  const { mode, propertyName, propertyAddress, landlordName, landlordEmail } = share;
  const isTenant = mode === 'tenant';

  const updateShare = (patch: Partial<Omit<ShareState, 'mode'>>) =>
    setShare((s) => (s ? { ...s, ...patch } : s));

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
      {/* ── Builder form (landlord only) ── */}
      {!isTenant && (
        <div className="print:hidden">
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="mb-1 font-semibold text-gray-900">1. Your property details</h3>
            <p className="mb-5 text-sm text-gray-500">
              This fills in the live preview on the right — nothing is saved or sent anywhere.
            </p>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  Property name
                </label>
                <input
                  type="text"
                  value={propertyName}
                  onChange={(e) => updateShare({ propertyName: e.target.value })}
                  placeholder="e.g., 123 Maple St Duplex"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Property address (optional)
                </label>
                <input
                  type="text"
                  value={propertyAddress}
                  onChange={(e) => updateShare({ propertyAddress: e.target.value })}
                  placeholder="123 Maple St, Unit B, Springfield"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                  <User className="h-4 w-4 text-gray-400" />
                  Your name
                </label>
                <input
                  type="text"
                  value={landlordName}
                  onChange={(e) => updateShare({ landlordName: e.target.value })}
                  placeholder="e.g., Alex Rivera"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                  <Mail className="h-4 w-4 text-gray-400" />
                  Your contact email
                </label>
                <input
                  type="email"
                  value={landlordEmail}
                  onChange={(e) => updateShare({ landlordEmail: e.target.value })}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 focus:outline-none"
                />
                <p className="mt-1.5 text-xs text-gray-400">
                  Completed requests will be addressed to this email when a tenant submits.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-2.5 border-t border-gray-100 pt-5">
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-800"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </button>
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-teal-200 bg-white px-5 py-3 text-sm font-semibold text-teal-700 shadow-sm transition-colors hover:bg-teal-50"
              >
                <Copy className="h-4 w-4" />
                Copy shareable link
              </button>
              <p className="pt-1 text-center text-xs text-gray-400">
                Share the link — no app, no account for your tenant.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Tenant intro banner (tenant mode only) ── */}
      {isTenant && (
        <div className="lg:col-span-2 print:hidden">
          <div className="mb-6 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-800">
            You&rsquo;ve been sent this maintenance request form
            {propertyName ? ` for ${propertyName}` : ''}. Fill it out below — no app or account
            needed.
          </div>
        </div>
      )}

      {/* ── Live preview / tenant form ── */}
      <div className={isTenant ? 'lg:col-span-2 lg:mx-auto lg:max-w-xl' : ''}>
        <div
          id="maintenance-request-preview"
          className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm print:rounded-none print:border-black print:shadow-none"
        >
          <div className="mb-5 border-b border-gray-100 pb-4 print:border-black">
            <p className="text-xs font-semibold tracking-wide text-teal-700 uppercase">
              Maintenance Request Form
            </p>
            <h3 className="mt-1 text-lg font-bold text-gray-900">
              {propertyName || 'Your Property Name'}
            </h3>
            {propertyAddress && <p className="text-sm text-gray-500">{propertyAddress}</p>}
            {landlordName && (
              <p className="mt-1 text-xs text-gray-400">
                Submits to {landlordName}
                {landlordEmail ? ` · ${landlordEmail}` : ''}
              </p>
            )}
          </div>

          {submitted ? (
            <div className="py-6">
              <div className="flex flex-col items-center gap-2 pb-6 text-center">
                <CheckCircle2 className="h-9 w-9 text-teal-600" />
                <p className="font-semibold text-gray-900">Request ready to send</p>
                <p className="max-w-xs text-sm text-gray-500">
                  Your email app should have opened with these details filled in. Attach your photo
                  before sending, if you added one.
                </p>
              </div>

              <div className="rounded-xl border border-gray-100 bg-slate-50 p-4 text-left">
                <p className="text-sm text-gray-600">
                  Didn&rsquo;t your email app open? Copy the request below and send it to your
                  landlord at{' '}
                  <span className="font-medium text-gray-900">
                    {landlordEmail || 'their email'}
                  </span>
                  .
                </p>
                <pre className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 text-xs whitespace-pre-wrap text-gray-700">
                  {submittedBody}
                </pre>
                <button
                  type="button"
                  onClick={handleCopyRequest}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-white px-4 py-2 text-sm font-medium text-teal-700 shadow-sm transition-colors hover:bg-teal-50"
                >
                  <Copy className="h-4 w-4" />
                  {copied ? 'Copied!' : 'Copy to clipboard'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <form onSubmit={handleTenantSubmit} className="space-y-4 print:hidden">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Tenant name
                    </label>
                    <input
                      type="text"
                      required={isTenant}
                      disabled={!isTenant}
                      value={tenantName}
                      onChange={(e) => setTenantName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Unit / apt #
                    </label>
                    <input
                      type="text"
                      disabled={!isTenant}
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="Unit 2B"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Phone or email
                  </label>
                  <input
                    type="text"
                    required={isTenant}
                    disabled={!isTenant}
                    value={tenantContact}
                    onChange={(e) => setTenantContact(e.target.value)}
                    placeholder="How the landlord can reach you"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Issue category
                    </label>
                    <select
                      disabled={!isTenant}
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Urgency
                    </label>
                    <select
                      disabled={!isTenant}
                      value={urgency}
                      onChange={(e) => setUrgency(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                    >
                      {URGENCY.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Describe the issue
                  </label>
                  <textarea
                    required={isTenant}
                    disabled={!isTenant}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="What's wrong, and where?"
                    className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>

                <div className="print:hidden">
                  <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                    <Camera className="h-4 w-4 text-gray-400" />
                    Photo (optional)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={!isTenant}
                    onChange={handlePhotoChange}
                    className="block w-full text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-teal-700 hover:file:bg-teal-100 disabled:opacity-50"
                  />
                  {photoPreview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoPreview}
                      alt="Attached issue"
                      className="mt-2 h-24 w-24 rounded-lg object-cover"
                    />
                  )}
                </div>

                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                    <Clock className="h-4 w-4 text-gray-400" />
                    Preferred access times
                  </label>
                  <input
                    type="text"
                    disabled={!isTenant}
                    value={accessTimes}
                    onChange={(e) => setAccessTimes(e.target.value)}
                    placeholder="Weekdays after 5pm, or anytime with 1 hour notice"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>

                <div className="pt-2 print:hidden">
                  {isTenant ? (
                    <button
                      type="submit"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-800"
                    >
                      Send request
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-center text-xs text-gray-400">
                      Live preview — this is what your tenant fills out from the shared link.
                    </div>
                  )}
                </div>
              </form>

              {/* Print-only static view — see PrintField/PrintTextArea comment above. */}
              <div className="hidden print:block print:space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <PrintField label="Tenant name" value={tenantName} />
                  <PrintField label="Unit / apt #" value={unit} />
                </div>
                <PrintField label="Phone or email" value={tenantContact} />
                <div className="grid grid-cols-2 gap-4">
                  <PrintField label="Issue category" value={category} />
                  <PrintField label="Urgency" value={urgency} />
                </div>
                <PrintTextArea label="Describe the issue" value={description} />
                <PrintField label="Preferred access times" value={accessTimes} />
              </div>
            </>
          )}
        </div>

        {isTenant && (
          <p className="mt-4 text-center text-xs text-gray-400 print:hidden">
            Powered by{' '}
            <Link href="/landing" className="text-teal-700 underline underline-offset-2">
              Nestora
            </Link>{' '}
            — free maintenance request tool.
          </p>
        )}
      </div>
    </div>
  );
}
