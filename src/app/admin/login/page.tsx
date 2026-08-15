'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? 'Incorrect password.');
        setSubmitting(false);
        return;
      }
      router.push('/admin');
      router.refresh();
    } catch {
      setError('Could not reach the server. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm">
        <h1 className="text-center text-3xl font-bold text-teal-deep">Admin</h1>
        <p className="mt-2 text-center text-lg text-ink/70">Enter the admin password to continue.</p>

        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="mt-8 min-h-[60px] w-full rounded-2xl border-2 border-teal/20 bg-white px-5 text-xl text-ink shadow-sm outline-none focus:border-teal"
        />

        {error && (
          <p className="mt-4 rounded-2xl bg-amber/10 px-4 py-3 text-center text-base font-medium text-amber">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !password}
          className="mt-6 min-h-[60px] w-full rounded-2xl bg-teal px-6 text-xl font-semibold text-cream shadow-lg transition active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? 'Checking…' : 'Log in'}
        </button>
      </form>
    </div>
  );
}
