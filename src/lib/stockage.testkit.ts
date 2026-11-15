/** Les stockages de test (#3041) : en mémoire, qui lève, posé en `localStorage` d'un environnement qui n'en a pas. */
import { onTestFinished } from 'vitest';
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

/** Pose un `stockageEnMemoire(opts)` neuf en `globalThis.localStorage`, et le rend ; le `localStorage`
 *  d'avant revient à la fin du test (`isolate: false` : le worker sert les fichiers suivants). */
export function poserLeLocalStorage(opts?: Parameters<typeof stockageEnMemoire>[0]): ReturnType<typeof stockageEnMemoire> {
  const avant = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  onTestFinished(() => {
    if (avant) Object.defineProperty(globalThis, 'localStorage', avant);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  });
  const s = stockageEnMemoire(opts);
  Object.defineProperty(globalThis, 'localStorage', { value: s, writable: true, configurable: true, enumerable: true });
  return s;
}
