import { useEffect } from 'react';

export type OverlayType = 'drawer' | 'search' | 'sheet';

export interface OverlayEntry {
  type: OverlayType;
  close: () => void;
}

const overlayStack: OverlayEntry[] = [];

/**
 * Pushes an overlay onto the global mobile overlay stack.
 * Returns a cleanup function that pops or removes this overlay entry.
 */
export function pushOverlay(entry: OverlayEntry): () => void {
  overlayStack.push(entry);
  return () => {
    const idx = overlayStack.indexOf(entry);
    if (idx !== -1) {
      overlayStack.splice(idx, 1);
    }
  };
}

/**
 * Pops the top-most overlay and executes its close callback.
 * Returns true if an overlay was found and closed, false otherwise.
 */
export function popOverlay(): boolean {
  if (overlayStack.length > 0) {
    const top = overlayStack.pop();
    if (top) {
      top.close();
      return true;
    }
  }
  return false;
}

/**
 * Checks if any overlay is currently active.
 */
export function hasActiveOverlay(): boolean {
  return overlayStack.length > 0;
}

/**
 * Returns the type of the top-most active overlay, or 'none'.
 */
export function getTopOverlayType(): OverlayType | 'none' {
  if (overlayStack.length === 0) return 'none';
  return overlayStack[overlayStack.length - 1].type;
}

/**
 * React hook to register an overlay with the global back-button stack.
 */
export function useMobileOverlay(type: OverlayType, isOpen: boolean, onClose?: () => void) {
  useEffect(() => {
    if (!isOpen) return;
    const cleanup = pushOverlay({ type, close: onClose || (() => {}) });
    return cleanup;
  }, [type, isOpen, onClose]);
}

