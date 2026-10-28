/**
 * Verdicts de la DÉPENSE DE PX, en module FEUILLE : la couture `depenserPx` (`noyau/partyFlow.ts`) et la
 * vue d'avancement (`noyau/monde/advancement.ts`) les lisent toutes deux, sans que l'une importe l'autre.
 */
import { mentorBlocks, validateCareerChange, type CareerChangeContext } from '../engine/advancement';
import { rule } from '../engine/policy';
import { talentMaxReached, arcaneDomainGate } from '../engine/careerSlots';
import { findTalentById, refLabel, findCareerById, levelsForCareer } from '../data/index';
import { t } from '../i18n';
import type { Jeu } from './etat';
import { refusEnCombat, type VerdictDeGeste } from './verrousDeFiche';
import type { Combatant } from '../engine/types';

/** Refus d'une dépense de PX : la raison affichée, ou `null`. LDB 05 l.907 */
export const refusDepensePx: VerdictDeGeste = refusEnCombat('pf.xpInCombat');

/** Une Augmentation hors carrière exige-t-elle un mentor absent (règle `advancement-mentor`, flag de
 *  partie `mentor`) ? Verdict UNIQUE de l'achat et de la vue d'avancement. LDB 07 l.89 */
export function mentorRequis(s: Pick<Jeu, 'flags'>, inCareer: boolean): boolean {
  return mentorBlocks(inCareer, rule('advancement-mentor') === true, !!s.flags['mentor']);
}

/** Libellé d'affichage d'une Compétence/Talent concret : nom, et spécialisation entre parenthèses. */
export function libelleAvecSpec(name: string, spec?: string): string {
  return spec ? `${name} (${spec})` : name;
}

/** Refus d'acquérir le Talent (id, spec) propre au Talent : Maxi atteint (LDB 10), puis Domaine
 *  arcanique refusé (`arcaneDomainGate`, LDB 46 l.177). Verdict UNIQUE de `buyTalent` et de la vue
 *  d'avancement ; le combat et les PX se refusent à part (`refusDepensePx`). */
export function refusDAcquerirLeTalent(hero: Combatant, talentId: string, spec: string | undefined): string | null {
  const label = refLabel('talents', { id: talentId, spec });
  if (talentMaxReached(hero, talentId, spec)) return t('pf.talentMaxed', { name: hero.label, label });
  if (spec == null || !findTalentById(talentId)?.grantsArcaneDomain) return null;
  const gate = arcaneDomainGate(hero, spec);
  return gate.ok ? null : t('pf.refused', { name: hero.label, what: label, reason: gate.reason ?? '' });
}

/** Refus d'une dépense de `cost` PX que le héros n'a pas : la raison affichée, ou `null`. Verdict UNIQUE
 *  des achats de progression (en tête du geste, avant le moteur) et de la vue d'avancement. */
export function refusDePx(hero: Combatant, cost: number): string | null {
  return (hero.xp ?? 0) < cost ? t('pf.notEnoughXp', { name: hero.label, cost }) : null;
}

/** Contexte d'un changement de Carrière de `hero` vers (`newCareer`, `newLevel`) : complétion du niveau
 *  courant (fournie par l'appelant), même Classe, niveau cible existant, Saut de Niveau (règle). LDB 07 l.137-148 */
export function contexteDeChangement(hero: Combatant, newCareer: string, newLevel: number, completed: boolean): CareerChangeContext {
  return {
    completed,
    sameClass: findCareerById(hero.career ?? '')?.class === findCareerById(newCareer)?.class,
    targetLevelExists: levelsForCareer(newCareer).some((l) => l.level === newLevel),
    gmJump: rule('advancement-career-jump') === true,
  };
}

/** Refus de changer de Carrière : combat, cible fermée (`validateCareerChange`), puis PX — la raison que
 *  rend `changeCareer`, ou `null`. Verdict UNIQUE du geste et de la vue d'avancement. */
export function refusDeChangerDeCarriere(
  s: Pick<Jeu, 'battle'>, hero: Combatant, newCareer: string, newLevel: number, completed: boolean,
): string | null {
  const v = validateCareerChange(hero, newCareer, newLevel, contexteDeChangement(hero, newCareer, newLevel, completed));
  return refusDepensePx(s) ?? (v.ok ? refusDePx(hero, v.cost) : t('pf.careerRefused', { name: hero.label, reason: v.reason ?? '' }));
}
