'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronDown, ExternalLink, Mail, MessageSquare } from 'lucide-react';
import { submitSupportTicket } from './support-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── FAQ data — one array per role ─────────────────────────────────────────────
// To update content: edit the relevant array below. The rendering logic
// automatically picks the right set based on the user's role prop.

const LANDLORD_FAQ = [
  {
    id: 'll-add-tenant',
    question: 'How do I add a new tenant?',
    answer:
      'Go to the Tenants page and click "Add Tenant". Enter the tenant\'s email address and assign them to one of your properties. They\'ll receive an invitation email with a link to set up their account. You can also share your property\'s unique join code so tenants can self-request access.',
  },
  {
    id: 'll-tenant-request',
    question: 'How does a tenant submit a maintenance request?',
    answer:
      'Once a tenant has an approved account, they can log in and submit a new maintenance request from their dashboard. You\'ll be notified when they submit one, and it will appear in your Tenants section.',
  },
  {
    id: 'll-statuses',
    question: 'What do the different request statuses mean?',
    answer:
      'Submitted — waiting for your review. In Progress — converted into a work order and being handled. Resolved — work is complete. Declined — reviewed but not actioned.',
  },
  {
    id: 'll-convert',
    question: 'How do I convert a maintenance request into a work order?',
    answer:
      'Open the Tenants page, find the maintenance request, and select "Convert to Work Order". A new work order is created pre-filled with the request details. You can then assign a contractor, set a priority, and track it through to completion.',
  },
  {
    id: 'll-invite-contractor',
    question: 'How do I invite a contractor?',
    answer:
      'Go to Teams in the sidebar and click "Add Contractor". Enter their name, email, trade, and an optional phone number. They\'ll receive an invitation email with a link to create their account. Once registered, you can assign them to work orders directly.',
  },
  {
    id: 'll-activity',
    question: 'Where can I see all activity on my properties?',
    answer:
      'Your Dashboard shows a Recent Activity feed with the latest work order updates. For a full history, go to Work Orders and use the filters to narrow by property, status, or date.',
  },
] as const;

const TENANT_FAQ = [
  {
    id: 'tn-submit',
    question: 'How do I submit a maintenance request?',
    answer:
      'From your dashboard, click "New Request" and fill in the title, description, category, and priority. Your landlord will be notified immediately and can review it from their Tenants page.',
  },
  {
    id: 'tn-status',
    question: 'How do I check the status of my request?',
    answer:
      'Go to your dashboard and look at the Maintenance Requests section. Each request shows its current status: Submitted, In Progress, Resolved, or Declined. You\'ll also see any notes added by your landlord.',
  },
  {
    id: 'tn-what-happens',
    question: 'What happens after I submit a maintenance request?',
    answer:
      'Your landlord reviews the request and can convert it into a work order, assigning a contractor to handle the repair. The status will update as the work progresses. You can check back at any time to see where things stand.',
  },
  {
    id: 'tn-statuses',
    question: 'What do the different statuses mean?',
    answer:
      'Submitted — your landlord hasn\'t reviewed it yet. In Progress — a contractor has been assigned and the work is underway. Resolved — the issue has been fixed. Declined — your landlord reviewed the request but decided not to action it.',
  },
  {
    id: 'tn-profile',
    question: 'How do I update my contact or emergency contact information?',
    answer:
      'Go to Settings (your profile icon in the sidebar). You can update your phone number and emergency contact details there. Changes are saved immediately when you click "Save changes".',
  },
  {
    id: 'tn-join',
    question: 'How do I join a property?',
    answer:
      'Your landlord can invite you by email, or they can share a join code for the property. Visit the join page, enter the code, and your request will be sent to your landlord for approval. Once approved, the property will appear in your dashboard.',
  },
] as const;

const CONTRACTOR_FAQ = [
  {
    id: 'co-see-orders',
    question: 'How do I see the work orders assigned to me?',
    answer:
      'Log in and go to your dashboard — all work orders assigned to you are listed there. Each card shows the property address, unit, priority, and due date so you can plan your schedule.',
  },
  {
    id: 'co-update-status',
    question: 'How do I update the status of a work order?',
    answer:
      'Open the work order from your dashboard and use the status dropdown to move it from Open to In Progress or Completed. The landlord is notified automatically when you mark a job complete.',
  },
  {
    id: 'co-notes-photos',
    question: 'How do I add notes or photos to a work order?',
    answer:
      'Open the work order and scroll to the Notes or Photos section. You can type a note and attach photos directly from your phone or computer. These are visible to the landlord and help document the work done.',
  },
  {
    id: 'co-reassign',
    question: 'What happens if a work order is reassigned?',
    answer:
      'If the landlord reassigns a work order to another contractor, it will disappear from your dashboard and you\'ll receive an email notification. Any notes or photos you added are retained.',
  },
  {
    id: 'co-profile',
    question: 'How do I update my contact information or trade?',
    answer:
      'Go to Settings from the sidebar. You can update your name, phone number, company name, and trade there. Keep your phone number current so landlords can reach you about jobs.',
  },
  {
    id: 'co-questions',
    question: 'Who do I contact with questions about a specific job?',
    answer:
      'Reach out to the landlord who assigned the work order directly. Their contact details are shown on the work order page. If you have a platform issue, use the Contact Support form below.',
  },
] as const;

type FaqItem = { id: string; question: string; answer: string };

function getFaqItems(role: string | null): ReadonlyArray<FaqItem> | null {
  if (role === 'landlord') return LANDLORD_FAQ;
  if (role === 'tenant')   return TENANT_FAQ;
  if (role === 'contractor') return CONTRACTOR_FAQ;
  return null;
}

// ── Accordion item ─────────────────────────────────────────────────────────────

function AccordionItem({
  id,
  question,
  answer,
  isOpen,
  onToggle,
}: {
  id: string;
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between gap-4 py-4 text-left transition-colors hover:text-gray-900"
        aria-expanded={isOpen}
      >
        <span className={cn('text-sm font-medium', isOpen ? 'text-gray-900' : 'text-gray-700')}>
          {question}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all duration-200 ease-in-out',
          isOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <p className="pb-4 text-sm leading-relaxed text-gray-500">{answer}</p>
      </div>
    </div>
  );
}

// ── Quick resources ────────────────────────────────────────────────────────────

const RESOURCES = [
  { label: 'Getting started guide', href: '#' },
  { label: 'Video walkthrough', href: '#' },
  { label: 'Report a bug', href: '#' },
] as const;

// ── Main component ─────────────────────────────────────────────────────────────

export function SupportSection({ role }: { role: string | null }) {
  const faqItems = getFaqItems(role);

  // Multiple accordion items can be open simultaneously.
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Contact form state
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setSending(true);
    setFormError('');

    const result = await submitSupportTicket({ subject: subject.trim(), message: message.trim() });
    setSending(false);

    if (result.success) {
      toast.success('Message sent!');
      setSubject('');
      setMessage('');
      setSubmitted(true);
    } else {
      setFormError(result.error);
      toast.error(result.error);
    }
  };

  return (
    <div className="space-y-8 pt-2">

      {/* Section heading */}
      <div>
        <h2 className="text-base font-semibold text-gray-900">Support</h2>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Find answers or get in touch with the Nestora team.
        </p>
      </div>

      {/* ── Help & FAQ ── */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 pb-1">
          <MessageSquare className="h-3.5 w-3.5 text-teal-700" />
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
            Help &amp; FAQ
          </p>
        </div>
        {faqItems === null ? (
          <div className="rounded-xl border border-gray-100 bg-white px-4 py-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Complete your profile to see role-specific help topics.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-100 bg-white px-4 shadow-sm">
            {faqItems.map((item) => (
              <AccordionItem
                key={item.id}
                id={item.id}
                question={item.question}
                answer={item.answer}
                isOpen={openItems.has(item.id)}
                onToggle={toggle}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Contact Support ── */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 pb-1">
          <Mail className="h-3.5 w-3.5 text-teal-700" />
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
            Contact Support
          </p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-3 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50">
                <CheckCircle2 className="h-5 w-5 text-teal-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Your message has been sent.</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  We&apos;ll reply within 24–48 hours on business days.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="text-xs font-medium text-teal-700 underline-offset-4 hover:underline"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="support-subject" className="block text-sm font-medium text-gray-700">
                  Subject
                </label>
                <Input
                  id="support-subject"
                  placeholder="e.g. Problem with work order assignment"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={sending}
                  className="max-w-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="support-message" className="block text-sm font-medium text-gray-700">
                  Message
                </label>
                <Textarea
                  id="support-message"
                  placeholder="Describe your issue or question in as much detail as you can…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={sending}
                  rows={4}
                  className="resize-none"
                />
              </div>

              {formError && (
                <p className="text-xs text-red-600">{formError}</p>
              )}

              <div className="flex items-center gap-4">
                <Button
                  type="submit"
                  disabled={sending || !subject.trim() || !message.trim()}
                  className="bg-teal-700 text-white hover:bg-teal-800"
                >
                  {sending ? 'Sending…' : 'Send message'}
                </Button>
                <p className="text-xs text-gray-400">
                  We usually reply within 24–48 hours on business days.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ── Quick Resources ── */}
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 pb-1">
          Quick Resources
        </p>
        <div className="rounded-xl border border-gray-100 bg-white px-4 shadow-sm">
          {RESOURCES.map((r, i) => (
            <a
              key={r.label}
              href={r.href}
              className={cn(
                'flex items-center justify-between py-3.5 text-sm text-gray-700 transition-colors hover:text-teal-700',
                i < RESOURCES.length - 1 && 'border-b border-gray-50'
              )}
            >
              {r.label}
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-300" />
            </a>
          ))}
        </div>
      </div>

    </div>
  );
}
