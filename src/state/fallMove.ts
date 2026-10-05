import { Scene, WallSeg, wallIsOpen, edgeOf, heightAt, surfaceDAtterrissage } from './scene';
import { gradeBetween } from './relief';
import { aretesA } from './wallIndex';
import type { Pt } from './path';
import type { PendingFall, TombantParticipant } from './pendings';
import { rule } from '../engine/policy';
import { climbMovementCost } from '../engine/movement';

/**
 * FRANCHISSEMENT d'une arête par un GESTE — planificateur UNIQUE de la chute VOLONTAIRE « à dessein »
 * (LDB 15 l.82) et de la croisée franchissable (`WallSeg.crossable`, #700 ; EDO 01 l.229), dont la hauteur de suspension
 * (`WallSeg.suspendu`, EDO 01 l.231). Répond :
 * « où atterrit-on, et de quelle hauteur tombe-t-on, quand on quitte volontairement une surface ? »
 * L'atterrissage vient de `surfaceDAtterrissage` (toutes couches) ; `gradeBetween` tranche : `cliff`
 * descendant → `fall` ; pas `flat`/`ramp` à travers une croisée franchissable → `enjamber` (LDB 15
 * l.55, `WallSeg.allege`). Une croisée sans allège ne se franchit pas (#700 issuecomment-5984719806).
 * Le pathfinding ne traverse jamais une croisée (arbitrage #1712, 2026-09-08) : seul ce geste la franchit.
 *
 * La résolution du Test de chute (numérique, DR-driven, LDB 15 l.82) vit dans `rollFlowSpecs.fall`
 * (patron `pendingRun`), PAS ici : contrairement à `climbMove.ts`/`flow.ts::testFlow` (binaire, réservé
 * à l'Escalade), la réduction « −1 m par DR » exige la sortie NUMÉRIQUE de la modale canonique.
 */
export type RefusFranchissement =
  | 'non-adjacente' // pas une case cardinale voisine
  | 'aucune-surface' // rien de marchable à atteindre en (to.x, to.y)
  | 'muree' // l'arête barre le pas et n'est pas une croisée franchissable
  | 'escalade' // arête grimpable → flux dédié (`climbAcross`/Escalade)
  | 'marche'; // pas ordinaire sans croisée : la marche, pas un geste

/** `fall` : `suspendu` = hauteur de chute de qui SE SUSPEND d'abord (EDO 01 l.231), présente
 *  seulement sous `metres` ; `allege` = le saut passe par une croisée franchissable, d'allège `allege` m. */
export type PlanFranchissement =
  | { kind: 'none'; raison: RefusFranchissement }
  | { kind: 'fall'; metres: number; to: Pt; suspendu?: number; allege?: number }
  | { kind: 'enjamber'; to: Pt; allege: number };

/** Défaut d'AUTEUR de la hauteur de suspension (`WallSeg.suspendu`) sur un pas : jamais offerte, lue
 *  par `planDefects`. `trop-haute` = pas sous la hauteur réelle du saut ; `plain-pied` = croisée qu'on
 *  enjambe. */
export type DefautDeSuspension = 'trop-haute' | 'plain-pied';

type Analyse = { plan: PlanFranchissement; defaut?: DefautDeSuspension };

const refus = (raison: RefusFranchissement): Analyse => ({ plan: { kind: 'none', raison } });

/** Croisée franchissable, son allège authorée (`LDB 15 l.55` ; #700 issuecomment-5984719806). */
const estCroiseeFranchissable = (w: WallSeg): w is WallSeg & { allege: number } => !!w.window && !!w.crossable && w.allege !== undefined;

function analyser(scene: Scene, from: Pt, to: Pt): Analyse {
  const e = edgeOf(from.x, from.y, to.x, to.y);
  if (!e) return refus('non-adjacente');
  const hDepart = heightAt(scene, from.x, from.y, from.z ?? 0);
  const atterrissage = surfaceDAtterrissage(scene, to.x, to.y, hDepart);
  if (atterrissage.kind === 'aucune-surface') return refus('aucune-surface');
  // L'arête se lit à la couche la PLUS HAUTE du pas (patron `path.ts::neighborsOf`).
  const zHaut = Math.max(from.z ?? 0, atterrissage.to.z ?? 0);
  const barrent = aretesA(scene, e.x, e.y, e.side, zHaut).filter((w) => !wallIsOpen(scene, w));
  if (barrent.some((w) => !!w.climb)) return refus('escalade');
  const croisees = barrent.length > 0 && barrent.every(estCroiseeFranchissable) ? barrent : null;
  if (barrent.length > 0 && !croisees) return refus('muree');
  // UNE arête, UN segment (#1624) : la croisée est la première.
  const croisee = croisees?.[0];
  const suspendu = croisee?.suspendu;
  if (gradeBetween(hDepart, atterrissage.hauteur) === 'cliff') {
    const metres = hDepart - atterrissage.hauteur;
    const plan = { kind: 'fall' as const, metres, to: atterrissage.to, ...(croisee ? { allege: croisee.allege } : {}) };
    if (suspendu === undefined) return { plan };
    return suspendu < metres ? { plan: { ...plan, suspendu } } : { plan, defaut: 'trop-haute' };
  }
  if (!croisee) return refus('marche');
  return { plan: { kind: 'enjamber', to: atterrissage.to, allege: croisee.allege }, ...(suspendu !== undefined ? { defaut: 'plain-pied' as const } : {}) };
}

/** `from` = case du mobile (couche comprise), `to` = case cardinale adjacente visée — sa couche
 *  d'arrivée est celle d'ATTERRISSAGE, recalculée ici. PUR. */
export function planFranchissement(scene: Scene, from: Pt, to: Pt): PlanFranchissement {
  return analyser(scene, from, to).plan;
}

/** Le défaut d'auteur de la hauteur de suspension sur ce pas, s'il y en a un. PUR. */
export function defautDeSuspension(scene: Scene, from: Pt, to: Pt): DefautDeSuspension | undefined {
  return analyser(scene, from, to).defaut;
}

/** Mouvement (cases) que coûte l'allège `allege` (m) de la croisée franchie — LDB 15 l.55.
 *  Lu par l'enjambée (`windowAcross`) et par la chute (`mouvementDeLaChute`). */
export function mouvementDeLAllege(allege: number, metresParCase: number): number {
  return climbMovementCost(allege, metresParCase);
}

/** Mouvement (cases) que coûte à un tombant, en combat, le geste de chute : le pas, l'allège de la
 *  croisée franchie (`WallSeg.allege`, LDB 15 l.55), la hauteur descendue s'il se suspend (maison
 *  `fenetre-suspension`, LDB 15 l.55, LDB 15 l.57, EDO 01 l.231). */
export function mouvementDeLaChute(
  p: { metres: number; suspendu?: number; allege?: number },
  suspendre: boolean,
  metresParCase: number,
): number {
  const allege = p.allege !== undefined ? mouvementDeLAllege(p.allege, metresParCase) : 0;
  const descente = suspendre && p.suspendu !== undefined && rule('fenetre-suspension') === 'descente-facile'
    ? climbMovementCost(p.metres - p.suspendu, metresParCase)
    : 0;
  return 1 + allege + descente;
}

/** Hauteur de chute RETENUE pour CE tombant (LDB 15 l.82) — la SEULE lecture de la hauteur d'une
 *  chute volontaire : la spec du Test (`rollFlowSpecs.fall`) et la résolution de l'étape (`store`
 *  `settleFall`) passent par elle. */
export function metresRetenus(p: PendingFall, part: TombantParticipant): number {
  if (!part.suspendre) return p.metres;
  if (p.suspendu === undefined) throw new Error(`metresRetenus : ${part.id} se suspend sans hauteur de suspension offerte`);
  return p.suspendu;
}

/** PHASE d'une chute volontaire, DÉRIVÉE de l'état (patron `counterspellDeclarePhase`) : `'choice'` tant
 *  qu'une rangée n'a pas déclaré ses DEUX axes — le Test (`attempt`) et, quand la suspension est offerte,
 *  la hauteur (`suspendre`) —, `'roll'` ensuite. */
export function phaseDeChute(p: PendingFall): 'choice' | 'roll' {
  const offerte = p.suspendu !== undefined;
  return p.participants.some((x) => x.attempt === null || (offerte && x.suspendre == null)) ? 'choice' : 'roll';
}
