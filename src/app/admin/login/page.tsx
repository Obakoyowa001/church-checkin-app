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
    <div className="flex min-h-dvh flex-col items-center justify-center bg-sky px-6">
      <form onSubmit={submit} className="w-full max-w-sm sm:max-w-md">
        <div className="flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-md bg-navy-800">
            <Image src="/logo-mark.png" alt="ChristTribe" width={26} height={36} className="brightness-0 invert" />
          </div>
          <h1 className="display mt-4 text-center text-2xl text-navy-800 sm:text-3xl">Admin</h1>
          <p className="mt-1.5 text-center text-base text-ink-muted sm:text-lg">Enter the admin password to continue.</p>
        </div>

        <div className="relative mt-8">
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="min-h-[58px] w-full rounded-md border-2 border-blue-100 bg-white pl-12 pr-5 text-lg text-ink shadow-sm outline-none focus:border-blue-500"
          />
          <LockKey size={20} color="#5C6B90" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 opacity-60" />
        </div>

        {error && (
          <p className="mt-4 rounded-md bg-blue-100 px-4 py-3 text-center text-base font-medium text-red-500">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !password}
          className="mt-6 min-h-[58px] w-full rounded-full bg-navy-800 px-6 text-lg font-bold text-white shadow-level1 transition active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? 'Checking…' : 'Log in'}
        </button>
      </form>
    </div>
  );
}
