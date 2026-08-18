import { BADGE_INNER_PATH, BADGE_OUTER_PATH } from '@/lib/badgeShapes';

// The recreated "Welcome to ChristTribe" hero badge — same scalloped
// sticker shape as CheckBadge, in brand blue, with hand-lettered-style
// text (Fredoka + a white stroke to mimic the original's sticker outline).
export default function WelcomeBadge({ size = 236 }: { size?: number }) {
  return (
    <div className="relative animate-badge-float" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 300 300" className="absolute inset-0">
        <path d={BADGE_OUTER_PATH} fill="#3D66D6" opacity={0.85} />
        <path d={BADGE_INNER_PATH} fill="#122761" />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
        <span
          className="font-display text-2xl sm:text-3xl font-semibold leading-tight text-cream"
          style={{ WebkitTextStroke: '5px #122761', paintOrder: 'stroke fill' }}
        >
          WELCOME
        </span>
        <span
          className="font-display mt-0.5 text-xs sm:text-sm font-semibold tracking-widest text-cream"
          style={{ WebkitTextStroke: '3px #122761', paintOrder: 'stroke fill' }}
        >
          TO
        </span>
        <span
          className="font-display text-2xl sm:text-3xl font-semibold leading-tight text-cream"
          style={{ WebkitTextStroke: '5px #122761', paintOrder: 'stroke fill' }}
        >
          CHRIST
        </span>
        <span
          className="font-display text-2xl sm:text-3xl font-semibold leading-tight text-cream"
          style={{ WebkitTextStroke: '5px #122761', paintOrder: 'stroke fill' }}
        >
          TRIBE
        </span>
      </div>

      <svg
        className="absolute top-3 right-6 animate-sparkle-pulse"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" fill="#EFB239" />
      </svg>
      <svg
        className="absolute bottom-9 left-5 animate-sparkle-pulse-delay"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" fill="#E8582C" />
      </svg>
    </div>
  );
}
