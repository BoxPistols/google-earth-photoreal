/**
 * OS / platform detection for cross-platform shortcut display.
 *
 * Hardcoding "Cmd+K" hurts on Windows and "Ctrl+K" hurts on Mac. Resolve at
 * runtime once and surface labels + a matcher for keyboard events.
 */

function detectMac(): boolean {
  if (typeof navigator === "undefined") return false;
  // userAgentData is the modern, non-deprecated API; fall back to userAgent.
  const uaData = (
    navigator as Navigator & {
      userAgentData?: { platform?: string };
    }
  ).userAgentData;
  if (uaData?.platform) return /mac/i.test(uaData.platform);
  return /Mac|iPad|iPhone|iPod/i.test(navigator.userAgent);
}

export const isMac = detectMac();

/** Display label for the primary modifier — ⌘ on Mac, Ctrl elsewhere. */
export const MOD_LABEL = isMac ? "⌘" : "Ctrl";

/** True when the event holds the primary modifier (Cmd on Mac, Ctrl else). */
export function isModKey(e: KeyboardEvent | React.KeyboardEvent): boolean {
  return isMac ? e.metaKey : e.ctrlKey;
}

/** True if the event represents an active IME composition.
 *  Some browsers fire keydown with keyCode=229 even when isComposing is false,
 *  so we check both. */
export function isComposingEvent(
  e: KeyboardEvent | React.KeyboardEvent,
): boolean {
  return e.isComposing || ("keyCode" in e && e.keyCode === 229);
}
