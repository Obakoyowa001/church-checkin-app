import { useEffect, useState } from 'react';
import Cloud from '@/components/Cloud';

// The check-in "moment" (PRD §6): a member's row search-fades, the screen
// takes over in navy with a cloud sweeping in from where they tapped, faint
// clouds drift up behind concentric rings, then their name, a checkmark and
// a 4s drain bar before the screen resets. `revealed` gates step 4/5 (name,
// checkmark, subtext, drain, dismiss button) — the caller only flips it once
// the check-in call has actually resolved, so the "you're checked in" text
// never shows before the write did.
//
// The composition is built at phone proportions, so on a wide viewport it
// stays centered in a phone-width column instead of stretching the sweep/
// drift/ring positions (tuned for ~375px) across the full screen — only the
// navy backdrop itself goes edge to edge.
export default function ConfirmationSequence({
  fullName,
  firstName,
  revealed,
  alreadyCheckedIn,
  timeLabel,
  onDismiss,
}: {
  fullName: string;
  firstName: string;
  revealed: boolean;
  alreadyCheckedIn: boolean;
  timeLabel: string;
  onDismiss: () => void;
}) {
  // A real check-in call can take a few seconds (a cold Apps Script
  // deployment, a slow connection) — without this, the screen just sits on
  // the settled entrance animation with nothing on it, which reads as
  // frozen. Show a quiet "still working" label once the entrance has had
  // time to land, and upgrade the wording if it runs unusually long.
  const [showWaiting, setShowWaiting] = useState(false);
  const [longWait, setLongWait] = useState(false);

  useEffect(() => {
    if (revealed) {
      setShowWaiting(false);
      setLongWait(false);
      return;
    }
    const t1 = setTimeout(() => setShowWaiting(true), 700);
    const t2 = setTimeout(() => setLongWait(true), 6000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [revealed]);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-sky">
      {/* Step 2: navy takeover, full-bleed */}
      <div className="base-in absolute inset-0 bg-gradient-to-br from-navy-900 to-navy-800" />

      <div className="relative mx-auto h-full w-full max-w-md overflow-hidden sm:max-w-lg">
        {/* Step 1: the tapped row, fading out */}
        <div className="list-fade absolute inset-0 px-6 pt-[100px]" aria-hidden="true">
          <div className="flex min-h-16 items-center rounded-md bg-white px-5 shadow-level2">
            <span className="text-[19px] font-semibold text-ink">{fullName}</span>
          </div>
        </div>

        {/* Step 2: cloud sweep, growing from roughly where the list sat */}
        <div className="sweep absolute left-10 top-28 h-[158px] w-[220px]" aria-hidden="true">
          <Cloud fill="#0E2B5E" />
        </div>

        {/* Step 3: faint drifting clouds */}
        <div className="drift-1 absolute left-5 top-[280px] h-[115px] w-40" aria-hidden="true">
          <Cloud fill="#FFFFFF" />
        </div>
        <div className="drift-2 absolute right-2.5 top-[200px] h-[94px] w-[130px]" aria-hidden="true">
          <Cloud fill="#FFFFFF" flip />
        </div>
        <div className="drift-3 absolute left-[110px] top-[480px] h-[108px] w-[150px]" aria-hidden="true">
          <Cloud fill="#FFFFFF" />
        </div>

        {/* Step 3: concentric hairline rings behind the name */}
        <div className="ring-1 absolute left-1/2 top-[300px] h-[190px] w-[260px] -ml-[130px]" aria-hidden="true">
          <Cloud outline fill="#FFFFFF" />
        </div>
        <div className="ring-2 absolute left-1/2 top-[280px] h-[230px] w-[320px] -ml-[160px]" aria-hidden="true">
          <Cloud outline fill="#FFFFFF" />
        </div>

        {/* Step 4/5: checkmark, name, subtext — only once the write has resolved */}
        <div className="relative flex h-full flex-col items-center justify-center px-8 text-center">
          {revealed ? (
            <>
              <svg className="check-pop mb-3.5" width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 12.5l5 5L20 6" stroke="#ED4020" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h1 className="signature name-in text-[44px] leading-none text-white">{firstName || fullName}</h1>
              <p className="name-in-2 mt-2.5 text-[17px] font-normal text-white/[0.72]">
                {alreadyCheckedIn ? "You're already checked in." : "You're checked in."}
              </p>
              <p className="name-in-3 mt-1.5 text-sm text-white/60">{timeLabel}</p>
            </>
          ) : (
            showWaiting && (
              <p className="animate-pulse text-[15px] font-medium text-white/60">
                {longWait ? 'Still checking — almost there…' : 'Checking you in…'}
              </p>
            )
          )}
        </div>

        {revealed && (
          <button
            type="button"
            onClick={onDismiss}
            className="btn-in absolute right-5 top-5 border-none bg-transparent text-sm font-medium text-white/[0.72]"
          >
            Check in someone else
          </button>
        )}

        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/[0.15]">
          {revealed && <div className="drain-line h-full bg-red-500" />}
        </div>
      </div>
    </div>
  );
}
