/** Les ids du monde d'une partie (#2907) : la fabrique (`FabriqueDId`, `src/engine/fabriqueDId.ts`) qui lit et avance le
 *  compteur `prochainId` de l'état (`forgerUnId`). Le compteur voyage dans la save et dans l'instantané coop. Seul l'hôte
 *  l'écrit. L'id d'un héros de roster vient de l'entropie de la plateforme, que l'hôte passe à `engagerLeHeros`
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
  } satisfies FabriqueDuNoyau;
}
