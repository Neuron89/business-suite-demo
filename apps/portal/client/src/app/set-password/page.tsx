'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { setPassword as apiSetPassword } from '@/lib/api';

export default function SetPasswordPage() {
  const router = useRouter();
  const { token, employee, refresh } = useAuth();
  const [password, setPasswordVal] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) return;
    if (password.length < 10 || password !== confirm) {
      setError('Password must be at least 10 characters and match the confirmation.');
      return;
    }
    setSubmitting(true);
    try {
      await apiSetPassword(token, password);
      await refresh();
      router.replace('/home');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!employee) {
    return (
      <div className="bg-page min-h-screen flex items-center justify-center p-6">
        <p className="text-theme-muted">Sign in first.</p>
      </div>
    );
  }

  return (
    <div className="bg-page min-h-screen flex items-center justify-center p-6">
      <div className="card w-full max-w-md animate-fade-in-up">
        <h1 className="text-2xl font-extrabold text-theme-primary">Choose a password</h1>
        <p className="text-sm text-theme-muted mt-1">
          You're using a temporary password. Set a new one to continue.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="password"
            autoComplete="new-password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPasswordVal(e.target.value)}
            className="input-field"
            required
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="input-field"
            required
          />
          {error && <div className="text-sm font-medium text-red-600">{error}</div>}
          <button type="submit" disabled={submitting} className="btn-accent w-full">
            {submitting ? 'Saving...' : 'Save password'}
          </button>
        </form>
      </div>
    </div>
  );
}
