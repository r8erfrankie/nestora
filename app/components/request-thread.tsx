'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { timeAgo } from '@/lib/utils';
import { Loader2, Send } from 'lucide-react';
import { type MaintenanceNote } from '@/app/actions/maintenance-note-actions';

interface Props {
  initialNotes: MaintenanceNote[];
  onSend: (content: string) => Promise<MaintenanceNote>;
  viewerRole: 'landlord' | 'tenant';
  placeholder?: string;
}

export function RequestThread({ initialNotes, onSend, viewerRole, placeholder }: Props) {
  const [notes, setNotes] = useState<MaintenanceNote[]>(initialNotes);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSend = async () => {
    const trimmed = draft.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    const tempId = `__tmp__${Date.now()}`;
    const optimistic: MaintenanceNote = {
      id: tempId,
      request_id: notes[0]?.request_id ?? '',
      author_email: '',
      author_role: viewerRole,
      note_type: 'manual',
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setNotes((prev) => [...prev, optimistic]);
    setDraft('');

    try {
      const saved = await onSend(trimmed);
      setNotes((prev) => prev.map((n) => (n.id === tempId ? saved : n)));
    } catch {
      setNotes((prev) => prev.filter((n) => n.id !== tempId));
      setDraft(trimmed);
      alert('Failed to send. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const manualNotes = notes.filter((n) => n.note_type === 'manual');

  return (
    <div className="space-y-3">
      {manualNotes.length > 0 && (
        <div className="space-y-2">
          {manualNotes.map((note) => {
            const isOwn = note.author_role === viewerRole;
            return (
              <div
                key={note.id}
                className={`rounded-lg border px-3 py-2.5 ${
                  isOwn ? 'bg-card' : 'bg-muted/40'
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-muted-foreground capitalize">
                    {note.author_role === 'landlord' ? 'Landlord' : 'Tenant'}
                  </span>
                  <span className="text-[11px] text-muted-foreground/60">
                    {timeAgo(note.created_at)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm">{note.content}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-1.5">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder ?? 'Write a reply… (⌘↵ to send)'}
          className="min-h-[64px] resize-none text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend();
          }}
        />
        <Button
          size="sm"
          className="w-full gap-2"
          onClick={handleSend}
          disabled={!draft.trim() || submitting}
        >
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          Send
        </Button>
      </div>
    </div>
  );
}
