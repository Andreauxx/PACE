// ============================================================
// AgriSweep — Scraper Travel Maths
// There are no end switches, so distance is controlled by time:
//   run time = distance ÷ (travel rate × speed)
// The travel rate is measured once on the real build
// (Settings → Scraper travel) because belt slip, load and the
// worm gear make any calculated figure approximate.
// ============================================================

/** 20-tooth GT2 pulley (40 mm per turn) on an 80 RPM motor ≈ 5.3 cm/s at full speed. */
export const DEFAULT_TRAVEL_CM_PER_SEC = 5.3;

export const STROKE_RANGE_CM = { min: 10, max: 200, step: 5 };
export const JOG_STEPS_CM = [2, 5, 10, 20];
export const CALIBRATION_RUN_MS = 5000;

/** cm per second at a given PWM speed, assuming speed scales roughly linearly with duty. */
export function cmPerSecond(travelCmPerSecAt100: number, speedPercent: number): number {
  return Math.max(0.01, travelCmPerSecAt100 * (speedPercent / 100));
}

/** Milliseconds the motor must run to cover `distanceCm`. */
export function msForDistance(distanceCm: number, speedPercent: number, travelCmPerSecAt100: number): number {
  return Math.round((distanceCm / cmPerSecond(travelCmPerSecAt100, speedPercent)) * 1000);
}

/** Turns a measured test run into the full-speed travel rate. */
export function rateFromTest(measuredCm: number, runMs: number, speedPercent: number): number {
  return measuredCm / (runMs / 1000) / (speedPercent / 100);
}

export function formatSeconds(ms: number): string {
  const s = ms / 1000;
  return s < 10 ? `${s.toFixed(1)} s` : `${Math.round(s)} s`;
}
