/**
 * Pure animation mathematics for building tap squash-and-stretch spring dynamics.
 * Simulates a damped harmonic oscillator with physical volume conservation.
 */
export function calculateSquashStretchScale(
  progress: number,
  baseScale: number,
  intensity = 0.12,
  dampFactor = 4.2,
  frequency = 2.5
): { scaleX: number; scaleY: number } {
  if (progress <= 0 || progress >= 1) {
    return { scaleX: baseScale, scaleY: baseScale };
  }
  const damp = Math.exp(-progress * dampFactor);
  const oscillation = Math.sin(progress * Math.PI * frequency);
  const factor = oscillation * damp * intensity;
  return {
    scaleX: baseScale * (1 + factor),
    scaleY: baseScale * (1 - factor),
  };
}
