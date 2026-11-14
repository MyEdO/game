/** Enfoncer une porte à plusieurs (EDO 11 l.89-95) : le Test que chaque héros jette, ses dégâts et le
 *  bilan d'un Round. Lus par le résolveur (`FLOWS.enfoncerLaPorte`), par la clôture du Round (`jetValider('enfoncerLaPorte')`),
 *  par le choix de l'arme (réglage `enfoncerLaPorte.arme`) et par la fenêtre (`ForceDoorModal`). PUR. */
import type { Combatant, Weapon } from '../engine/types';
import { testValue, type TestDesigne } from '../engine/skills';
import { attackTestOf } from '../engine/combat';
import { effectiveWeaponDamage } from '../engine/weaponDamage';
import { bonusDeForce, forceDuPorteur } from '../engine/characteristics';
import type { ForceDoorParticipant, PendingForceDoor } from './pendings';
import { rollLine, type RollLineParts } from './ligneDeJet';

/** EDO 11 l.93. */
const TEST_A_MAINS_NUES = { skill: { id: 'corps-a-corps', spec: 'bagarre' } } as const;

/** Armes que le héros peut choisir pour enfoncer : EDO 11 l.93 ; décision de l'orchestrateur (2026-11-03,
 *  #3059) : toute arme de corps à corps tenue, au choix du joueur. */
export function armesDEnfoncement(actor: Combatant): Weapon[] {
  return actor.weapons.filter((w) => w.type === 'melee' && !w.unarmed && !w.natural && !!w.uid);
}

/** L'arme choisie par le participant (`armeUid`), `undefined` à mains nues. */
export function armeDEnfoncement(actor: Combatant, part: Pick<ForceDoorParticipant, 'armeUid'>): Weapon | undefined {
  return part.armeUid ? armesDEnfoncement(actor).find((w) => w.uid === part.armeUid) : undefined;
}

function testDEnfoncement(actor: Combatant, arme: Weapon | undefined): TestDesigne {
  return arme ? attackTestOf(actor, arme, 'melee') : TEST_A_MAINS_NUES;
}

/** Valeur du Test d'enfoncement — EDO 11 l.93. */
export function valeurDEnfoncement(actor: Combatant, arme: Weapon | undefined): number {
  const t = testDEnfoncement(actor, arme);
  return testValue(actor, t);
}

/** Ligne du Test d'enfoncement (`rollLine`) — EDO 11 l.93. */
export function ligneDEnfoncement(actor: Combatant, arme: Weapon | undefined): RollLineParts {
  return rollLine({ actor, test: testDEnfoncement(actor, arme), difficulty: 'intermediaire' });
}

/** Dégâts infligés à la porte au DR `sl` — EDO 11 l.93-95 ; décision de l'orchestrateur (2026-11-03,
 *  #3059) : avec une arme, ⌊dégâts de l'arme ÷ 2⌋ au lieu du Bonus de Force. */
export function degatsDEnfoncement(actor: Combatant, arme: Weapon | undefined, sl: number, doorBE: number): number {
  return Math.max(0, sl + (arme ? Math.floor(effectiveWeaponDamage(arme, forceDuPorteur(actor)) / 2) : bonusDeForce(actor)) - doorBE);
}

/** Bilan d'un Round d'enfoncement — EDO 11 l.89-95. `complet` : tous les héros ont frappé. */
export interface BilanDuRound { degats: number; reste: number; cede: boolean; complet: boolean }

export function bilanDuRound(p: PendingForceDoor): BilanDuRound {
  const degats = p.participants.reduce((s, x) => s + (x.result?.damage ?? 0), 0);
  const reste = p.doorB - degats;
  return { degats, reste, cede: reste <= 0, complet: p.participants.every((x) => x.result) };
}
