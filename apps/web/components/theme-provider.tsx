/**
 * The app is dark-only, so there is no theme state to provide: the root layout
 * hard-codes `class="dark"` on <html>. This passthrough keeps the import site in
 * `lib/providers.tsx` working; the next-themes props it receives are ignored.
 */
export interface ThemeProviderProps {
  children: React.ReactNode;
  attribute?: string;
  defaultTheme?: string;
  forcedTheme?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  return <>{children}</>;
}
