/**
 * UI seeded bugs, mirroring the API's registry. Enabled at dev/build time:
 *   VITE_BUGS=UI_STALE_TOTAL,A11Y_MISSING_LABEL npm run dev
 */
export type UiBugFlag = 'UI_STALE_TOTAL' | 'A11Y_MISSING_LABEL' | 'NO_TOKEN_REFRESH'

export function isBugEnabled(flag: UiBugFlag): boolean {
  const raw = import.meta.env.VITE_BUGS ?? ''
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .includes(flag)
}
