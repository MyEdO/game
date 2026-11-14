/**
 * LE PONT DE COMBAT — ce que la console d'un hôte montre de la situation : le combattant qu'elle porte à
 * l'ouverture d'un combat (pause de Round, personne n'agit encore) et les États de SITUATION de l'acteur, qui ne
 * vivent pas sur le Combatant mais sur le combat. Lecteurs PURS, partagés par l'écran web et par tout hôte qui
 * lit la partie sans écran ; l'hôte ne garde que le chrome (icône, sévérité, libellé).
 */
import type { Combatant } from '../engine/types';
import type { BattleState, Jeu } from './etat';
import type { Scene } from './monde/scene';
import { isOutOfAction } from '../engine/conditions';
import { controlsCombatant } from './netOwnership';
import { inBattleId } from './monde/combatants';
import { effectifAuContact } from './combat/surnombre';
import { outnumberMod } from '../engine/combat';

/** Le combattant du pont à l'ouverture : un combattant vivant que le siège local pilote, à défaut un héros vivant
 *  (partie conduite par l'IA), à défaut un combattant piloté, et seulement en dernier recours la tête de
 *  l'initiative — qui, sur une embuscade, est un ennemi. */
export function pontDOuverture(s: Jeu): Combatant | undefined {
  const battle = s.battle;
  if (!battle) return undefined;
  const ordonnes = battle.order.map((id) => inBattleId(battle, id)).filter((c): c is Combatant => !!c);
  const debout = ordonnes.filter((c) => !isOutOfAction(c));
  return debout.find((c) => controlsCombatant(s, c))
    ?? debout.find((c) => c.kind === 'heros')
    ?? ordonnes.find((c) => controlsCombatant(s, c))
    ?? inBattleId(battle, battle.order[0]);
}

/** Les États de situation, keyés par id stable : Assailli (`nombre` d'adversaires d'un même camp au contact, au seuil
 *  du Surnombre que la résolution accorde, `outnumberMod` ; `null` sous ce seuil), Cloué (`fearGate`), Renfort de
 *  pièce (servant qui n'est pas le chef, `crewIds[0]`). */
export interface EtatsDeSituation {
  assailli: { nombre: number } | null;
  cloue: boolean;
  renfort: boolean;
}

/** Les États de situation de `active` dans `battle`. LDB 14 l.110 ; LDB 21 l.27 ; `ShipPoste.crewIds`. */
export function etatsDeSituation(scene: Scene | null, active: Combatant, battle: BattleState): EtatsDeSituation {
  const camps = new Set(battle.combatants.map((c) => c.kind).filter((k) => k !== active.kind));
  const nombre = Math.max(0, ...[...camps].map((k) => effectifAuContact(scene, battle, active, k)));
  return {
    assailli: outnumberMod(nombre) ? { nombre } : null,
    cloue: battle.fearGate === 'failed',
    renfort: !!active.mannedPoste && active.mannedPoste.crewIds?.[0] !== active.id,
  };
}
