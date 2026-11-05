/**
 * INFIRMERIE — flux de soins HORS COMBAT unifié (Guérison / Hémorragie / Déchirure / Chirurgie) :
 * une modale PERSISTANTE (MedicModal) — bandeau patients → dossier (actes) → zone de jet — qui ne
 * se ferme pas entre deux actes. Le RAW vit dans engine/healing + engine/trauma (sources uniques),
 * ici : orchestration seulement. En combat, le flux de la console reste (un acte = une Action).
 *
 * La CHIRURGIE (Test ÉTENDU, LDB 10 l.184 / 12 l.200) est « armée » sur l'infirmerie (`medic.surgery` :
 * chirurgien figé, patient verrouillé) ; chaque passe est un jet INFLUENÇABLE (`pendingSurgery` via
 * `FLOWS.surgery` — Chance/Pacte/Résilience comme tout jet de héros), qui inflige 1d10 PB + 1 Hémorragie
 * et cumule le DR (DrBar) à l'application (`jetConfirm('surgery')`). Le Test d'infection du patient (cible atteinte)
 * est un jet SUBI poussé en RÉVÉLATION témoin. Entre deux passes, Bander (wounds) et Hémorragie (bleed)
 * redeviennent des ACTES NORMAUX du même patient — jet complet (Chance/Résilience), sans interrompre le cumul.
 *
 * Acte PAYANT (PNJ `medicalAid`, LDB 75 : l'aide médicale se paie à l'acte, 4-6 pistoles) :
 * débit au clic d'acte ; « Annuler » AVANT le jet rembourse ; arrêter une opération jamais
 * commencée rembourse aussi.
 */
import { locationLabel, type Combatant, type Difficulty, type Trauma } from '../engine/types';
import type { ChoixNomme } from './reglages';
import { fenetreDuJeu } from './combatAuto';
import { libelleDuParametre } from './libelles';
import { garanti } from '../lib/garanti';
import type { CloturesDuJet } from './rollFlowSpecs';
import { rollLine, type RollLineParts } from './rollSeam';
import { battleRng } from './battleRng';
import { d10 } from '../engine/dice';
import { flowStakeRef, type FlowStakeId, type StakeRef, type SkillRef } from '../data';
import { applyOps } from '../engine/ops';
import { extendedTestStep, cibleMesuree } from '../engine/tests';
import { partyAssisted, peutTenter, type SupportDetail } from '../engine/skills';
import { bonus, effectiveChar } from '../engine/characteristics';
import { addCondition, loseWounds, releaseConditionLocks } from '../engine/conditions';
import { hasSurgerySkill, raisonDeModeDeSoin, estActeImmediat, isHealable, healDifficulty, HEAL_SKILL, type HealMode } from '../engine/healing';
import { removeSurgicalTrauma, surgeryTraumas, recoverableTraumas, recoverDisabledLimb } from '../engine/trauma';
import { toMoney, canAfford } from '../engine/money';
import { t } from '../i18n';
import { totalDesBourses, payFromGroup, distributeCredit } from './bourseFlow';
import { touchActors } from './combatOrParty';
import { refuserGeste, refuserGesteDuSiege } from './refusVisible';
import { refusEnCombat } from './verrousDeFiche';
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
     *  opérer et rééduquer ne mettent pas la même chose en jeu (`stakes.json`, `surgery-roll` vs
     *  `surgery-recovery`). Rendu par la zone de jet embarquée (`MedicModal`). */
    stake: StakeRef;
    /** Dernière passe (affichage DrBar) — absent tant qu'aucune passe n'a été tentée. */
    last?: { roll: number; sl: number };
    /** Prix déjà débité (PNJ) — remboursé si on arrête AVANT la première passe. */
    paidCost?: MedicCost;
  };
}

import type { Get, Set } from './flowTypes';
import type { Jeu } from './etat';
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { FabriqueDuNoyau } from './machinerieDuNoyau';
import type { SortiesDeFenetre } from './sortieDeFenetre';

/** Meilleur soigneur du groupe pour un acte (Opérer exige AUSSI le Talent Chirurgie, LDB 10 ; la récupération
 *  d'usage est un simple Test étendu de Guérison, sans Chirurgie, LDB 18 l.120/179). */
export function bestHealerFor(party: Combatant[], act: HealMode): { actor: Combatant; value: number; support: SupportDetail } | null {
  const pool = act === 'surgery' ? party.filter(hasSurgerySkill) : party;
  return partyAssisted(pool, HEAL_SKILL); // Soutien (LDB 12) : assistants de chirurgie/soin
}

/** Ligne d'un jet de l'infirmerie — SOURCE UNIQUE des deux surfaces (acte simple `pendingHeal`, passe
 *  d'opération `pendingSurgery`), montée par le monteur canonique (`rollLine`, #1153) : la valeur est
 *  DÉCOMPOSABLE quand le soigneur est un héros (Guérison + Soutien LDB 12), et sans fiche pour un PNJ
 *  payant — la cible est alors le seuil fourni, écrêté comme `rollTest` l'écrêtera. */
function ligneDuSoigneur(healer: { actor?: Combatant; skill: number; support?: SupportDetail }, difficulty: Difficulty): RollLineParts {
  return rollLine({
    actor: healer.actor,
    ...(healer.actor ? { test: { skill: HEAL_SKILL } } : {}),
    valeur: healer.skill, soutien: healer.support, difficulty,
  });
}

/** Refus d'ouvrir l'infirmerie : la raison affichée, ou `null`. En combat, les soins passent par la
 *  console. Sur un patient DEMANDÉ (`heroId`) : il doit avoir de quoi être soigné (`isHealable`) et, sans
 *  PNJ soigneur (`npc`), un héros du groupe doit pouvoir tenter la Guérison (`peutTenter`). Verdict UNIQUE
 *  du geste `openMedic` et du bouton Soins de la fiche. */
export function refusDeSoins(s: Pick<Jeu, 'battle' | 'party'>, heroId?: string, npc?: MedicNpc): string | null {
  const enCombat = refusEnCombat('medic.inCombat')(s);
  if (enCombat || heroId == null) return enCombat;
  const patient = s.party.find((h) => h.id === heroId);
  if (!patient) return t('medic.patientIntrouvable');
  if (!isHealable(patient)) return t('medic.rienASoigner', { name: patient.label });
  return npc || s.party.some((h) => peutTenter(h, HEAL_SKILL)) ? null : t('medic.aucunSoigneur');
}

/** Refus de l'acte `act` sur le patient courant de l'infirmerie : la raison affichée, ou `null`. Verdict
 *  UNIQUE du geste `medicAct` et du bouton d'acte de `MedicModal`. */
export function refusDActeDeSoin(s: Pick<Jeu, 'medic' | 'party' | 'pendingHeal' | 'pendingSurgery'>, act: HealMode): string | null {
  const m = s.medic;
  if (!m) return t('medic.fermee');
  if (s.pendingHeal || s.pendingSurgery) return t('medic.jetEnCours');
  if (m.surgery && !estActeImmediat(act)) return t('medic.operationEnCours');
  const patient = s.party.find((h) => h.id === m.patientId);
  if (!patient) return t('medic.patientIntrouvable');
  const duPatient = raisonDeModeDeSoin(patient, act);
  if (duPatient) return duPatient;
  if (act === 'recovery' && !recoverableTraumas(patient).length) return t('medic.aidRequired'); // LDB 18 l.120/179
  if (m.npc) {
    const offer = m.npc.acts.find((a) => a.act === act);
    if (!offer) return t('medic.acteNonPropose', { pnj: m.npc.label });
    return offer.cost && !canAfford(totalDesBourses(s.party), toMoney(offer.cost)) ? t('medic.tooExpensive') : null;
  }
  if (bestHealerFor(s.party, act)) return null;
  return act === 'surgery' ? t('medic.aucunChirurgien') : t('medic.aucunSoigneur');
}

/** Ouvre l'infirmerie (hors combat). Patient par défaut : celui demandé, sinon le premier soignable. */
export function openMedic(get: Get, set: Set, opts?: { patientId?: string; npc?: MedicNpc }): void {
  const refus = refusDeSoins(get(), opts?.patientId, opts?.npc);
  if (refus) return void refuserGeste(get, set, refus);
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

/** Enjeu servi par chaque acte de soin ; `surgery`/`recovery` : celui de l'opération que l'acte arme. */
export const HEAL_STAKE: Record<HealMode, FlowStakeId> = {
  wounds: 'heal-wounds', bleed: 'heal-bleed', trauma: 'heal-trauma', ammo: 'heal-ammo',
  surgery: 'surgery-roll', recovery: 'surgery-recovery',
};

/** Lance un ACTE sur le patient courant : wounds/bleed/trauma → jet différé (pendingHeal) ;
 *  surgery/recovery → ARME l'opération étendue (les passes suivent). PNJ : débite le tarif de l'acte. */
export function medicAct(get: Get, set: Set, act: HealMode): void {
  const refus = refusDActeDeSoin(get(), act);
  if (refus) return void refuserGesteDuSiege(get, set, refus);
  const m = garanti(get().medic, act, 'infirmerie de l’acte');
  const patient = garanti(get().party.find((h) => h.id === m.patientId), m.patientId ?? undefined, 'patient de l’acte');

  // `actor` : le soigneur JOUEUR, absent pour un PNJ payant (aucune fiche) — c'est lui qui permet de
  // décomposer la valeur en Niveau de Compétence nu + composantes nommées (`rollLine`).
  let healer: { id?: string; actor?: Combatant; label: string; skill: number; intBonus: number; support?: SupportDetail };
  let paidCost: MedicCost | undefined;
  if (m.npc) {
    const offer = garanti(m.npc.acts.find((a) => a.act === act), act, 'offre du PNJ soigneur');
    if (offer.cost) { // débit à l'ACTE — DÉPENSE DE GROUPE (arbitrage user 2026-07-20 : « le groupe peut se
      // cotiser pour payer […] les soins »), remboursé au groupe sur Annuler avant le jet
      payFromGroup(get, set, toMoney(offer.cost), { purpose: 'soins' });
      paidCost = offer.cost;
    }
    healer = { id: m.npc.id, label: m.npc.label, skill: m.npc.skill.value, intBonus: m.npc.intBonus };
  } else {
    const best = garanti(bestHealerFor(get().party, act), act, 'soigneur du groupe');
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
  const ligne = ligneDuSoigneur(healer, difficulty);
  set({
    pendingHeal: {
      healerId: healer.id ?? 'pnj-soigneur', healerName: healer.label, targetId: patient.id, targetName: patient.label,
      mode: act, intBonus: healer.intBonus, test: 'guerison', bandagesDe: null, skillValue: healer.skill, support: healer.support,
      difficulty, ligne, ...cibleMesuree(ligne), roll: null, success: false, sl: 0, paidCost,
    },
  });
}

/** Choix de la Blessure Critique à opérer, parmi `plaiesDeLOperation`. */
export function medicSetWound(get: Get, set: Set, idx: number): void {
  const m = get().medic;
  if (!m?.surgery || !plaiesDeLOperation(get())[idx]) return;
  set({ medic: { ...m, surgery: { ...m.surgery, traumaIdx: idx } } });
}

/** Les Blessures Critiques que l'opération armée (`medic.surgery`) peut viser, au rang que `medicSetWound` reçoit et que
 *  `jetConfirm('surgery')` lit : à rééduquer (`recoverableTraumas`) ou à opérer (`surgeryTraumas`) ; vide sans opération armée
 *  ou une passe tentée. */
export function plaiesDeLOperation(s: Jeu): Trauma[] {
  const m = s.medic;
  const patient = m?.surgery && !m.surgery.last ? s.party.find((h) => h.id === m.patientId) : undefined;
  if (!m?.surgery || !patient) return [];
  return m.surgery.kind === 'recovery' ? recoverableTraumas(patient) : surgeryTraumas(patient);
}

/** Les verbes que la fenêtre de l'opération règle (`fenetreDeLOperation`), comme ceux de l'attaque. */
export const REGLAGES_DE_L_OPERATION = ['medicSetWound'] as const satisfies readonly (keyof ActionsDuNoyau)[];

/** La fenêtre de l'infirmerie en données : la Blessure Critique que l'opération armée vise (`plaiesDeLOperation`),
 *  chacune nommée avec sa Localisation, réglée par `medicSetWound` ; `null` hors de l'infirmerie. PUR. */
export function fenetreDeLOperation(s: Jeu): { plaie: ChoixNomme<number> | null } | null {
  const m = s.medic;
  if (!m || fenetreDuJeu(s)?.cle !== 'medic') return null;
  const plaies = plaiesDeLOperation(s);
  const patient = s.party.find((h) => h.id === m.patientId);
  if (!plaies.length || !m.surgery || !patient) return { plaie: null };
  return {
    plaie: {
      geste: { verbe: 'medicSetWound' }, parametre: 'idx', libelle: garanti(libelleDuParametre('medicSetWound', 'idx'), 'medicSetWound', 'libellé de la plaie'), choisie: m.surgery.traumaIdx,
      options: plaies.map((p, i) => ({ valeur: i, libelle: t('medic.plaie', { plaie: p.label, localisation: locationLabel(p.location, patient.bodyShape) }) })),
    },
  };
}

/** OUVRE le jet INFLUENÇABLE d'UNE passe de Chirurgie (`pendingSurgery`) depuis l'opération armée
 *  (`medic.surgery`) — le jet de Médecine du chirurgien passe par `FLOWS.surgery` (Chance/Pacte/
 *  Résilience ; PNJ → influence no-op), `jetConfirm('surgery')` applique. Idempotent : no-op si une passe est
 *  déjà posée (appelé pour la 1re passe ET pour rouvrir la suivante depuis `jetConfirm('surgery')`). Ne TIRE rien. */
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
      ...cibleMesuree(ligneDuSoigneur({ skill: sg.skill, support: sg.support }, sg.difficulty)),
      roll: null, success: false, sl: 0,
      traumaIdx: sg.traumaIdx, targetDR: sg.targetDR, cumDR: sg.cumDR, paidCost: sg.paidCost,
    },
  });
}

/** APPLIQUE une passe de l'opération étendue (calque `jetConfirm('extendedTest')`) : prend le jet FIGÉ de `pendingSurgery`
 *  (déjà roulé + influencé en modale) et cumule le DR (repart à 0 sous 0, LDB 12 l.174).
 *  - `kind:'surgery'` : chaque passe inflige 1d10 PB + 1 Hémorragie (LDB 10 l.184) ; à 0 PB → interruption.
 *    Cible atteinte → Blessure Critique réparée + Test d'infection du PATIENT (LDB 10 l.184) DIFFÉRÉ en ÉTAPE de
 *    cascade INFLUENÇABLE (`combatEndDisease`, jumeau de fin de combat).
 *  - `kind:'recovery'` (« Épaule luxée »/« Genou démis », LDB 18 l.120/179) : AUCUN dégât. Cible DR 6 atteinte →
 *    usage du membre rendu (séquelle « membre désactivé » retirée) + `recoveryPenalty` posé à la cible avec une
 *    durée d'horloge PARTAGÉE de 1d10 jours (charMod −10 / `moveScale` jambe) ; pas de Test d'infection.
 *  Sinon (les deux) → cumule sur `medic.surgery` et RÉOUVRE la passe suivante. */
function appliquerLaPasse(get: Get, set: Set): void {
  const ps = get().pendingSurgery;
  const m = get().medic;
  const sg = m?.surgery;
  if (!ps || !m || !sg) return;
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
  set({ medic: { ...m, surgery: { ...sg, cumDR: cum, last: { roll: garanti(ps.roll, ps.healerId, 'jet de la passe'), sl: ps.sl } } }, pendingSurgery: null, ...touchActors(get()) });
  get().log(log[0]);
  openSurgeryPass(get, set);
}

/** Annule la Chirurgie : le cumul du Test étendu (LDB 12 l.170-174) est perdu. Jamais commencée
 *  (aucune passe appliquée) → l'acte PNJ est remboursé, comme `jetCancel('heal')`. Ferme la passe en cours
 *  (`pendingSurgery`) ET l'opération armée (`medic.surgery`). */
export function medicAbandonSurgery(get: Get, set: Set): void {
  const m = get().medic;
  const sg = m?.surgery;
  if (!m || !sg) { set({ pendingSurgery: null }); return; }
  if (!sg.last && sg.paidCost && m.patientId) distributeCredit(get, set, toMoney(sg.paidCost)); // remboursé au groupe (payeur), symétrique du débit `payFromGroup`
  set({ pendingSurgery: null, medic: { ...m, surgery: undefined } });
  if (sg.last) get().log(t('medic.interrupted', { healer: sg.healerName }));
}

export function creerActionsDuMedecin(get: Get, set: Set) {
  return {
    openMedic: (opts) => openMedic(get, set, opts),
    medicSelectPatient: (id) => medicSelectPatient(get, set, id),
    medicAct: (act) => medicAct(get, set, act),
    medicSetWound: (idx) => medicSetWound(get, set, idx),
    openSurgeryPass: () => openSurgeryPass(get, set),
    medicAbandonSurgery: () => medicAbandonSurgery(get, set),
  } satisfies FabriqueDuNoyau;
}

/** L'infirmerie se ferme hors soin en cours (`MODAL_DEFS.medic.sortieFermee`). */
export function sortiesDuMedecin(_get: Get, set: Set) {
  return { medic: () => set({ medic: null }) } satisfies Partial<SortiesDeFenetre>;
}

export function cloturesDuMedecin(get: Get, set: Set) {
  return { surgery: () => appliquerLaPasse(get, set) } satisfies Partial<CloturesDuJet>;
}
