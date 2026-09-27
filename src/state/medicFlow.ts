/**
 * INFIRMERIE — flux de soins HORS COMBAT unifié (Guérison / Hémorragie / Déchirure / Chirurgie) :
 * une modale PERSISTANTE (MedicModal) — bandeau patients → dossier (actes) → zone de jet — qui ne
 * se ferme pas entre deux actes. Le RAW vit dans engine/healing + engine/trauma (sources uniques),
 * ici : orchestration seulement. En combat, le flux de la console reste (un acte = une Action).
 *
 * La CHIRURGIE (Test ÉTENDU, LDB 10 l.184 / 12 l.200) est « armée » sur l'infirmerie (`medic.surgery` :
 * chirurgien figé, patient verrouillé) ; chaque passe est un jet INFLUENÇABLE (`pendingSurgery` via
 * `FLOWS.surgery` — Chance/Pacte/Résilience comme tout jet de héros), qui inflige 1d10 PB + 1 Hémorragie
 * et cumule le DR (DrBar) à l'application (`surgeryNext`). Le Test d'infection du patient (cible atteinte)
 * est un jet SUBI poussé en RÉVÉLATION témoin. Entre deux passes, Bander (wounds) et Hémorragie (bleed)
 * redeviennent des ACTES NORMAUX du même patient — jet complet (Chance/Résilience), sans interrompre le cumul.
 *
 * Acte PAYANT (PNJ `medicalAid`, LDB 75 : l'aide médicale se paie à l'acte, 4-6 pistoles) :
 * débit au clic d'acte ; « Annuler » AVANT le jet rembourse ; arrêter une opération jamais
 * commencée rembourse aussi.
 */
import { type Combatant, type Difficulty } from '../engine/types';
import { rollLine } from './rollSeam';
import { battleRng } from './battleRng';
import { d10 } from '../engine/dice';
import { flowStakeRef, type FlowStakeId, type StakeRef, type SkillRef } from '../data';
import { applyOps } from '../engine/ops';
import { extendedTestStep } from '../engine/tests';
import { partyAssisted, type SupportDetail } from '../engine/skills';
import { bonus, effectiveChar } from '../engine/characteristics';
import { addCondition, loseWounds, releaseConditionLocks } from '../engine/conditions';
import { hasHealSkill, hasSurgerySkill, availableHealModes, isHealable, healDifficulty, HEAL_SKILL, type HealMode } from '../engine/healing';
import { removeSurgicalTrauma, surgeryTraumas, recoverableTraumas, recoverDisabledLimb } from '../engine/trauma';
import { toMoney, canAfford } from '../engine/money';
import { t } from '../i18n';
import { partyMoneyTotal, payFromGroup, distributeCredit } from './bourseFlow';
import { touchActors } from './combatOrParty';
import { finishPlayerAction, openContractionCascade } from './combatFlow';

export interface MedicCost { gold?: number; silver?: number; brass?: number }

/** PNJ soigneur payant (effet `medicalAid`) : sa compétence + son tarif PAR ACTE. La Compétence est
 *  une RÉFÉRENCE portant sa valeur de Test imprimée (`SkillRef`) — le PNJ n'a pas de fiche. */
export interface MedicNpc {
  id: string;
  label: string;
  skill: SkillRef;
  intBonus: number;
  acts: { act: HealMode; cost?: MedicCost }[];
}

export interface MedicState {
  /** Absent = soins entre héros (meilleur soigneur du groupe). */
  npc?: MedicNpc;
  patientId: string | null;
  /** Opération ARMÉE (Test étendu, LDB 12 l.170-174). Deux `kind`, MÊME machinerie
   *  de passes (jet de Guérison influençable → cumul du DR) : `'surgery'` = Chirurgie d'une Blessure Critique
   *  (Talent Chirurgie, chaque passe inflige 1d10 PB + 1 Hémorragie, LDB 10 l.184) ; `'recovery'` = Test étendu
   *  de Guérison qui rend l'usage d'un membre désactivé (« Épaule luxée »/« Genou démis », LDB 18 l.120/179 — aucun
   *  dégât, cible DR 6, Accessible +20, pénalité 1d10 j à la clé). */
  surgery?: {
    kind: 'surgery' | 'recovery';
    difficulty: Difficulty;
    healerId?: string;
    healerName: string;
    skill: number;
    /** SOUTIEN (LDB 12) des assistants, déjà fondu dans `skill` — recopié sur chaque passe (affichage). */
    support?: SupportDetail;
    intBonus: number;
    traumaIdx: number;
    targetDR: number;
    cumDR: number;
    /** ENJEU d'une passe (#1117) — posé à l'ARMEMENT, où le `kind` et la cible de DR sont connus :
     *  opérer et rééduquer ne mettent pas la même chose en jeu (`flow-stakes`, `surgery/roll` vs
     *  `surgery/recovery`). Rendu par la zone de jet embarquée (`MedicModal`). */
    stake: StakeRef;
    /** Dernière passe (affichage DrBar) — absent tant qu'aucune passe n'a été tentée. */
    last?: { roll: number; sl: number };
    /** Prix déjà débité (PNJ) — remboursé si on arrête AVANT la première passe. */
    paidCost?: MedicCost;
  };
}

import type { Get, Set } from './flowTypes';

/** Meilleur soigneur du groupe pour un acte (Opérer exige AUSSI le Talent Chirurgie, LDB 10 ; la récupération
 *  d'usage est un simple Test étendu de Guérison, sans Chirurgie, LDB 18 l.120/179). */
export function bestHealerFor(party: Combatant[], act: HealMode): { actor: Combatant; value: number; support: SupportDetail } | null {
  const pool = act === 'surgery' ? party.filter((c) => hasHealSkill(c) && hasSurgerySkill(c)) : party.filter(hasHealSkill);
  return partyAssisted(pool, HEAL_SKILL); // Soutien (LDB 12) : assistants de chirurgie/soin
}

/** Cible d'un jet de l'infirmerie — SOURCE UNIQUE des deux surfaces (acte simple `pendingHeal`, passe
 *  d'opération `pendingSurgery`), montée par le monteur canonique (`rollLine`, #1153) : la valeur est
 *  DÉCOMPOSABLE quand le soigneur est un héros (Guérison + Soutien LDB 12), et sans fiche pour un PNJ
 *  payant — la cible est alors le seuil fourni, écrêté comme `rollTest` l'écrêtera. */
function healLineTarget(healer: { actor?: Combatant; skill: number; support?: SupportDetail }, difficulty: Difficulty): number {
  return rollLine({
    actor: healer.actor,
    ...(healer.actor ? { test: { skill: HEAL_SKILL } } : {}),
    valeur: healer.skill, soutien: healer.support, difficulty,
  }).target;
}

/** Ouvre l'infirmerie (hors combat). Patient par défaut : celui demandé, sinon le premier soignable. */
export function openMedic(get: Get, set: Set, opts?: { patientId?: string; npc?: MedicNpc }): void {
  if (get().battle) return; // en combat : flux de la console (un acte = une Action)
  const party = get().party;
  const patientId = opts?.patientId ?? party.find((h) => isHealable(h))?.id ?? party[0]?.id ?? null;
  set({ medic: { npc: opts?.npc, patientId } });
}

export function medicSelectPatient(get: Get, set: Set, id: string): void {
  const m = get().medic;
  // Verrouillé pendant un jet posé et pendant une opération.
  if (!m || get().pendingHeal || m.surgery) return;
  if (!get().party.some((h) => h.id === id)) return;
  set({ medic: { ...m, patientId: id } });
}

export function closeMedic(get: Get, set: Set): void {
  const m = get().medic;
  if (!m || get().pendingHeal || m.surgery) return; // résoudre le jet / arrêter l'opération d'abord
  set({ medic: null });
}

/** Enjeu servi par chaque acte de soin ; `surgery`/`recovery` : celui de l'opération que l'acte arme. */
export const HEAL_STAKE: Record<HealMode, FlowStakeId> = {
  wounds: 'heal-wounds', bleed: 'heal-bleed', trauma: 'heal-trauma', ammo: 'heal-ammo',
  surgery: 'surgery-roll', recovery: 'surgery-recovery',
};

/** Lance un ACTE sur le patient courant : wounds/bleed/trauma → jet différé (pendingHeal) ;
 *  surgery/recovery → ARME l'opération étendue (les passes suivent). PNJ : débite le tarif de l'acte. */
export function medicAct(get: Get, set: Set, act: HealMode): void {
  const m = get().medic;
  if (!m || get().pendingHeal) return;
  if (m.surgery && (act === 'surgery' || act === 'trauma' || act === 'recovery')) return; // pendant l'op : seuls Bander/Hémorragie
  const patient = get().party.find((h) => h.id === m.patientId);
  if (!patient || !availableHealModes(patient).includes(act)) return;
  // Récupération d'usage : bloquée tant que l'Aide Médicale n'a pas été reçue (LDB 18 l.120/179 : « Après
  // application de cette Aide… ») — l'acte reste proposé (raison affichée) mais ne s'arme pas.
  if (act === 'recovery' && !recoverableTraumas(patient).length) { get().log(t('medic.aidRequired')); return; }

  // `actor` : le soigneur JOUEUR, absent pour un PNJ payant (aucune fiche) — c'est lui qui permet de
  // décomposer la valeur en Niveau de Compétence nu + composantes nommées (`rollLine`).
  let healer: { id?: string; actor?: Combatant; label: string; skill: number; intBonus: number; support?: SupportDetail };
  let paidCost: MedicCost | undefined;
  if (m.npc) {
    const offer = m.npc.acts.find((a) => a.act === act);
    if (!offer) return;
    if (offer.cost) { // débit à l'ACTE — DÉPENSE DE GROUPE (arbitrage user 2026-07-20 : « le groupe peut se
      // cotiser pour payer […] les soins »), remboursé au groupe sur Annuler avant le jet
      const cost = toMoney(offer.cost);
      if (!canAfford(partyMoneyTotal(get), cost)) { get().log(t('medic.tooExpensive')); return; }
      payFromGroup(get, set, cost, { purpose: 'soins' });
      paidCost = offer.cost;
    }
    healer = { id: m.npc.id, label: m.npc.label, skill: m.npc.skill.value, intBonus: m.npc.intBonus };
  } else {
    const best = bestHealerFor(get().party, act);
    if (!best) return;
    healer = { id: best.actor.id, actor: best.actor, label: best.actor.label, skill: best.value, intBonus: bonus(effectiveChar(best.actor, 'intelligence')), support: best.support };
  }

  if (act === 'surgery' || act === 'recovery') {
    // Chirurgie : cible MJ 5-10 (LDB 10), Intermédiaire +0. Récupération d'usage : DR 6 fixe (LDB 18 l.120/179),
    // Accessible +20 — cible lue sur la séquelle « membre désactivé » (restoreDR).
    const recovery = act === 'recovery';
    const targetDR = recovery ? (recoverableTraumas(patient)[0].restoreDR ?? 6) : 7;
    set({
      medic: {
        ...m,
        surgery: {
          kind: act, difficulty: recovery ? 'accessible' : 'intermediaire',
          healerId: healer.id, healerName: healer.label, skill: healer.skill, support: healer.support, intBonus: healer.intBonus,
          traumaIdx: 0, targetDR, cumDR: 0, paidCost,
          stake: flowStakeRef(HEAL_STAKE[act], { values: { targetDR } }),
        },
      },
    });
    return;
  }
  const difficulty = healDifficulty(act);
  set({
    pendingHeal: {
      healerId: healer.id ?? 'pnj-soigneur', healerName: healer.label, targetId: patient.id, targetName: patient.label,
      mode: act, intBonus: healer.intBonus, skillValue: healer.skill, support: healer.support,
      difficulty, target: healLineTarget(healer, difficulty), roll: null, success: false, sl: 0, paidCost,
    },
  });
}

/** Choix de la Blessure Critique à opérer — possible tant qu'aucune passe n'a été tentée. */
export function medicSetWound(get: Get, set: Set, idx: number): void {
  const m = get().medic;
  if (!m?.surgery || m.surgery.last) return;
  set({ medic: { ...m, surgery: { ...m.surgery, traumaIdx: idx } } });
}

/** OUVRE le jet INFLUENÇABLE d'UNE passe de Chirurgie (`pendingSurgery`) depuis l'opération armée
 *  (`medic.surgery`) — le jet de Médecine du chirurgien passe par `FLOWS.surgery` (Chance/Pacte/
 *  Résilience ; PNJ → influence no-op), `surgeryNext` applique. Idempotent : no-op si une passe est
 *  déjà posée (appelé pour la 1re passe ET pour rouvrir la suivante depuis `surgeryNext`). Ne TIRE rien. */
export function openSurgeryPass(get: Get, set: Set): void {
  const m = get().medic;
  const sg = m?.surgery;
  if (!m || !sg || get().pendingSurgery) return;
  const patient = get().party.find((h) => h.id === m.patientId);
  if (!patient) { set({ medic: { ...m, surgery: undefined } }); return; }
  set({
    pendingSurgery: {
      healerId: sg.healerId ?? 'pnj-soigneur', healerName: sg.healerName,
      targetId: patient.id, targetName: patient.label,
      skillValue: sg.skill, support: sg.support, intBonus: sg.intBonus, difficulty: sg.difficulty,
      // La cible PORTE la Difficulté de l'opération (Rééducation = Accessible, `LDB 18 l.120/179`) : c'est
      // celle que `rollTest` jettera (`FLOWS.surgery`, `simpleTestResolve`). `sg.skill` est l'instantané
      // FIGÉ à l'armement (le chirurgien peut avoir changé d'État depuis) : aucune fiche vivante à en
      // déduire, la valeur reste celle de l'opération engagée.
      target: healLineTarget({ skill: sg.skill, support: sg.support }, sg.difficulty),
      roll: null, success: false, sl: 0,
      traumaIdx: sg.traumaIdx, targetDR: sg.targetDR, cumDR: sg.cumDR, paidCost: sg.paidCost,
    },
  });
}

/** APPLIQUE une passe de l'opération étendue (calque `extendedTestNext`) : prend le jet FIGÉ de `pendingSurgery`
 *  (déjà roulé + influencé en modale) et cumule le DR (repart à 0 sous 0, LDB 12 l.174).
 *  - `kind:'surgery'` : chaque passe inflige 1d10 PB + 1 Hémorragie (LDB 10 l.184) ; à 0 PB → interruption.
 *    Cible atteinte → Blessure Critique réparée + Test d'infection du PATIENT (LDB 10 l.184) DIFFÉRÉ en ÉTAPE de
 *    cascade INFLUENÇABLE (`combatEndDisease`, jumeau de fin de combat).
 *  - `kind:'recovery'` (« Épaule luxée »/« Genou démis », LDB 18 l.120/179) : AUCUN dégât. Cible DR 6 atteinte →
 *    usage du membre rendu (séquelle « membre désactivé » retirée) + `recoveryPenalty` posé à la cible avec une
 *    durée d'horloge PARTAGÉE de 1d10 jours (charMod −10 / `moveScale` jambe) ; pas de Test d'infection.
 *  Sinon (les deux) → cumule sur `medic.surgery` et RÉOUVRE la passe suivante. */
export function surgeryNext(get: Get, set: Set): void {
  const ps = get().pendingSurgery;
  const m = get().medic;
  const sg = m?.surgery;
  if (!ps || ps.roll == null || !m || !sg) return;
  const patient = get().party.find((h) => h.id === m.patientId);
  if (!patient) { set({ pendingSurgery: null, medic: { ...m, surgery: undefined } }); return; }
  const { total: cum } = extendedTestStep(sg.cumDR, { success: ps.success, sl: ps.sl }, sg.targetDR); // Test étendu mutualisé (LDB 12)
  const recovery = sg.kind === 'recovery';
  const verb = recovery ? t('medic.verbRecovery') : t('medic.verbSurgery');
  const harm = recovery ? 0 : battleRng().int(1, 10);
  if (!recovery) { loseWounds(patient, harm); addCondition(patient, 'hemorragique'); } // dégâts d'une passe de Chirurgie (LDB 10 l.184)
  const log: string[] = [t('medic.pass', { healer: sg.healerName, verb, patient: patient.label, dr: `${ps.sl >= 0 ? '+' : ''}${ps.sl}`, cum, target: sg.targetDR, suite: recovery ? t('medic.fragPassEnd') : t('medic.fragPassHarm', { harm }) })];
  if (!recovery && patient.wounds.current <= 0) { // « de fortes chances de tuer » (LDB 10) : on interrompt
    log.push(t('medic.patientSinks', { patient: patient.label }));
    set({ pendingSurgery: null, medic: { ...m, surgery: undefined } });
    finishPlayerAction(get, set, log, 'heal');
    return;
  }
  if (cum >= sg.targetDR) { // cible atteinte
    if (recovery) {
      const { penalty, log: recLog } = recoverDisabledLimb(patient, sg.traumaIdx);
      log.push(...recLog);
      // Pénalité 1d10 jours (LDB 18 l.120/179) : durée d'horloge PARTAGÉE (charMod −10 ET Mouvement ÷2 de la jambe
      // expirent ENSEMBLE) — `defaultUntilTime` fournit la même échéance à toutes les ops sans durée propre.
      if (penalty.length) {
        const now = get().gameTime;
        log.push(...applyOps(patient, penalty, { rng: battleRng(), now, defaultUntilTime: now + d10(battleRng()) * 24 * 60 }));
      }
      set({ pendingSurgery: null, medic: { ...m, surgery: undefined } });
      finishPlayerAction(get, set, log, 'heal');
      return;
    }
    if (surgeryTraumas(patient).length) log.push(...removeSurgicalTrauma(patient, sg.traumaIdx)); // Chirurgie : Blessure Critique réparée (s'il y en a une à opérer)
    log.push(...releaseConditionLocks(patient, 'surgery')); // verrous d'État « ne peut être retiré que par Chirurgie » (Hémorragie interne, LDB 18)
    set({ pendingSurgery: null, medic: { ...m, surgery: undefined } });
    finishPlayerAction(get, set, log, 'heal');
    // Test d'infection du PATIENT (LDB 10 l.184) : Résistance Accessible (+20) — plus un jet SILENCIEUX
    // mais une ÉTAPE INFLUENÇABLE (cascade `combatEndDisease`, jumeau d'`openCombatEndCascade` :
    // Chance/Résilience + auto-succès Résistance (Menace : Maladie), LDB 17/10). La contraction
    // (`applyContraction`) est appliquée à la VALIDATION de l'étape, jamais avant l'influence.
    openContractionCascade(get, set, patient, 'infection-mineure', 'accessible', t('medic.afterSurgery'));
    return;
  }
  // Passe intermédiaire : cumule (medic.surgery), journalise, et RÉOUVRE la passe suivante (FLOWS.surgery).
  set({ medic: { ...m, surgery: { ...sg, cumDR: cum, last: { roll: ps.roll, sl: ps.sl } } }, pendingSurgery: null, ...touchActors(get()) });
  get().log(log[0]);
  openSurgeryPass(get, set);
}

/** Annule la PASSE posée, avant son jet : l'opération armée (`medic.surgery`), son cumul et l'acte payé
 *  restent ; `openSurgeryPass` la repose. */
export function surgeryPassCancel(get: Get, set: Set): void {
  const ps = get().pendingSurgery;
  if (!ps || ps.roll != null) return;
  set({ pendingSurgery: null });
}

/** Annule la Chirurgie : le cumul du Test étendu (LDB 12 l.170-174) est perdu. Jamais commencée
 *  (aucune passe appliquée) → l'acte PNJ est remboursé, comme `healCancel`. Ferme la passe en cours
 *  (`pendingSurgery`) ET l'opération armée (`medic.surgery`). */
export function surgeryCancel(get: Get, set: Set): void {
  const m = get().medic;
  const sg = m?.surgery;
  if (!m || !sg) { set({ pendingSurgery: null }); return; }
  if (!sg.last && sg.paidCost && m.patientId) distributeCredit(get, set, toMoney(sg.paidCost)); // remboursé au groupe (payeur), symétrique du débit `payFromGroup`
  set({ pendingSurgery: null, medic: { ...m, surgery: undefined } });
  if (sg.last) get().log(t('medic.interrupted', { healer: sg.healerName }));
}
