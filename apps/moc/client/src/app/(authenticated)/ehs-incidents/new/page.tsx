'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { createEhsIncident } from '@/lib/api';
import {
  EHS_INCIDENT_TYPES,
  EHS_INCIDENT_SEVERITIES,
  INCIDENT_SEVERITY_LABELS,
} from '@moc/shared';

export default function NewEhsIncidentPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    incident_type: '' as string,
    severity: '' as string,
    incident_date: new Date().toISOString().split('T')[0],
    location: '',
    affected_persons: '',
    root_cause: '',
    corrective_actions: '',
    moc_id: '' as string,
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError('');
    setLoading(true);

    try {
      const payload: any = {
        title: form.title,
        description: form.description,
        incident_type: form.incident_type,
        severity: form.severity,
        incident_date: form.incident_date,
        location: form.location,
      };
      if (form.affected_persons) payload.affected_persons = form.affected_persons;
      if (form.root_cause) payload.root_cause = form.root_cause;
      if (form.corrective_actions) payload.corrective_actions = form.corrective_actions;
      if (form.moc_id) payload.moc_id = parseInt(form.moc_id);

      const incident = await createEhsIncident(token, payload);
      router.push(`/ehs-incidents/${incident.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create incident');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Report EHS Incident</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 text-sm">{error}</div>
        )}

        <div className="card space-y-5">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Incident Details</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input-field"
              placeholder="Brief description of the incident"
              required
              maxLength={200}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Incident Type *</label>
              <select
                value={form.incident_type}
                onChange={(e) => setForm({ ...form, incident_type: e.target.value })}
                className="input-field"
                required
              >
                <option value="">Select type...</option>
                {EHS_INCIDENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Severity *</label>
              <select
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value })}
                className="input-field"
                required
              >
                <option value="">Select severity...</option>
                {EHS_INCIDENT_SEVERITIES.map((s) => (
                  <option key={s} value={s}>{INCIDENT_SEVERITY_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Incident Date *</label>
              <input
                type="date"
                value={form.incident_date}
                onChange={(e) => setForm({ ...form, incident_date: e.target.value })}
                className="input-field"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Location *</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="input-field"
              placeholder="Where did the incident occur?"
              required
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Description *</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input-field"
              rows={4}
              placeholder="Detailed description of what happened"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Affected Persons</label>
            <input
              type="text"
              value={form.affected_persons}
              onChange={(e) => setForm({ ...form, affected_persons: e.target.value })}
              className="input-field"
              placeholder="Names or count of persons affected"
            />
          </div>
        </div>

        <div className="card space-y-5">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Investigation</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Root Cause</label>
            <textarea
              value={form.root_cause}
              onChange={(e) => setForm({ ...form, root_cause: e.target.value })}
              className="input-field"
              rows={3}
              placeholder="What caused the incident? (can be filled later)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Corrective Actions</label>
            <textarea
              value={form.corrective_actions}
              onChange={(e) => setForm({ ...form, corrective_actions: e.target.value })}
              className="input-field"
              rows={3}
              placeholder="Actions taken or planned to prevent recurrence"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Related MOC ID</label>
            <input
              type="number"
              value={form.moc_id}
              onChange={(e) => setForm({ ...form, moc_id: e.target.value })}
              className="input-field"
              placeholder="Optional — link to a MOC request"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Reporting...' : 'Report Incident'}
          </button>
        </div>
      </form>
    </div>
  );
}
