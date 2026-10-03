'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Member, SearchApiResponse } from '@/lib/types';

interface UnityRegisterFlowProps {
  formUrl?: string;
}

const DEBOUNCE_MS = 300;
const DEFAULT_UNITY_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLScs-TRd5454MFyBaa0CE1A-ScoU7LBNeluzEgXiBjwcmXujaQ/viewform';

export default function UnityRegisterFlow({ formUrl }: UnityRegisterFlowProps) {
  const effectiveFormUrl = formUrl || DEFAULT_UNITY_FORM_URL;

  const [currentView, setCurrentView] = useState<'landing' | 'search'>('landing');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Member[]>([]);
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentView === 'search') {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [currentView]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedMember) {
          setSelectedMember(null);
        } else if (currentView === 'search') {
          setCurrentView('landing');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMember, currentView]);

  const runSearch = useCallback(async (q: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSearchState('loading');
    try {
      const res = await fetch(`/api/unity-sunday/search?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      });
      const data: SearchApiResponse = await res.json();
      if (!data.success) {
        setSearchState('error');
        setResults([]);
        return;
      }
      setResults(data.results ?? []);
      setSearchState('idle');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setSearchState('error');
      setResults([]);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearchState('idle');
      abortRef.current?.abort();
      return;
    }

    debounceRef.current = setTimeout(() => {
      runSearch(trimmed);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  const handleSelectMember = (member: Member) => {
    setSelectedMember(member);
  };

  const handleDone = () => {
    setSelectedMember(null);
    setQuery('');
    setResults([]);
    setCurrentView('landing');
  };

  const handleCheckAnother = () => {
    setSelectedMember(null);
    setQuery('');
    setResults([]);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[#071330] text-white selection:bg-amber-400 selection:text-navy-950 font-sans">
      {/* ------------------- STAGE LIGHTING & AMBIENT GLOW ------------------- */}
      {/* Top spotlights */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-[380px] w-[540px] -translate-x-1/2 rounded-full bg-gradient-to-b from-sky-400/25 via-blue-600/15 to-transparent blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-28 left-1/2 h-[260px] w-[420px] -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-500/20 via-yellow-400/25 to-amber-600/20 blur-2xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-20 right-0 h-[300px] w-[300px] rounded-full bg-blue-700/20 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col justify-between px-5 pb-8 pt-6 sm:max-w-lg sm:px-8">
        {/* ------------------- TOP NAVIGATION ------------------- */}
        <div className="flex items-center justify-between">
          {currentView === 'landing' ? (
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-blue-100 backdrop-blur-md transition hover:bg-white/20 active:scale-95 border border-white/10"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Church Home
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                setCurrentView('landing');
                setQuery('');
                setResults([]);
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-blue-100 backdrop-blur-md transition hover:bg-white/20 active:scale-95 border border-white/10"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Unity Sunday
            </button>
          )}

          {/* ChristTribe Brand Badge */}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-950/80 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-200 border border-blue-500/30">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-amber-400">
              <path d="M12 2L3 9v11a2 2 0 002 2h14a2 2 0 002-2V9l-9-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 7v8M9 10h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            ChristTribe
          </div>
        </div>

        {/* ------------------- HERO BANNER WITH POSTER THEME ------------------- */}
        <div className="mt-6 text-center">
          {/* Scripture Pill from Flyer */}
          <div className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3.5 py-1 text-[11px] font-semibold text-amber-200 border border-amber-400/30 backdrop-blur-md">
            <span className="text-amber-400">&ldquo;All one in Christ Jesus&rdquo;</span>
            <span className="text-white/60">&bull; Galatians 3:28</span>
          </div>

          {/* Grand 3D Gold Metallic Title */}
          <div className="mt-3 relative">
            <h1 className="display text-[46px] font-black tracking-tight uppercase leading-[0.92] sm:text-[56px]">
              <span className="block text-transparent bg-clip-text bg-gradient-to-b from-[#FFFBEA] via-[#FBBF24] to-[#B45309] drop-shadow-[0_4px_18px_rgba(245,181,46,0.45)]">
                Unity
              </span>
              <span className="block text-transparent bg-clip-text bg-gradient-to-b from-[#FFE885] via-[#F59E0B] to-[#92400E] drop-shadow-[0_4px_22px_rgba(245,158,11,0.55)]">
                Sunday
              </span>
            </h1>
          </div>

          {/* Event Details Card matching the flyer banner */}
          <div className="mt-4 mx-auto inline-flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-950/90 via-navy-900/90 to-blue-950/90 px-4 py-2 text-xs font-bold tracking-wide border border-blue-400/30 shadow-lg">
            <span className="text-amber-300 font-extrabold">OCTOBER 4TH</span>
            <span className="text-blue-400">&bull;</span>
            <span className="text-white font-extrabold">9:00 AM</span>
            <span className="text-blue-400">&bull;</span>
            <span className="text-blue-200 font-medium">IFELOJU CICS HALL, OAU</span>
          </div>

          <p className="mt-2 text-xs text-blue-200/70 sm:text-sm">
            {currentView === 'landing'
              ? 'Join us for this special celebration! Check if you are registered or sign up below.'
              : 'Type your name below to verify your Unity Sunday registration.'}
          </p>
        </div>

        {/* ------------------- VIEW 1: LANDING WITH TWO GLARING BUTTONS ------------------- */}
        {currentView === 'landing' && (
          <div className="mt-8 flex flex-1 flex-col justify-center gap-4">
            {/* BUTTON 1: "Have I registered?" / "Search up your name" (GLARING METALLIC GOLD) */}
            <button
              type="button"
              onClick={() => setCurrentView('search')}
              className="group relative flex min-h-[90px] w-full items-center justify-between rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 p-1 shadow-[0_8px_32px_rgba(245,181,46,0.45)] transition duration-200 hover:shadow-[0_10px_42px_rgba(245,181,46,0.7)] active:scale-[0.98]"
            >
              <div className="flex h-full w-full items-center justify-between rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 px-5 py-4 text-left">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-navy-950/15 text-navy-950">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2.4" />
                      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-[19px] font-black leading-tight text-navy-950 sm:text-[21px]">
                        Have I registered?
                      </h2>
                      <span className="rounded bg-navy-950/10 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-navy-950">
                        Check Name
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs font-semibold text-navy-950/80 sm:text-sm">
                      Search up your name to verify registration
                    </p>
                  </div>
                </div>
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-navy-950/15 text-navy-950 transition group-hover:translate-x-1">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </button>

            {/* BUTTON 2: "New Registration" (GLOWING GLASS WITH GOLD ACCENTS) */}
            <a
              href={effectiveFormUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex min-h-[90px] w-full items-center justify-between rounded-2xl border-2 border-amber-300/40 bg-gradient-to-r from-blue-950/70 via-navy-900/80 to-blue-950/70 p-5 backdrop-blur-md shadow-[0_6px_25px_rgba(0,0,0,0.4)] transition duration-200 hover:border-amber-400 hover:bg-blue-900/60 active:scale-[0.98]"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-amber-300 border border-amber-400/30">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12 18v-6M9 15h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-[19px] font-black leading-tight text-white sm:text-[21px]">
                      New Registration
                    </h2>
                    <span className="rounded bg-amber-400/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-300 border border-amber-400/30">
                      Google Form
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-blue-200/80 sm:text-sm">
                    Register for Unity Sunday on the official form &rarr;
                  </p>
                </div>
              </div>
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-amber-300 transition group-hover:translate-x-1">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M15 3h6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </a>
          </div>
        )}

        {/* ------------------- VIEW 2: SEARCH VIEW (THEMED) ------------------- */}
        {currentView === 'search' && (
          <div className="mt-6 flex flex-1 flex-col">
            {/* Glowing Search Box */}
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                inputMode="text"
                enterKeyHint="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type your first or last name…"
                className="h-14 w-full rounded-2xl border-2 border-amber-400/50 bg-[#0B1E48]/90 pl-12 pr-10 font-sans text-base text-white placeholder:text-blue-300/50 shadow-inner outline-none focus:border-amber-400 focus:shadow-[0_0_20px_rgba(245,181,46,0.35)] transition"
              />
              <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-amber-400">
                {searchState === 'loading' ? <Spinner /> : <SearchIcon />}
              </div>
              {query.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setResults([]);
                    inputRef.current?.focus();
                  }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-blue-300 hover:text-white"
                  aria-label="Clear search"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>

            {/* Results Container */}
            <div role="region" aria-live="polite" className="mt-4 flex flex-1 flex-col gap-2.5 pb-6">
              {searchState === 'error' && (
                <div className="rounded-2xl border border-red-500/30 bg-red-950/60 p-5 text-center text-sm font-medium text-red-200">
                  <p>Could not connect to the registration sheet.</p>
                  <a
                    href={effectiveFormUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block font-bold text-amber-300 underline"
                  >
                    Open Google Form to register &rarr;
                  </a>
                </div>
              )}

              {!query.trim() && searchState === 'idle' && (
                <div className="py-8 text-center text-sm text-blue-200/70">
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-blue-900/50 text-amber-400">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <p className="font-semibold text-white">Start typing your name</p>
                  <p className="mt-0.5 text-xs text-blue-300/60">
                    Matches will appear live from the Unity Sunday Registration sheet.
                  </p>
                </div>
              )}

              {results.length > 0 && (
                <>
                  <div className="flex items-center justify-between px-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                      {results.length} registered attendee{results.length === 1 ? '' : 's'} found
                    </p>
                    <span className="text-[11px] text-blue-200/70">Click your name to confirm</span>
                  </div>
                  <div className="flex flex-col gap-2 overflow-hidden">
                    {results.map((member, i) => (
                      <button
                        key={member.memberId || i}
                        type="button"
                        onClick={() => handleSelectMember(member)}
                        className="row-in group flex min-h-[68px] items-center justify-between rounded-2xl border border-white/10 bg-gradient-to-r from-blue-950/80 via-navy-900/90 to-blue-950/80 px-5 py-3 text-left shadow-lg backdrop-blur-md transition hover:border-amber-400/80 hover:bg-blue-900/80 active:scale-[0.99]"
                        style={{ animationDelay: `${i * 35}ms` }}
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-400 text-sm font-black text-navy-950 shadow-md">
                            {member.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-[18px] font-bold text-white group-hover:text-amber-200 transition">
                              <MatchHighlight fullName={member.fullName} query={query.trim()} />
                            </span>
                            <p className="text-[11px] font-semibold text-emerald-400">✓ Registered for Unity Sunday</p>
                          </div>
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-amber-300 transition group-hover:translate-x-1 group-hover:bg-amber-400 group-hover:text-navy-950">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* No Results Fallback */}
              {query.trim().length >= 2 && searchState === 'idle' && results.length === 0 && (
                <div className="mt-2 flex flex-col items-center rounded-3xl border border-white/10 bg-blue-950/60 p-6 text-center shadow-xl backdrop-blur-md">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-400/20 text-amber-300">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <h3 className="mt-3 text-lg font-bold text-white">
                    No registration found for &ldquo;{query.trim()}&rdquo;
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-blue-200/80">
                    Have you filled the Unity Sunday form yet? You can register right now in less than a minute!
                  </p>

                  <div className="mt-5 flex w-full flex-col gap-2.5">
                    <a
                      href={effectiveFormUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-6 text-sm font-bold text-navy-950 shadow-lg shadow-amber-500/30 transition hover:brightness-105 active:scale-[0.98]"
                    >
                      <span>Register on Google Form</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M15 3h6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('');
                        inputRef.current?.focus();
                      }}
                      className="text-xs font-semibold text-blue-300 hover:text-white"
                    >
                      Try a different spelling
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------- FOOTER VENUE & CAMPUS TAG ------------------- */}
        <div className="mt-6 border-t border-white/10 pt-4 text-center">
          <p className="text-xs font-semibold text-amber-300/90">
            ChristTribe &bull; Unity Sunday 2026
          </p>
          <p className="mt-0.5 text-[11px] text-blue-200/60">
            Ifeloju CICS Hall, behind Banking Area, OAU Campus, Ile-Ife
          </p>
        </div>
      </div>

      {/* ------------------- THEMED CELEBRATORY POP-UP PROMPT ------------------- */}
      {selectedMember && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="popup-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop with cosmic royal blur */}
          <div
            onClick={() => setSelectedMember(null)}
            className="base-in absolute inset-0 bg-[#030919]/80 backdrop-blur-md"
            aria-hidden="true"
          />

          {/* Modal Card with Gold Rim */}
          <div className="fu-1 relative z-10 w-full max-w-sm overflow-hidden rounded-3xl border-2 border-amber-400/80 bg-gradient-to-b from-[#0B1E48] via-[#081534] to-[#040C22] p-7 text-center shadow-[0_0_50px_rgba(245,181,46,0.35)] sm:max-w-md sm:p-9">
            {/* Top Close Button */}
            <button
              type="button"
              onClick={() => setSelectedMember(null)}
              className="absolute right-4 top-4 rounded-full p-2 text-blue-300/70 hover:bg-white/10 hover:text-white transition"
              aria-label="Close popup"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>

            {/* Glowing Celebratory Ring */}
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-amber-400/20" />
              <div className="check-pop relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 shadow-[0_0_30px_rgba(245,181,46,0.6)]">
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M4.5 12.5l5 5L19.5 7"
                    stroke="#071330"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            {/* Heading requested by the user */}
            <p className="mt-5 text-xs font-bold uppercase tracking-wider text-amber-300">
              Registration Confirmed
            </p>
            <h2 id="popup-title" className="mt-1 text-[23px] font-black leading-tight text-white sm:text-[26px]">
              Oh, you&apos;ve been registered already!
            </h2>

            {/* Member Name in Gold Card */}
            <div className="mt-4 rounded-2xl border border-amber-400/30 bg-blue-950/70 p-4 shadow-inner">
              <p className="signature text-[30px] font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-100 sm:text-[34px]">
                {selectedMember.fullName}
              </p>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-3 py-0.5 text-xs font-bold text-emerald-300 border border-emerald-400/30">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 12l5 5L20 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Unity Sunday Confirmed &bull; Oct 4th
              </div>
            </div>

            {/* Reassuring note: no need to write new details */}
            <p className="mt-4 text-xs leading-relaxed text-blue-200/80 sm:text-sm">
              You are all set for Unity Sunday! There is no need to write new details or submit another form. We can&apos;t wait to see you at Ifeloju CICS Hall!
            </p>

            {/* Actions */}
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleDone}
                className="flex min-h-13 w-full items-center justify-center rounded-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 px-6 py-3 text-sm font-black text-navy-950 shadow-lg shadow-amber-500/30 transition hover:brightness-105 active:scale-[0.98]"
              >
                Done
              </button>
              <button
                type="button"
                onClick={handleCheckAnother}
                className="flex min-h-11 w-full items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 text-xs font-bold text-blue-100 transition hover:bg-white/10 active:scale-[0.98]"
              >
                Check another name
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MatchHighlight({ fullName, query }: { fullName: string; query: string }) {
  if (!query) return <span>{fullName}</span>;
  const idx = fullName.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <span>{fullName}</span>;
  const before = fullName.slice(0, idx);
  const match = fullName.slice(idx, idx + query.length);
  const after = fullName.slice(idx + query.length);
  return (
    <>
      {before && <span>{before}</span>}
      <span className="font-black text-amber-300 underline decoration-amber-400 decoration-2 underline-offset-2">
        {match}
      </span>
      {after && <span>{after}</span>}
    </>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2.2" />
      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin text-amber-400" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
