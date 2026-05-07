'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getExternalActionByToken, respondToExternalAction } from '@/lib/api';

export default function ExternalActionPage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [markDone, setMarkDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) return;
    getExternalActionByToken(token)
      .then((d) => {
        setData(d);
        if (d.responded_at) setSubmitted(true);
      })
      .catch((err) => setError(err.message || 'This link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim() && !markDone) return;
    setSubmitting(true);
    try {
      await respondToExternalAction(token, { note: note.trim() || undefined, marked_done: markDone });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-4xl mb-4">!</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Unable to Load</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-green-500 text-5xl mb-4">&#10003;</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Response Recorded</h1>
          <p className="text-gray-600 mb-4">
            {data?.responded_at
              ? 'You have already responded to this action item.'
              : 'Thank you! Your response has been recorded and the MOC team has been updated.'}
          </p>
          {markDone && <p className="text-sm text-green-600 font-medium">You marked this item as complete.</p>}
          <p className="text-xs text-gray-400 mt-6">You may close this page.</p>
        </div>
      </div>
    );
  }

  const mocDisplay = data?.moc?.moc_number || `MOC #${data?.moc?.id}`;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="bg-blue-800 text-white px-6 py-4 rounded-t-xl">
          <h1 className="text-lg font-bold">Management of Change</h1>
          <p className="text-blue-200 text-sm">External Action Item Response</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-b-xl shadow-lg p-6">
          {/* Greeting */}
          <p className="text-gray-700 mb-4">
            {data?.name ? `Hi ${data.name},` : 'Hello,'} you have been assigned an action item by <strong>{data?.assigned_by}</strong>.
          </p>

          {/* MOC Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-2 text-sm">
              <span className="font-semibold text-gray-600">MOC:</span>
              <span className="text-gray-900">{mocDisplay} — {data?.moc?.title}</span>
              <span className="font-semibold text-gray-600">Review:</span>
              <span className="text-gray-900">{data?.item_type?.toUpperCase()}</span>
            </div>
          </div>

          {/* Action Item */}
          <div className="border-l-4 border-amber-400 bg-amber-50 rounded-r-lg p-4 mb-6">
            <p className="text-xs font-bold text-amber-700 uppercase mb-1">Action Item</p>
            <p className="text-gray-900">{data?.item?.description}</p>
            {data?.item?.notes && (
              <p className="text-sm text-gray-600 mt-2 italic">Notes: {data.item.notes}</p>
            )}
            {data?.item?.action_resolved && (
              <p className="text-sm text-green-600 font-medium mt-2">This item has already been marked resolved.</p>
            )}
          </div>

          {/* Response Form */}
          <form onSubmit={handleSubmit}>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Your Response</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note, update, or comment..."
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />

            <label className="flex items-center gap-3 mt-4 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={markDone}
                onChange={(e) => setMarkDone(e.target.checked)}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500 h-5 w-5"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">Mark as complete</span>
                <p className="text-xs text-gray-500">Check this if the action item has been addressed</p>
              </div>
            </label>

            <button
              type="submit"
              disabled={submitting || (!note.trim() && !markDone)}
              className="w-full mt-4 bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit Response'}
            </button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-4">
            No login required. Your response will be added to the MOC record.
          </p>
        </div>
      </div>
    </div>
  );
}
