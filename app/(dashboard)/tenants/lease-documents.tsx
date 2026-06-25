'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FileText, Trash2, Upload, Loader2, ExternalLink } from 'lucide-react';
import { saveLeaseDocument, deleteLeaseDocument, type LeaseDocument } from './lease-actions';

const MAX_MB = 20;

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LeaseDocuments({
  linkId,
  initialDocs,
}: {
  linkId: string;
  initialDocs: LeaseDocument[];
}) {
  const supabase = createClient();
  const [docs, setDocs] = useState<LeaseDocument[]>(initialDocs);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.includes('pdf')) {
      setUploadError('Only PDF files are supported.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setUploadError(`File must be under ${MAX_MB} MB.`);
      return;
    }

    setUploadError('');
    setUploading(true);

    try {
      const ext = file.name.split('.').pop() ?? 'pdf';
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${linkId}/${Date.now()}-${safeName}`;

      const { error: storageError } = await supabase.storage
        .from('lease-documents')
        .upload(path, file, { contentType: 'application/pdf', upsert: false });

      if (storageError) throw new Error(storageError.message);

      const { data: urlData } = supabase.storage
        .from('lease-documents')
        .getPublicUrl(path);

      const saved = await saveLeaseDocument({
        linkId,
        name: file.name,
        url: urlData.publicUrl,
        size: file.size,
      });

      setDocs((prev) => [...prev, saved]);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: LeaseDocument) => {
    if (deletingId) return;
    setDeletingId(doc.id);
    try {
      await deleteLeaseDocument(doc.id);
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } catch {
      alert('Failed to delete document.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-2 border-t pt-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Documents
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {uploading ? 'Uploading…' : 'Upload PDF'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {uploadError && (
        <p className="text-xs text-destructive">{uploadError}</p>
      )}

      {docs.length === 0 && !uploading && (
        <p className="text-muted-foreground/60 text-xs">No documents uploaded yet.</p>
      )}

      {docs.length > 0 && (
        <div className="space-y-1.5">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2"
            >
              <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{doc.name}</p>
                {doc.size && (
                  <p className="text-muted-foreground text-xs">{formatSize(doc.size)}</p>
                )}
              </div>
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Open"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <button
                type="button"
                onClick={() => handleDelete(doc)}
                disabled={deletingId === doc.id}
                className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                title="Delete"
              >
                {deletingId === doc.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
