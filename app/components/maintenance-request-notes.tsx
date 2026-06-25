'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Activity } from 'lucide-react';
import { timeAgo } from '@/lib/utils';
import { RequestThread } from './request-thread';
import { addMaintenanceNote, type MaintenanceNote } from '@/app/actions/maintenance-note-actions';

export function MaintenanceRequestNotes({ requestId }: { requestId: string }) {
  const supabase = createClient();
  const [notes, setNotes] = useState<MaintenanceNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requestId) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from('maintenance_request_notes')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!cancelled) {
          setNotes((data ?? []) as MaintenanceNote[]);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  const systemNotes = notes.filter((n) => n.note_type === 'system');
  const manualNotes = notes.filter((n) => n.note_type === 'manual');

  const handleSend = async (content: string): Promise<MaintenanceNote> => {
    const saved = await addMaintenanceNote(requestId, content);
    setNotes((prev) => [...prev, saved]);
    return saved;
  };

  return (
    <div className="space-y-3 border-t pt-4">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        Messages
      </p>

      {/* System activity notes (internal only) */}
      {systemNotes.length > 0 && (
        <div className="space-y-1.5">
          {systemNotes.map((note) => (
            <div key={note.id} className="flex items-start gap-2 text-xs text-muted-foreground">
              <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />
              <span className="leading-relaxed">
                {note.content}
                <span className="ml-1 text-muted-foreground/50">· {timeAgo(note.created_at)}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-6 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : (
        <RequestThread
          initialNotes={manualNotes}
          viewerRole="landlord"
          placeholder="Write a message to the tenant… (⌘↵ to send)"
          onSend={handleSend}
        />
      )}
    </div>
  );
}
