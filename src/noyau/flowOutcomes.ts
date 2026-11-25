/**
 * Narration des issues de jet envoyées au journal ou reprises dans les vues du jeu.
 */
import type {
  PendingTest,
  PendingHeal,
  PendingFrenzy,
  PendingReload,
  PendingStateRecovery,
  PendingBargain,
} from './pendings';
import type { PendingEncounterPsych } from './encounterPsychFlow';
import { estCibleType } from '../engine/psych/ciblage';
import { PSY } from '../engine/psychology';
import { psychologyLabel } from '../data';
import { SL_ASTOUNDING } from '../engine/tests';
import { hausseDeVente, issueDuMarchandage, variationDuMarchandage, type BargainOutcome } from '../engine/bargain';
import { healWoundsDelta, cappedHealAmount, arretDHemorragie } from '../engine/healing';
import { parametresDuSoin } from './soin';
import type { Combatant } from '../engine/types';
import { t } from '../i18n';
import { rule } from '../engine/policy';

/** Test de scène (LDB 12) : réussite / échec / réussite garantie par Résilience. Le DR figure déjà
 *  dans le breakdown au-dessus — l'issue reste une phrase courte. `name` = l'acteur. */
export function describeTest(pt: PendingTest, name: string): string {
  if (pt.roll == null) return '';
  if (pt.forcee) return t('out.testForced', { name });
  return pt.success ? t('out.testSuccess', { name }) : t('out.testFail', { name });
}

/**
 * Option « Succès / échec stupéfiants » (LDB 12 l.127), règle `test-critiques-doubles`. PUREMENT un libellé (aucune
 * mécanique nouvelle). Retourne `null` quand il n'y a rien à afficher : règle coupée, avant le jet, sans double,
 * ou sur une réussite FORCÉE par Résilience (le « double » n'a pas eu lieu sur un vrai dé). */
export function amazingTestLabel(pt: PendingTest): { success: boolean; text: string } | null {
  if (!rule('test-critiques-doubles') || pt.roll == null || !pt.isDouble || pt.forcee) return null;
  return { success: pt.success, text: pt.success ? t('out.amazingSuccess') : t('out.amazingFail') };
}

// (Psychologie EN COMBAT : PLUS de `describePsych` — l'issue des étapes de la cascade de Round est
//  produite par l'applier 'psychologieDeCombat' (noyau/combatFlow), comme la psy de rencontre.)

/** Psychologie À LA RENCONTRE, hors combat (couture C) : Trait ciblé social, Terreur ou Peur face à
 *  une source nommée. `name` = héros concerné. */
export function describeEncounterPsych(pe: PendingEncounterPsych, name: string): string {
  const r = pe.result;
  if (!r) return '';
  if (estCibleType(pe.kind)) {
    const psych = psychologyLabel(pe.kind);
    return r.success ? t('out.cibleMaster', { name, psych }) : t('out.cibleGrip', { name, psych });
  }
  if (pe.kind === PSY.terreur) {
    return r.success ? t('out.terreurHold', { name }) : t('out.terreurTerrified', { name, foe: pe.sourceName, brise: String(r.brise) });
  }
  return r.success ? t('out.fearOvercome', { name, foe: pe.sourceName }) : t('out.fear', { name, foe: pe.sourceName });
}

/** Soin (LDB 09 ; LDB 74 l.41) : l'issue du jet — Blessures rendues / Hémorragie stoppée / convalescence
 *  raccourcie —, dérivée des MÊMES calculs que l'application avec les MÊMES paramètres déclarés (Test, Bandages) :
 *  `cappedHealAmount` (#473 : plafond des munitions Empaleuses logées) et `arretDHemorragie` (plafond aux États
 *  portés par `target`). */
export function describeHeal(ph: PendingHeal, target: Combatant, name: string): string {
  if (ph.roll == null) return '';
  const wounds = ph.mode === 'blessures';
  const trauma = ph.mode === 'traumatisme';
  const ammo = ph.mode === 'munition';
  const rawPreview = wounds ? healWoundsDelta(ph.intBonus, ph.sl, ph.success, ph.test) : 0;
  const preview = wounds ? cappedHealAmount(target, rawPreview) : rawPreview;
  if (ph.success) {
    if (wounds) return t('out.healWounds', { name, n: preview });
    if (trauma) return t('out.healTrauma', { name, n: 1 + Math.max(0, ph.sl) });
    if (ammo) return t('out.healAmmo', { name });
    return t('out.healBleed', { n: arretDHemorragie(target, ph.sl, true, parametresDuSoin(ph)).removed, name });
  }
  return wounds && ph.intBonus + ph.sl < 0
    ? t('out.healHarm', { name, n: ph.intBonus + ph.sl })
    : t('out.healNone', { name });
}

/** Marchandage (LDB 59 l.43) : VERDICT du Test opposé (source unique popin ↔ journal). */
export function describeBargain(pb: PendingBargain): string {
  const issue = issueDuMarchandage(pb.result, pb.negotiator);
  // « Rater de beaucoup » (LDB 59 l.43) = perdre l'opposé par un net DR ≥ 6 → le vendeur se méfie.
  if (!issue.won && issue.drNet >= SL_ASTOUNDING) return t('out.bargainSuspicious', { who: pb.opposant.label });
  const c = pb.contrepartie;
  if (c.kind === 'billet') return issue.won ? t('out.bargainWonBillet') : t('out.bargainLostBillet');
  if (c.mode === 'vente') return verdictDeVente(issue);
  return issue.won ? t('out.bargainWonBuy', { discount: t('out.fragDiscount', { pct: -variationDuMarchandage(issue, 'achat') }) }) : t('out.bargainLostBuy');
}

/** Marchandage de VENTE (LDB 59 l.54) : verdict de `describeBargain`. */
function verdictDeVente(o: BargainOutcome): string {
  if (!o.won) return t('out.bargainLostSell');
  const hausse = hausseDeVente(o);
  return t('out.bargainWonSell', { hausse: hausse ? t('out.fragHausse', { pct: hausse }) : '' });
}

/** « Se libérer » (Empêtré) / « se rouler » (En flammes) — LDB 16 l.66/84 : issue du Test (source unique
 *  popin ↔ journal). `name` = l'acteur. */
export function describeStateRecovery(sr: PendingStateRecovery, name: string): string {
  if (sr.roll == null) return '';
  const removed = sr.success ? Math.min(sr.stacks, 1 + Math.max(0, sr.netSL)) : 0;
  const body = sr.success
    ? t('out.stateRecoveryWin', { sign: sr.netSL >= 0 ? '+' : '', netSL: sr.netSL, removed, s: removed > 1 ? 's' : '' })
    : t('out.stateRecoveryFail');
  return t('out.stateRecovery', { name, body });
}

/** Rechargement = Test étendu de Projectiles (LDB 62 l.335) : issue (source unique popin ↔ journal).
 *  `after` = DR cumulé après ce jet (plafond 0). `weaponName` = NOM résolu de l'arme (uid → nom à l'appel), `name` = le tireur. */
export function describeReload(pr: PendingReload, name: string, after: number, weaponName: string): string {
  if (pr.roll == null) return '';
  return after >= pr.reload ? t('out.reloadDone', { weapon: weaponName }) : t('out.reload', { name, weapon: weaponName, after, reload: pr.reload });
}

/** Entrée en Frénésie (LDB 21 l.31) : issue (source unique popin ↔ journal). `name` = le combattant. */
export function describeFrenzy(pf: PendingFrenzy, name: string): string {
  const r = pf.result;
  if (!r) return '';
  return r.success
    ? t('out.frenzyEnter', { name })
    : t('out.frenzyNo', { name });
}
