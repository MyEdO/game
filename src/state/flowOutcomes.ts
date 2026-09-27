/**
 * NARRATION d'issue des jets — SOURCE UNIQUE par flux (popin ET journal).
 *
 * Motif unifié : chaque flux expose une fonction PURE `describeX(pending) → string` qui produit LA
 * ligne d'issue du jet. La modale la FOURNIT en donnée (`outcome={[recapLineOfEvent(ev(kind, describeX(p), …))]}`,
 * rendue par la coquille) et le
 * store la journalise au même endroit — fini les `outcomeText` recalculés dans chaque modale (et
 * re-recalculés à la validation). Pour le combat, l'équivalent est `result.log`, déjà posé par le
 * moteur ; ces fonctions étendent le même principe aux flux non-combat.
 */
import type {
  PendingTest,
  PendingHeal,
  PendingCorruption,
  PendingRun,
  PendingApproach,
  PendingWard,
  PendingFocus,
  PendingFrenzy,
  PendingReload,
  PendingStateRecovery,
  PendingBargain,
  PendingAppraise,
  PendingDisengage,
  PendingBattement,
  PendingDistraire,
} from './pendings';
import { garanti } from './combatants';
import { battementRemoval } from './combatManeuvers';
import { fleeBackstab, fleeCalme } from './pendings';
import type { PendingEncounterPsych } from './encounterPsychFlow';
import type { PendingActivity } from './interludeFlow';
import { estCibleType, cibleLabel } from '../engine/psychology';
import { activityById, matchOutcomes } from '../engine/activities';
import { isFumble } from '../engine/oups';
import { extendedTestStep, isImpressiveSuccess, isImpressiveFailure, isAstoundingFailure, SL_ASTOUNDING } from '../engine/tests';
import { healWoundsDelta, cappedHealAmount } from '../engine/healing';
import { corruptionGain } from '../engine/corruption';
import type { Combatant } from '../engine/types';
import { t } from '../i18n';

/** Test de scène (LDB 12) : réussite / échec / réussite garantie par Résilience. Le DR figure déjà
 *  dans le breakdown au-dessus — l'issue reste une phrase courte. */
export function describeTest(pt: PendingTest): string {
  if (pt.roll == null) return '';
  if (pt.forced) return t('out.testForced', { name: pt.actorName });
  return pt.success ? t('out.testSuccess', { name: pt.actorName }) : t('out.testFail', { name: pt.actorName });
}

/**
 * Option « Succès / échec stupéfiants » (LDB 12 l.127) : hors combat, un Test résolu sur un DOUBLE
 * est un Succès Stupéfiant (réussite) ou un Échec Stupéfiant (échec). PUREMENT un libellé (aucune
 * mécanique nouvelle). Retourne `null` quand il n'y a rien à afficher : avant le jet, sans double,
 * ou sur une réussite FORCÉE par Résilience (le « double » n'a pas eu lieu sur un vrai dé). La règle
 * elle-même (`rule('test-critiques-doubles')`) est lue par l'appelant — cette fonction reste pure. */
export function amazingTestLabel(pt: PendingTest): { success: boolean; text: string } | null {
  if (pt.roll == null || !pt.isDouble || pt.forced) return null;
  return { success: pt.success, text: pt.success ? t('out.amazingSuccess') : t('out.amazingFail') };
}

// (Psychologie EN COMBAT : PLUS de `describePsych` — l'issue des étapes de la cascade de Round est
//  produite par l'applier 'combatPsych' (state/combatFlow), comme la psy de rencontre.)

/** Psychologie À LA RENCONTRE, hors combat (couture C) : Trait ciblé social, Terreur ou Peur face à
 *  une source nommée. `name` = héros concerné. */
export function describeEncounterPsych(pe: PendingEncounterPsych, name: string): string {
  const r = pe.result;
  if (!r) return '';
  if (estCibleType(pe.kind)) {
    const cl = cibleLabel(pe.kind);
    const kind = cl?.label.toLowerCase() ?? pe.kind;
    return r.success ? t('out.cibleMaster', { name, kind }) : t('out.cibleGrip', { name, kind });
  }
  if (pe.kind === 'terreur') {
    return r.success ? t('out.terreurHold', { name }) : t('out.terreurTerrified', { name, foe: pe.sourceName, brise: String(r.brise) });
  }
  return r.success ? t('out.fearOvercome', { name, foe: pe.sourceName }) : t('out.fear', { name, foe: pe.sourceName });
}

/** Soin de Guérison (LDB 09) : montant PRÉVU (aperçu) — Blessures rendues / Hémorragie stoppée /
 *  convalescence raccourcie. La VALIDATION applique le montant réel (plafonné, via `applyHealWounds`) :
 *  cette ligne est l'aperçu de la popin, le fil journalise sa conséquence chiffrée à part. `target` (si
 *  fourni) plafonne l'aperçu par `cappedHealAmount` — MÊME calcul que l'application (#473 : la popin
 *  annonçait le brut « +5 PB » quand la munition Empaleuse logée plafonnait le gain réel à +3). */
export function describeHeal(ph: PendingHeal, target?: Combatant): string {
  if (ph.roll == null) return '';
  const wounds = ph.mode === 'wounds';
  const trauma = ph.mode === 'trauma';
  const ammo = ph.mode === 'ammo';
  const rawPreview = wounds ? healWoundsDelta(ph.intBonus, ph.sl, ph.success) : 0;
  const preview = wounds && target ? cappedHealAmount(target, rawPreview) : rawPreview;
  if (ph.success) {
    if (wounds) return t('out.healWounds', { name: ph.targetName, n: preview });
    if (trauma) return t('out.healTrauma', { name: ph.targetName, n: 1 + Math.max(0, ph.sl) });
    if (ammo) return t('out.healAmmo', { name: ph.targetName });
    return t('out.healBleed', { n: 1 + Math.max(0, ph.sl), name: ph.targetName });
  }
  return wounds && ph.intBonus + ph.sl < 0
    ? t('out.healHarm', { name: ph.targetName, n: ph.intBonus + ph.sl })
    : t('out.healNone', { name: ph.targetName });
}

/** Exposition à une Influence corruptrice (LDB 19) ou Test de seuil : issue de la popin. La VALIDATION
 *  applique la conséquence par un autre mécanisme (gainCorruption / « Je te renie ! » / mutation) →
 *  cette fonction n'unifie que la popin. */
export function describeCorruption(pc: PendingCorruption, name: string): string {
  if (pc.roll == null) return '';
  if (pc.kind === 'seuil') {
    return pc.success
      ? t('out.corruptHold', { name })
      : t('out.corruptThreatens', { name });
  }
  const gain = corruptionGain(pc.level ?? 'mineure', !!pc.success, pc.sl ?? 0);
  return gain === 0
    ? t('out.corruptRepel', { name })
    : t('out.corruptGain', { name, gain, s: gain > 1 ? 's' : '' });
}

/** Jet d'Activité d'interlude (LDB 23) : issue de la popin (Revenus / Artisanat / Apprentissage /
 *  Identification). La VALIDATION applique la conséquence chiffrée (somme, objet, PX) à part. */
export function describeActivity(pa: PendingActivity): string {
  if (pa.roll == null || !pa.activityId) return '';
  const def = garanti(activityById(pa.activityId), pa.activityId, 'activité d’interlude');
  // Activité/Scène de BATAILLE (ADE II 8) : l'issue chiffrée (Puissance) est journalisée par
  // `confirmBattleActivity` ; la popin résume Succès/Échec (Test combiné : les deux compétences).
  if (pa.battle) {
    if (pa.combinedLevel) {
      return pa.combinedLevel === 'full'
        ? t('out.testSuccess', { name: def.label })
        : t('out.testFail', { name: def.label });
    }
    return pa.success ? t('out.testSuccess', { name: def.label }) : t('out.testFail', { name: def.label });
  }
  // Les 4 Activités « socle » n'ont pas de table d'issues : leur narration est propre au résolveur
  // (source unique, même règle RAW que `runActivityResolver`). Les autres dérivent des bandes.
  switch (def.resolver) {
    case 'craftExtended': {
      const { total: after, done } = extendedTestStep(pa.drBefore ?? 0, { success: !!pa.success, sl: pa.sl }, pa.drTarget ?? 1);
      return done ? t('out.craftDone') : t('out.craftProgress', { after, target: String(pa.drTarget) });
    }
    case 'identify':
      return pa.success
        ? isImpressiveSuccess(pa.success, pa.sl)
          ? t('out.identifyFull')
          : t('out.identifyPartial')
        : isImpressiveFailure(pa.success, pa.sl)
          ? t('out.identifyMisread')
          : t('out.identifyNone');
    case 'learnTalent':
      return pa.success ? t('out.learnDone') : t('out.learnFail');
    case 'income':
      return pa.success
        ? t('out.incomeGood')
        : isAstoundingFailure(pa.success, pa.sl)
          ? t('out.incomeNone')
          : t('out.incomeHalf');
    default: {
      // Catalogue data-driven à table : l'issue EST la (les) bande(s) matchée(s) — notes VERBATIM de
      // la table source (même matching que la validation, source unique).
      const bands = def ? matchOutcomes(def, { success: !!pa.success, sl: pa.sl, fumble: isFumble(pa.roll, !!pa.success) }) : [];
      const notes = bands.map((b) => b.note).filter((n): n is string => !!n);
      if (notes.length) return notes.join(' ');
      return pa.success ? t('out.catalogOk') : t('out.catalogFail');
    }
  }
}

/** Marchandage (LDB 59 l.43) : VERDICT du Test opposé (source unique popin ↔ journal). */
export function describeBargain(pb: PendingBargain): string {
  const won = pb.result?.attackerWins ?? false;
  const drNet = pb.result?.netSL ?? 0;
  const discount = won ? (drNet >= SL_ASTOUNDING || pb.negotiator ? t('out.fragDiscount20') : t('out.fragDiscount10')) : '—';
  // « Rater de beaucoup » (LDB 59 l.43) = perdre l'opposé par un net DR ≥ 6 → le marchand se méfie.
  if (!won && drNet >= SL_ASTOUNDING) return t('out.bargainSuspicious');
  if (won) return pb.mode === 'buy' ? t('out.bargainWonBuy', { discount }) : t('out.bargainWonSell');
  return pb.mode === 'buy' ? t('out.bargainLostBuy') : t('out.bargainLostSell');
}

/** Évaluation / Détection d'artefact (LDB 59 l.41 / 10 l.310-312) : issue de la popin. La VALIDATION
 *  applique la révélation + l'estimation chiffrée à part (resolveAppraise). */
export function describeAppraise(pa: PendingAppraise): string {
  if (pa.roll == null) return '';
  const detect = pa.mode === 'detect';
  if (detect) {
    return pa.success
      ? t('out.detectSomething', { name: pa.actorName, item: pa.itemName })
      : t('out.detectNothing', { name: pa.actorName });
  }
  return pa.success
    ? t('out.appraiseRevealed', { name: pa.actorName, item: pa.itemName })
    : t('out.appraiseNone', { name: pa.actorName, item: pa.itemName });
}

/** Approche d'une source de Peur (LDB 21 l.27) : issue du Test de Calme (popin). Le fil journalise la
 *  conséquence (gate d'approche du Tour) à part. `name` = combattant ; `sourceName` = source de Peur. */
export function describeApproach(pa: PendingApproach): string {
  if (!pa.result) return '';
  return pa.result.success ? t('out.approachYes') : t('out.approachNo');
}

/** Bénédiction de Protection (LDB 41 l.142) : issue du Test de FM (popin). Le fil journalise la
 *  conséquence (attaque relancée / refusée) à part. `targetName` = la cible bénie. */
export function describeWard(pw: PendingWard, targetName: string): string {
  if (!pw.result) return '';
  return pw.result.success
    ? t('out.wardOvercome', { target: targetName })
    : t('out.wardBlocked', { target: targetName });
}

/** Course (LDB 15 l.41) : issue du Test d'Athlétisme/Chevaucher (popin). Le fil journalise le
 *  déplacement réel (cases parcourues) à part. */
export function describeRun(pr: PendingRun): string {
  const r = pr.result;
  if (!r) return '';
  return t('out.run', { label: r.success ? t('out.runYes') : t('out.runNo'), cases: r.bonusCases });
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
 *  `after` = DR cumulé après ce jet (plafond 0). `weaponName` = NOM résolu de l'arme (uid → nom à l'appel). */
export function describeReload(pr: PendingReload, after: number, weaponName: string): string {
  if (pr.roll == null) return '';
  return after >= pr.reload ? t('out.reloadDone', { weapon: weaponName }) : t('out.reload', { name: pr.actorName, weapon: weaponName, after, reload: pr.reload });
}

/** Focalisation = Test étendu (LDB 46) : issue de la fenêtre de jet. La PROGRESSION (DR du Round,
 *  cumul vers le NI) vit dans SES zones — ✓/✗ ±DR sur la ligne de jet, cumul/cible sur la barre de DR
 *  (#1078 LOT B2, patron Dissipation/Test étendu) : ne reste à l'issue que ce qu'aucune autre zone
 *  n'énonce, le NI ATTEINT. Chaîne vide sinon — donc aucun cadre d'issue. */
export function describeFocus(pf: PendingFocus, prev: number, ni: number): string {
  const r = pf.result;
  if (!r) return '';
  return prev + r.dr >= ni ? t('out.focusDone') : '';
}

/** Entrée en Frénésie (LDB 21 l.31) : issue (source unique popin ↔ journal). `name` = le combattant. */
export function describeFrenzy(pf: PendingFrenzy, name: string): string {
  const r = pf.result;
  if (!r) return '';
  return r.success
    ? t('out.frenzyEnter', { name })
    : t('out.frenzyNo', { name });
}

/** Battement (LDB 10 l.103) : succès → −(1 + DR) Avantage adverse (barème `battementRemoval`), échec →
 *  rien. Popin = MÊME phrase que la ligne de journal (`manv.battement`/`manv.battementFail`). */
export function describeBattement(pb: PendingBattement, attackerName: string, foeName: string): string {
  const r = pb.result;
  if (!r) return '';
  return r.success
    ? t('manv.battement', { name: attackerName, foe: foeName, n: battementRemoval(r.sl) })
    : t('manv.battementFail', { name: attackerName, foe: foeName });
}

/** Distraire (LDB 10 l.364) : verdict du Test opposé Athlétisme vs Calme. Victoire (`success`) → le foe
 *  est distrait ; 'tie'/'failure' → rien. Popin = MÊME phrase que la ligne de journal (`manv.distraire*`). */
export function describeDistraire(pd: PendingDistraire, moverName: string, foeName: string): string {
  if (pd.result == null) return '';
  return pd.result === 'success'
    ? t('manv.distraire', { name: moverName, foe: foeName })
    : t('manv.distraireFail', { name: moverName, foe: foeName });
}

/** Désengagement (LDB 15-Dépl) — phase 'esquive' : verdict du Test opposé d'Esquive (popin). Le fil
 *  journalise la conséquence (Avantage, libération des Engagements) à part. */
export function describeDisengage(pd: PendingDisengage): string {
  return pd.result === 'success'
    ? t('out.disengageSuccess')
    : pd.result === 'tie'
      ? t('out.disengageTie')
      : t('out.disengageFail');
}

/** Désengagement — phase 'fuir' : issue du coup dans le dos + Test de Calme, montrée INLINE (popin).
 *  Les deux jets sont INFLUENÇABLES (slots `backstab`/`calme`) ; l'État Brisé découle du Calme raté
 *  (1 + DR négatif) — calculé ici pour la narration, appliqué par `fleeConfirm`. Jet manquant → issue
 *  indéterminée à ce stade (chaîne vide). */
export function describeDisengageFlee(pd: PendingDisengage): string {
  const res = fleeBackstab(pd)?.result;
  if (!res) return ''; // coup dans le dos pas encore lancé
  const wounds = res.woundsLost ?? 0;
  if (!res.hit || wounds <= 0) return t('out.disengageFlee', { hit: t('out.fleeDodge') });
  const calme = fleeCalme(pd)?.calme;
  if (!calme) return ''; // coup qui touche : Test de Calme pas encore lancé
  const broken = calme.success ? 0 : 1 + Math.max(0, -calme.sl);
  const hit = t('out.fleeHit', { wounds, s: wounds > 1 ? 's' : '', broken: broken ? t('out.fleeBroken', { broken, s: broken > 1 ? 's' : '' }) : '' });
  return t('out.disengageFlee', { hit });
}
