'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { timeAgo } from '@/lib/utils';
import { Activity, Loader2, Send } from 'lucide-react';
import { addMaintenanceNote, type MaintenanceNote } from '@/app/actions/maintenance-note-actions';

export function MaintenanceRequestNotes({ requestId }: { requestId: string }) {
  const supabase = createClient();
  const [notes, setNotes] = useState<MaintenanceNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleSubmit = async () => {
    const trimmed = newNote.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    const tempId = `__tmp__${Date.now()}`;
    const optimistic: MaintenanceNote = {
      id: tempId,
      request_id: requestId,
      author_email: '',
      author_role: 'landlord',
      note_type: 'manual',
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setNotes((prev) => [...prev, optimistic]);
    setNewNote('');

    try {
      const saved = await addMaintenanceNote(requestId, trimmed);
      setNotes((prev) => prev.map((n) => (n.id === tempId ? saved : n)));
    } catch {
      setNotes((prev) => prev.filter((n) => n.id !== tempId));
      setNewNote(trimmed);
      alert('Failed to save note.');
    } finally {
      setSubmitting(false);
    }
  };

  const manualNotes = notes.filter((n) => n.note_type === 'manual');
  const systemNotes = notes.filter((n) => n.note_type === 'system');

  return (
    <div className="space-y-3 border-t pt-4">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        Notes to Tenant
      </p>

      {loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-6 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {/* System notes (internal activity) */}
          {systemNotes.map((note) => (
            <div key={note.id} className="flex items-start gap-2 text-xs text-muted-foreground">
              <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />
              <span className="leading-relaxed">
                {note.content}
                <span className="ml-1 text-muted-foreground/50">· {timeAgo(note.created_at)}</span>
              </span>
            </div>
          ))}

          {/* Manual notes visible to tenant */}
          {manualNotes.map((note) => (
            <div key={note.id} className="rounded-lg border bg-card px-3 py-2.5">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Note to tenant
                </span>
                <span className="text-[11px] text-muted-foreground/60">
                  {timeAgo(note.created_at)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{note.content}</p>
            </div>
          ))}

          {manualNotes.length === 0 && systemNotes.length === 0 && (
            <p className="text-muted-foreground/60 text-xs">No notes yet.</p>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Textarea
          ref={textareaRef}
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Write a note to the tenant… (⌘↵ to send)"
          className="min-h-[64px] resize-none text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
          }}
        />
        <Button
          size="sm"
          className="w-full gap-2"
          onClick={handleSubmit}
          disabled={!newNote.trim() || submitting}
        >
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          Send Note
        </Button>
      </div>
    </div>
  );
}
