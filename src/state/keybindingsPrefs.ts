/**
 * Persistance des SURCHARGES de touches (remap clavier) — localStorage, SANS dépendance au store ni
 * au registre `keybindings` : évite tout cycle d'import (le store charge ces overrides à l'init, et
 * `keybindings`/le hook les consomment via `effectiveCodes`). `id de raccourci → event.code`.
 */
import { lireDictionnaire, stockageWeb } from '../lib/stockageWeb';

const OVERRIDES_KEY = 'wfrp4.keys';

/** Les surcharges persistées dont la valeur est une chaîne non vide. L'id et la combinaison se
 *  valident contre le registre à la LECTURE (`surchargeDe`, `keybindings.ts`). */
export function loadKeyOverrides(): Record<string, string> {
  const o = lireDictionnaire('localStorage', OVERRIDES_KEY) ?? {};
  return Object.fromEntries(Object.entries(o).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1] !== ''));
}

export function saveKeyOverrides(o: Record<string, string>): void {
  try {
    if (Object.keys(o).length) stockageWeb('localStorage')?.setItem(OVERRIDES_KEY, JSON.stringify(o));
    else stockageWeb('localStorage')?.removeItem(OVERRIDES_KEY);
  } catch {
    // stockage indisponible : la surcharge reste effective pour la session, sans persistance
  }
}
