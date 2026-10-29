/** Transition du jeu (#2817 D7) : ce que le propriétaire de l'état applique après CHAQUE écriture,
 *  par sa seule observation de l'état avant/après. */
import { blessuresReconciliees } from '../engine/characteristics';
import type { Combatant } from '../engine/types';
import { CHEMINS_DES_COMBATTANTS } from './combattantsDeLEtat.generated';
import { releaseRecomposedRanks } from './monde/seating';
import type { EtatDeJeu } from './etat';

/**
 * Rend l'écriture que la transition de `prev` à `s` appelle, ou `null`. Elle compose deux
 * observations de la même écriture : les Blessures des combattants touchés (`blessuresSuivies`) et
 * l'occupation des sièges (`chaisesLevees`).
 */
export function transitionDuJeu(prev: EtatDeJeu, s: EtatDeJeu): Partial<EtatDeJeu> | null {
  const scene = chaisesLevees(prev, s);
  const ecriture = { ...blessuresSuivies(prev, s), ...(scene ? { scene } : {}) };
  return Object.keys(ecriture).length ? ecriture : null;
}

/**
 * LE MAXIMUM DES BLESSURES SUIT SES PORTEURS (LDB 05 l.1001, LDB 48 l.23, LDB 48 l.27). Tout champ de
 * premier niveau que l'écriture a remplacé voit chaque combattant qu'il porte réconcilié par
 * `blessuresReconciliees`, à chaque chemin de `CHEMINS_DES_COMBATTANTS` — dérivé du type `EtatDeJeu`
 * (`scripts/gen-combattants-de-l-etat.mjs`), aucune collection nommée ici. Un acteur muté EN PLACE
 * garde son objet (`touchActors`) : c'est le champ remplacé qui dit qu'il a pu changer, jamais
 * l'identité du combattant. Seul un combattant dont les Blessures bougent est copié, avec ses
 * conteneurs ; tout autre objet rendu est celui reçu, et une écriture déjà réconciliée ne rend rien
 * (réentrance structurelle).
 */
function blessuresSuivies(prev: EtatDeJeu, s: EtatDeJeu): Partial<EtatDeJeu> {
  const ecriture: Record<string, unknown> = {};
  for (const [champ, ...chemin] of CHEMINS_DES_COMBATTANTS) {
    if (s[champ] === prev[champ]) continue;
    const courant = champ in ecriture ? ecriture[champ] : s[champ];
    const suivi = reconcilierAuChemin(courant, chemin);
    if (suivi !== courant) ecriture[champ] = suivi;
  }
  return ecriture as Partial<EtatDeJeu>;
}

/** `valeur` dont chaque combattant au bout de `chemin` est réconcilié ; la MÊME référence si rien ne bouge. */
function reconcilierAuChemin(valeur: unknown, chemin: readonly string[]): unknown {
  if (valeur == null) return valeur;
  if (!chemin.length) {
    const c = valeur as Combatant;
    const wounds = blessuresReconciliees(c);
    return wounds === c.wounds ? c : { ...c, wounds };
  }
  const [pas, ...reste] = chemin;
  if (pas === '[]') {
    const elements = valeur as readonly unknown[];
    const suivis = elements.map((e) => reconcilierAuChemin(e, reste));
    return suivis.some((e, i) => e !== elements[i]) ? suivis : elements;
  }
  const objet = valeur as Record<string, unknown>;
  const suivi = reconcilierAuChemin(objet[pas], reste);
  return suivi === objet[pas] ? objet : { ...objet, [pas]: suivi };
}

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
 * rendue ici produit une occupation neuve, donc ne se rejoue pas. Les ids du groupe ne bougent pas
 * avec ses Blessures : la chaise se lit sur `s`, dans la même transition.
 * Rend la scène aux chaises levées, ou `null` quand aucune ne se lève.
 */
function chaisesLevees(prev: EtatDeJeu, s: EtatDeJeu): EtatDeJeu['scene'] {
  const scene = s.scene;
  if (s.party === prev.party || !scene?.seatAssignments || scene.seatAssignments !== prev.scene?.seatAssignments) return null;
  const debout = releaseRecomposedRanks(scene, prev.party, s.party);
  return debout === scene ? null : debout;
}
