/**
 * LES JETS EN VUE — ce que la fenêtre qui tient la main (`fenetreDuJeu`) montre de ses jets : par ligne, qui
 * jette, le Test (ou la table, ou le dé nu), la cible, le d100, le DR et le verdict ; pour un Test opposé, la
 * ligne gagnante et le DR net. Lecteur PUR, partagé par l'écran web (libellés de ligne, graphie du dé nu et du
 * seuil) et par tout hôte qui lit la partie sans écran.
 *
 * Une ligne dont le dé n'est pas tombé est rendue « à lancer » (`jet: null`) avec la cible annoncée : celle que le
 * pending porte (flux figés), ou celle du lecteur de ligne que le résolveur jette (flux sur l'acteur vivant).
 * Le jet FIGÉ d'un adversaire est rendu « à lancer » tant qu'il n'est pas révélé à ce siège, et le Test opposé sans
 * gagnante ni DR net : `netOwnership.jetFigeRevele` sur `JET_FIGE` (#990).
 */
import type { Jeu } from './etat';
import type { FlowKey } from './flowVerbs';
import type { HostJet } from './slotsDeJet';
import type { BatchParticipant, CascadeRoll, IssueOpposee, CascadeStep, PendingCastOpposition, PendingDefense, SeuilDeSauvegarde } from './pendings';
import { fleeBackstab, fleeTouche } from './pendings';
import type { AttackResult, RollBreakdown } from '../engine/combat';
import type { Combatant } from '../engine/types';
import { CHAR_LABELS } from '../engine/types';
import type { TestNomme } from '../engine/reglesChiffrees';
import { estJete, evaluateTest, type EchecSansJet } from '../engine/tests';
import { castInfoIsPrayer } from '../engine/magic';
import { attaqueDeCle } from '../engine/creatureAttacks';
import { formatDice } from '../engine/dice';
import { formatWardSave } from '../engine/traits/dispatch';
import { findCrewRoleById, findSpellById, refLabel, testSkillLabel } from '../data';
import { t } from '../i18n';
import { HORS_MODAL, MODAL_DEFS, type HorsModalDef, type ModalDef } from './modalArbiter';
import { FENETRE_DU_JET, fenetreDuJeu } from './combatAuto';
import { maladresseCourante, tableStepDef } from './cascade';
import { opposedAttackerLabel } from './rollSeam';
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import { APPRAISE_SKILL } from './merchantFlow';
import { ligneDeFrenesie, ligneDuTestNomme } from './rollFlowSpecs';
import { JET_FIGE, jetFigeRevele } from './netOwnership';
import { nomEnVue } from './visionDuGroupe';

/** Le dé d'une ligne de Test, une fois tombé. */
export interface DeDuTest { d100: number; dr: number; reussi: boolean }

/** UNE ligne de jet : un Test, un tirage sur table, ou un dé nu. `qui` : l'id du combattant qui jette (`null` :
 *  le monde, ou un adversaire sans combattant — le libellé le nomme). `jet: null` : le dé n'est pas tombé. */
export type LigneDeJet =
  | { genre: 'test'; qui: string | null; test: string; cible: number | null; jet: DeDuTest | null }
  | { genre: 'table'; qui: string | null; table: string; jet: { d100: number; effectif: number; ligne: string } | null }
  | { genre: 'de'; qui: string | null; de: string; jet: { naturel: number; total: number; lecture: string } | null };

/** Test opposé tranché : l'index de la ligne GAGNANTE (`null` : égalité parfaite, statu quo) et le DR net du
 *  vainqueur — la grandeur du badge « DR net » de l'écran web (`OpposedResult.netSL`). */
export interface OppositionEnVue { gagnante: number | null; drNet: number }

/** Les jets d'UN flux de la fenêtre (ou d'une étape de cascade), dans l'ordre où la fenêtre les range. */
export interface JetEnVue { flux: FlowKey; lignes: LigneDeJet[]; oppose: OppositionEnVue | null }

/** Les Tests dont la Compétence ou la Caractéristique est fixée par la situation. */
const TESTS_FIXES = {
  'corps-a-corps': () => refLabel('skills', { id: 'corps-a-corps' }),
  'dans-le-dos': () => `${refLabel('skills', { id: 'corps-a-corps' })} (dans le dos)`,
  esquive: () => refLabel('skills', { id: 'esquive' }),
  athletisme: () => refLabel('skills', { id: 'athletisme' }),
  calme: () => refLabel('skills', { id: 'calme' }),
  chant: () => refLabel('skills', { id: 'divertissement', spec: 'chant' }),
  focalisation: () => refLabel('skills', { id: 'focalisation' }),
  'langue-magick': () => refLabel('skills', { id: 'langue', spec: 'magick' }),
  guerison: () => refLabel('skills', { id: 'guerison' }),
  projectiles: () => refLabel('skills', { id: 'projectiles' }),
  marchandage: () => refLabel('skills', { id: 'marchandage' }),
  bagarre: () => 'Bagarre',
  force: () => CHAR_LABELS.force,
  'force-mentale': () => CHAR_LABELS['force-mentale'],
  dexterite: () => CHAR_LABELS.dexterite,
  initiative: () => CHAR_LABELS.initiative,
  oups: () => 'Tableau des Oups !',
} as const satisfies Record<string, () => string>;
export type TestFixe = keyof typeof TESTS_FIXES;

/** Le libellé de ligne d'un Test fixé par la situation. */
export const libelleDeTest = (cle: TestFixe): string => TESTS_FIXES[cle]();

/** Le libellé de ligne d'un Test que nomme une règle (`TestNomme`) : sa Compétence. */
export const libelleDuTestNomme = (test: Pick<TestNomme, 'skill'>): string => refLabel('skills', test.skill);

/** Le libellé de ligne du Test d'un `pendingTest` : la Compétence affichée, à défaut le libellé de l'ouvreur. */
export const libelleDuTestDeScene = (pt: { skill?: string; label: string }): string => pt.skill ?? pt.label;

/** Le libellé de ligne d'une incantation : la Prière, ou l'Incantation et son NI. */
export function libelleDIncantation(spellId: string): string {
  const spell = findSpellById(spellId);
  if (!spell) return '';
  return castInfoIsPrayer(spell) ? 'Prière' : `Incantation / NI ${spell.cn ?? 0}`;
}

/** Le libellé de ligne du jet d'une manœuvre de créature : la Caractéristique de son attaque. */
export function libelleDeManoeuvre(attacker: Combatant, attaque: string): string {
  const stat = attaqueDeCle(attacker.traits ?? [], attaque)?.stat ?? 'capacite-de-tir';
  return CHAR_LABELS[stat === 'capacite-de-combat' ? 'capacite-de-combat' : 'capacite-de-tir'];
}

/** Le libellé de ligne du jet de Force d'un adversaire nommé (sortie d'un État, LDB 13). */
export const libelleDeForceAdverse = (nom: string): string => `${nom} — ${libelleDeTest('force')}`;

/** Le libellé de ligne du jet de Puissance d'une armée adverse (bataille rangée). */
export const libelleDePuissance = (nom: string): string => `${nom} · Puissance`;

/** Le libellé de ligne d'une Évaluation/Détection. */
export const libelleDEvaluation = (pa: { skillLabel?: string; mode?: keyof typeof APPRAISE_SKILL }): string =>
  pa.skillLabel ?? refLabel('skills', APPRAISE_SKILL[pa.mode ?? 'evaluation'].skill);

/** Le libellé de ligne d'une opposition de cible à une incantation. */
export const libelleDOppositionDeSort = (pcs: Pick<PendingCastOpposition, 'test'>): string => testSkillLabel(pcs.test);

/** Le libellé de ligne d'une rangée de Test d'équipage : le rôle tenu, étoilé s'il est essentiel. */
export function libelleDeRole(part: { roleId: string; essential?: boolean }): string {
  const role = findCrewRoleById(part.roleId);
  return role ? `${role.label}${part.essential ? ' ★' : ''}` : '';
}

/** Le libellé de ligne d'une rangée-participant : la Compétence qu'elle déclare (aucune : `undefined`, la
 *  rangée garde le sien). */
export const libelleDeRangee = (part: { skill?: RefDesignee }): string | undefined =>
  part.skill ? refLabel('skills', part.skill) : undefined;

/** Le libellé de ligne du jet FIGÉ d'un Test opposé d'étape : l'adversaire, et ce qu'il teste. */
export function libelleDuJetFige(opp: NonNullable<Parameters<typeof opposedAttackerLabel>[0]> & { attackerName: string }): string {
  const teste = opposedAttackerLabel(opp);
  return teste ? `${opp.attackerName} — ${teste}` : opp.attackerName;
}

/** Le libellé de ligne de l'attaque FIGÉE d'une Défense : l'arme d'une attaque gratuite de créature (#1858), sinon
 *  l'Attaque. */
export const libelleDeLAttaqueFigee = (pd: Pick<PendingDefense, 'suite' | 'weapon'>): string =>
  (pd.suite.mode === 'machine' && pd.suite.coup.manoeuvre?.kind ? pd.weapon.label : t('jet.attaque'));

/** La graphie du seuil d'un dé (#1508). */
export const libelleDuSeuil = (seuil: SeuilDeSauvegarde): string =>
  `${formatWardSave(seuil.source, seuil.indice)}${seuil.dome ? t('cf.sauvegardeDuDome') : ''}`;

/** Ce qui se tire d'un dé nu, et ses dés (« Hauteur de chute (2d10) »). */
export const libelleDuDe = (s: CascadeStep): string => `${s.label ?? ''} (${s.de ? formatDice(s.de.spec) : ''})`.trim();

/** Le total d'un dé nu, dans la lecture de l'étape : avec son unité, ou confronté à son seuil. */
export function lectureDuTotal(s: CascadeStep, total: number): string {
  const seuil = s.de?.seuil;
  if (seuil) return `${total} ${total >= seuil.indice ? '≥' : '<'} ${libelleDuSeuil(seuil)}`;
  return s.de?.unite ? `${total} ${s.de.unite}` : String(total);
}

/** Le nom de la table d'une étape à table, celui que sa définition porte. */
export const libelleDeTable = (s: CascadeStep): string | undefined => (s.table ? tableStepDef(s.table.tableId)?.label : undefined);

type JetLu = { roll: number; target?: number; sl?: number; success?: boolean } | null | undefined;

/** La ligne d'un Test : le dé se lit comme la rangée l'affiche (`testBreakdown`). */
function ligne(qui: string | null | undefined, test: string, r: JetLu, cible?: number | null): LigneDeJet {
  const c = r?.target ?? cible ?? null;
  return {
    genre: 'test', qui: qui ?? null, test, cible: c,
    jet: r ? { d100: r.roll, dr: r.sl ?? 0, reussi: r.success ?? (c != null && evaluateTest(r.roll, c).success) } : null,
  };
}

const ligneDuDetail = (qui: string, d: RollBreakdown): LigneDeJet => ligne(qui, d.label, d);

const jete = <T extends object>(r: T | EchecSansJet | null | undefined): T | null => (estJete(r) ? r : null);

const vue = (flux: JetEnVue['flux'], lignes: LigneDeJet[], oppose: OppositionEnVue | null = null): JetEnVue => ({ flux, lignes, oppose });

const drNet = (a: JetLu, b: JetLu): number => Math.abs((a?.sl ?? 0) - (b?.sl ?? 0));

/** Test opposé binaire (`opposedBinaryFlow`) : le jet figé du foe d'abord, celui de l'acteur ensuite. `revele` : le
 *  verdict du calendrier sur le jet figé (`jetFigeRevele`). */
function opposeBinaire(
  flux: FlowKey,
  foe: { qui: string; test: string; r: JetLu },
  acteur: { qui: string; test: string; r: JetLu },
  issue: IssueOpposee | null,
  revele: boolean,
): JetEnVue {
  const lignes = [ligne(foe.qui, foe.test, revele ? foe.r : null), ligne(acteur.qui, acteur.test, acteur.r)];
  const oppose = revele && acteur.r && foe.r && issue ? { gagnante: issue === 'egalite' ? null : issue === 'reussite' ? 1 : 0, drNet: drNet(foe.r, acteur.r) } : null;
  return vue(flux, lignes, oppose);
}

const pool = (s: Jeu): readonly Combatant[] => s.battle?.combatants ?? s.party;

/** La cible qu'annonce, avant le jet, le lecteur de ligne que le résolveur jette (`ligneDuTestNomme`, `ligneDeFrenesie`)
 *  sur l'acteur `id` ; `null` sans lui. */
function cibleDuLecteur(s: Jeu, id: string, lire: (c: Combatant) => { target: number }): number | null {
  const c = pool(s).find((x) => x.id === id);
  return c ? lire(c).target : null;
}

/** Le Test opposé d'un coup tranché : la ligne 0 (l'attaquant) gagne quand le coup touche ; `null` sans jet de
 *  défense. Lu par `lireCoup` et par la fenêtre d'attaque (`fenetreDAttaque`). */
export function oppositionDuCoup(res: AttackResult): OppositionEnVue | null {
  return res.defenderDetail ? { gagnante: res.hit ? 0 : 1, drNet: res.netSL } : null;
}

/** Coup d'attaque : la ligne de l'attaquant, celle du défenseur au Test opposé. */
function lireCoup(flux: FlowKey, de: string, contre: string, res: AttackResult | null): JetEnVue | null {
  if (!res?.attackerDetail) return null;
  const lignes = [ligneDuDetail(de, res.attackerDetail), ...(res.defenderDetail ? [ligneDuDetail(contre, res.defenderDetail)] : [])];
  return vue(flux, lignes, oppositionDuCoup(res));
}

/** Les rangées d'un flux multi dont le dé est jeté ou à jeter (une rangée refusée n'a pas de dé). */
function rangees<P extends { id: string; result?: unknown; refus?: unknown }>(parts: readonly P[], lire: (p: P) => LigneDeJet): LigneDeJet[] {
  return parts.filter((p) => p.refus == null).map(lire);
}

/**
 * LE LECTEUR DE CHAQUE FLUX DE JET (`FLOW_VERBS`) — table TOTALE : un flux neuf déclare comment ses jets se lisent.
 * `null` : son pending est fermé.
 */
const LECTEURS: Record<FlowKey, (s: Jeu) => JetEnVue | null> = {
  attaque: (s) => s.pendingAttack && lireCoup('attaque', s.pendingAttack.attackerId, s.pendingAttack.targetId, s.pendingAttack.result),
  defense: (s) => {
    const pd = s.pendingDefense;
    if (!pd) return null;
    if (pd.result) return lireCoup('defense', pd.attackerId, pd.defenderId, pd.result);
    return vue('defense', [ligne(pd.attackerId, libelleDeLAttaqueFigee(pd), jetFigeRevele(s, JET_FIGE.defense(pd)) ? pd.atk : null)]);
  },
  incantation: (s) => {
    const pc = s.pendingCast;
    if (!pc) return null;
    const r = jetFigeRevele(s, JET_FIGE.incantation(s, pc)) ? pc.result : undefined;
    return vue('incantation', [ligne(pc.casterId, libelleDIncantation(pc.spellId), r && { roll: r.roll, target: r.target, sl: r.sl })]);
  },
  contreSort: (s) => {
    const csp = s.pendingCounterspell;
    const pc = s.pendingCast;
    const cast = pc && jetFigeRevele(s, JET_FIGE.incantation(s, pc)) ? pc.result : undefined;
    if (!csp) return null;
    const lignes = rangees(csp.participants, (p) => ligne(p.id, libelleDeTest('langue-magick'), p.result?.counter));
    const tranche = cast && csp.participants.length === 1 && csp.participants[0].result;
    return vue('contreSort', tranche ? [ligne(s.pendingCast!.casterId, libelleDIncantation(s.pendingCast!.spellId), cast), ...lignes] : lignes,
      tranche ? { gagnante: tranche.dispelled ? 1 : 0, drNet: drNet(cast, tranche.counter) } : null);
  },
  opposition: (s) => {
    const pcs = s.pendingCastOpposition;
    if (!pcs) return null;
    return vue('opposition', rangees(pcs.participants, (p) => ligne(p.id, libelleDOppositionDeSort(pcs), p.result?.oppose, p.ligne.target)));
  },
  testEtendu: (s) => {
    const p = s.pendingExtendedTest;
    const cur = p?.rounds[p.rounds.length - 1];
    if (!p || !cur) return null;
    return vue('testEtendu', [ligne(p.actorId, p.skillLabel, cur.result && { ...cur.result, target: p.target }, p.target)]);
  },
  cascade: (s) => {
    const cur = etapeCourante(s);
    return cur && !cur.jet && !cur.participants && !cur.table && !cur.de ? lireEtape(s, cur, true)[0] ?? null : null;
  },
  cascadeTirage: (s) => {
    const cur = etapeCourante(s);
    return cur && !cur.jet && (cur.table || cur.de) ? lireEtape(s, cur, true)[0] ?? null : null;
  },
  maladresse: (s) => {
    const m = maladresseCourante(s.pendingCascade);
    if (!m) return null;
    const r = m.maladresse.result;
    return vue('maladresse', [{ genre: 'table', qui: m.actorId ?? null, table: libelleDeTest('oups'), jet: r ? { d100: r.roll, effectif: r.roll, ligne: r.label } : null }]);
  },
  cascadeEnBande: (s) => {
    const cur = etapeCourante(s);
    return cur?.participants ? vue('cascadeEnBande', lireEtape(s, cur, true).flatMap((v) => v.lignes)) : null;
  },
  etalLot: (s) => s.pendingEtalLot && vue('etalLot', s.pendingEtalLot.participants.map((r) => ({
    genre: 'de', qui: null, de: r.label, jet: { naturel: r.value, total: r.value, lecture: String(r.value) },
  }))),
  enfoncerLaPorte: (s) => s.pendingForceDoor && vue('enfoncerLaPorte', rangees(s.pendingForceDoor.participants, (p) => ligne(p.id, libelleDeTest('bagarre'), p.result))),
  desengagement: (s) => {
    const pd = s.pendingDisengage;
    if (!pd || pd.phase !== 'esquive') return null;
    return opposeBinaire('desengagement', { qui: pd.foeId, test: libelleDeTest('corps-a-corps'), r: pd.atk }, { qui: pd.moverId, test: libelleDeTest('esquive'), r: pd.def }, pd.result, jetFigeRevele(s, JET_FIGE.desengagement(pd)));
  },
  fuite: (s) => {
    const pd = s.pendingDisengage;
    if (!pd?.fuir) return null;
    const dos = fleeBackstab(pd);
    const touche = fleeTouche(pd);
    const lignes: LigneDeJet[] = [
      ...(dos ? [ligne(dos.id, libelleDeTest('dans-le-dos'), dos.result?.attackerDetail)] : []),
      ...(touche ? [ligne(touche.id, libelleDuTestNomme(touche.test), touche.jet, cibleDuLecteur(s, touche.id, (c) => ligneDuTestNomme(c, touche.test)))] : []),
    ];
    return vue('fuite', lignes);
  },
  auContact: (s) => {
    const pd = s.pendingAuContact;
    if (!pd) return null;
    const cac = libelleDeTest('corps-a-corps');
    return opposeBinaire('auContact', { qui: pd.foeId, test: cac, r: pd.atk }, { qui: pd.moverId, test: cac, r: pd.def }, pd.result, jetFigeRevele(s, JET_FIGE.auContact(pd)));
  },
  empoignade: (s) => {
    const pd = s.pendingGrapple;
    if (!pd) return null;
    const force = libelleDeTest('force');
    return opposeBinaire('empoignade', { qui: pd.foeId, test: force, r: pd.atk }, { qui: pd.actorId, test: force, r: pd.def }, pd.result, jetFigeRevele(s, JET_FIGE.empoignade(pd)));
  },
  distraire: (s) => {
    const pd = s.pendingDistraire;
    if (!pd) return null;
    return opposeBinaire('distraire', { qui: pd.foeId, test: libelleDeTest('calme'), r: pd.defRoll }, { qui: pd.moverId, test: libelleDeTest('athletisme'), r: pd.atk }, pd.result, jetFigeRevele(s, JET_FIGE.distraire(pd)));
  },
  battement: (s) => s.pendingBattement && vue('battement', [ligne(s.pendingBattement.attackerId, libelleDeTest('corps-a-corps'), s.pendingBattement.result)]),
  manoeuvre: (s) => {
    const pm = s.pendingManeuver;
    const a = pm && pool(s).find((c) => c.id === pm.attackerId);
    return pm && a ? vue('manoeuvre', [ligne(pm.attackerId, libelleDeManoeuvre(a, pm.attaque), pm.result)]) : null;
  },
  course: (s) => {
    const pr = s.pendingRun;
    return pr && vue('course', [ligne(pr.combatantId, libelleDuTestNomme(pr.test), pr.result && { ...pr.result, sl: pr.result.dr }, cibleDuLecteur(s, pr.combatantId, (c) => ligneDuTestNomme(c, pr.test)))]);
  },
  chute: (s) => {
    const p = s.pendingFall;
    if (!p) return null;
    const test = libelleDuTestNomme(p.test);
    return vue('chute', p.participants.filter((x) => x.attempt === true).map((x) => ligne(x.id, test, x.result && { ...x.result, sl: x.result.dr }, cibleDuLecteur(s, x.id, (c) => ligneDuTestNomme(c, p.test)))));
  },
  rechargement: (s) => {
    const p = s.pendingReload;
    return p && vue('rechargement', [ligne(p.actorId, libelleDeTest('projectiles'), p.roll != null ? { roll: p.roll, target: p.target, sl: p.sl, success: p.success } : null, p.target)]);
  },
  mainEnsanglantee: (s) => {
    const p = s.pendingHandGate;
    return p && vue('mainEnsanglantee', [ligne(p.attackerId, libelleDeTest('dexterite'), p.roll != null ? { roll: p.roll, target: p.target, sl: p.sl, success: p.success } : null, p.target)]);
  },
  recuperation: (s) => {
    const sr = s.pendingStateRecovery;
    if (!sr) return null;
    const acteur = ligne(sr.actorId, sr.skillLabel, sr.roll);
    if (!sr.opposition || !sr.roll) return vue('recuperation', [acteur]);
    return vue('recuperation', [acteur, ligne(null, libelleDeForceAdverse(sr.opposition.label), sr.opponentRoll)],
      sr.opponentRoll ? { gagnante: sr.success ? 0 : 1, drNet: Math.abs(sr.netSL) } : null);
  },
  focalisation: (s) => {
    const p = s.pendingFocus;
    const r = p?.result;
    return p && vue('focalisation', [ligne(p.casterId, libelleDeTest('focalisation'), r && { roll: r.roll, target: r.target, sl: r.sl ?? r.dr, success: r.success })]);
  },
  dissipation: (s) => s.pendingDispel && vue('dissipation', [ligne(s.pendingDispel.casterId, libelleDeTest('langue-magick'), s.pendingDispel.result)]),
  frenesie: (s) => s.pendingFrenzy && vue('frenesie', [ligne(s.pendingFrenzy.combatantId, libelleDeTest('force-mentale'), s.pendingFrenzy.result, cibleDuLecteur(s, s.pendingFrenzy.combatantId, ligneDeFrenesie))]),
  approche: (s) => {
    const p = s.pendingApproach;
    return p && vue('approche', [ligne(p.combatantId, libelleDuTestNomme(p.test), p.result, cibleDuLecteur(s, p.combatantId, (c) => ligneDuTestNomme(c, p.test)))]);
  },
  protection: (s) => s.pendingWard && vue('protection', [ligne(s.pendingWard.attackerId, libelleDeTest('force-mentale'), s.pendingWard.result)]),
  soins: (s) => {
    const p = s.pendingHeal;
    return p && vue('soins', [ligne(p.healerId, libelleDeTest(p.test), p.roll != null ? { roll: p.roll, target: p.target, sl: p.sl, success: p.success } : null, p.target)]);
  },
  chirurgie: (s) => {
    const p = s.pendingSurgery;
    return p && vue('chirurgie', [ligne(p.healerId, libelleDeTest('guerison'), p.roll != null ? { roll: p.roll, target: p.target, sl: p.sl, success: p.success } : null, p.target)]);
  },
  corruption: (s) => {
    const p = s.pendingCorruption;
    return p && vue('corruption', [ligne(p.heroId, libelleDuTestNomme(p.test), p.roll != null ? { roll: p.roll, target: p.target, sl: p.sl, success: p.success } : null, cibleDuLecteur(s, p.heroId, (c) => ligneDuTestNomme(c, p.test)))]);
  },
  test: (s) => {
    const p = s.pendingTest;
    return p && vue('test', [ligne(p.actorId, libelleDuTestDeScene(p), p.roll != null ? { roll: p.roll, target: p.target, sl: p.sl, success: evaluateTest(p.roll, p.target).success } : null, p.target)]);
  },
  fuiteDeVapeur: (s) => {
    const p = s.pendingSteamSave;
    return p && vue('fuiteDeVapeur', [ligne(p.actorId, libelleDeTest('initiative'), p.roll != null ? { roll: p.roll, target: p.target, sl: p.sl, success: p.success } : null, p.target)]);
  },
  activite: (s) => {
    const pa = s.pendingActivity;
    if (!pa) return null;
    const r = pa.roll != null ? { roll: pa.roll, target: pa.target, sl: pa.sl, success: pa.success } : null;
    const lignes = [ligne(pa.heroId, pa.skillLabel, r, pa.target)];
    if (pa.target2 != null && pa.skill2) lignes.push(ligne(pa.heroId, pa.skill2, pa.roll != null ? { roll: pa.roll, target: pa.target2, sl: pa.sl2 ?? 0, success: pa.success2 } : null, pa.target2));
    const ennemi = r && pa.enemyValue != null && pa.enemyRoll != null && s.massBattle ? evaluateTest(pa.enemyRoll, pa.enemyValue) : null;
    if (!ennemi) return vue('activite', lignes);
    lignes.push(ligne(null, libelleDePuissance(s.massBattle!.ennemi.label), ennemi));
    return vue('activite', lignes, { gagnante: pa.success ? 0 : lignes.length - 1, drNet: Math.abs(pa.enemySL ?? 0) });
  },
  marchandage: (s) => {
    const pb = s.pendingBargain;
    if (!pb) return null;
    const revele = jetFigeRevele(s, JET_FIGE.marchandage(pb));
    const lignes = [ligne(pb.playerId, libelleDeTest('marchandage'), pb.roll), ligne(null, libelleDeTest('marchandage'), revele ? pb.merchantRoll : null)];
    const o = revele && pb.roll ? pb.result : null;
    return vue('marchandage', lignes, o ? { gagnante: o.winner === 'egalite' ? null : o.attackerWins ? 0 : 1, drNet: o.netSL } : null);
  },
  evaluation: (s) => {
    const p = s.pendingAppraise;
    return p && vue('evaluation', [ligne(p.actorId, libelleDEvaluation(p), p.roll != null ? { roll: p.roll, target: p.target, sl: p.sl, success: p.success } : null, p.target)]);
  },
  chansonDeMarin: (s) => s.pendingShanty && vue('chansonDeMarin', [ligne(s.pendingShanty.singerId, libelleDeTest('chant'), s.pendingShanty.result)]),
  manoeuvreDuNavire: (s) => s.pendingShipManeuver && vue('manoeuvreDuNavire', rangees(s.pendingShipManeuver.participants, (p) => ligne(p.id, libelleDeRole(p), jete(p.result)))),
  tirDeBatterie: (s) => s.pendingShipBattery && vue('tirDeBatterie', rangees(s.pendingShipBattery.participants, (p) => ligne(p.id, libelleDeRole(p), jete(p.result)))),
};

/** Les flux qu'une étape-JET de cascade héberge, dans l'ordre de sa fenêtre : le sien, puis ceux des fenêtres qu'elle
 *  ouvre en son sein (`FENETRE_DU_JET`). */
const fluxDeLEtape = (jet: HostJet): readonly FlowKey[] => {
  const { flux, reactives = [] } = FENETRE_DU_JET[jet];
  return [flux, ...reactives.map((r) => r.flux)];
};

function etapeCourante(s: Jeu): CascadeStep | undefined {
  const p = s.pendingCascade;
  return p ? p.participants[p.cursor] : undefined;
}

/** La ligne d'une rangée de bande (`BatchParticipant`). */
function ligneDeBande(s: Jeu, part: BatchParticipant): LigneDeJet {
  const r = jete(part.result);
  return ligne(part.id, libelleDeRangee(part) ?? part.label ?? nomEnVue(s, part.id) ?? part.id, r, part.target);
}

/** Le jet FIGÉ d'une étape opposée (`meta.opposed`) face à une réponse, révélé selon le calendrier (`jetFigeRevele`). */
function opposeDEtape(s: Jeu, step: CascadeStep, reponse: LigneDeJet, r: CascadeRoll | null): JetEnVue {
  const flux = step.participants ? 'cascadeEnBande' : 'cascade';
  const opp = step.meta?.opposed;
  if (!opp) return vue(flux, [reponse]);
  const revele = jetFigeRevele(s, JET_FIGE.cascade(step));
  const fige = ligne(opp.attackerId, libelleDuJetFige(opp), revele ? opp.aT : null);
  return vue(flux, [fige, reponse], revele && r ? {
    gagnante: r.statuQuo ? null : r.success ? 1 : 0,
    drNet: Math.abs(opp.aT.sl - (r.sl + (opp.bonusSL ?? 0))),
  } : null);
}

/** Les jets d'UNE étape de cascade non hôte. `courante` : l'étape tient la fenêtre (le jet figé d'un Test
 *  opposé y est rendu) ; sinon elle est lue au bilan. */
function lireEtape(s: Jeu, step: CascadeStep, courante: boolean): JetEnVue[] {
  if (step.participants) {
    if (courante && step.meta?.opposed) return step.participants.filter((p) => p.refus == null).map((p) => opposeDEtape(s, step, ligneDeBande(s, p), jete(p.result)));
    return [vue('cascadeEnBande', rangees(step.participants, (p) => ligneDeBande(s, p)))];
  }
  if (step.refus != null) return [];
  if (step.target != null) {
    const r = jete(step.result);
    const reponse = ligne(step.actorId, step.rollLabel, r, step.target);
    return [courante ? opposeDEtape(s, step, reponse, r) : vue('cascade', [reponse])];
  }
  if (step.table) {
    const r = step.table.result;
    return [vue('cascadeTirage', [{ genre: 'table', qui: step.actorId ?? null, table: libelleDeTable(step) ?? step.label ?? step.id, jet: r ? { d100: r.roll, effectif: r.die, ligne: r.lines[0] ?? '' } : null }])];
  }
  if (step.de) {
    const r = step.de.result;
    return [vue('cascadeTirage', [{ genre: 'de', qui: step.actorId ?? null, de: libelleDuDe(step), jet: r ? { naturel: r.roll, total: r.total, lecture: lectureDuTotal(step, r.total) } : null }])];
  }
  return [];
}

function jetsDeLaCascade(s: Jeu): JetEnVue[] {
  const p = s.pendingCascade;
  if (!p) return [];
  if (p.cursor >= p.participants.length) return p.participants.filter((st) => !st.jet).flatMap((st) => lireEtape(s, st, false));
  const cur = p.participants[p.cursor];
  if (!cur) return [];
  if (!cur.jet) return lireEtape(s, cur, true);
  return fluxDeLEtape(cur.jet).flatMap((f) => {
    const v = LECTEURS[f](s);
    return v ? [v] : [];
  });
}

/** Les flux qu'une fenêtre déclare rendre (`ModalDef.flux`, `HorsModalDef.flux`). */
function fluxDeLaFenetre(cle: string): readonly FlowKey[] {
  const def = (MODAL_DEFS as readonly ModalDef[]).find((d) => d.key === cle) ?? (HORS_MODAL as readonly HorsModalDef[]).find((d) => d.key === cle);
  return def?.flux ?? [];
}

/** LES JETS EN VUE de la fenêtre qui tient la main (`fenetreDuJeu`), dans l'ordre où elle les range, chacun avec au
 *  moins une ligne. Vide : aucune fenêtre, ou une fenêtre sans jet. */
export function jetsEnVue(s: Jeu): JetEnVue[] {
  const fenetre = fenetreDuJeu(s);
  if (!fenetre) return [];
  const jets = fenetre.cle === 'cascade' ? jetsDeLaCascade(s) : fluxDeLaFenetre(fenetre.cle).flatMap((f) => {
    const v = LECTEURS[f](s);
    return v ? [v] : [];
  });
  return jets.filter((j) => j.lignes.length);
}
