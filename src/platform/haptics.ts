// navigator.vibrate where supported. iOS Safari has no vibration API: every call is a silent no-op.

let enabled = true;

export function setHapticsEnabled(on: boolean): void {
  enabled = on;
}

function vibrate(pattern: number | number[]): void {
  if (!enabled || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // ignore
  }
}

export const haptics = {
  light: () => vibrate(10),
  medium: () => vibrate(20),
  success: () => vibrate([15, 40, 25]),
  fail: () => vibrate([30, 60, 30]),
};
