'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronDown, ExternalLink, Mail, MessageSquare } from 'lucide-react';
import { submitSupportTicket } from './support-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── FAQ data ──────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    id: 'add-tenant',
    question: 'How do I add a new tenant?',
    answer:
      'Go to the Tenants page and click "Add Tenant". Enter the tenant\'s email address and assign them to one of your properties. They\'ll receive an invitation email with a link to set up their account. You can also share your property\'s unique join code so tenants can self-request access.',
  },
  {
    id: 'tenant-request',
    question: 'How does a tenant submit a maintenance request?',
    answer:
      'Once a tenant has an approved account, they can log in and navigate to their dashboard. From there, they can submit a new maintenance request by filling in the title, description, category, and priority. You\'ll be notified when they submit one, and it will appear in your Tenants section.',
  },
  {
    id: 'request-statuses',
    question: 'What do the different request statuses mean?',
    answer:
      'Submitted — the tenant just sent it and it\'s waiting for your review. In Progress — you\'ve converted it into a work order and a contractor is handling it. Resolved — the work is done and you\'ve marked it complete. Declined — you\'ve reviewed the request and decided not to act on it.',
  },
  {
    id: 'convert-request',
    question: 'How do I convert a maintenance request into a work order?',
    answer:
      'Open the Tenants page and find the maintenance request. Click into it and select "Convert to Work Order". A new work order is created pre-filled with the request details. You can then assign it to a contractor, set a priority and due date, and track it through completion.',
  },
  {
    id: 'invite-contractor',
    question: 'How do I invite a contractor?',
    answer:
      'Go to Teams in the sidebar and click "Add Contractor". Enter their name, email, trade, and an optional phone number. They\'ll receive an invitation email with a link to create their account. Once registered, you can assign them to work orders directly.',
  },
  {
    id: 'see-activity',
    question: 'Where can I see all activity on my properties?',
    answer:
      'Your Dashboard shows a Recent Activity feed with the latest work order updates across all your properties. For a full history, go to Work Orders and use the filters to narrow by property, status, or date. The Tenants page shows all maintenance requests by property.',
  },
] as const;

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

export function SupportSection() {
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
        <div className="rounded-xl border border-gray-100 bg-white px-4 shadow-sm">
          {FAQ_ITEMS.map((item) => (
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
