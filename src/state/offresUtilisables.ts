/**
 * LES PASTILLES D'EXPLORATION (#1687 lot 3-I-b) — second producteur de l'invariant `OffreRendue`.
 *
 * Hors combat, ce qu'une chose du champ offre, et son verdict, sont dits par le noyau
 * (`offresDExploration`, sur le dériveur UNIQUE `actionsDe`) et joués par l'exécuteur UNIQUE `jouerAction` :
 * ce module n'en est que la PROJECTION vers la pastille, pas une seconde source d'offre. Aucun `ActionDef`, aucune entrée au registre des actions de combat (dont
 * les gates exigent un combat ouvert et un actif contrôlé).
 *
 * RÉGIME — celui du COMBAT, à la lettre : les pastilles se montrent sur TOUS les porteurs à PORTÉE
 * du groupe, sans rien devoir au survol (`registreOffres.entityGestes`, qui rend les porteurs à
 * portée du combattant actif). Un hôte, un régime.
 *
 * Le survol ne PEUT pas porter ce régime : le bouton flotte au-dessus de la tête du porteur, donc le
 * viser fait quitter sa case — la pastille se démontait sous le curseur au bout de ~19 px de trajet
 * (recette 2026-09-11), et le panneau borné était inatteignable à la souris. Au tactile il n'y a pas
 * de survol du tout (`gameIso/stage/pointerCaps.ts`), donc pas de pastille. Le survol sert le HALO,
 * pas l'offre.
 *
 * COÛT : `null`. L'économie du tour est celle du combat ; hors combat, un geste ne prend pas d'Action.
 */
import { offresDExploration } from '../noyau/interactionsDExploration';
import type { GameState } from './store';
import type { OffresRenduesParPorteur } from './offreRendue';

/** Les offres d'exploration du noyau (`offresDExploration`) dans la forme que la pastille peint, chacune commise
 *  par l'exécuteur unique `jouerAction`. */
export function offresUtilisables(state: GameState): OffresRenduesParPorteur[] {
  return offresDExploration(state).map(({ porteurId, porteurLabel, offres }) => ({
    porteurId,
    porteurLabel,
    offres: offres.map((o) => ({ id: o.id, label: o.label, cost: null, gate: o.gate, onSelect: () => state.jouerAction(porteurId, o.id) })),
  }));
}
