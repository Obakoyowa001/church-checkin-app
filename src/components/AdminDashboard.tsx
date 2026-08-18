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
    <div className="min-h-dvh bg-sky">
      <div className="flex items-center justify-between bg-navy-800 px-6 py-5 sm:px-10">
        <div className="flex items-center gap-3">
          <Image src="/logo-mark.png" alt="ChristTribe" width={28} height={39} className="brightness-0 invert" />
          <span className="display text-lg text-white sm:text-xl">ChristTribe Admin</span>
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex min-h-[40px] items-center gap-1.5 rounded-sm border border-white/25 px-3.5 text-sm font-semibold text-white/[0.85] transition active:scale-[0.98] sm:px-4"
        >
          <SignOut size={16} weight="bold" />
          Log out
        </button>
      </div>

      <div className="mx-auto max-w-5xl px-5 py-7 sm:px-10">
        {error && (
          <p className="mb-6 rounded-md bg-blue-100 px-4 py-3 text-base font-medium text-red-500">{error}</p>
        )}

        {loading && !stats ? (
          <p className="text-lg text-ink-muted">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-md bg-navy-800 px-6 py-6 shadow-level1 sm:col-span-1">
                <CalendarCheck size={22} weight="bold" color="#80ACF8" className="mb-2" />
                <div className="display text-4xl text-white">{stats?.todayCount ?? 0}</div>
                <div className="mt-1 text-sm font-medium text-white/70">Checked in today</div>
              </div>
              <div className="rounded-md bg-white px-6 py-6 ring-1 ring-blue-100 sm:col-span-1">
                <UsersThree size={22} weight="bold" color="#043280" className="mb-2" />
                <div className="display text-4xl text-navy-800">{stats?.totalMembers ?? 0}</div>
                <div className="mt-1 text-sm font-medium text-ink-muted">Total members</div>
              </div>
              <div className="flex flex-col justify-center gap-3 rounded-md bg-white px-6 py-6 ring-1 ring-blue-100 sm:col-span-1">
                <a
                  href="/api/admin/export"
                  className="flex min-h-[48px] items-center justify-center gap-2 rounded-sm bg-navy-800 px-4 text-sm font-bold text-white transition active:scale-[0.98]"
                >
                  <DownloadSimple size={18} weight="bold" />
                  Export CSV
                </a>
                {lastUpdated && (
                  <span className="text-center text-xs text-ink-muted">
                    Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · refreshes
                    every 30s
                  </span>
                )}
              </div>
            </div>

            <h2 className="display mt-9 text-xl text-navy-800">
              Checked in today ({checkins.length})
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {checkins.length === 0 && <p className="text-lg text-ink-muted">No check-ins yet today.</p>}
              {checkins.map((c, i) => {
                const checkinTime = c.timestamp ? new Date(c.timestamp) : null;
                const hasValidTime = checkinTime && !isNaN(checkinTime.getTime());
                const initial = c.fullName.trim().charAt(0).toUpperCase();
                return (
                  <div
                    key={`${c.fullName}-${i}`}
                    className="flex items-center gap-3 rounded-sm bg-white px-4 py-3 shadow-sm ring-1 ring-blue-100"
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-blue-100">
                      <span className="display text-sm text-navy-800">{initial}</span>
                    </div>
                    <span className="flex-grow text-base font-semibold text-ink">{c.fullName}</span>
                    {hasValidTime && (
                      <span className="text-sm text-ink-muted">
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
