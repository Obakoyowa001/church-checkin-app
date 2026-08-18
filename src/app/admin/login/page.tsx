'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { LockKey } from '@phosphor-icons/react';

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
      <form onSubmit={submit} className="w-full max-w-sm sm:max-w-md">
        <div className="flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-deep">
            <Image src="/logo-mark.png" alt="ChristTribe" width={26} height={36} className="brightness-0 invert" />
          </div>
          <h1 className="mt-4 text-center font-display text-2xl font-semibold text-brand-deep sm:text-3xl">Admin</h1>
          <p className="mt-1.5 text-center text-base text-ink/60 sm:text-lg">Enter the admin password to continue.</p>
        </div>

        <div className="relative mt-8">
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="min-h-[58px] w-full rounded-2xl border-2 border-brand/25 bg-white pl-12 pr-5 text-lg text-ink shadow-sm outline-none focus:border-brand"
          />
          <LockKey size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 opacity-40" />
        </div>

        {error && (
          <p className="mt-4 rounded-2xl bg-accent/10 px-4 py-3 text-center text-base font-medium text-accent">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !password}
          className="mt-6 min-h-[58px] w-full rounded-2xl bg-brand-deep px-6 text-lg font-bold text-cream shadow-lg shadow-brand-deep/25 transition active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? 'Checking…' : 'Log in'}
        </button>
      </form>
    </div>
  );
}
