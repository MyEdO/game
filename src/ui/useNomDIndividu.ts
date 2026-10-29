/**
 * Le nom des individus `ids` (Cible d'individu d'un Trait psy), lu sur l'état courant par `nomDIndividu`
 * (`noyau/monde/sceneNpc.ts`) : le composant ne se rafraîchit qu'au changement de CES noms. #3045
 */
import { useShallow } from 'zustand/react/shallow';
import { useGame } from '../state/store';
import { nomDIndividu } from '../noyau/monde/sceneNpc';
import type { NomDIndividu } from '../engine/psych/ciblage';

export function useNomDIndividu(ids: readonly string[]): NomDIndividu {
  const noms = useGame(useShallow((s) => ids.map((id) => nomDIndividu(s)(id))));
  return (id) => noms[ids.indexOf(id)];
}
