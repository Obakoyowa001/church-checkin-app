'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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
    <div className="min-h-dvh px-5 py-8 sm:px-10">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-teal-deep">Admin</h1>
          <button
            type="button"
            onClick={logout}
            className="min-h-[44px] rounded-xl border-2 border-teal/20 px-4 text-base font-medium text-ink/70 active:scale-[0.98]"
          >
            Log out
          </button>
        </div>

        {error && (
          <p className="mt-6 rounded-2xl bg-amber/10 px-4 py-3 text-base font-medium text-amber">{error}</p>
        )}

        {loading && !stats ? (
          <p className="mt-8 text-lg text-ink/60">Loading…</p>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-2 gap-4">
              <StatCard label="Checked in today" value={stats?.todayCount ?? 0} accent />
              <StatCard label="Total members" value={stats?.totalMembers ?? 0} />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="/api/admin/export"
                className="min-h-[52px] rounded-2xl bg-teal px-6 text-lg font-semibold leading-[52px] text-cream shadow-sm transition active:scale-[0.98]"
              >
                Export attendance CSV
              </a>
              {lastUpdated && (
                <span className="text-sm text-ink/50">
                  Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · refreshes
                  every 30s
                </span>
              )}
            </div>

            <h2 className="mt-10 text-xl font-semibold text-ink">Checked in today ({checkins.length})</h2>
            <div className="mt-4 space-y-2">
              {checkins.length === 0 && <p className="text-lg text-ink/50">No check-ins yet today.</p>}
              {checkins.map((c, i) => (
                <div
                  key={`${c.fullName}-${c.timestamp}-${i}`}
                  className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-teal/10"
                >
                  <span className="text-lg font-medium text-ink">{c.fullName}</span>
                  <span className="text-sm text-ink/50">
                    {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-2xl px-5 py-6 shadow-sm ${accent ? 'bg-teal text-cream' : 'bg-white ring-1 ring-teal/10 text-ink'}`}>
      <div className="text-4xl font-bold">{value}</div>
      <div className={`mt-1 text-base ${accent ? 'text-cream/80' : 'text-ink/60'}`}>{label}</div>
    </div>
  );
}
