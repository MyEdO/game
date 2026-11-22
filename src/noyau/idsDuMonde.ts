/** Les ids du monde d'une partie (#2907) : la fabrique (`FabriqueDId`, `src/engine/fabriqueDId.ts`) qui lit et avance le
 *  compteur `prochainId` de l'état (`forgerUnId`), et le compte des combats ouverts (`marquerUnCombatOuvert`, #3009), l'identité
 *  du `battle` courant. Les compteurs voyagent dans la save et dans l'instantané coop. Seul l'hôte
 *  les écrit. L'id d'un héros de roster vient de l'entropie de la plateforme, que l'hôte passe à `engagerLeHeros`
 *  (`hote/roster.ts`). */
import { idDuGenre, type FabriqueDId, type GenreDId } from '../engine/fabriqueDId';
import type { EtatDeJeu } from './etat';
import type { Get, PatchDeFlux, SetDesClesReservees } from './flowTypes';
import type { FabriqueDuNoyau } from './machinerieDuNoyau';

function fabriqueDuCompteur(prochainId: number) {
  return {
    forgerUnId: (genre: GenreDId) => idDuGenre(genre, prochainId++),
    lireLeCompteur: () => prochainId,
  };
}

export function patchAvecIdsNeufs(
  etat: Pick<EtatDeJeu, 'prochainId'>,
  preparer: (idNeuf: FabriqueDId) => PatchDeFlux<EtatDeJeu>,
): Partial<EtatDeJeu> {
  const fabrique = fabriqueDuCompteur(etat.prochainId);
  const patch = preparer(fabrique.forgerUnId);
  const prochainId = fabrique.lireLeCompteur();
  return prochainId === etat.prochainId ? patch : { ...patch, prochainId };
}

export function creerFabriqueDIds(get: Get, set: SetDesClesReservees) {
  return {
    forgerUnId: (genre) => {
      const fabrique = fabriqueDuCompteur(get().prochainId);
      const id = fabrique.forgerUnId(genre);
      set({ prochainId: fabrique.lireLeCompteur() });
      return id;
    },
    /** L'UNIQUE écrivain de `combatsOuverts`, hors la garde de `lancerLaScene`. */
    marquerUnCombatOuvert: () => {
      set((s) => ({ combatsOuverts: s.combatsOuverts + 1 }));
    },
  } satisfies FabriqueDuNoyau;
}
