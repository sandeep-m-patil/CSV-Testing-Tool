/**
 * The app is dark-only by design, so there is nothing to toggle. The component
 * remains as a stable import site (and a single place to reintroduce a switcher
 * later) but renders nothing rather than a control that cannot change anything.
 */
export function ThemeToggle(_props: { align?: "start" | "end" }) {
  return null;
}