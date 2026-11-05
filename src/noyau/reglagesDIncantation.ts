/**
 * LES RÉGLAGES DE L'INCANTATION EN ATTENTE (#3328) : ce qui ferme maintenant chacun des verbes qui règlent `pendingCast`
 * (`REGLAGES_DE_L_INCANTATION`). Lu par leurs ops, qui ne jouent qu'ouverts, par la fenêtre qui tient la main
 * (`fermeturesDeLaFenetre`) et par la modale d'incantation : un réglage ne s'offre que là où il change le Sort.
 */
import type { Jeu } from './etat';
import type { FermetureDuJet } from './rollFlowFactory';
import { REGLAGES_DE_L_INCANTATION } from './reglages';
import { actorIn } from './monde/combatants';
import { influencesLocally } from './netOwnership';
import { findSpellById } from '../data/index';
import { castInfoIsPrayer } from '../engine/magic';
import { spellEffectOps } from '../engine/flowCore';
import { conjureFormOptions } from '../engine/conjuredWeapons';
import { spellHasOvercastTableRoll } from '../engine/overcast';
import { rule } from '../engine/policy';

/** Ce qui ferme chaque réglage de l'incantation en attente (`null` : ouvert) ; `null` sans incantation. */
export function fermeturesDeLIncantation(s: Jeu): Record<(typeof REGLAGES_DE_L_INCANTATION)[number], FermetureDuJet | null> | null {
  const pc = s.pendingCast;
  const sort = pc && findSpellById(pc.spellId);
  const lanceur = pc && actorIn(s, pc.casterId);
  if (!pc || !sort || !lanceur) return null;
  const jet = pc.result;
  const priere = castInfoIsPrayer(sort);
  const ici = influencesLocally(s, lanceur.id);
  const ops = spellEffectOps(sort.effects);
  return {
    // LDB 46 l.26-32
    castSetCritChoice: !jet ? 'jetNonLance' : jet.isCritical && !priere && ici ? null : 'nonOffert',
    // LDB 47
    castSetConjureForm: ops.some((o) => o.op === 'grantWeapon' && o.chooseForm) && conjureFormOptions(lanceur).length ? null : 'nonOffert',
    // LDB 40 l.42
    castSetDiscreet: jet ? 'jetLance' : priere && rule('prayer-conviction') ? null : 'nonOffert',
    // EDOC 13 l.276
    castSetChosenTableRolls: !jet ? 'jetNonLance' : jet.cast && ici && (pc.overcast?.duration ?? 0) > 0 && spellHasOvercastTableRoll(ops) ? null : 'nonOffert',
  };
}
