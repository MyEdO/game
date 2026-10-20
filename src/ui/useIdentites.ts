/**
 * Les identités en vigueur (`identitesResolues`, `src/noyau/monde/identites.ts`), mémoïsées sur une clé PRIMITIVE
 * des couples figés (`cleDesIdentites`) et sur le narratif : un changement de PV ne rerend aucun site de prose de paquet.
 */
import { useMemo } from 'react';
import { useGame } from '../state/store';
import { cleDesIdentites, couplesDeLaCle, identitesResolues, type Identites } from '../noyau/monde/identites';

export function useIdentites(): Identites {
  const cle = useGame((s) => cleDesIdentites(s.identitesFigees));
  const campaignNarratif = useGame((s) => s.campaignNarratif);
  return useMemo(() => identitesResolues({ identitesFigees: couplesDeLaCle(cle), campaignNarratif }), [cle, campaignNarratif]);
}
