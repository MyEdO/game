/**
 * INFIRMERIE — flux de soins HORS COMBAT unifié (Guérison / Hémorragie / Déchirure / Chirurgie) :
 * une modale PERSISTANTE (MedicModal) — bandeau patients → dossier (actes) → zone de jet — qui ne
 * se ferme pas entre deux actes. Le RAW vit dans engine/healing + engine/trauma (sources uniques),
 * ici : orchestration seulement. En combat, le flux de la console reste (un acte = une Action).
 *
 * La CHIRURGIE (Test ÉTENDU, LDB 10 l.184 / 12 l.200) est « armée » sur l'infirmerie (`medic.surgery` :
 * chirurgien figé, patient verrouillé) ; chaque passe est un jet INFLUENÇABLE (`pendingSurgery` via
 * `FLOWS.surgery` — Chance/Pacte/Résilience comme tout jet de héros), qui inflige 1d10 PB + 1 Hémorragie
 * et cumule le DR (DrBar) à l'application (`jetValider('surgery')`). Le Test d'infection du patient (cible atteinte)
 * est un jet SUBI poussé en RÉVÉLATION témoin. Entre deux passes, Bander (wounds) et Hémorragie (bleed)
 * redeviennent des ACTES NORMAUX du même patient — jet complet (Chance/Résilience), sans interrompre le cumul.
 *
 * L'acte se choisit par le réglage `heal.mode` du brouillon que la transition du jeu tient (`acteDeSoin.ts`), et se
 * joue par `jetLancer('heal')`. Acte PAYANT (PNJ `medicalAid`, LDB 75 : l'aide médicale se paie à l'acte, 4-6
 * pistoles) : débit au lancer ; arrêter une opération jamais commencée rembourse.
 */
import { locationLabel } from '../engine/types';
import type { IdDePlaieDeLOperation } from './designations';
import { garanti } from '../lib/garanti';
import type { CloturesDuJet } from './rollFlowSpecs';
import { battleRng } from './battleRng';
import { d10 } from '../engine/dice';
import { applyOps } from '../engine/ops';
import { extendedTestStep } from '../engine/tests';
import { peutTenter } from '../engine/skills';
import { addCondition, loseWounds, releaseConditionLocks } from '../engine/conditions';
import { isHealable, HEAL_SKILL } from '../engine/healing';
import { removeSurgicalTrauma, recoverDisabledLimb } from '../engine/trauma';
import { toMoney } from '../engine/money';
import { t } from '../i18n';
import { distributeCredit } from './bourseFlow';
import { touchActors } from './combatOrParty';
import { refuserGeste } from './refusVisible';
import { refusEnCombat } from './verrousDeFiche';
import { finishPlayerAction, openContractionCascade } from './combatFlow';
import { passeDeLOperation, plaiesDeLOperation, type MedicNpc } from './acteDeSoin';
import type { Get, Set } from './flowTypes';
import type { Jeu } from './etat';
import type { FabriqueDuNoyau } from './machinerieDuNoyau';
import type { SortiesDeFenetre } from './sortieDeFenetre';
import type { CorpsDesChoix } from './choixDesFenetres';

/** Refus d'ouvrir l'infirmerie : la raison affichée, ou `null`. En combat, les soins passent par la
 *  console. Sur un patient DEMANDÉ (`heroId`) : il doit avoir de quoi être soigné (`isHealable`) et, sans
 *  PNJ soigneur (`npc`), un héros du groupe doit pouvoir tenter la Guérison (`peutTenter`). Verdict UNIQUE
 *  du geste `ouvrirLeMedecin` et du bouton Soins de la fiche. */
export function refusDeSoins(s: Pick<Jeu, 'battle' | 'party'>, heroId?: string, npc?: MedicNpc): string | null {
  const enCombat = refusEnCombat('medic.inCombat')(s);
  if (enCombat || heroId == null) return enCombat;
  const patient = s.party.find((h) => h.id === heroId);
  if (!patient) return t('medic.patientIntrouvable');
  if (!isHealable(patient)) return t('medic.rienASoigner', { name: patient.label });
  return npc || s.party.some((h) => peutTenter(h, { skill: { id: HEAL_SKILL } })) ? null : t('medic.aucunSoigneur');
}

/** Ouvre l'infirmerie (hors combat). Patient par défaut : celui demandé, sinon le premier soignable. */
export function ouvrirLeMedecin(get: Get, set: Set, opts?: { patientId?: string; npc?: MedicNpc }): void {
  const refus = refusDeSoins(get(), opts?.patientId, opts?.npc);
  if (refus) return void refuserGeste(get, set, refus);
  const party = get().party;
  const patientId = opts?.patientId ?? party.find((h) => isHealable(h))?.id ?? party[0]?.id ?? null;
  set({ medic: { npc: opts?.npc, patientId } });
}

/** Les Blessures Critiques que le choix `medic.plaie` ouvre (`plaiesDeLOperation`), chacune nommée avec sa
 *  Localisation. PUR. */
export function plaiesNommees(s: Jeu): { uid: IdDePlaieDeLOperation; libelle: string }[] {
  const patient = s.party.find((h) => h.id === s.medic?.patientId);
  return patient ? plaiesDeLOperation(s).map((p) => ({ uid: p.uid, libelle: t('medic.plaie', { plaie: p.label, localisation: locationLabel(p.location, patient.bodyShape) }) })) : [];
}

/** APPLIQUE une passe de l'opération étendue (calque `jetValider('extendedTest')`) : prend le jet FIGÉ de `pendingSurgery`
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
      const { penalty, log: recLog } = recoverDisabledLimb(patient, sg.traumaUid);
      log.push(...recLog);
      // Pénalité 1d10 jours (LDB 18 l.120/179) : durée d'horloge PARTAGÉE (charMod −10 ET Mouvement ÷2 de la jambe
      // expirent ENSEMBLE) — `defaultUntilTime` fournit la même échéance à toutes les ops sans durée propre.
      if (penalty.length) {
        const now = get().gameTime;
        log.push(...applyOps(patient, penalty, { idNeuf: get().forgerUnId, rng: battleRng(), now, defaultUntilTime: now + d10(battleRng()) * 24 * 60 }));
      }
      set({ pendingSurgery: null, medic: { ...m, surgery: undefined } });
      finishPlayerAction(get, set, log, 'heal');
      return;
    }
    if (sg.traumaUid) log.push(...removeSurgicalTrauma(patient, sg.traumaUid)); // Chirurgie : Blessure Critique réparée (s'il y en a une à opérer)
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
  const medic = { ...m, surgery: { ...sg, cumDR: cum, last: { roll: garanti(ps.roll, ps.healerId, 'jet de la passe'), sl: ps.sl } } };
  set({ medic, pendingSurgery: passeDeLOperation({ party: get().party, medic }), ...touchActors(get()) });
  get().ecrireAuJournal(log[0]);
}

/** Annule la Chirurgie : le cumul du Test étendu (LDB 12 l.170-174) est perdu. Jamais commencée
 *  (aucune passe appliquée) → l'acte PNJ, débité au lancer, est remboursé. Ferme la passe en cours
 *  (`pendingSurgery`) ET l'opération armée (`medic.surgery`). */
function abandonnerLOperation(get: Get, set: Set): void {
  const m = get().medic;
  const sg = m?.surgery;
  if (!m || !sg) { set({ pendingSurgery: null }); return; }
  if (!sg.last && sg.paidCost && m.patientId) distributeCredit(get, set, toMoney(sg.paidCost)); // remboursé au groupe (payeur), symétrique du débit `payFromGroup`
  set({ pendingSurgery: null, medic: { ...m, surgery: undefined } });
  if (sg.last) get().ecrireAuJournal(t('medic.interrupted', { healer: sg.healerName }));
}

export function creerActionsDuMedecin(get: Get, set: Set) {
  return {
    ouvrirLeMedecin: (opts) => ouvrirLeMedecin(get, set, opts),
  } satisfies FabriqueDuNoyau;
}

/** Les choix de l'infirmerie (`CorpsDesChoix`) : le patient, verrouillé pendant un soin (`OUVERTS_DU_CHOIX`), le
 *  brouillon du soin suivant le patient (`brouillonTenu`) ; l'abandon de l'opération ; la Blessure Critique visée,
 *  celle de l'opération armée, sinon celle du brouillon d'une opération (`plaiesDeLOperation`). */
export function choixDuMedecin(get: Get, set: Set) {
  return {
    medic: {
      patient: (id) => set({ medic: { ...garanti(get().medic, id, 'infirmerie du patient'), patientId: id } }),
      abandon: () => abandonnerLOperation(get, set),
      plaie: (uid) => {
        const m = garanti(get().medic, uid, 'infirmerie de la plaie');
        if (m.surgery) return void set({ medic: { ...m, surgery: { ...m.surgery, traumaUid: uid } } });
        set({ pendingHeal: { ...garanti(get().pendingHeal, uid, 'brouillon de l’opération'), plaie: uid } });
      },
    },
  } satisfies Partial<CorpsDesChoix>;
}

/** L'infirmerie se ferme hors soin en cours (`MODAL_DEFS.medic.sortieFermee`) ; son brouillon part avec elle
 *  (`brouillonTenu`). */
export function sortiesDuMedecin(_get: Get, set: Set) {
  return { medic: () => set({ medic: null }) } satisfies Partial<SortiesDeFenetre>;
}

export function cloturesDuMedecin(get: Get, set: Set) {
  return { surgery: () => appliquerLaPasse(get, set) } satisfies Partial<CloturesDuJet>;
}
