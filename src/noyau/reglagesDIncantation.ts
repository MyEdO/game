/**
 * L'OFFRE DES RÉGLAGES DE L'INCANTATION EN ATTENTE (#3328, #3368) : dans sa phase, un réglage de `pendingCast` ne s'offre
 * que là où il change le Sort (`DeclarationDuReglage.offre`, `REGLAGES_DU_JET.cast`). Lu par le verbe qui règle un jet
 * (`fermetureDuReglage`), par la fenêtre qui tient la main (`fermeturesDeLaFenetre`) et par la modale d'incantation.
 */
import type { Jeu } from './etat';
import type { FermetureDuJet } from './rollFlowFactory';
import type { ReglageDu } from './reglagesDuJet';
import { actorIn } from './monde/combatants';
import { influencesLocally } from './netOwnership';
import { findSpellById } from '../data/index';
import { castInfoIsPrayer } from '../engine/magic';
import { spellEffectOps } from '../engine/flowCore';
import { conjureFormOptions } from '../engine/conjuredWeapons';
import { spellHasOvercastTableRoll } from '../engine/overcast';
import { rule } from '../engine/policy';

/** Les réglages de l'incantation qu'une offre ferme. */
export type ReglageOffertDeLIncantation = Extract<ReglageDu<'cast'>, 'effetCritique' | 'formeConjuree' | 'discret' | 'jetsDeTable'>;

/** Ce qui ferme le réglage `reglage` de l'incantation en attente là où il ne change rien au Sort (`nonOffert`) ; `null` :
 *  il s'offre. Sans incantation, aucun ne s'offre. */
export function offreDeLIncantation(s: Jeu, reglage: ReglageOffertDeLIncantation): FermetureDuJet | null {
  const pc = s.pendingCast;
  const sort = pc && findSpellById(pc.spellId);
  const lanceur = pc && actorIn(s, pc.casterId);
  if (!pc || !sort || !lanceur) return 'nonOffert';
  const jet = pc.result;
  const ici = influencesLocally(s, lanceur.id);
  const ops = spellEffectOps(sort.effects);
  const offert = {
    // LDB 46 l.26-32
    effetCritique: () => !!jet?.isCritical && !castInfoIsPrayer(sort) && ici,
    // LDB 47
    formeConjuree: () => ops.some((o) => o.op === 'grantWeapon' && o.chooseForm) && conjureFormOptions(lanceur).length > 0,
    // LDB 40 l.42
    discret: () => castInfoIsPrayer(sort) && !!rule('prayer-conviction'),
    // EDOC 13 l.276
    jetsDeTable: () => !!jet?.cast && ici && (pc.overcast?.duration ?? 0) > 0 && spellHasOvercastTableRoll(ops),
  } satisfies Record<ReglageOffertDeLIncantation, () => boolean>;
  return offert[reglage]() ? null : 'nonOffert';
}
