/**
 * LES RÉGLAGES DE L'INCANTATION EN ATTENTE (#3328) : ce qui ferme maintenant chacun des verbes qui règlent `pendingCast`
 * (`REGLAGES_DE_L_INCANTATION`). Lu par leurs ops, qui ne jouent qu'ouverts, par la fenêtre qui tient la main
 * (`fermeturesDeLaFenetre`) et par la modale d'incantation : un réglage ne s'offre que là où il change le Sort.
 */
import type { Jeu } from './etat';
import type { FermetureDuJet } from './rollFlowFactory';
import { REGLAGES_DE_L_INCANTATION } from './reglages';
import { actorIn } from './monde/combatants';
import { aiDriven, influencesLocally } from './netOwnership';
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
  // Le moteur règle seul le lanceur qu'il conduit (`aiDriven`) ; le réglage offert se refuse au siège qui ne pilote pas
  // le lanceur (`influencesLocally`).
  const ici = (offert: boolean): FermetureDuJet | null => (!offert || aiDriven(s, lanceur) ? 'nonOffert' : influencesLocally(s, lanceur.id) ? null : 'rangeeTemoin');
  const ops = spellEffectOps(sort.effects);
  return {
    // LDB 46 l.26-32
    castSetCritChoice: !jet ? 'jetNonLance' : ici(jet.isCritical && !priere),
    // LDB 47
    castSetConjureForm: ici(ops.some((o) => o.op === 'grantWeapon' && o.chooseForm) && conjureFormOptions(lanceur).length > 0),
    // LDB 40 l.42
    castSetDiscreet: jet ? 'jetLance' : ici(priere && !!rule('prayer-conviction')),
    // EDOC 13 l.276
    castSetChosenTableRolls: !jet ? 'jetNonLance' : ici(jet.cast && (pc.overcast?.duration ?? 0) > 0 && spellHasOvercastTableRoll(ops)),
  };
}
