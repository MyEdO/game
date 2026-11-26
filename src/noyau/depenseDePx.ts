/**
 * Verdicts de la DÉPENSE DE PX, en module FEUILLE : la couture `depenserPx` (`noyau/partyFlow.ts`) et la
 * vue d'avancement (`noyau/monde/advancement.ts`) les lisent toutes deux, sans que l'une importe l'autre.
 */
import { coutDeLAugmentation, mentorBlocks, validateCareerChange, type CareerChangeContext, type CibleDAugmentation } from '../engine/advancement';
import { rule } from '../engine/policy';
import { talentMaxReached, arcaneDomainGate } from '../engine/careerSlots';
import { findTalentById, refLabel, findCareerById, levelsForCareer, byId, findSpellById, type SpellData } from '../data/index';
import { eligibleTalent, spellCost, verdictApprentissage } from '../engine/grimoire';
import { modeleDe } from '../engine/modeleDeProgression';
import { t } from '../i18n';
import type { Jeu } from './etat';
import { refusDepensePx } from './verrousDeFiche';
import type { Combatant } from '../engine/types';
import { nomDe } from '../engine/nom';


/** La règle optionnelle de progression `id` vaut-elle pour `hero` : active, et applicable à son modèle
 *  (`ModeleDeProgression.reglesOptionnelles`) ? LDB 07 l.89, l.140 */
export function regleDeProgression(hero: Combatant, id: 'progression-mentor' | 'progression-saut-de-niveau'): boolean {
  return rule(id) === true && modeleDe(hero).reglesOptionnelles;
}

/** Une Augmentation hors carrière de `hero` exige-t-elle un mentor absent (règle `progression-mentor`, flag de partie
 *  `mentor`) ? Lu par `refusDAugmentation`. LDB 07 l.89 */
function mentorRequis(s: Pick<Jeu, 'flags'>, hero: Combatant, inCareer: boolean): boolean {
  return mentorBlocks(inCareer, regleDeProgression(hero, 'progression-mentor'), !!s.flags['mentor']);
}

/** Refus d'augmenter par les PX la Compétence `skillId` hors carrière quand le modèle de `hero` ferme les Compétences
 *  avancées hors carrière, ou `null`. Lu par `refusDAugmentation`. CRB 018 l.69 */
function refusDeCompetenceHorsCarriere(hero: Combatant, skillId: string, what: string, inCareer: boolean): string | null {
  const fermee = !inCareer && !modeleDe(hero).horsCarriere.competencesAvancees && byId('skill', skillId)?.acces === 'avancee';
  return fermee ? t('pf.advancedSkillOutOfCareer', { name: nomDe(hero), what }) : null;
}

/** Refus d'acquérir le Talent (id, spec) propre au Talent : Maxi atteint (LDB 10), puis Domaine
 *  arcanique refusé (`arcaneDomainGate`, LDB 46 l.177). Verdict UNIQUE d'`acheterLeTalent` et de la vue
 *  d'avancement ; le combat et les PX se refusent à part (`refusDepensePx`). */
export function refusDAcquerirLeTalent(hero: Combatant, talentId: string, spec: string | undefined): string | null {
  const label = refLabel('talents', { id: talentId, spec });
  if (talentMaxReached(hero, talentId, spec)) return t('pf.talentMaxed', { name: nomDe(hero), label });
  if (spec == null || !findTalentById(talentId)?.grantsArcaneDomain) return null;
  const gate = arcaneDomainGate(hero, spec);
  return gate.ok ? null : t('pf.refused', { name: nomDe(hero), what: label, reason: gate.reason ?? '' });
}

/** Refus d'une dépense de `cost` PX que le héros n'a pas : la raison affichée, ou `null`. Verdict UNIQUE
 *  des achats de progression (en tête du geste, avant le moteur) et de la vue d'avancement. */
export function refusDePx(hero: Combatant, cost: number): string | null {
  return (hero.xp ?? 0) < cost ? t('pf.notEnoughXp', { name: nomDe(hero), cost }) : null;
}

/** Refus de la prochaine Augmentation de `cible` (`what` : son libellé) : combat (`refusDepensePx`), mentor absent
 *  (`mentorRequis`), Compétence avancée fermée hors carrière, chiffrage (`coutDeLAugmentation`, remise `remise`
 *  comprise), puis PX — ou `null`. Verdict UNIQUE d'`acheterLaCaracteristique`, d'`acheterLaCompetence` et de la vue
 *  d'avancement. LDB 07 l.89 ; CRB 018 l.69 */
export function refusDAugmentation(
  s: Pick<Jeu, 'battle' | 'flags'>, hero: Combatant, cible: CibleDAugmentation, inCareer: boolean, what: string, remise = 0,
): string | null {
  const c = coutDeLAugmentation(hero, cible, inCareer, remise);
  return refusDepensePx(s)
    ?? (mentorRequis(s, hero, inCareer) ? t('pf.charNeedsMentor', { name: nomDe(hero), what }) : null)
    ?? (cible.kind === 'competence' ? refusDeCompetenceHorsCarriere(hero, cible.competence.id, what, inCareer) : null)
    ?? (c.ok ? refusDePx(hero, c.cout) : t('pf.refused', { name: nomDe(hero), what, reason: c.raison }));
}

/** Le prix d'apprendre `sp` (`spellCost`, `full`) et le prix de CET achat (`cout`) sous la remise `discountXp`
 *  (ACE 12 l.55) ; `null` : le sort est déjà connu ou inapprenable. */
export function prixDuSort(hero: Combatant, sp: SpellData, opts: { discountXp?: number }): { full: number; cout: number } | null {
  const full = spellCost(hero, sp);
  if (full == null) return null;
  return { full, cout: opts.discountXp && full > 0 ? Math.min(full, Math.max(100, full - opts.discountXp)) : full };
}

/** Refus d'apprendre le sort `spellId` : sort introuvable, déjà connu ou inapprenable, PX (remise `opts` comprise,
 *  `prixDuSort`), puis Maxi du Talent de Magie du Chaos qui le paie (LDB 10 l.704-708) — ou `null`. Verdict UNIQUE
 *  d'`acheterLeSort` et de son offre (`gesteDAchatDuSort`) ; le combat se refuse à part (`refusDepensePx`). */
export function refusDAchatDuSort(hero: Combatant, spellId: string, opts: { discountXp?: number } = {}): string | null {
  const sp = findSpellById(spellId);
  if (!sp) return t('pf.spellNotFound', { id: spellId });
  const prix = prixDuSort(hero, sp, opts);
  if (!prix) return t(verdictApprentissage(hero, sp) === 'dejaConnu' ? 'pf.spellAlreadyKnown' : 'pf.spellCannotLearn', { name: nomDe(hero), spell: sp.label });
  const manque = refusDePx(hero, prix.cout);
  if (manque) return manque;
  const talent = eligibleTalent(hero, sp)!;
  return talent.kind === 'chaos' && prix.full > 0 && talentMaxReached(hero, talent.talentId, talent.spec) ? t('adv.talentMax') : null;
}

/** Contexte d'un changement de Carrière de `hero` vers (`newCareer`, `newLevel`) : niveau courant validé (fourni par
 *  l'appelant), même Classe, niveau cible existant, Saut de Niveau (`regleDeProgression`). LDB 07 l.137-148 */
export function contexteDeChangement(hero: Combatant, newCareer: string, newLevel: number, completed: boolean): CareerChangeContext {
  return {
    completed,
    sameClass: findCareerById(hero.career ?? '')?.class.id === findCareerById(newCareer)?.class.id,
    targetLevelExists: levelsForCareer(newCareer).some((l) => l.level === newLevel),
    gmJump: regleDeProgression(hero, 'progression-saut-de-niveau'),
  };
}

/** Refus de changer de Carrière : combat, cible fermée (`validateCareerChange`), puis PX — la raison que
 *  rend `changerDeCarriere`, ou `null`. Verdict UNIQUE du geste et de la vue d'avancement. */
export function refusDeChangerDeCarriere(
  s: Pick<Jeu, 'battle'>, hero: Combatant, newCareer: string, newLevel: number, completed: boolean,
): string | null {
  const v = validateCareerChange(hero, newCareer, newLevel, contexteDeChangement(hero, newCareer, newLevel, completed));
  return refusDepensePx(s) ?? (v.ok ? refusDePx(hero, v.cost) : t('pf.careerRefused', { name: nomDe(hero), reason: v.reason ?? '' }));
}
