import Link from 'next/link';
import Image from 'next/image';
import { CaretRight, CheckCircle, Sparkle } from '@phosphor-icons/react/dist/ssr';
import WelcomeBadge from '@/components/WelcomeBadge';

// Force dynamic rendering so NEW_MEMBER_FORM_URL is read fresh on every
// request rather than baked into a statically-prerendered page at build
// time — otherwise updating the env var wouldn't take effect without a
// full rebuild.
export const dynamic = 'force-dynamic';

export default function Home() {
  const newMemberFormUrl = process.env.NEW_MEMBER_FORM_URL;

  return (
    <div className="flex min-h-dvh flex-col items-center">
      <div className="w-full max-w-md md:max-w-2xl lg:max-w-3xl">
        <div className="relative flex flex-col items-center overflow-hidden rounded-b-[40px] bg-gradient-to-br from-brand-deeper via-brand-deep to-brand-mid px-6 pb-10 pt-6 sm:pb-14 sm:pt-8">
          <svg
            className="pointer-events-none absolute -right-10 -top-8 opacity-50"
            width="160"
            height="120"
            viewBox="0 0 160 120"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M20 70 Q10 55 30 48 Q28 30 50 32 Q62 15 82 28 Q102 18 108 40 Q128 38 122 62 Q135 72 118 82 L30 82 Q10 82 20 70 Z"
              fill="#3D66D6"
              opacity="0.35"
            />
          </svg>
          <svg
            className="pointer-events-none absolute -left-12 bottom-2 opacity-40"
            width="150"
            height="110"
            viewBox="0 0 150 110"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M18 62 Q8 48 26 42 Q24 26 44 28 Q55 12 74 24 Q92 15 98 35 Q116 33 111 55 Q123 64 107 73 L26 73 Q8 73 18 62 Z"
              fill="#3D66D6"
              opacity="0.3"
            />
          </svg>

          <Image src="/logo-mark.png" alt="ChristTribe" width={56} height={77} className="mt-1 brightness-0 invert opacity-90" />
          <div className="font-display mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-cream/70">
            ChristTribe
          </div>

          <div className="mt-6 sm:mt-8">
            <WelcomeBadge size={220} />
          </div>
        </div>

        <div className="flex flex-col items-center px-6 pb-8 pt-8 sm:px-10">
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">Welcome!</h1>
          <p className="mt-2 text-base text-ink/60 sm:text-lg">Have you visited with us before?</p>

          <div className="mt-7 flex w-full flex-col gap-3.5 sm:mt-8 sm:flex-row sm:gap-4">
            <Link
              href="/checkin"
              className="flex flex-1 items-center gap-4 rounded-3xl bg-brand-deep px-5 py-5 shadow-lg shadow-brand-deep/30 transition active:scale-[0.98]"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-brand">
                <CheckCircle size={26} weight="bold" color="#FBF8F3" />
              </div>
              <div className="flex-grow">
                <div className="text-lg font-bold text-cream">I&apos;ve been here before</div>
                <div className="mt-0.5 text-sm text-cream/65">Find your name and check in</div>
              </div>
              <CaretRight size={18} weight="bold" color="#FBF8F3" className="flex-shrink-0 opacity-50" />
            </Link>

            {newMemberFormUrl ? (
              <a
                href={newMemberFormUrl}
                className="flex flex-1 items-center gap-4 rounded-3xl border border-brand-deep/10 bg-white px-5 py-5 transition active:scale-[0.98]"
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-accent/10">
                  <Sparkle size={26} weight="bold" color="#EFB239" />
                </div>
                <div className="flex-grow">
                  <div className="text-lg font-bold text-ink">This is my first time</div>
                  <div className="mt-0.5 text-sm text-ink/55">Fill out a quick guest form</div>
                </div>
                <CaretRight size={18} weight="bold" color="#1B2A2E" className="flex-shrink-0 opacity-30" />
              </a>
            ) : (
              <div className="flex flex-1 items-center gap-4 rounded-3xl bg-accent/10 px-5 py-5 text-center">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-accent/15">
                  <Sparkle size={26} weight="bold" color="#EFB239" />
                </div>
                <div className="flex-grow text-left">
                  <div className="text-lg font-bold text-ink">First time here?</div>
                  <div className="mt-0.5 text-sm text-ink/55">Please see someone at the welcome desk.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
