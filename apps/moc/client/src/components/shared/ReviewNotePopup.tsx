'use client';

import { useState } from 'react';
import { createReviewNote, updateReviewNote, deleteReviewNote } from '@/lib/api';
import { getSectionLabel } from '@moc/shared';

interface ReviewNote {
  id: number;
  moc_id: number;
  section_id: string;
  note: string;
  author_id: number;
  author_name: string;
  author_role: string;
  resolved: boolean;
  resolved_by_name?: string;
  resolved_at?: string;
  created_at: string;
}

interface ReviewNotePopupProps {
  mocId: number;
  sectionId: string;
  notes: ReviewNote[];
  token: string;
  userId: number;
  userRole: string;
  onClose: () => void;
  onRefresh: () => void;
}

export default function ReviewNotePopup({
  mocId,
  sectionId,
  notes,
  token,
  userId,
  userRole,
  onClose,
  onRefresh,
}: ReviewNotePopupProps) {
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  const sectionNotes = notes.filter((n) => n.section_id === sectionId);
  const isAdmin = userRole === 'super_admin' || userRole === 'admin' || userRole === 'moc_manager';

  async function handleAdd() {
    if (!newNote.trim()) return;
    setSaving(true);
    try {
      await createReviewNote(token, { moc_id: mocId, section_id: sectionId, note: newNote.trim() });
      setNewNote('');
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleResolved(noteId: number, currentResolved: boolean) {
    try {
      await updateReviewNote(token, noteId, { resolved: !currentResolved });
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleSaveEdit(noteId: number) {
    if (!editText.trim()) return;
    try {
      await updateReviewNote(token, noteId, { note: editText.trim() });
      setEditingId(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleDelete(noteId: number) {
    if (!confirm('Delete this note?')) return;
    try {
      await deleteReviewNote(token, noteId);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100">Section Notes</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{getSectionLabel(sectionId)}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Notes list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {sectionNotes.length === 0 && (
            <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">No notes for this section yet.</p>
          )}
          {sectionNotes.map((n) => (
            <div
              key={n.id}
              className={`rounded-lg border p-3 text-sm ${
                n.resolved
                  ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                  : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div>
                  <span className="font-medium text-gray-800 dark:text-gray-100">{n.author_name}</span>
                  <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500 capitalize">{n.author_role}</span>
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                  {new Date(n.created_at).toLocaleString()}
                </span>
              </div>
              {editingId === n.id ? (
                <div className="space-y-2 mt-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="input-field text-sm w-full"
                    rows={2}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button onClick={() => handleSaveEdit(n.id)} className="text-xs btn-primary px-2 py-1">Save</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{n.note}</p>
              )}
              {n.resolved && n.resolved_by_name && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  Resolved by {n.resolved_by_name} {n.resolved_at ? `on ${new Date(n.resolved_at).toLocaleString()}` : ''}
                </p>
              )}
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => handleToggleResolved(n.id, n.resolved)}
                  className={`text-xs font-medium ${n.resolved ? 'text-orange-600 hover:text-orange-700' : 'text-green-600 hover:text-green-700'}`}
                >
                  {n.resolved ? 'Unresolve' : 'Resolve'}
                </button>
                {n.author_id === userId && (
                  <button
                    onClick={() => { setEditingId(n.id); setEditText(n.note); }}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    Edit
                  </button>
                )}
                {(n.author_id === userId || isAdmin) && (
                  <button
                    onClick={() => handleDelete(n.id)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add new note */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-5 py-4">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a note..."
            className="input-field text-sm w-full mb-2"
            rows={2}
          />
          <div className="flex justify-end">
            <button onClick={handleAdd} disabled={saving || !newNote.trim()} className="btn-primary text-sm px-4 py-1.5">
              {saving ? 'Adding...' : 'Add Note'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
