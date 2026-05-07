'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTheme } from '@/lib/theme-context';
import { forgot } from '@/lib/api';

export default function ForgotPage() {
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await forgot(email);
      setSubmitted(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page px-4">
      <div className="card w-full max-w-md animate-fade-in-up">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-[10px] flex items-center justify-center font-extrabold text-base"
              style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
            >
              NY
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-theme-primary">
                Set <span className="text-accent">Password</span>
              </h1>
              <p className="text-xs text-theme-muted">
                We'll email you a link to choose your portal password.
              </p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-card-hover-surface transition-colors"
            title="Toggle theme"
          >
            {theme === 'dark' ? (
              <svg
                className="w-5 h-5 text-theme-secondary"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5 text-theme-secondary"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
                />
              </svg>
            )}
          </button>
        </div>

        {submitted ? (
          <div
            className="mb-4 p-3 rounded-lg text-sm"
            style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}
          >
            If that email is in the directory, a reset link is on the way. Check your inbox.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-theme-secondary mb-1.5">
                Work email
              </label>
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="firstname.lastname@acme.demo"
              />
            </div>
            {error && (
              <div
                className="p-3 rounded-lg text-sm font-semibold"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
              >
                {error}
              </div>
            )}
            <button type="submit" disabled={submitting} className="btn-accent w-full">
              {submitting ? 'Sending...' : 'Email me a link'}
            </button>
          </form>
        )}

        <div className="mt-6 text-sm">
          <Link href="/login" className="hover:underline text-accent">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
