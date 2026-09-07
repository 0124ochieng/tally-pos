import { useState } from 'react'

interface SplashScreenProps {
  /** True once it's time to leave — starts the fade-out. The real screen
   * underneath (ActivationGate/Login/the app) is already mounted and
   * visible by this point (see LicenseGate), so the fade reveals it rather
   * than cutting to a blank frame. */
  exiting: boolean
}

// Same path data as public/pwa-icon.svg, inlined (not <img>) so each of the
// three shapes can animate in on its own, staggered — a static image can
// only ever fade or scale as one flat unit.
const ICON_PATHS = [
  'M38,39.7c-5-0.2-9.8-1.6-14.2-3.9C20.7,34,18,32,15.4,29.5c-4.2-4-7.6-8.7-10.2-14L16.7,0.4c2.8,4.9,5.9,9.2,9.9,12.8c3.9,3.6,8.4,6.4,13.4,8.2c2.4,0.8,4.8,1.4,7.4,1.6L38,39.7z',
  'M41.2,42.5l7.5-10.9l-6.1,12.2c-6.1,0.9-12.2,1-18.2,0.1c-5.2-0.8-10.1-2.3-14.9-4.5c-3.2-1.5-6.1-3.3-8.8-5.6L6,23.7l2.2,2.4l-3.4,6.7c2.8,2.6,6,4.7,9.6,6.2C22.7,42.6,32.2,43.4,41.2,42.5z',
  'M8.8,41.5l-0.3,5c10,1.4,20.6,1.7,30.5-0.1c2.6-0.5,5-1.1,7.4-1.9l2.7-6l-1.6,7.3c-13.1,4.7-28,4.8-41.5,1.7l1.1-6.5L8.8,41.5z',
]

export function SplashScreen({ exiting }: SplashScreenProps) {
  // Read once — this screen is only ever up for ~2s, not worth subscribing
  // to changes for.
  const [reduceMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[300] flex flex-col items-center justify-center gap-5 bg-page transition-opacity duration-[420ms] ease-out ${
        exiting ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <div className="relative flex h-20 w-20 items-center justify-center">
        {!reduceMotion && (
          <span
            className="absolute inset-0 rounded-full bg-[#F26522]/25 blur-2xl"
            style={{ animation: 'splash-glow 2.2s ease-in-out infinite' }}
          />
        )}
        <svg viewBox="0 0 50 50" className="relative h-16 w-16">
          {ICON_PATHS.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="#F26522"
              style={reduceMotion ? undefined : { animation: `splash-icon-path 0.5s cubic-bezier(0.22,1,0.36,1) ${i * 120}ms both` }}
            />
          ))}
        </svg>
      </div>
      <p
        className="text-2xl font-bold tracking-tight text-ink"
        style={reduceMotion ? undefined : { animation: 'splash-text-in 0.5s cubic-bezier(0.22,1,0.36,1) 360ms both' }}
      >
        Tally
      </p>
    </div>
  )
}
