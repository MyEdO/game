/** Les ids du monde d'une partie (#2907) : la fabrique (`FabriqueDId`, `src/engine/fabriqueDId.ts`) qui lit et avance le
 *  compteur `prochainId` de l'état (`forgerUnId`), et le compte des combats ouverts (`marquerUnCombatOuvert`, #3009), l'identité
 *  du `battle` courant. Les compteurs voyagent dans la save et dans l'instantané coop. Seul l'hôte
 *  les écrit. L'id d'un héros de roster vient de l'entropie de la plateforme, que l'hôte passe à `engagerLeHeros`
 *  (`hote/roster.ts`). */
import { idDuGenre } from '../engine/fabriqueDId';
import type { Get, SetDesClesReservees } from './flowTypes';
import type { FabriqueDuNoyau } from './machinerieDuNoyau';

/** L'UNIQUE écrivain de `prochainId`. */
export function creerFabriqueDIds(get: Get, set: SetDesClesReservees) {
  return {
    forgerUnId: (genre) => {
      const n = get().prochainId;
      set({ prochainId: n + 1 });
      return idDuGenre(genre, n);
    },
    /** L'UNIQUE écrivain de `combatsOuverts`, hors la garde de `lancerLaScene`. */
    marquerUnCombatOuvert: () => {
      set((s) => ({ combatsOuverts: s.combatsOuverts + 1 }));
    },
  } satisfies FabriqueDuNoyau;
}
