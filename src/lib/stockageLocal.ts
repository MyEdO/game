/** Le `localStorage` ; `null` s'il manque ou si son accès lève (mode privé strict, iframe sandbox). */
export function stockageLocal(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
