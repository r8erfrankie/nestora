import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Building2, MessageSquare } from 'lucide-react';
import { timeAgo } from '@/lib/utils';
import { RequestThread } from '@/app/components/request-thread';
import { addTenantMaintenanceNote, type MaintenanceNote } from '@/app/actions/maintenance-note-actions';
import { WithdrawButton } from './withdraw-button';

export const metadata = { title: 'Request Details' };

const STATUS_STYLES: Record<string, string> = {
  Submitted:     'bg-secondary text-secondary-foreground',
  'In Progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  Resolved:      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  Withdrawn:     'bg-secondary text-muted-foreground',
  Declined:    'bg-destructive/10 text-destructive',
};

const PRIORITY_STYLES: Record<string, string> = {
  Low:    'bg-secondary text-secondary-foreground',
  Medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  High:   'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  Urgent: 'bg-destructive/10 text-destructive',
};

function Pill({ label, style }: { label: string; style: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'tenant') redirect('/');

  // RLS "Tenant views own requests" (tenant_id = auth.uid()) enforces ownership.
  const { data: request } = await supabase
    .from('maintenance_requests')
    .select('id, property_id, title, description, category, priority, status, created_at')
    .eq('id', id)
    .single();

  if (!request) notFound();

  // Fetch photos (RLS also enforces tenant ownership via request_id join).
  const { data: photos } = await supabase
    .from('maintenance_request_photos')
    .select('id, url, name')
    .eq('request_id', id)
    .order('created_at', { ascending: true });

  // Property name + manual notes via admin — tenant RLS blocks direct access.
  const admin = createAdminClient();
  const [{ data: property }, { data: rawNotes }] = await Promise.all([
    admin.from('properties').select('name, address').eq('id', request.property_id).single(),
    admin
      .from('maintenance_request_notes')
      .select('id, request_id, author_email, author_role, note_type, content, created_at')
      .eq('request_id', id)
      .eq('note_type', 'manual')
      .order('created_at', { ascending: true }),
  ]);

  const notes = (rawNotes ?? []) as MaintenanceNote[];

  const statusStyle = STATUS_STYLES[request.status] ?? STATUS_STYLES['Submitted'];
  const priorityStyle = PRIORITY_STYLES[request.priority] ?? PRIORITY_STYLES['Medium'];

  return (
    <div className="max-w-2xl space-y-4 sm:space-y-6">
      {/* Back */}
      <Link
        href="/tenant"
        className="text-muted-foreground inline-flex items-center gap-1.5 text-sm transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Dashboard
      </Link>

      {/* Header */}
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{request.title}</h1>
          <Pill label={request.status} style={statusStyle} />
        </div>
        <p className="text-muted-foreground text-sm">
          Submitted {timeAgo(request.created_at)}
        </p>
      </div>

      {/* Meta */}
      <div className="rounded-lg border divide-y">
        <Row label="Property">
          <div className="flex items-center gap-2">
            <Building2 className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
            <span>
              {property?.name ?? 'Property'}
              {property?.address && (
                <span className="text-muted-foreground"> · {property.address}</span>
              )}
            </span>
          </div>
        </Row>
        <Row label="Priority">
          <Pill label={request.priority} style={priorityStyle} />
        </Row>
        {request.category && (
          <Row label="Category">
            <span>{request.category}</span>
          </Row>
        )}
      </div>

      {/* Withdraw — only available while still Submitted */}
      {request.status === 'Submitted' && (
        <WithdrawButton requestId={id} />
      )}

      {/* Description */}
      {request.description && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Description</p>
          <p className="text-muted-foreground whitespace-pre-wrap text-sm">{request.description}</p>
        </div>
      )}

      {/* Photos */}
      {photos && photos.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Photos</p>
          <div className="flex flex-wrap gap-3">
            {photos.map((photo) => (
              <a
                key={photo.id}
                href={photo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative h-24 w-24 overflow-hidden rounded-lg border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.name ?? 'Photo'}
                  className="h-full w-full object-cover transition-opacity group-hover:opacity-90"
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Conversation thread with landlord */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <MessageSquare className="text-muted-foreground h-3.5 w-3.5" />
          <p className="text-sm font-medium">Messages</p>
        </div>
        <RequestThread
          initialNotes={notes}
          viewerRole="tenant"
          placeholder="Reply to your landlord… (⌘↵ to send)"
          onSend={async (content) => {
            'use server';
            return addTenantMaintenanceNote(id, content);
          }}
        />
      </div>

      <Button asChild variant="outline" size="sm">
        <Link href="/tenant">Back to Dashboard</Link>
      </Button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 text-sm">
      <span className="text-muted-foreground w-24 shrink-0">{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}
