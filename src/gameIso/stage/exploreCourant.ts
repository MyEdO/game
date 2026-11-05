/**
 * L'EXPLORÉ DE LA SCÈNE — la dérivation de l'hôte du monde (`stage/MondeDeCampagne`), servie à ses DEUX
 * regards. La transition du jeu fond la vue dans l'exploré par l'écriture même qui l'a changée
 * (`noyau/transitionDuJeu.ts`) : un pas ne passe qu'UN champ de teinte (#1396).
 *
 * Sa RÉFÉRENCE ne change qu'au CONTENU : un instantané coop ou un chargement rend un tableau neuf mais
 * égal, et la teinte qui en descend (`visibilityField`) ne doit pas s'y reforger.
 */
import { useMemo, useRef } from 'react';

/** L'exploré du store pour cette scène — référence stable au CONTENU. */
export function useExploreCourant(explored: Record<string, string[]>, sceneId: string | undefined): Set<string> {
  const retenu = useRef<Set<string> | null>(null);
  const cases = explored[sceneId ?? ''];
  return useMemo(() => {
    const set = new Set(cases);
    const précédent = retenu.current;
    if (précédent && précédent.size === set.size) {
      let identique = true;
      for (const k of set) if (!précédent.has(k)) { identique = false; break; }
      if (identique) return précédent;
    }
    retenu.current = set;
    return set;
  }, [cases]);
}
