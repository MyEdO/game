/**
 * Le décompte du Surnombre (LDB 14 l.110) : combien de combattants d'un camp sont au contact d'une cible. Source
 * unique de la résolution de mêlée (`outnumberMod`, `noyau/combatFlow.ts`), de l'État de situation Assailli
 * (`noyau/pontDeCombat.ts`) et du feu concentré de l'IA (`noyau/monde/ai.ts`) ; le binôme au contact du jezaïl
 * (`bouclierDuBinome`, ZI 13 l.193).
 */
import type { Combatant, Weapon } from '../../engine/types';
import type { BattleState, Jeu } from '../etat';
import type { Scene } from '../monde/scene';
import { isOutOfAction } from '../../engine/conditions';
import { isInanimate } from '../../engine/structures';
import { distanceDeContact } from '../monde/footprint';

/** Parmi `combattants`, ceux du camp `kind`, vivants, posés, animés (`isInanimate`) et au contact de `cible`
 *  (`distanceDeContact`, relief compris), hors monture chevauchée (`riderId`, comme `isMount` de `noyau/mount.ts`, dont
 *  l'import ferme un cycle) : son cavalier la représente. ZI 13 l.193 ; LDB 14 l.110 ; arbitrage du 2026-11-16, #4202 */
export function auContactParmi(scene: Scene | null, combattants: readonly Combatant[], cible: Combatant, kind: Combatant['kind']): Combatant[] {
  return combattants.filter((c) => c.kind === kind && !c.riderId && !isOutOfAction(c) && !isInanimate(c) && c.pos && distanceDeContact(scene, c, cible) <= 1);
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

/** `effectifAuContactParmi` sur tous les combattants de la bataille. */
export function effectifAuContact(scene: Scene | null, battle: BattleState, cible: Combatant, kind: Combatant['kind']): number {
  return effectifAuContactParmi(scene, battle.combatants, cible, kind);
}

/** `bouclierDuBinome` parmi les combattants de la bataille en cours : le paramètre des défenses (`protectriceAP`,
 *  `rangedDefenseModes`) et des refus de Course et de Fuite. */
export function bouclierDuBinomeEnJeu(s: Pick<Jeu, 'scene' | 'battle'>, c: Combatant): Weapon | undefined {
  return s.battle ? bouclierDuBinome(s.scene, s.battle.combatants, c) : undefined;
}
