import type { Combatant, Weapon } from '../../engine/types';
import type { Jeu } from '../etat';
import type { Scene } from '../monde/scene';
import { isOutOfAction } from '../../engine/conditions';
import { isEngagedWith } from '../../engine/engagement';
import { outnumberMod, type ModLine } from '../../engine/combat';
import { outnumberCountBonus } from '../../engine/combatFeatures/dispatch';
import { isInanimate } from '../../engine/structures';
import { distanceDeContact } from '../monde/footprint';

function compteDansLeCombat(c: Combatant): boolean {
  return !isOutOfAction(c) && !isInanimate(c);
}

interface UniteDeCombat {
  representant: Combatant;
  membres: Combatant[];
}

/** Arbitrage #4202 ; LDB 14 l.181–182. */
function unitesDuSurnombre(combattants: readonly Combatant[], ...acteursDuDuel: Combatant[]) {
  const parId = new Map(combattants.map((c) => [c.id, c]));
  for (const c of acteursDuDuel) parId.set(c.id, c);
  const parRepresentant = new Map<string, UniteDeCombat>();
  const parMembre = new Map<string, UniteDeCombat>();
  for (const c of parId.values()) {
    if (!compteDansLeCombat(c)) continue;
    const cavalier = c.riderId ? parId.get(c.riderId) : undefined;
    const representant = cavalier ?? c;
    const unite = parRepresentant.get(representant.id) ?? { representant, membres: [] };
    unite.membres.push(c);
    parRepresentant.set(representant.id, unite);
    parMembre.set(c.id, unite);
  }
  return { unites: [...parRepresentant.values()], parMembre };
}

function unitesEngagees(a: UniteDeCombat, b: UniteDeCombat): boolean {
  return a.membres.some((c) => b.membres.some((autre) => isEngagedWith(c, autre.id)));
}

interface Surnombre {
  attaquants: number;
  defenseurs: number;
  mod: ModLine;
}

/** LDB 13 l.171 ; LDB 14 l.110 ; LDB 10 l.765 ; CRB 036 l.191 ; arbitrage #4202. */
function surnombreDuDuel(unites: readonly UniteDeCombat[], attaquant: UniteDeCombat, cible: UniteDeCombat): Surnombre | null {
  if (attaquant.representant.kind === cible.representant.kind) return null;

  // L'attaque crée le lien de la paire évaluée ; les renforts se lisent par leurs liens déjà posés.
  let attaquants = 1;
  const defenseurs = [cible];
  for (const unite of unites) {
    if (unite === attaquant || unite === cible) continue;
    if (unite.representant.kind === attaquant.representant.kind && unitesEngagees(cible, unite)) attaquants++;
    if (unite.representant.kind === cible.representant.kind && unitesEngagees(attaquant, unite)) defenseurs.push(unite);
  }
  if (attaquants < 2 * defenseurs.length) return null;

  const effectifDefense = defenseurs.reduce((effectif, { representant }) =>
    effectif + 1 + (compteDansLeCombat(representant) ? outnumberCountBonus(representant) : 0), 0);
  const mod = outnumberMod(Math.floor(attaquants / effectifDefense));
  return mod ? { attaquants, defenseurs: effectifDefense, mod } : null;
}

/** Surnombre de l'attaque résolue ou envisagée. LDB 13 l.171 ; LDB 14 l.110 */
export function surnombreDeLAttaque(combattants: readonly Combatant[], attaquant: Combatant, cible: Combatant): ModLine | null {
  const { unites, parMembre } = unitesDuSurnombre(combattants, attaquant, cible);
  const offensive = parMembre.get(attaquant.id);
  const defensive = parMembre.get(cible.id);
  return offensive && defensive ? surnombreDuDuel(unites, offensive, defensive)?.mod ?? null : null;
}

/** Surnombre subi dans un Engagement existant. LDB 14 l.110 */
export function surnombreSubi(combattants: readonly Combatant[], cible: Combatant): Surnombre | null {
  const { unites, parMembre } = unitesDuSurnombre(combattants, cible);
  const defensive = parMembre.get(cible.id);
  if (!defensive) return null;
  let surnombre: Surnombre | null = null;
  for (const adversaire of unites) {
    if (!unitesEngagees(defensive, adversaire)) continue;
    const courant = surnombreDuDuel(unites, adversaire, defensive);
    if (courant && (!surnombre || courant.attaquants > surnombre.attaquants)) surnombre = courant;
  }
  return surnombre;
}

/** Les combattants posés et au contact de la cible. ZI 13 l.193 ; arbitrage #4202. */
export function auContactParmi(scene: Scene | null, combattants: readonly Combatant[], cible: Combatant, kind: Combatant['kind']): Combatant[] {
  return combattants.filter((c) => c.kind === kind && !c.riderId && compteDansLeCombat(c) && c.pos && distanceDeContact(scene, c, cible) <= 1);
}

/** Le décompte d'`auContactParmi`. */
export function effectifAuContactParmi(scene: Scene | null, combattants: readonly Combatant[], cible: Combatant, kind: Combatant['kind']): number {
  return auContactParmi(scene, combattants, cible, kind).length;
}

/** Le bouclier du binôme de `c` (ZI 13 l.193) : celui que tient un allié au contact (`auContactParmi`) quand `c` tient
 *  une arme dont c'est le `bouclierDEquipe`, ou celui que `c` tient au contact d'un allié qui tient une telle arme.
 *  `undefined` hors binôme. */
export function bouclierDuBinome(scene: Scene | null, combattants: readonly Combatant[], c: Combatant): Weapon | undefined {
  if (isOutOfAction(c) || isInanimate(c) || !c.pos) return undefined;
  const allies = auContactParmi(scene, combattants, c, c.kind).filter((a) => a.id !== c.id);
  for (const arme of c.weapons) {
    const id = arme.bouclierDEquipe?.id;
    const tenu = id && allies.flatMap((a) => a.weapons).find((w) => w.trappingId === id);
    if (tenu) return tenu;
  }
  return c.weapons.find((b) => b.trappingId && allies.some((a) => a.weapons.some((w) => w.bouclierDEquipe?.id === b.trappingId)));
}

/** `bouclierDuBinome` parmi les combattants de la bataille en cours : le paramètre des défenses (`protectriceAP`,
 *  `rangedDefenseModes`) et des refus de Course et de Fuite. */
export function bouclierDuBinomeEnJeu(s: Pick<Jeu, 'scene' | 'battle'>, c: Combatant): Weapon | undefined {
  return s.battle ? bouclierDuBinome(s.scene, s.battle.combatants, c) : undefined;
}
