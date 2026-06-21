'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/utils';
import { Activity, Pencil, Loader2, Send } from 'lucide-react';
import { addManualNote, updateManualNote, type WorkOrderNote } from '@/app/actions/note-actions';

interface WorkOrderNotesProps {
  workOrderId: string;
  // Optional: bump this to force a reload (e.g. after a parent action logs a system note)
  refreshKey?: number;
  // Hide budget-related system notes (landlord-only info — never shown to contractors)
  hideBudgetNotes?: boolean;
}

export function WorkOrderNotes({ workOrderId, refreshKey = 0, hideBudgetNotes = false }: WorkOrderNotesProps) {
  const supabase = createClient();

  const [notes, setNotes] = useState<WorkOrderNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // New note
  const [newNote, setNewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Edit existing note
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Resolve current user once
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserEmail(user?.email?.toLowerCase() ?? null);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load notes whenever workOrderId or refreshKey changes
  useEffect(() => {
    if (!workOrderId) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from('work_order_notes')
      .select('*')
      .eq('work_order_id', workOrderId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!cancelled) {
          setNotes((data ?? []) as WorkOrderNote[]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrderId, refreshKey]);

  const handleSubmit = async () => {
    const trimmed = newNote.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    // Optimistic placeholder
    const tempId = `__tmp__${Date.now()}`;
    const optimistic: WorkOrderNote = {
      id: tempId,
      work_order_id: workOrderId,
      author_email: currentUserEmail ?? '',
      author_role: 'landlord', // will be replaced with real data from server
      note_type: 'manual',
      content: trimmed,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setNotes((prev) => [...prev, optimistic]);
    setNewNote('');

    try {
      const saved = await addManualNote(workOrderId, trimmed);
      setNotes((prev) => prev.map((n) => (n.id === tempId ? saved : n)));
    } catch {
      setNotes((prev) => prev.filter((n) => n.id !== tempId));
      setNewNote(trimmed);
      alert('Failed to save note.');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (note: WorkOrderNote) => {
    setEditingId(note.id);
    setEditText(note.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const handleSaveEdit = async () => {
    if (!editingId || saving) return;
    const trimmed = editText.trim();
    if (!trimmed) return;

    setSaving(true);
    const originalContent = notes.find((n) => n.id === editingId)?.content;
    // Optimistic update
    setNotes((prev) =>
      prev.map((n) =>
        n.id === editingId ? { ...n, content: trimmed, updated_at: new Date().toISOString() } : n
      )
    );
    setEditingId(null);

    try {
      await updateManualNote(editingId, trimmed);
    } catch {
      // Revert
      if (originalContent !== undefined) {
        setNotes((prev) =>
          prev.map((n) => (n.id === editingId ? { ...n, content: originalContent } : n))
        );
      }
      alert('Failed to update note.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Activity
      </div>

      {/* Note list */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-7 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">
          No activity yet.
        </div>
      ) : (
        <div className="space-y-1.5">
          {notes.filter((note) =>
            !(hideBudgetNotes && note.note_type === 'system' && note.content.startsWith('Budget'))
          ).map((note) => {
            const isOwn =
              currentUserEmail !== null &&
              note.author_email.toLowerCase() === currentUserEmail;
            const isEditing = editingId === note.id;

            if (note.note_type === 'system') {
              return (
                <div
                  key={note.id}
                  className="flex items-start gap-2 py-1 text-xs text-muted-foreground"
                >
                  <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />
                  <div className="min-w-0 flex-1 leading-relaxed">
                    {note.content}
                    <span className="ml-1 text-muted-foreground/50">
                      · {timeAgo(note.created_at)}
                    </span>
                  </div>
                </div>
              );
            }

            // Manual note
            return (
              <div key={note.id} className="rounded-lg border bg-card px-3 py-2.5">
                {isEditing ? (
                  <div className="space-y-1.5">
                    <Textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="min-h-[60px] resize-none text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveEdit();
                        if (e.key === 'Escape') cancelEdit();
                      }}
                    />
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={handleSaveEdit}
                        disabled={saving || !editText.trim()}
                      >
                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={cancelEdit}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {note.author_role === 'contractor' ? 'Contractor' : 'Owner'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-muted-foreground/60">
                          {timeAgo(note.created_at)}
                          {note.updated_at !== note.created_at && ' · edited'}
                        </span>
                        {isOwn && (
                          <button
                            type="button"
                            onClick={() => startEdit(note)}
                            className="text-muted-foreground/60 transition-colors hover:text-foreground"
                            aria-label="Edit note"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{note.content}</p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add a new note */}
      <div className="mt-3 space-y-1.5">
        <Textarea
          ref={textareaRef}
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note… (⌘↵ to send)"
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
          Add Note
        </Button>
      </div>
    </div>
  );
}
