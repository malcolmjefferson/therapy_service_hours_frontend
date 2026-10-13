const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Elements inside `root` that Tab can reach, in DOM order. */
export function tabbableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(TABBABLE));
}

/**
 * Where focus should go when Tab is pressed inside a trap, or null to let the browser move it.
 * Wraps from the last element to the first (and back with Shift) and pulls stray focus inside.
 */
export function trappedFocusTarget(panel: HTMLElement, active: Element | null, backwards: boolean): HTMLElement | null {
  const items = tabbableIn(panel);
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) {
    return panel;
  }
  if (!active || !panel.contains(active) || active === panel) {
    return backwards ? last : first;
  }
  if (backwards && active === first) {
    return last;
  }
  if (!backwards && active === last) {
    return first;
  }
  return null;
}
