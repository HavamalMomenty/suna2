'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { createClient } from '@/lib/supabase/client';
import { 
  KnowledgeBaseEntry, 
  KnowledgeBaseListResponse, 
  createKbEntry, 
  deleteKbEntry, 
  getKbEntry, 
  listKbEntries, 
  updateKbEntry,
  getThreads,
  Thread
} from '@/lib/api';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadId?: string;
};

type Mode = 'list' | 'edit';

export default function KnowledgeBaseModal({ open, onOpenChange, threadId }: Props) {
  const [mode, setMode] = useState<Mode>('list');
  const [entries, setEntries] = useState<KnowledgeBaseEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [effectiveThreadId, setEffectiveThreadId] = useState<string | null>(threadId ?? null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState<boolean>(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');

  const supabase = useMemo(() => createClient(), []);

  const loadDefaultThread = useCallback(async (): Promise<string | null> => {
    try {
      const threads: Thread[] = await getThreads();
      if (threads && threads.length > 0) {
        // Choose the most recently updated thread
        const sorted = [...threads].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        return sorted[0].thread_id;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const loadEntries = useCallback(async (tid: string) => {
    setLoading(true);
    setError(null);
    try {
      const res: KnowledgeBaseListResponse = await listKbEntries(tid, false);
      setEntries(res.entries || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load knowledge base');
    } finally {
      setLoading(false);
    }
  }, []);

  const resetForm = () => {
    setName('');
    setDescription('');
    setContent('');
    setSelectedEntryId(null);
  };

  const beginCreate = () => {
    resetForm();
    setMode('edit');
  };

  const beginEdit = async (entryId: string) => {
    try {
      setSaving(true);
      const entry = await getKbEntry(entryId);
      setSelectedEntryId(entry.entry_id);
      setName(entry.name);
      setDescription(entry.description || '');
      setContent(entry.content);
      setMode('edit');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load entry');
    } finally {
      setSaving(false);
    }
  };

  const confirmAndDelete = (entryId: string) => {
    setConfirmDeleteId(entryId);
  };

  const cancelEdit = async () => {
    setConfirmDiscard(true);
  };

  const saveEntry = async () => {
    if (!effectiveThreadId) {
      setError('No thread available to save knowledge base entries.');
      return;
    }
    if (!name.trim() || !content.trim()) {
      setError('Title and content are required.');
      return;
    }
    if (description.length > 150) {
      setError('Description must be 150 characters or fewer.');
      return;
    }
    if (content.length > 10000) {
      setError('Content must be 10,000 characters or fewer.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (selectedEntryId) {
        await updateKbEntry(selectedEntryId, {
          name,
          description,
          content,
        });
      } else {
        await createKbEntry(effectiveThreadId, {
          name,
          description,
          content,
          usage_context: 'always',
        });
      }
      await loadEntries(effectiveThreadId);
      resetForm();
      setMode('list');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    (async () => {
      const tid = threadId || (await loadDefaultThread());
      if (!mounted) return;
      setEffectiveThreadId(tid);
      if (tid) await loadEntries(tid);
    })();
    return () => {
      mounted = false;
    };
  }, [open, threadId, loadDefaultThread, loadEntries]);

  const handleClose = () => {
    if (saving) return;
    setMode('list');
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[700px]"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle>Knowledge base</DialogTitle>
              <DialogDescription>
                Add knowledge to the agent. Knowledge is available in all conversations and when running workflows.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="mb-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {mode === 'list' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {effectiveThreadId ? 'Your records' : 'No thread available. Create a conversation to store knowledge.'}
              </div>
              <Button onClick={beginCreate} disabled={!effectiveThreadId}>
                <Plus className="h-4 w-4 mr-2" /> Add record
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading records...
              </div>
            ) : entries.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6">No records yet.</div>
            ) : (
              <div className="divide-y rounded-md border border-subtle dark:border-white/10">
                {entries.map((entry) => (
                  <div key={entry.entry_id} className="flex items-center justify-between p-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{entry.name}</div>
                      {entry.description && (
                        <div className="text-xs text-muted-foreground truncate">{entry.description}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => beginEdit(entry.entry_id)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive border-destructive"
                        onClick={() => confirmAndDelete(entry.entry_id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1 text-destructive" /> Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {mode === 'edit' && (
          <div className="space-y-4">
            <div className="grid gap-3">
              <div className="space-y-2">
                <Label htmlFor="kb-title">Title</Label>
                <Input id="kb-title" value={name} onChange={(e) => setName(e.target.value)} maxLength={255} placeholder="Short title" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kb-desc">Description (max 150 chars)</Label>
                <Input id="kb-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={150} placeholder="Describe what the content contains" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kb-content">Content (up to 10,000 chars)</Label>
                <Textarea id="kb-content" value={content} onChange={(e) => setContent(e.target.value)} rows={10} maxLength={10000} placeholder="Main content" />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                Discard changes
              </Button>
              <Button onClick={saveEntry} disabled={saving || !effectiveThreadId}>
                {saving ? (<><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</>) : 'Save record and continue'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      {/* Confirm delete dialog */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete record</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The record will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!confirmDeleteId) return;
                try {
                  setSaving(true);
                  await deleteKbEntry(confirmDeleteId);
                  if (effectiveThreadId) await loadEntries(effectiveThreadId);
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Failed to delete entry');
                } finally {
                  setSaving(false);
                  setConfirmDeleteId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm discard changes */}
      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              All changes to this record will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => { resetForm(); setMode('list'); setConfirmDiscard(false); }}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}


