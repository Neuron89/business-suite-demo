'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { complaintApi, ApiError } from '@/lib/api';

const COMPLAINT_TYPES = ['quality', 'delivery', 'packaging', 'documentation', 'contamination', 'other'];
const SEVERITIES = ['low', 'medium', 'high', 'critical'];

export default function NewComplaintPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    customer_name: '', customer_email: '', customer_phone: '', customer_company: '',
    product_name: '', lot_number: '',
    complaint_type: 'quality', severity: 'medium',
    title: '', description: '',
  });

  const update = (field: string, value: string) => setForm({ ...form, [field]: value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const complaint = await complaintApi.create(form);
      router.push(`/complaints/${complaint.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create complaint');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl animate-fade-in-up">
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>New Complaint</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Info */}
        <div className="card p-5">
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Customer Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Customer Name *" value={form.customer_name} onChange={(v) => update('customer_name', v)} required />
            <Field label="Customer Email" type="email" value={form.customer_email} onChange={(v) => update('customer_email', v)} />
            <Field label="Phone" value={form.customer_phone} onChange={(v) => update('customer_phone', v)} />
            <Field label="Company" value={form.customer_company} onChange={(v) => update('customer_company', v)} />
          </div>
        </div>

        {/* Product Info */}
        <div className="card p-5">
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Product Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Product Name *" value={form.product_name} onChange={(v) => update('product_name', v)} required />
            <Field label="Lot Number" value={form.lot_number} onChange={(v) => update('lot_number', v)} />
          </div>
        </div>

        {/* Classification */}
        <div className="card p-5">
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Classification</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Type *</label>
              <select className="input-field capitalize" value={form.complaint_type} onChange={(e) => update('complaint_type', e.target.value)}>
                {COMPLAINT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Severity *</label>
              <select className="input-field capitalize" value={form.severity} onChange={(e) => update('severity', e.target.value)}>
                {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="card p-5">
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Complaint Details</h2>
          <div className="space-y-4">
            <Field label="Title *" value={form.title} onChange={(v) => update('title', v)} required />
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Description *</label>
              <textarea
                className="input-field min-h-[120px]"
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creating...' : 'Submit Complaint'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => router.back()}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required = false }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <input type={type} className="input-field" value={value} onChange={(e) => onChange(e.target.value)} required={required} />
    </div>
  );
}
