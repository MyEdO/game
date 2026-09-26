/**
 * Persistance des SURCHARGES de touches (remap clavier) — localStorage, SANS dépendance au store ni
 * au registre `keybindings` : évite tout cycle d'import (le store charge ces overrides à l'init, et
 * `keybindings`/le hook les consomment via `effectiveCodes`). `id de raccourci → event.code`.
 */
import { stockageLocal } from '../lib/stockageLocal';

const OVERRIDES_KEY = 'wfrp4.keys.v1';

export function loadKeyOverrides(): Record<string, string> {
  try {
    const raw = stockageLocal()?.getItem(OVERRIDES_KEY);
    const o = raw ? JSON.parse(raw) : {};
    return o && typeof o === 'object' ? (o as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function saveKeyOverrides(o: Record<string, string>): void {
  try {
    if (Object.keys(o).length) stockageLocal()?.setItem(OVERRIDES_KEY, JSON.stringify(o));
    else stockageLocal()?.removeItem(OVERRIDES_KEY);
  } catch {
    // stockage indisponible : la surcharge reste effective pour la session, sans persistance
  }
}
