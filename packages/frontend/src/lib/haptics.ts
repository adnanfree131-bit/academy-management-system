/**
 * Web Haptic Feedback Engine
 * Provides subtle tactile feedback on mobile devices using navigator.vibrate
 */

export function hapticLight(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(10);
    } catch {
      // Ignored if vibration permission is blocked
    }
  }
}

export function hapticMedium(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(20);
    } catch {}
  }
}

export function hapticSuccess(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([15, 50, 20]);
    } catch {}
  }
}

export function hapticWarning(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([30, 40, 30]);
    } catch {}
  }
}

export function hapticSelection(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(8);
    } catch {}
  }
}
