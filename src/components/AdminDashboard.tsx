'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { CalendarCheck, DownloadSimple, SignOut, UsersThree } from '@phosphor-icons/react';
import type { StatsApiResponse, TodayCheckin } from '@/lib/types';

const REFRESH_MS = 30_000;

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<StatsApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats', { cache: 'no-store' });
      if (res.status === 401) {
        router.push('/admin/login');
        return;
      }
      const data: StatsApiResponse = await res.json();
      if (!data.success) {
        setError(data.error ?? 'Could not load stats.');
      } else {
        setStats(data);
        setError(null);
        setLastUpdated(new Date());
      }
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, REFRESH_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load]);

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  };

  const checkins: TodayCheckin[] = stats?.todayCheckins ?? [];

  return (
    <div className="min-h-dvh bg-brand-tint">
      <div className="flex items-center justify-between bg-brand-deep px-6 py-5 sm:px-10">
        <div className="flex items-center gap-3">
          <Image src="/logo-mark.png" alt="ChristTribe" width={28} height={39} className="brightness-0 invert" />
          <span className="font-display text-lg font-semibold text-cream sm:text-xl">ChristTribe Admin</span>
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-cream/25 px-3.5 text-sm font-semibold text-cream/85 transition active:scale-[0.98] sm:px-4"
        >
          <SignOut size={16} weight="bold" />
          Log out
        </button>
      </div>

      <div className="mx-auto max-w-5xl px-5 py-7 sm:px-10">
        {error && <p className="mb-6 rounded-2xl bg-accent/10 px-4 py-3 text-base font-medium text-accent">{error}</p>}

        {loading && !stats ? (
          <p className="text-lg text-ink/55">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-brand-deep px-6 py-6 shadow-lg shadow-brand-deep/25 sm:col-span-1">
                <CalendarCheck size={22} weight="bold" color="#3D66D6" className="mb-2" />
                <div className="font-display text-4xl font-semibold text-cream">{stats?.todayCount ?? 0}</div>
                <div className="mt-1 text-sm font-medium text-cream/70">Checked in today</div>
              </div>
              <div className="rounded-2xl bg-white px-6 py-6 ring-1 ring-brand-deep/10 sm:col-span-1">
                <UsersThree size={22} weight="bold" color="#3D66D6" className="mb-2" />
                <div className="font-display text-4xl font-semibold text-brand-deep">{stats?.totalMembers ?? 0}</div>
                <div className="mt-1 text-sm font-medium text-ink/55">Total members</div>
              </div>
              <div className="flex flex-col justify-center gap-3 rounded-2xl bg-white px-6 py-6 ring-1 ring-brand-deep/10 sm:col-span-1">
                <a
                  href="/api/admin/export"
                  className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-accent-gold px-4 text-sm font-bold text-ink transition active:scale-[0.98]"
                >
                  <DownloadSimple size={18} weight="bold" />
                  Export CSV
                </a>
                {lastUpdated && (
                  <span className="text-center text-xs text-ink/45">
                    Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · refreshes
                    every 30s
                  </span>
                )}
              </div>
            </div>

            <h2 className="mt-9 font-display text-xl font-semibold text-brand-deep">
              Checked in today ({checkins.length})
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {checkins.length === 0 && <p className="text-lg text-ink/45">No check-ins yet today.</p>}
              {checkins.map((c, i) => {
                const checkinTime = c.timestamp ? new Date(c.timestamp) : null;
                const hasValidTime = checkinTime && !isNaN(checkinTime.getTime());
                const initial = c.fullName.trim().charAt(0).toUpperCase();
                return (
                  <div
                    key={`${c.fullName}-${i}`}
                    className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-brand-deep/10"
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-tint">
                      <span className="font-display text-sm font-semibold text-brand-deep">{initial}</span>
                    </div>
                    <span className="flex-grow text-base font-semibold text-ink">{c.fullName}</span>
                    {hasValidTime && (
                      <span className="text-sm text-ink/40">
                        {checkinTime!.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
