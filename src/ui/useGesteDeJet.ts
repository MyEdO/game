/**
 * Un verbe de jet du noyau (`VerbesDeJet`, le flux en premier argument) lié au flux d'une modale : le geste que
 * son bouton joue, avec les seuls arguments qui restent (la rangée `pid`, le dé posé).
 */
import { useCallback } from 'react';
import type { NomDeVerbeDeJet } from '../noyau/flowVerbs';
import type { VerbesDeJet } from '../noyau/rollFlowSpecs';
import { useGame } from '../state/store';

type Reste<T> = T extends (flux: never, ...reste: infer R) => void ? R : never;

/** Le verbe de jet `nom` sur le flux `flux`. */
export function useGesteDeJet<N extends NomDeVerbeDeJet>(nom: N, flux: Parameters<VerbesDeJet[N]>[0]): (...reste: Reste<VerbesDeJet[N]>) => void {
  const verbe = useGame((s) => s[nom]) as (flux: Parameters<VerbesDeJet[N]>[0], ...reste: Reste<VerbesDeJet[N]>) => void;
  return useCallback((...reste: Reste<VerbesDeJet[N]>) => verbe(flux, ...reste), [verbe, flux]);
}
