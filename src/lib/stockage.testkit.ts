/** Les stockages de test (#3041) en mémoire ou qui lèvent. */
import type { Stockage } from './stockage';

/** Un `Storage` en mémoire, et son contenu ; `refuserEcriture(cle, valeur)` vrai : cette écriture lève (quota). */
export function stockageEnMemoire(opts: { refuserEcriture?: (cle: string, valeur: string) => boolean } = {}): Storage & { contenu: Map<string, string> } {
  const contenu = new Map<string, string>();
  return {
    contenu,
    getItem: (k) => contenu.get(k) ?? null,
    setItem: (k, v) => {
      if (opts.refuserEcriture?.(k, String(v))) throw new Error(`setItem refusé (${k})`);
      contenu.set(k, String(v));
    },
    removeItem: (k) => void contenu.delete(k),
    clear: () => contenu.clear(),
    key: (i) => [...contenu.keys()][i] ?? null,
    get length() {
      return contenu.size;
    },
  };
}

/** Un `Stockage` dont chaque accès lève (quota, accès refusé). */
export const stockageQuiLeve: Stockage = {
  getItem: () => { throw new Error('refusé'); },
  setItem: () => { throw new Error('refusé'); },
  removeItem: () => { throw new Error('refusé'); },
};
