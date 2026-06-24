'use client';

/**
 * AnimatedLogo — strokes the Nestora icon mark in sequence:
 *   1. Roofline traces left → peak → right (amber)
 *   2. Left pillar paints downward (teal/building color)
 *   3. Right pillar paints downward, slightly staggered
 *   4. Diagonal traces across last
 *
 * Uses pathLength="1" so all stroke-dasharray values are normalised to [0,1]
 * regardless of the actual pixel length of each path — no manual length maths.
 */

interface AnimatedLogoProps {
  size?: number;
  /** Stroke color for the roofline peak. Defaults to Nestora amber. */
  roofColor?: string;
  /** Stroke color for the building body. Defaults to Nestora teal. */
  buildingColor?: string;
}

export function AnimatedLogo({
  size = 80,
  roofColor = '#F2B069',
  buildingColor = '#0F766E',
}: AnimatedLogoProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
    >
      <style>{`
        @keyframes nestora-draw {
          to { stroke-dashoffset: 0; }
        }

        /* Roof: 0 → 0.65s */
        .n-roof {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          animation: nestora-draw 0.65s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0s both;
        }

        /* Left pillar: drops in while roof is still drawing */
        .n-left {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          animation: nestora-draw 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.38s both;
        }

        /* Right pillar: a beat behind the left */
        .n-right {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          animation: nestora-draw 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.5s both;
        }

        /* Diagonal: traces across after pillars are down */
        .n-diag {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          animation: nestora-draw 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.68s both;
        }
      `}</style>

      {/* 1 — Roofline: M20 42 → peak at 60,18 → 100,42 */}
      <path
        d="M20 42 L60 18 L100 42"
        stroke={roofColor}
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="1"
        className="n-roof"
      />

      {/* 2 — Left pillar: thick centerline stroke paints downward */}
      {/* Original rect: x=22 y=40 width=17 height=64 → centerline x=30.5 */}
      <path
        d="M30.5 40 L30.5 104"
        stroke={buildingColor}
        strokeWidth="17"
        strokeLinecap="butt"
        pathLength="1"
        className="n-left"
      />

      {/* 3 — Right pillar: centerline x=89.5 */}
      {/* Original rect: x=81 y=40 width=17 height=64 */}
      <path
        d="M89.5 40 L89.5 104"
        stroke={buildingColor}
        strokeWidth="17"
        strokeLinecap="butt"
        pathLength="1"
        className="n-right"
      />

      {/* 4 — Diagonal: traces from upper-left to lower-right */}
      <path
        d="M31 46 L88 99"
        stroke={buildingColor}
        strokeWidth="17"
        strokeLinecap="round"
        pathLength="1"
        className="n-diag"
      />
    </svg>
  );
}

/**
 * LoadingScreen — full-viewport centered loading overlay.
 * Drop a <LoadingScreen /> anywhere you need a blocking loader.
 * In Next.js App Router, prefer app/(segment)/loading.tsx for route-level
 * loading so Next.js unmounts it automatically when the segment resolves.
 */
export function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <AnimatedLogo size={72} />
    </div>
  );
}
