/**
 * L'ACTE DE SOIN DE L'INFIRMERIE (#3612) : le soin que l'acte pose sur le patient courant (`soinDeLActe`), le refus
 * de l'acte hors combat (`refusDeLActeALInfirmerie`), le brouillon que la transition du jeu tient après chaque écriture
 * (`brouillonTenu`) et la passe de l'opération armée (`passeDeLOperation`). PUR, module FEUILLE : il ne lit que le
 * moteur, la ligne de jet (`ligneDeJet`) et la bourse ; `transitionDuJeu` le compose sans tirer aucun flux. Le lancer de
 * l'acte (`lancerLActeDeSoin`) vit côté flux, dans `medicFlow`.
 */
import type { Combatant, Difficulty, Trauma } from '../engine/types';
import type { IdDePlaieDeLOperation } from './designations';
import { garanti } from '../lib/garanti';
import { rollLine, type RollLineParts } from './ligneDeJet';
import { type FlowStakeId, type StakeRef, type SkillRef } from '../data';
import { nomDe } from '../engine/nom';
import type { PlayerText } from '../i18n/playerText';
import { cibleMesuree } from '../engine/tests';
import { partyAssisted, type SupportDetail } from '../engine/skills';
import { bonus, effectiveChar } from '../engine/characteristics';
import { hasSurgerySkill, raisonDeModeDeSoin, estActeImmediat, healDifficulty, HEAL_MODES, HEAL_SKILL, type HealMode } from '../engine/healing';
import { surgeryTraumas, recoverableTraumas } from '../engine/trauma';
import { toMoney, canAfford } from '../engine/money';
import { t } from '../i18n';
import { totalDesBourses } from './bourseFlow';
import type { Jeu } from './etat';
import type { PendingHeal, PendingSurgery } from './pendings';

export interface MedicCost { gold?: number; silver?: number; brass?: number }

/** PNJ soigneur payant (effet `medicalAid`) : sa compétence + son tarif PAR ACTE. La Compétence est
 *  une RÉFÉRENCE portant sa valeur de Test imprimée (`SkillRef`) — le PNJ n'a pas de fiche. */
export interface MedicNpc {
  id: string;
  label: PlayerText;
  skill: SkillRef;
  intBonus: number;
  acts: { act: HealMode; cost?: MedicCost }[];
}

export interface MedicState {
  /** Absent = soins entre héros (meilleur soigneur du groupe). */
  npc?: MedicNpc;
  patientId: string | null;
  /** Opération ARMÉE (Test étendu, LDB 12 l.170-174). Deux `kind`, MÊME machinerie
   *  de passes (jet de Guérison influençable → cumul du DR) : `'chirurgie'` = Chirurgie d'une Blessure Critique
   *  (Talent Chirurgie, chaque passe inflige 1d10 PB + 1 Hémorragie, LDB 10 l.184) ; `'reeducation'` = Test étendu
   *  de Guérison qui rend l'usage d'un membre désactivé (« Épaule luxée »/« Genou démis », LDB 18 l.120/179 — aucun
   *  dégât, cible DR 6, Accessible +20, pénalité 1d10 j à la clé). */
  surgery?: {
    kind: ActeOperatoire;
    difficulty: Difficulty;
    healerId?: string;
    healerName: PlayerText;
    skill: number;
    /** SOUTIEN (LDB 12) des assistants, déjà fondu dans `skill` — recopié sur chaque passe (affichage). */
    support?: SupportDetail;
    intBonus: number;
    /** La Blessure Critique visée, parmi `plaiesDeLOperation` ; absente quand l'opération n'en vise aucune (verrous
     *  d'État seuls). */
    traumaUid?: IdDePlaieDeLOperation;
    drCible: number;
    cumDR: number;
    /** ENJEU d'une passe (#1117) — posé à l'ARMEMENT, où le `kind` et la cible de DR sont connus :
     *  opérer et rééduquer ne mettent pas la même chose en jeu (`stakes.json`, `chirurgie-test` vs
     *  `chirurgie-reeducation`). Rendu par la zone de jet embarquée (`MedicModal`). */
    stake: StakeRef;
    /** Dernière passe (affichage DrBar) — absent tant qu'aucune passe n'a été tentée. */
    last?: { roll: number; sl: number };
    /** Prix débité au lancer de l'acte (PNJ) — remboursé si on arrête AVANT la première passe. */
    paidCost?: MedicCost;
  };
}

/** Meilleur soigneur du groupe pour un acte (Opérer exige AUSSI le Talent Chirurgie, LDB 10 ; la récupération
 *  d'usage est un simple Test étendu de Guérison, sans Chirurgie, LDB 18 l.120/179). */
export function bestHealerFor(party: Combatant[], act: HealMode): { actor: Combatant; value: number; support: SupportDetail } | null {
  const pool = act === 'chirurgie' ? party.filter(hasSurgerySkill) : party;
  return partyAssisted(pool, { skill: { id: HEAL_SKILL } }); // Soutien (LDB 12) : assistants de chirurgie/soin
}

/** Enjeu servi par chaque acte de soin ; `chirurgie`/`reeducation` : celui de l'opération que l'acte arme. */
export const HEAL_STAKE: Record<HealMode, FlowStakeId> = {
  blessures: 'soin-blessures', hemorragie: 'soin-hemorragie', traumatisme: 'soin-dechirure', munition: 'soin-munition-logee',
  chirurgie: 'chirurgie-test', reeducation: 'chirurgie-reeducation',
};

/** L'acte arme-t-il une opération étendue (`medic.surgery`) ? */
/** Les actes de soin qui arment une opération au long cours (`MedicState['surgery']`). */
export type ActeOperatoire = Extract<HealMode, 'chirurgie' | 'reeducation'>;
export const estOperation = (act: HealMode): act is ActeOperatoire => act === 'chirurgie' || act === 'reeducation';

/** Le soigneur d'un acte : `actor`, le soigneur JOUEUR, absent pour un PNJ payant (aucune fiche) — c'est lui qui
 *  permet de décomposer la valeur en Niveau de Compétence nu + composantes nommées (`rollLine`). */
interface Soigneur { id?: string; actor?: Combatant; label: PlayerText; skill: number; intBonus: number; support?: SupportDetail }

/** Ligne d'un jet de l'infirmerie — SOURCE UNIQUE des deux surfaces (acte `pendingHeal`, passe d'opération
 *  `pendingSurgery`), montée par le monteur canonique (`rollLine`, #1153) : la valeur est DÉCOMPOSABLE quand le
 *  soigneur est un héros (Guérison + Soutien LDB 12), et sans fiche pour un PNJ payant — la cible est alors le seuil
 *  fourni, écrêté comme `rollTest` l'écrêtera. */
function ligneDuSoigneur(healer: { actor?: Combatant; skill: number; support?: SupportDetail }, difficulty: Difficulty): RollLineParts {
  return rollLine({
    actor: healer.actor,
    ...(healer.actor ? { test: { skill: { id: HEAL_SKILL } } } : {}),
    valeur: healer.skill, soutien: healer.support, difficulty,
  });
}

/** Le soigneur de l'acte `act` : le chirurgien figé de l'opération armée qu'il reprend, le PNJ payant, sinon le
 *  meilleur du groupe ; `null` : personne. */
function soigneurDeLActe(s: Pick<Jeu, 'medic' | 'party'>, act: HealMode): Soigneur | null {
  const m = s.medic;
  const sg = m?.surgery;
  if (sg?.kind === act) return { id: sg.healerId, label: sg.healerName, skill: sg.skill, intBonus: sg.intBonus, support: sg.support };
  if (m?.npc) return { id: m.npc.id, label: m.npc.label, skill: m.npc.skill.value, intBonus: m.npc.intBonus };
  const best = bestHealerFor(s.party, act);
  return best && { id: best.actor.id, actor: best.actor, label: nomDe(best.actor), skill: best.value, intBonus: bonus(effectiveChar(best.actor, 'intelligence')), support: best.support };
}

/** Les Blessures Critiques qu'une opération de genre `act` peut viser sur `patient` : à rééduquer
 *  (`recoverableTraumas`) ou à opérer (`surgeryTraumas`). */
const plaiesDeLActe = (patient: Combatant, act: ActeOperatoire): Trauma[] =>
  (act === 'reeducation' ? recoverableTraumas(patient) : surgeryTraumas(patient));

/** Les Blessures Critiques que le choix `infirmerie.plaie` ouvre, par l'`uid` que `jetValider('chirurgie')` lit : celles de
 *  l'opération armée avant sa première passe, sinon celles du brouillon d'une opération ; vide sinon. */
export function plaiesDeLOperation(s: Pick<Jeu, 'medic' | 'party' | 'pendingHeal'>): Trauma[] {
  const m = s.medic;
  const patient = m && s.party.find((h) => h.id === m.patientId);
  if (!m || !patient) return [];
  if (m.surgery) return m.surgery.last ? [] : plaiesDeLActe(patient, m.surgery.kind);
  const ph = s.pendingHeal;
  return ph && ph.roll == null && ph.targetId === patient.id && estOperation(ph.mode) ? plaiesDeLActe(patient, ph.mode) : [];
}

/** Pourquoi l'acte `act` est refusé sur le patient courant de l'infirmerie, `null` s'il s'offre. Pendant une opération
 *  armée, seuls les actes immédiats et la reprise de l'opération s'offrent ; la reprise garde son chirurgien et son
 *  tarif. Lu par `refusDuModeDuSoin` hors combat, par le brouillon et par le lancer. */
export function refusDeLActeALInfirmerie(s: Pick<Jeu, 'medic' | 'party' | 'pendingSurgery'>, act: HealMode): string | null {
  const m = s.medic;
  if (!m) return t('medic.fermee');
  if (s.pendingSurgery) return t('medic.jetEnCours');
  const reprise = m.surgery?.kind === act;
  if (m.surgery && !reprise && !estActeImmediat(act)) return t('medic.operationEnCours');
  const patient = s.party.find((h) => h.id === m.patientId);
  if (!patient) return t('medic.patientIntrouvable');
  const duPatient = raisonDeModeDeSoin(patient, act);
  if (duPatient || reprise) return duPatient;
  if (act === 'reeducation' && !recoverableTraumas(patient).length) return t('medic.aidRequired'); // LDB 18 l.120/179
  if (m.npc) {
    const offer = m.npc.acts.find((a) => a.act === act);
    if (!offer) return t('medic.acteNonPropose', { pnj: m.npc.label });
    return offer.cost && !canAfford(totalDesBourses(s.party), toMoney(offer.cost)) ? t('medic.tooExpensive') : null;
  }
  if (bestHealerFor(s.party, act)) return null;
  return act === 'chirurgie' ? t('medic.aucunChirurgien') : t('medic.aucunSoigneur');
}

/** Le soin de l'acte `act` sur le patient courant, sans jet ni débit : son soigneur, sa ligne, sa Difficulté et, pour
 *  une opération, la Blessure Critique visée par défaut. PUR. */
export function soinDeLActe(s: Pick<Jeu, 'medic' | 'party'>, act: HealMode): PendingHeal {
  const m = garanti(s.medic, act, 'infirmerie de l’acte');
  const patient = garanti(s.party.find((h) => h.id === m.patientId), m.patientId ?? undefined, 'patient de l’acte');
  const soigneur = garanti(soigneurDeLActe(s, act), act, 'soigneur de l’acte');
  const reprise = m.surgery?.kind === act ? m.surgery : undefined;
  // Chirurgie : Intermédiaire +0 (LDB 10). Récupération d'usage : Accessible +20 (LDB 18 l.120/179).
  const difficulty: Difficulty = reprise ? reprise.difficulty : act === 'reeducation' ? 'accessible' : act === 'chirurgie' ? 'intermediaire' : healDifficulty(act);
  const plaie = estOperation(act) && !reprise ? plaiesDeLActe(patient, act)[0]?.uid : undefined;
  const ligne = ligneDuSoigneur(soigneur, difficulty);
  return {
    healerId: soigneur.id ?? 'pnj-soigneur', healerName: soigneur.label, targetId: patient.id,
    mode: act, intBonus: soigneur.intBonus, test: 'guerison', bandagesDe: null, skillValue: soigneur.skill, support: soigneur.support,
    difficulty, ligne, ...cibleMesuree(ligne), roll: null, success: false, sl: 0, ...(plaie ? { plaie } : {}),
  };
}

/**
 * LE BROUILLON DU SOIN, tenu par la transition du jeu (`transitionDuJeu`) dans les deux sens. Hors combat, un soin
 * sans jet existe si et seulement si l'infirmerie est ouverte sans passe d'opération posée, sur son patient courant et
 * un acte ouvert : posé au premier acte ouvert (la reprise de l'opération armée d'abord) quand il manque, effacé quand
 * il est en trop, reposé quand le patient change ou que son acte se ferme. Un soin lancé et le combat n'y sont jamais
 * touchés.
 */
export function brouillonTenu(s: Pick<Jeu, 'medic' | 'battle' | 'party' | 'pendingHeal' | 'pendingSurgery'>): Partial<Pick<Jeu, 'pendingHeal'>> {
  const ph = s.pendingHeal;
  if (s.battle || ph?.roll != null) return {};
  const m = s.medic;
  if (!m || s.pendingSurgery) return ph ? { pendingHeal: null } : {};
  if (ph?.targetId === m.patientId && refusDeLActeALInfirmerie(s, ph.mode) === null) return {};
  const acte = (m.surgery ? [m.surgery.kind, ...HEAL_MODES] : HEAL_MODES).find((a) => refusDeLActeALInfirmerie(s, a) === null);
  if (acte) return { pendingHeal: soinDeLActe(s, acte) };
  return ph ? { pendingHeal: null } : {};
}

/** La passe d'opération que pose l'opération armée (`medic.surgery`), sur la valeur FIGÉE à l'armement : la ligne se
 *  monte sans fiche vivante. */
export function passeDeLOperation(s: Pick<Jeu, 'medic' | 'party'>): PendingSurgery {
  const m = garanti(s.medic, 'medic', 'infirmerie de la passe');
  const sg = garanti(m.surgery, m.patientId ?? undefined, 'opération armée');
  const patient = garanti(s.party.find((h) => h.id === m.patientId), m.patientId ?? undefined, 'patient opéré');
  const ligne = ligneDuSoigneur({ skill: sg.skill, support: sg.support }, sg.difficulty);
  return {
    healerId: sg.healerId ?? 'pnj-soigneur', targetId: patient.id,
    intBonus: sg.intBonus, ligne, ...cibleMesuree(ligne), roll: null, success: false, sl: 0, drCible: sg.drCible, cumDR: sg.cumDR,
  };
}

/** La cible de DR cumulé de l'opération que le brouillon `p` arme : Chirurgie, 7 (LDB 10) ; récupération d'usage,
 *  celle de la séquelle visée (LDB 18 l.120/179). Lue par l'armement et par l'enjeu du brouillon (`enjeuDuSoin`). */
export function cibleDeLOperation(s: Pick<Jeu, 'party'>, p: Pick<PendingHeal, 'targetId' | 'plaie'>, kind: ActeOperatoire): number {
  if (kind === 'chirurgie') return 7;
  const patient = garanti(s.party.find((h) => h.id === p.targetId), p.targetId, 'patient de l’opération');
  const aReeduquer = recoverableTraumas(patient);
  return garanti(aReeduquer.find((x) => x.uid === p.plaie) ?? aReeduquer[0], patient.id, 'membre à rééduquer').drCible;
}
