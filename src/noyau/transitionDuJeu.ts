/** Transition du jeu (#2817 D7) : ce que le propriétaire de l'état applique après CHAQUE écriture,
 *  par sa seule observation de l'état avant/après. */
import { releaseRecomposedRanks } from './monde/seating';
import type { EtatDeJeu } from './etat';

/**
 * OCCUPATION AU RUNTIME — LA CHAISE SUIT LE CORPS. COUTURE UNIQUE, et PAR CONSTRUCTION : elle ne
 * s'accroche pas aux écrivains de `party` (un seul oublié rouvrirait le défaut), elle observe la
 * TRANSITION d'état. Tout ce qui recompose le groupe — `partyAddHero`/`partyRemoveHero`/
 * `partyReplaceHero`, `setParty` en bloc, devtools, un écran de test, un snapshot coop, une permutation
 * écrite à la main — y passe sans le savoir : le corps présent à chaque emplacement ASSIS est comparé
 * avant/après, et l'emplacement dont le corps a changé (ou disparu) se lève.
 * Ce qui décide n'est PAS la scène (une scène patchée dans la même écriture reste la même partie),
 * c'est l'OCCUPATION EN VIGUEUR : on réconcilie quand l'écriture n'a pas apporté une occupation
 * NEUVE. Une occupation neuve — chargement de save, `startScene`, `transitionTo`, snapshot coop,
 * élagage, geste d'assise — arrive avec sa propre vérité, déjà élaguée à sa source ; il n'y a alors
 * rien à réconcilier. C'est aussi ce qui rend la réentrance structurelle : l'écriture de libération
 * rendue ici produit une occupation neuve, donc ne se rejoue pas.
 * Rend l'écriture à appliquer, ou `null` quand la transition n'appelle rien.
 */
export function transitionDuJeu(prev: EtatDeJeu, s: EtatDeJeu): Partial<EtatDeJeu> | null {
  const scene = s.scene;
  if (s.party === prev.party || !scene?.seatAssignments || scene.seatAssignments !== prev.scene?.seatAssignments) return null;
  const debout = releaseRecomposedRanks(scene, prev.party, s.party);
  return debout === scene ? null : { scene: debout };
}
