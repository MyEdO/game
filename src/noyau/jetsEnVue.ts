/**
 * LES JETS EN VUE — ce que la fenêtre qui tient la main (`fenetreDuJeu`) montre de ses jets : par ligne, qui
 * jette, le Test (ou la table, ou le dé nu), la cible, le d100, le DR et le verdict ; pour un Test opposé, la
 * ligne gagnante et le DR net. Lecteur PUR, partagé par l'écran web (libellés de ligne, graphie du dé nu et du
 * seuil) et par tout hôte qui lit la partie sans écran.
 *
 * Une ligne sépare la cible annoncée, le résultat du dé et son état de présentation. Le calendrier de révélation
 * `netOwnership.jetFigeRevele` sur `JET_FIGE` gouverne les faits du dé figé et de l'opposition (#990).
 */
import type { Jeu } from './etat';
import type { FlowKey } from './flowVerbs';
import type { HostJet } from './slotsDeJet';
import type {
  BatchParticipant, CascadeRoll, IssueOpposee, CascadeStep, PendingBargain, PendingCastOpposition, PendingDefense, SeuilDeSauvegarde,
} from './pendings';
import { fleeBackstab, fleeTouche } from './pendings';
import { attackTestOf, defenseTestOf, sommeDesModificateursDR, type AttackResult, type RollBreakdown } from '../engine/combat';
import type { CharKey, Combatant, ConditionId, Difficulty, HitLocation, ModLine, Weapon } from '../engine/types';
import { CHAR_LABELS } from '../engine/types';
import type { TestNomme } from '../engine/reglesChiffrees';
import {
  cibleDuTest,
  clampTarget,
  estJete,
  evaluateTest,
  hydrateTR,
  resolveOpposed,
  type EchecSansJet,
  type JetDeTest,
  type OpposedResult,
  type OrigineDuJet,
  type TestResult,
} from '../engine/tests';
import type { TestJete } from './bus';
import { castInfo, castInfoIsPrayer, castTestOf } from '../engine/magic';
import { attaqueDeCle } from '../engine/creatureAttacks';
import { formatDice } from '../engine/dice';
import { formatWardSave } from '../engine/traits/dispatch';
import { findCrewRoleById, findSpellById, refLabel, testSkillLabel } from '../data';
import { t } from '../i18n';
import { HORS_MODAL, MODAL_DEFS, type HorsModalDef, type ModalDef } from './modalArbiter';
import { attackWeaponOf, faitsPrevusDeLaFuite, faitsPrevusDeLaRangee, faitsPrevusDeLOups, faitsPrevusDuCritique } from './combatFlow';
import { objetDuNarratif } from './monde/resolveursDuNarratif';
import { FENETRE_DU_JET, fenetreDuJeu } from './combatAuto';
import { faitsAnnonces, maladresseCourante, resoudreOppositionDeCascade, stepOpposedFreeze, tableStepDef } from './cascade';
import { opposedAttackerLabel } from './rollSeam';
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import { APPRAISE_SKILL } from './merchantFlow';
import { ligneDeFrenesie, ligneDuTestNomme, parryWeaponOf } from './rollFlowSpecs';
import { JET_FIGE, jetFigeRevele } from './netOwnership';
import { tonDuFait, type RecapTone } from './recapLine';
import { faitDePrix, type DureeDEtat, type FaitApplique, type IssueDObjet, type MitigationDesBlessures } from '../engine/faits';
import { issueDuMarchandage, variationDuMarchandage, type SensDuPrix } from '../engine/bargain';
import { faitDuGainDeCorruption, gainDeLExposition } from './corruptionFlow';
import { actorIn } from './monde/combatants';
import type { CodexTarget } from '../engine/ruleRefs';
import { nomEnVue, porteurEnVue } from './visionDuGroupe';
import { mancheOpposeeDeTaverneEnVue } from './tavernFlow';
import { fenetreDAttaque } from './fenetreDAttaque';
import { fenetreDeDefense } from './fenetreDeDefense';
import { fenetreDIncantation } from './fenetreDIncantation';

export type VerdictDuJet = 'reussite' | 'echec';

export interface DeDuTest {
  d100: number;
  dr: number | null;
  reussi: boolean;
  verdict: VerdictDuJet;
  critique?: true;
  maladresse?: true;
  forcee?: true;
}

export type ReferenceDeJet =
  | ({ genre: 'competence' } & RefDesignee)
  | { genre: 'caracteristique'; id: CharKey }
  | { genre: 'table'; id: string };

/** Le sort qu'un Test d'incantation lance (#4830) : le contexte de sa ligne, la `reference` restant la Compétence testée. */
export type ReferenceDeSort = { genre: 'sort'; id: string };

export type EtatDeLigneDeJet = 'aJouer' | 'masque' | 'revele';

export interface CompositionDeJet {
  base: number | null;
  difficulty?: Difficulty;
  difficultyCombined?: number;
  difficultyParts?: ModLine[];
  clamped?: number;
}

type DonneesDeLigne =
  | { genre: 'test'; qui: string | null; test: string; cible: number | null; jet: DeDuTest | null; sort?: ReferenceDeSort; mods?: ModLine[]; modsDR?: ModLine[]; composition?: CompositionDeJet; seuil?: RollBreakdown['seuil'] }
  | { genre: 'table'; qui: string | null; table: string; jet: { d100: number; effectif: number; ligne: string } | null }
  | { genre: 'de'; qui: string | null; de: string; jet: { naturel: number; total: number; lecture: string } | null };

/**
 * @contrat Vue
 * Le détail d'une conséquence de genre `blessures`.
 */
export interface DetailDeBlessures {
  /** Atténuation d'une perte hors coup d'arme : `sans`, ou ce que la perte a déduit (`pa`, `be`). */
  mitigation?: MitigationDesBlessures;
  /** Regagnées par drain. */
  vol?: true;
}

/**
 * @contrat Vue
 * Le détail d'une conséquence de genre `avantage`.
 */
export interface DetailDAvantage {
  /** Avantage après le fait. */
  total: number;
  /** Porté à `total` plutôt qu'incrémenté. */
  complete?: true;
}

/**
 * @contrat Vue
 * Le détail d'une conséquence de genre `etat`.
 */
export interface DetailDEtat {
  /** Id de l'État. */
  id: ConditionId;
  /** Durée de la pose : `rounds`, `minutes`, ou annonce `parRound` (pions par Round, Rounds de la cause). */
  duree?: DureeDEtat;
  /** État porté par un effet ; `src` : ce qui le porte. */
  porte?: { src?: CodexTarget };
  /** Retiré par l'acte de soin qui lève son verrou. */
  verrouLeve?: true;
  /** Tout l'État retiré. */
  tous?: true;
  /** Re-pose d'une cause persistante. */
  regagne?: true;
  /** Annonce d'une cause persistante. */
  sauf?: true;
}

/**
 * @contrat Vue
 * Le détail d'une conséquence de genre `corruption`.
 */
export interface DetailDeCorruption {
  /** Corruption après le fait ; absent d'un gain écarté. */
  total?: number;
  /** Ce qui a écarté le gain : `protection`. */
  contre?: 'protection';
}

/**
 * @contrat Vue
 * Le détail d'une conséquence de genre `prix`.
 */
export interface DetailDePrix {
  /** Le prix d'un `achat` ou d'une `vente`. */
  sens: SensDuPrix;
}

/**
 * @contrat Vue
 * Le détail d'une conséquence de genre `objet`.
 */
export interface DetailDObjet {
  /** L'objet : `arme` (son id), ou `armure` (la Localisation qu'elle protège). */
  objet: { arme: string } | { armure: HitLocation };
  /** Ce que la conséquence en fait : `usee`, `brisee`, `lachee`, `intacte` (Incassable), `sauvee` (Sauvegarde Solide
   *  tenue sur son dé) ou `imperdable` (sauvée sans dé). */
  issue: IssueDObjet;
}

/**
 * @contrat Vue
 * Le détail propre au genre d'une conséquence (`ConsequenceEnVue.detail`, #4574) ; l'argent n'en porte aucun.
 */
export type DetailDeConsequence =
  /** Genre `blessures`. */
  | DetailDeBlessures
  /** Genre `avantage`. */
  | DetailDAvantage
  /** Genre `etat`. */
  | DetailDEtat
  /** Genre `corruption`. */
  | DetailDeCorruption
  /** Genre `prix`. */
  | DetailDePrix
  /** Genre `objet`. */
  | DetailDObjet;

/**
 * @contrat Vue
 * Une conséquence d'un jet ou d'une étape (#4574) : ce qu'elle fait, en données. Le texte du journal en est la
 * lecture ; l'hôte compose son affichage depuis ces champs. Une rangée d'une étape opposée au jet figé masqué
 * (`jetFigeRevele` faux) n'en publie aucune.
 */
export interface ConsequenceEnVue {
  /** Le genre du fait : `blessures`, `avantage`, `etat`, `corruption`, `argent`, `localisation`, `prix` ou `objet`. */
  genre: FaitApplique['genre'];
  /** Un nombre signé (Blessures, Avantage, pions d'État, Points de Corruption, sous de cuivre, points de pourcentage d'un
   *  prix, −1 d'un objet entamé ou brisé), ou l'id de ce que la conséquence désigne (`localisation` : l'id de la
   *  Localisation frappée). */
  valeur: number | HitLocation;
  /** L'id du combattant qui subit le fait, `null` s'il est hors de la vue du groupe. */
  qui: string | null;
  /** Présent quand le porteur du fait est hors de la vue du groupe. */
  porteurHorsDeVue?: true;
  /** Le ton vu du groupe : un gain du groupe ou une perte d'un hostile est une `reussite`, l'inverse un `echec` ; un
   *  fait sans variation ou sur un neutre est `neutre`. */
  ton: RecapTone;
  /** Le détail propre au genre (État et durée, atténuation, total, sens d'un prix), absent quand le genre n'en porte
   *  pas. */
  detail?: DetailDeConsequence;
}

/** L'identité de rangée est locale au jet. Un résultat masqué ne porte aucune valeur du dé. */
export type LigneDeJet = DonneesDeLigne & {
  id: string;
  etat: EtatDeLigneDeJet;
  reference: ReferenceDeJet | null;
  porteurHorsDeVue?: true;
  /** Les conséquences de ce jet : prévues tant que sa fenêtre attend sa validation, appliquées ensuite ; un seul
   *  résolveur les donne. Absentes s'il n'en publie aucune. */
  consequences?: ConsequenceEnVue[];
};
type LigneLue = DonneesDeLigne & { id?: string; masque?: boolean; reference?: ReferenceDeJet | null; faits?: FaitApplique[] };

/** Test opposé tranché : l'index de la ligne gagnante (null pour une égalité) et le DR net du vainqueur. */
export interface OppositionEnVue { gagnante: number | null; drNet: number }

export type SorteDeJet = 'simple' | 'oppose' | 'etendu' | 'multiple' | 'table' | 'de';

/** Les jets d'UN flux de la fenêtre (ou d'une étape de cascade), dans l'ordre où la fenêtre les range. */
export interface JetEnVue {
  flux: FlowKey;
  sorte: SorteDeJet;
  lignes: LigneDeJet[];
  /** Comparaison attestée. Un Test peut avoir été forcé sans marge d'opposition calculée. */
  oppose: OppositionEnVue | null;
  modsDR?: ModLine[];
  /** Comparaisons d'un même jet figé avec plusieurs réponses, indexées par rangée de réponse. */
  comparaisons?: { reponse: number; gagnante: 'fige' | 'reponse' | null; drNet: number }[];
}

type JetLuEnVue = Omit<JetEnVue, 'lignes'> & { lignes: LigneLue[] };

function testFixeDeCompetence(ref: RefDesignee, libelle: () => string = () => refLabel('skills', ref)) {
  return { libelle, reference: { genre: 'competence', ...ref } as const };
}

function testFixeDeCaracteristique(id: CharKey) {
  return { libelle: () => CHAR_LABELS[id], reference: { genre: 'caracteristique', id } as const };
}

const TESTS_FIXES = {
  'corps-a-corps': testFixeDeCompetence({ id: 'corps-a-corps' }),
  'dans-le-dos': testFixeDeCompetence({ id: 'corps-a-corps' }, () => `${refLabel('skills', { id: 'corps-a-corps' })} (dans le dos)`),
  esquive: testFixeDeCompetence({ id: 'esquive' }),
  athletisme: testFixeDeCompetence({ id: 'athletisme' }),
  calme: testFixeDeCompetence({ id: 'calme' }),
  chant: testFixeDeCompetence({ id: 'divertissement', spec: 'chant' }),
  focalisation: testFixeDeCompetence({ id: 'focalisation' }),
  'langue-magick': testFixeDeCompetence({ id: 'langue', spec: 'magick' }),
  guerison: testFixeDeCompetence({ id: 'guerison' }),
  projectiles: testFixeDeCompetence({ id: 'projectiles' }),
  marchandage: testFixeDeCompetence({ id: 'marchandage' }),
  bagarre: testFixeDeCompetence({ id: 'corps-a-corps', spec: 'bagarre' }, () => 'Bagarre'),
  force: testFixeDeCaracteristique('force'),
  'force-mentale': testFixeDeCaracteristique('force-mentale'),
  dexterite: testFixeDeCaracteristique('dexterite'),
  initiative: testFixeDeCaracteristique('initiative'),
  oups: { libelle: () => 'Tableau des Oups !', reference: null },
} as const;
export type TestFixe = keyof typeof TESTS_FIXES;

/** Le libellé de ligne d'un Test fixé par la situation. */
export const libelleDeTest = (cle: TestFixe): string => TESTS_FIXES[cle].libelle();

/** Le libellé de ligne d'un Test que nomme une règle (`TestNomme`) : sa Compétence. */
export const libelleDuTestNomme = (test: Pick<TestNomme, 'skill'>): string => refLabel('skills', test.skill);

/** Le libellé de ligne du Test d'un `pendingTest` : la Compétence affichée, à défaut le libellé de l'ouvreur. */
export const libelleDuTestDeScene = (pt: { skill?: string; label: string }): string => pt.skill ?? pt.label;

/** Ce que nomme la ligne du Test d'incantation du sort `spellId` : la Compétence testée (`castInfo`), et le sort. LDB 40 l.13 ; LDB 46 l.22-24 */
function referencesDIncantation(spellId: string): { reference: ReferenceDeJet | null; sort: ReferenceDeSort } {
  const spell = findSpellById(spellId);
  return { reference: spell ? referenceDeCompetence(castInfo(spell).skill) : null, sort: { genre: 'sort', id: spellId } };
}

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

/** Le jet d'attaque figé tel qu'il se lit avant la réponse de la Défense. */
export function lectureDeLAttaqueFigee(pd: Pick<PendingDefense, 'atk' | 'atkCompo'>) {
  const modsDR = pd.atkCompo?.modsDR;
  return { jet: { ...pd.atk, sl: pd.atk.sl + sommeDesModificateursDR(modsDR) }, modsDR };
}

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
type ReglagesDeLigne = {
  id?: string;
  reference?: ReferenceDeJet | null;
  sort?: ReferenceDeSort;
  masque?: 'roll' | 'value';
  cacherDR?: boolean;
  composition?: CompositionDeJet;
  seuil?: RollBreakdown['seuil'];
  mods?: ModLine[];
  modsDR?: ModLine[];
  critique?: boolean;
  maladresse?: boolean;
  forcee?: boolean;
};

const referenceDeCompetence = (ref: RefDesignee): ReferenceDeJet => ({ genre: 'competence', ...ref });

/** Ce qu'un Test teste : sa Compétence, à défaut sa Caractéristique. */
export function referenceDuSujet(sujet: { skill?: RefDesignee; characteristic?: CharKey } | undefined): ReferenceDeJet | null {
  if (sujet?.skill) return referenceDeCompetence(sujet.skill);
  return sujet?.characteristic ? { genre: 'caracteristique', id: sujet.characteristic } : null;
}

function ligne(qui: string | null | undefined, test: string, r: JetLu, cible?: number | null, options: ReglagesDeLigne = {}): LigneLue {
  const { id, reference, sort, masque, cacherDR, composition, seuil, mods, modsDR, critique, maladresse, forcee } = options;
  const c = r?.target ?? cible ?? null;
  const reussi = r?.success ?? (r != null && c != null && evaluateTest(r.roll, c).success);
  return {
    genre: 'test', id, qui: qui ?? null, test, reference, ...(sort ? { sort } : {}),
    cible: masque ? null : c,
    jet: r && masque !== 'roll' ? {
      d100: r.roll, dr: cacherDR ? null : r.sl ?? 0, reussi, verdict: reussi ? 'reussite' : 'echec',
      ...(critique ? { critique: true } : {}),
      ...(maladresse ? { maladresse: true } : {}),
      ...(forcee ? { forcee: true } : {}),
    } : null,
    ...(r && masque === 'roll' ? { masque: true } : {}),
    ...(!masque && composition ? { composition } : {}),
    ...(!masque && seuil ? { seuil } : {}),
    ...(!masque && mods?.length ? { mods } : {}),
    ...(!masque && modsDR?.length ? { modsDR } : {}),
  };
}

function ligneFixe(qui: string | null | undefined, cle: TestFixe, r: JetLu, cible?: number | null, options?: ReglagesDeLigne): LigneLue {
  return ligne(qui, libelleDeTest(cle), r, cible, { reference: TESTS_FIXES[cle].reference, ...options });
}

function compositionDuJet(d: CompositionDeJet): CompositionDeJet {
  return { base: d.base, difficulty: d.difficulty, difficultyCombined: d.difficultyCombined,
    difficultyParts: d.difficultyParts, clamped: d.clamped };
}

function referenceDeLAttaque(attaquant: Combatant | undefined, arme: Weapon | undefined): ReferenceDeJet | null {
  return attaquant && arme ? referenceDuSujet(attackTestOf(attaquant, arme, arme.type === 'distance' ? 'distance' : 'melee')) : null;
}

const ligneDuDetail = (id: 'attaquant' | 'defenseur', qui: string, d: RollBreakdown, reference: ReferenceDeJet | null): LigneLue =>
  ligne(qui, d.label, d, undefined, { id, reference, masque: d.mask, cacherDR: d.mask === 'value', mods: d.mods,
    modsDR: d.modsDR, composition: compositionDuJet(d), seuil: d.seuil });

const jete = <T extends object>(r: T | EchecSansJet | null | undefined): T | null => (estJete(r) ? r : null);

function sorteDe(flux: FlowKey, lignes: LigneLue[], oppose: OppositionEnVue | null): SorteDeJet {
  if (oppose) return 'oppose';
  if (flux === 'testEtendu' || flux === 'rechargement' || flux === 'focalisation' || flux === 'dissipation' || flux === 'chirurgie') return 'etendu';
  if (lignes.every((l) => l.genre === 'de')) return 'de';
  if (lignes.every((l) => l.genre === 'table')) return 'table';
  return lignes.length > 1 ? 'multiple' : 'simple';
}

const vue = (flux: FlowKey, lignes: LigneLue[], oppose: OppositionEnVue | null = null, modsDR?: ModLine[], sorte = sorteDe(flux, lignes, oppose)): JetLuEnVue =>
  ({ flux, sorte, lignes, oppose, ...(modsDR?.length ? { modsDR } : {}) });

const oppositionEnVue = (o: Pick<OpposedResult, 'winner' | 'netSL'>): OppositionEnVue =>
  ({ gagnante: o.winner === 'egalite' ? null : o.winner === 'attaquant' ? 0 : 1, drNet: o.netSL });

const drNet = (a: JetLu, b: JetLu): number => Math.abs((a?.sl ?? 0) - (b?.sl ?? 0));

/** Test opposé binaire (`opposedBinaryFlow`) : le jet figé du foe d'abord, celui de l'acteur ensuite. `revele` : le
 *  verdict du calendrier sur le jet figé (`jetFigeRevele`). */
function opposeBinaire(
  flux: FlowKey,
  foe: { qui: string; test: TestFixe; r: JetLu },
  acteur: { qui: string; test: TestFixe; r: JetLu },
  issue: IssueOpposee | null,
  revele: boolean,
): JetLuEnVue {
  const lignes = [ligneFixe(foe.qui, foe.test, foe.r, null, { masque: revele ? undefined : 'roll' }), ligneFixe(acteur.qui, acteur.test, acteur.r)];
  const oppose = revele && acteur.r && foe.r && issue ? { gagnante: issue === 'egalite' ? null : issue === 'reussite' ? 1 : 0, drNet: drNet(foe.r, acteur.r) } : null;
  return vue(flux, lignes, oppose, undefined, 'oppose');
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
  return res.defenderDetail ? { gagnante: res.advantageTo === 'attaquant' ? 0 : res.advantageTo === 'defenseur' ? 1 : null, drNet: res.netSL } : null;
}

/** Coup d'attaque : la ligne de l'attaquant, qui porte les faits du coup (`faits`), celle du défenseur au Test opposé. */
function lireCoup(flux: FlowKey, de: string, contre: string, res: AttackResult, attaque: ReferenceDeJet | null, defense: ReferenceDeJet | null, faits: FaitApplique[] = []): JetLuEnVue | null {
  if (!res.attackerDetail) return null;
  const lignes: LigneLue[] = [{ ...ligneDuDetail('attaquant', de, res.attackerDetail, attaque), ...(faits.length ? { faits } : {}) }];
  if (res.defenderDetail) lignes.push(ligneDuDetail('defenseur', contre, res.defenderDetail, defense));
  const oppose = lignes.some((l) => l.masque || (l.genre === 'test' && l.jet?.dr === null)) ? null : oppositionDuCoup(res);
  return vue(flux, lignes, oppose, undefined, res.defenderDetail ? 'oppose' : 'simple');
}

/** Les rangées d'un flux multi dont le dé est jeté ou à jeter (une rangée refusée n'a pas de dé). */
function rangees<P extends { id: string; result?: unknown; refus?: unknown }>(parts: readonly P[], lire: (p: P) => LigneLue): LigneLue[] {
  return parts.filter((p) => p.refus == null).map(lire);
}

/**
 * LE LECTEUR DE CHAQUE FLUX DE JET (`FLOW_VERBS`) — table TOTALE : un flux neuf déclare comment ses jets se lisent.
 * `null` : son pending est fermé.
 */
const LECTEURS: Record<FlowKey, (s: Jeu) => JetLuEnVue | null> = {
  attaque: (s) => {
    const pa = s.pendingAttack;
    if (!pa) return null;
    const attaquant = pool(s).find((c) => c.id === pa.attackerId);
    const cible = pool(s).find((c) => c.id === pa.targetId);
    const arme = s.battle && attaquant && cible ? attackWeaponOf(objetDuNarratif(s.campaignNarratif), s.scene, s.battle, attaquant, cible, pa) : pa.weapon;
    const referenceAttaque = referenceDeLAttaque(attaquant, arme);
    if (pa.result) {
      const mode = pa.result.defenderDetail?.mode;
      const test = cible && mode ? defenseTestOf(cible, mode, pa.result.parryWeapon) : undefined;
      return lireCoup('attaque', pa.attackerId, pa.targetId, pa.result, referenceAttaque, referenceDuSujet(test), fenetreDAttaque(s)?.issue?.faits);
    }
    const annonce = fenetreDAttaque(s);
    if (!annonce?.jet || !('pending' in annonce.jet)) return null;
    const attaque = annonce.jet.pending;
    const lignes = [ligne(pa.attackerId, attaque.label, null, attaque.target, {
      id: 'attaquant', reference: referenceAttaque, mods: attaque.mods, modsDR: attaque.modsDR,
      composition: compositionDuJet(attaque),
    })];
    const defense = annonce.defense;
    if (defense && 'pending' in defense) lignes.push(ligne(pa.targetId, defense.pending.label, null, null, {
      id: 'defenseur', reference: referenceDuSujet(defense.pending.test), mods: defense.pending.mods, composition: compositionDuJet({ ...defense.pending, base: null }),
    }));
    return vue('attaque', lignes, null, undefined, defense ? 'oppose' : 'simple');
  },
  defense: (s) => {
    const pd = s.pendingDefense;
    if (!pd) return null;
    const attaquant = pool(s).find((c) => c.id === pd.attackerId);
    const defenseur = pool(s).find((c) => c.id === pd.defenderId);
    const referenceAttaque = referenceDeLAttaque(attaquant, pd.weapon);
    const test = defenseur && defenseTestOf(defenseur, pd.result?.defenderDetail?.mode ?? pd.mode,
      pd.result?.parryWeapon ?? parryWeaponOf(defenseur, pd), pd.substituteSkillId);
    const referenceDefense = referenceDuSujet(test || undefined);
    if (pd.result) return lireCoup('defense', pd.attackerId, pd.defenderId, pd.result, referenceAttaque, referenceDefense, fenetreDeDefense(s)?.issue?.faits);
    const revele = jetFigeRevele(s, JET_FIGE.defense(pd));
    const attaque = lectureDeLAttaqueFigee(pd);
    const lignes = [ligne(pd.attackerId, libelleDeLAttaqueFigee(pd), attaque.jet, undefined,
      { id: 'attaquant', reference: referenceAttaque, masque: revele ? undefined : 'roll', modsDR: attaque.modsDR })];
    const annonce = fenetreDeDefense(s);
    if (annonce?.jet) {
      lignes.push(ligne(pd.defenderId, annonce.test, null, annonce.jet.target, {
        id: 'defenseur', reference: referenceDefense, mods: annonce.jet.mods, composition: compositionDuJet(annonce.jet),
      }));
    }
    return vue('defense', lignes, null, undefined, 'oppose');
  },
  incantation: (s) => {
    const pc = s.pendingCast;
    if (!pc) return null;
    const r = pc.result;
    const revele = jetFigeRevele(s, JET_FIGE.incantation(s, pc));
    const annonce = !r || revele ? fenetreDIncantation(s)?.ligne : undefined;
    return vue('incantation', [ligne(pc.casterId, libelleDIncantation(pc.spellId), r && { ...castTestOf(r), sl: r.slPropre ?? r.sl }, annonce?.target, {
      masque: revele ? undefined : 'roll',
      ...referencesDIncantation(pc.spellId),
      mods: annonce?.mods,
      composition: annonce && compositionDuJet(annonce),
      critique: r?.isCritical,
      maladresse: r?.isFumble,
    })]);
  },
  contreSort: (s) => {
    const csp = s.pendingCounterspell;
    const pc = s.pendingCast;
    if (!csp) return null;
    const cast = pc?.result && jetFigeRevele(s, JET_FIGE.incantation(s, pc)) ? castTestOf(pc.result) : null;
    const reponses = rangees(csp.participants, (p) => ligneFixe(p.id, 'langue-magick', p.result?.counter));
    const attente = vue('contreSort', reponses, null, undefined, 'oppose');
    if (!pc || !cast) return attente;
    const tranche = csp.participants.length === 1 && csp.participants[0].result;
    if (tranche) {
      const lanceur = ligne(pc.casterId, libelleDIncantation(pc.spellId), cast, undefined, referencesDIncantation(pc.spellId));
      return vue('contreSort', [lanceur, ...reponses], oppositionEnVue(resolveOpposed(cast, tranche.counter)), undefined, 'oppose');
    }
    const comparaisons = reponses.flatMap((l, i) => {
      const resultat = csp.participants.find((p) => p.id === l.qui)?.result;
      if (!resultat) return [];
      const verdict = resolveOpposed(cast, resultat.counter);
      return [{ reponse: i, gagnante: verdict.winner === 'egalite' ? null : verdict.winner === 'attaquant' ? 'fige' as const : 'reponse' as const, drNet: verdict.netSL }];
    });
    return comparaisons.length ? { ...attente, comparaisons } : attente;
  },
  opposition: (s) => {
    const pcs = s.pendingCastOpposition;
    if (!pcs) return null;
    const lignes = rangees(pcs.participants, (p) => ligne(p.id, libelleDOppositionDeSort(pcs), p.result?.oppose, p.ligne.target,
      { reference: referenceDuSujet(pcs.test), mods: p.ligne.mods }));
    return vue('opposition', lignes, null, undefined, 'oppose');
  },
  testEtendu: (s) => {
    const p = s.pendingExtendedTest;
    const cur = p?.rounds[p.rounds.length - 1];
    if (!p || !cur) return null;
    return vue('testEtendu', [ligne(p.actorId, p.skillLabel, cur.result && { ...cur.result, target: p.target }, p.target, { id: cur.id, reference: referenceDuSujet(p) })]);
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
    return vue('maladresse', [{ genre: 'table', qui: m.actorId ?? null, table: libelleDeTest('oups'), jet: r ? { d100: r.roll, effectif: r.roll, ligne: r.label } : null,
      ...faitsPublies(s, m, faitsDeLEtape(s, m)) }]);
  },
  cascadeEnBande: (s) => {
    const cur = etapeCourante(s);
    if (!cur?.participants) return null;
    const lectures = lireEtape(s, cur, true);
    if (lectures.length === 1) return lectures[0];
    return vue('cascadeEnBande', lectures.flatMap((v) => v.lignes), null, cur.meta?.aggregateDRMods, 'oppose');
  },
  etalLot: (s) => s.pendingEtalLot && vue('etalLot', s.pendingEtalLot.participants.map((r) => ({
    genre: 'de', id: r.id, qui: null, de: r.label, jet: { naturel: r.value, total: r.value, lecture: String(r.value) },
  }))),
  enfoncerLaPorte: (s) => s.pendingForceDoor && vue('enfoncerLaPorte', rangees(s.pendingForceDoor.participants, (p) => ligneFixe(p.id, 'bagarre', p.result))),
  desengagement: (s) => {
    const pd = s.pendingDisengage;
    if (!pd || pd.phase !== 'esquive') return null;
    return opposeBinaire('desengagement', { qui: pd.foeId, test: 'corps-a-corps', r: pd.atk }, { qui: pd.moverId, test: 'esquive', r: pd.def }, pd.result, jetFigeRevele(s, JET_FIGE.desengagement(pd)));
  },
  fuite: (s) => {
    const pd = s.pendingDisengage;
    if (!pd?.fuir) return null;
    const dos = fleeBackstab(pd);
    const touche = fleeTouche(pd);
    const lignes: LigneLue[] = [
      ...(dos ? [ligneFixe(dos.id, 'dans-le-dos', dos.result?.attackerDetail)] : []),
      ...(touche ? [ligne(touche.id, libelleDuTestNomme(touche.test), touche.jet, cibleDuLecteur(s, touche.id, (c) => ligneDuTestNomme(c, touche.test)), { reference: referenceDuSujet(touche.test) })] : []),
    ];
    return vue('fuite', lignes);
  },
  auContact: (s) => {
    const pd = s.pendingAuContact;
    if (!pd) return null;
    return opposeBinaire('auContact', { qui: pd.foeId, test: 'corps-a-corps', r: pd.atk }, { qui: pd.moverId, test: 'corps-a-corps', r: pd.def }, pd.result, jetFigeRevele(s, JET_FIGE.auContact(pd)));
  },
  empoignade: (s) => {
    const pd = s.pendingGrapple;
    if (!pd) return null;
    return opposeBinaire('empoignade', { qui: pd.foeId, test: 'force', r: pd.atk }, { qui: pd.actorId, test: 'force', r: pd.def }, pd.result, jetFigeRevele(s, JET_FIGE.empoignade(pd)));
  },
  distraire: (s) => {
    const pd = s.pendingDistraire;
    if (!pd) return null;
    return opposeBinaire('distraire', { qui: pd.foeId, test: 'calme', r: pd.defRoll }, { qui: pd.moverId, test: 'athletisme', r: pd.atk }, pd.result, jetFigeRevele(s, JET_FIGE.distraire(pd)));
  },
  battement: (s) => s.pendingBattement && vue('battement', [ligneFixe(s.pendingBattement.attackerId, 'corps-a-corps', s.pendingBattement.result)]),
  manoeuvre: (s) => {
    const pm = s.pendingManeuver;
    const a = pm && pool(s).find((c) => c.id === pm.attackerId);
    return pm && a ? vue('manoeuvre', [ligne(pm.attackerId, libelleDeManoeuvre(a, pm.attaque), pm.result)]) : null;
  },
  course: (s) => {
    const pr = s.pendingRun;
    return pr && vue('course', [ligne(pr.combatantId, libelleDuTestNomme(pr.test), pr.result && { ...pr.result, sl: pr.result.dr }, cibleDuLecteur(s, pr.combatantId, (c) => ligneDuTestNomme(c, pr.test)), { reference: referenceDuSujet(pr.test) })]);
  },
  chute: (s) => {
    const p = s.pendingFall;
    if (!p) return null;
    const test = libelleDuTestNomme(p.test);
    return vue('chute', p.participants.filter((x) => x.attempt === true).map((x) => ligne(x.id, test, x.result && { ...x.result, sl: x.result.dr }, cibleDuLecteur(s, x.id, (c) => ligneDuTestNomme(c, p.test)), { reference: referenceDuSujet(p.test) })));
  },
  rechargement: (s) => {
    const p = s.pendingReload;
    return p && vue('rechargement', [ligneFixe(p.actorId, 'projectiles', p.roll != null ? { roll: p.roll, target: p.target, sl: p.sl, success: p.success } : null, p.target)]);
  },
  mainEnsanglantee: (s) => {
    const p = s.pendingHandGate;
    return p && vue('mainEnsanglantee', [ligneFixe(p.attackerId, 'dexterite', p.roll != null ? { roll: p.roll, target: p.target, sl: p.sl, success: p.success } : null, p.target)]);
  },
  recuperation: (s) => {
    const sr = s.pendingStateRecovery;
    if (!sr) return null;
    const acteur = ligne(sr.actorId, sr.skillLabel, sr.roll);
    if (!sr.opposition || !sr.roll) return vue('recuperation', [acteur], null, undefined, sr.opposition ? 'oppose' : 'simple');
    return vue('recuperation', [acteur, ligne(null, libelleDeForceAdverse(sr.opposition.label), sr.opponentRoll)],
      sr.opponentRoll ? { gagnante: sr.success ? 0 : 1, drNet: Math.abs(sr.netSL) } : null, undefined, 'oppose');
  },
  focalisation: (s) => {
    const p = s.pendingFocus;
    const r = p?.result;
    return p && vue('focalisation', [ligneFixe(p.casterId, 'focalisation', r && { roll: r.roll, target: r.target, sl: r.sl ?? r.dr, success: r.success })]);
  },
  dissipation: (s) => s.pendingDispel && vue('dissipation', [ligneFixe(s.pendingDispel.casterId, 'langue-magick', s.pendingDispel.result)]),
  frenesie: (s) => s.pendingFrenzy && vue('frenesie', [ligneFixe(s.pendingFrenzy.combatantId, 'force-mentale', s.pendingFrenzy.result, cibleDuLecteur(s, s.pendingFrenzy.combatantId, ligneDeFrenesie))]),
  approche: (s) => {
    const p = s.pendingApproach;
    return p && vue('approche', [ligne(p.combatantId, libelleDuTestNomme(p.test), p.result, cibleDuLecteur(s, p.combatantId, (c) => ligneDuTestNomme(c, p.test)), { reference: referenceDuSujet(p.test) })]);
  },
  protection: (s) => s.pendingWard && vue('protection', [ligneFixe(s.pendingWard.attackerId, 'force-mentale', s.pendingWard.result)]),
  soins: (s) => {
    const p = s.pendingHeal;
    return p && vue('soins', [ligneFixe(p.healerId, p.test, p.roll != null ? { roll: p.roll, target: p.target, sl: p.sl, success: p.success } : null, p.target)]);
  },
  chirurgie: (s) => {
    const p = s.pendingSurgery;
    return p && vue('chirurgie', [ligneFixe(p.healerId, 'guerison', p.roll != null ? { roll: p.roll, target: p.target, sl: p.sl, success: p.success } : null, p.target)]);
  },
  corruption: (s) => {
    const p = s.pendingCorruption;
    if (!p) return null;
    const hero = actorIn(s, p.heroId);
    const gain = gainDeLExposition(p);
    const fait = hero && gain > 0 ? faitDuGainDeCorruption(s, hero, gain) : null;
    return vue('corruption', [{ ...ligne(p.heroId, libelleDuTestNomme(p.test), p.roll != null ? { roll: p.roll, target: p.target, sl: p.sl, success: p.success } : null, cibleDuLecteur(s, p.heroId, (c) => ligneDuTestNomme(c, p.test)), { reference: referenceDuSujet(p.test) }),
      ...(fait ? { faits: [fait] } : {}) }]);
  },
  test: (s) => {
    const p = s.pendingTest;
    return p && vue('test', [ligne(p.actorId, libelleDuTestDeScene(p), p.roll != null ? { roll: p.roll, target: p.target, sl: p.sl, success: evaluateTest(p.roll, p.target).success } : null, p.target, { reference: referenceDuSujet(p.sujet), mods: p.mods })]);
  },
  fuiteDeVapeur: (s) => {
    const p = s.pendingSteamSave;
    return p && vue('fuiteDeVapeur', [ligneFixe(p.actorId, 'initiative', p.roll != null ? { roll: p.roll, target: p.target, sl: p.sl, success: p.success } : null, p.target)]);
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
    const lignes = [
      { ...ligneFixe(pb.playerId, 'marchandage', pb.roll, clampTarget(cibleDuTest(pb.playerSkill)).target, { id: 'joueur' }),
        ...(revele ? prixDuMarchandage(s, pb) : {}) },
      ligneFixe(null, 'marchandage', pb.merchantRoll, null, { id: 'marchand', masque: revele ? 'value' : 'roll' }),
    ];
    const oppose = revele && pb.roll && pb.result ? oppositionEnVue(pb.result) : null;
    return vue('marchandage', lignes, oppose, undefined, 'oppose');
  },
  evaluation: (s) => {
    const p = s.pendingAppraise;
    return p && vue('evaluation', [ligne(p.actorId, libelleDEvaluation(p), p.roll != null ? { roll: p.roll, target: p.target, sl: p.sl, success: p.success } : null, p.target, { reference: referenceDuSujet(APPRAISE_SKILL[p.mode ?? 'evaluation']) })]);
  },
  chansonDeMarin: (s) => s.pendingShanty && vue('chansonDeMarin', [ligneFixe(s.pendingShanty.singerId, 'chant', s.pendingShanty.result)]),
  manoeuvreDuNavire: (s) => s.pendingShipManeuver && vue('manoeuvreDuNavire', rangees(s.pendingShipManeuver.participants, (p) => ligne(p.id, libelleDeRole(p), jete(p.result)))),
  tirDeBatterie: (s) => {
    const p = s.pendingShipBattery;
    return p && vue('tirDeBatterie', rangees(p.participants, (r) => ligne(r.id, libelleDeRole(r), jete(r.result))), null, p.modsDR);
  },
};

/** Le prix que le Marchandage tranché `pb` fait au marchand, prévu tant que sa fenêtre attend sa validation : la
 *  variation que son acquittement fige (`issueDuMarchandage`) et que les prix du marchand lisent (`bargainBuyFactor`,
 *  `bargainSellFactor`). Aucun pour un billet, qui lit son palier (`prixParPassager`), ni pour une variation nulle. */
function prixDuMarchandage(s: Jeu, pb: PendingBargain): { faits?: FaitApplique[] } {
  const c = pb.contrepartie;
  const joueur = actorIn(s, pb.playerId);
  if (!pb.result || c.kind !== 'marchand' || !joueur) return {};
  const variation = variationDuMarchandage(issueDuMarchandage(pb.result, pb.negotiator), c.mode);
  return variation ? { faits: [faitDePrix(joueur, variation, c.mode)] } : {};
}

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

/** Les faits d'une étape : ceux qu'elle a appliqués (`step.faits`), sinon, tant qu'elle attend sa validation, ceux que
 *  son application prévoit — la Blessure critique de sa fenêtre de Déviation (`faitsPrevusDuCritique`), les États
 *  Brisés de sa Fuite (`faitsPrevusDeLaFuite`), l'arme de sa Maladresse tirée (`faitsPrevusDeLOups`), son annonce
 *  (`faitsAnnonces`). Un fait stocké est un fait appliqué. */
export function faitsDeLEtape(s: Jeu, step: CascadeStep): FaitApplique[] {
  if (step.faits || step.committed) return step.faits ?? [];
  if (step.deviation && step.options) return faitsPrevusDuCritique(s, step.deviation);
  if (step.fuite) return faitsPrevusDeLaFuite(s, step.fuite);
  if (step.maladresse?.result) return faitsPrevusDeLOups(s, step.actorId, step.maladresse.weapon, step.maladresse.result);
  return faitsAnnonces(s, step);
}

/** Les faits qu'une étape publie : aucun tant que le jet figé d'une étape opposée n'est pas révélé
 *  (`jetFigeRevele`). */
function faitsPublies(s: Jeu, step: CascadeStep, faits: FaitApplique[] | undefined): { faits?: FaitApplique[] } {
  if (!faits?.length) return {};
  const masquee = !!step.meta?.opposed && !!stepOpposedFreeze(step) && !jetFigeRevele(s, JET_FIGE.cascade(step));
  return masquee ? {} : { faits };
}

/** La ligne d'une rangée de bande (`BatchParticipant`), avec les faits que son étape publie : appliqués, sinon, tant
 *  que sa bande attend sa validation, prévus (`faitsPrevusDeLaRangee`). */
function ligneDeBande(s: Jeu, step: CascadeStep, part: BatchParticipant): LigneLue {
  const r = jete(part.result);
  const libelle = libelleDeRangee(part.teste) ?? (porteurEnVue(s, part.id) ? part.label : undefined) ?? nomEnVue(s, part.id);
  const faits = part.faits ?? (step.committed ? undefined : faitsPrevusDeLaRangee(s, step, part));
  return { ...ligne(part.id, libelle ?? '', r, part.target, { reference: referenceDuSujet(part.teste), mods: part.mods, forcee: part.forcee }), ...faitsPublies(s, step, faits) };
}

/** Le jet FIGÉ d'une étape opposée (`meta.opposed`) face à une réponse, révélé selon le calendrier (`jetFigeRevele`). */
function opposeDEtape(s: Jeu, step: CascadeStep, reponse: LigneLue, r: CascadeRoll | null, base?: number): JetLuEnVue {
  const flux = step.participants ? 'cascadeEnBande' : 'cascade';
  const opp = step.meta?.opposed;
  const fige = stepOpposedFreeze(step);
  if (!opp || !fige) return vue(flux, [reponse]);
  const revele = jetFigeRevele(s, JET_FIGE.cascade(step));
  const auteur = opp.attackerId && !porteurEnVue(s, opp.attackerId)
    ? { ...opp, attackerName: nomEnVue(s, opp.attackerId) ?? '' }
    : opp;
  const adversaire = ligne(opp.attackerId, libelleDuJetFige(auteur), opp.aT, undefined,
    { id: 'adversaire', masque: revele ? undefined : 'roll', reference: referenceDuSujet(opp.test) });
  const jetDeReponse = reponse.genre === 'test' && reponse.jet;
  const test = r && jetDeReponse && hydrateTR({ ...r, base, success: jetDeReponse.reussi });
  const opposition = revele && test && !jetDeReponse.forcee ? oppositionEnVue(resoudreOppositionDeCascade(test, fige, base)) : null;
  const taverne = mancheOpposeeDeTaverneEnVue(s, step);
  const issue = taverne?.issue;
  const gagnante = issue?.gagnant === 'joueur' ? 1 : issue?.gagnant === 'adversaire' ? 0 : null;
  return vue(flux, [adversaire, reponse], revele && issue ? { gagnante, drNet: issue.drNet } : opposition, undefined,
    taverne?.etendue ? 'etendu' : 'oppose');
}

function jetPropre(r: CascadeRoll | null, oppose: boolean, forcee?: boolean): CascadeRoll | null {
  return r && oppose ? { ...r, success: forcee || evaluateTest(r.roll, r.target).success } : r;
}

/** Étape de cascade non hôte, courante puis au bilan. */
function lireEtape(s: Jeu, step: CascadeStep, courante: boolean): JetLuEnVue[] {
  if (step.participants) {
    if (step.meta?.opposed) return step.participants.filter((p) => p.refus == null).map((p) => opposeDEtape(s, step,
      ligneDeBande(s, step, { ...p, result: jetPropre(jete(p.result), true, p.forcee) }), jete(p.result), p.base));
    const lignes = rangees(step.participants, (p) => ligneDeBande(s, step, p));
    const taverne = mancheOpposeeDeTaverneEnVue(s, step);
    const issue = taverne?.issue;
    const gagnant = issue?.gagnant === 'joueur' ? taverne?.joueurId : issue?.gagnant === 'adversaire' ? taverne?.adversaireId : null;
    const indexGagnant = lignes.findIndex((l) => l.qui === gagnant);
    const opposition = issue ? { gagnante: indexGagnant >= 0 ? indexGagnant : null, drNet: issue.drNet } : null;
    const sorte = taverne ? taverne.etendue ? 'etendu' : 'oppose' : 'multiple';
    return [vue('cascadeEnBande', lignes, opposition, step.meta?.aggregateDRMods, sorte)];
  }
  if (step.refus != null) return [];
  if (step.target != null) {
    const r = jete(step.result);
    const reponse = { ...ligne(step.actorId, step.rollLabel, jetPropre(r, !!step.meta?.opposed, step.forcee), step.target,
      { reference: referenceDuSujet(step.teste), mods: step.mods, forcee: step.forcee }), ...faitsPublies(s, step, faitsDeLEtape(s, step)) };
    return [courante || step.meta?.opposed ? opposeDEtape(s, step, reponse, r, step.base) : vue('cascade', [reponse])];
  }
  if (step.table) {
    const r = step.table.result;
    const reference = { genre: 'table', id: step.table.tableId } as const;
    return [vue('cascadeTirage', [{ genre: 'table', qui: step.actorId ?? null, table: libelleDeTable(step) ?? step.label ?? step.id,
      reference, jet: r ? { d100: r.roll, effectif: r.die, ligne: r.lines[0] ?? '' } : null, ...faitsPublies(s, step, faitsDeLEtape(s, step)) }])];
  }
  if (step.de) {
    const r = step.de.result;
    return [vue('cascadeTirage', [{ genre: 'de', qui: step.actorId ?? null, de: libelleDuDe(step), jet: r ? { naturel: r.roll, total: r.total, lecture: lectureDuTotal(step, r.total) } : null,
      ...faitsPublies(s, step, faitsDeLEtape(s, step)) }])];
  }
  return [];
}

/** Les conséquences de l'étape `step` quand elle ne porte aucune ligne de jet (`lireEtape`), par la même porte que les
 *  rangées (`faitsPublies`) : une étape sans jet les publie sur elle-même. */
export function consequencesDeLEtape(s: Jeu, step: CascadeStep): ConsequenceEnVue[] {
  if (step.jet || lireEtape(s, step, true).length) return [];
  return (faitsPublies(s, step, faitsDeLEtape(s, step)).faits ?? []).map((f) => consequenceEnVue(s, f));
}

function jetsDeLaCascade(s: Jeu): JetLuEnVue[] {
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

/** Un fait appliqué tel que le groupe le voit : son porteur hors de vue n'est pas nommé, le ton suit son camp. */
function consequenceEnVue(s: Jeu, f: FaitApplique): ConsequenceEnVue {
  const { cible, camp: _camp, genre, valeur, ...detail } = f;
  const horsDeVue = !porteurEnVue(s, cible);
  return {
    genre, valeur, qui: horsDeVue ? null : cible, ...(horsDeVue ? { porteurHorsDeVue: true } : {}), ton: tonDuFait(f),
    ...(Object.keys(detail).length ? { detail } : {}),
  };
}

/** LES JETS EN VUE de la fenêtre qui tient la main (`fenetreDuJeu`), dans l'ordre où elle les range, chacun avec au
 *  moins une ligne. Vide : aucune fenêtre, ou une fenêtre sans jet. */
export function jetsEnVue(s: Jeu): JetEnVue[] {
  return jetsLus(s).filter((j) => j.lignes.length).map((j) => ({
    ...j,
    lignes: j.lignes.map(({ id, masque, reference, faits, ...l }, i): LigneDeJet => {
      const porteurHorsDeVue = l.qui !== null && !porteurEnVue(s, l.qui);
      const qui = porteurHorsDeVue ? null : l.qui;
      const quiUnique = qui && j.lignes.filter((r) => r.qui === qui).length === 1 ? qui : null;
      return {
        ...l, qui, id: id ?? quiUnique ?? `${j.flux}/${i}`, reference: reference ?? null, etat: masque ? 'masque' : l.jet ? 'revele' : 'aJouer',
        ...(porteurHorsDeVue ? { porteurHorsDeVue: true } : {}),
        ...(faits?.length ? { consequences: faits.map((f) => consequenceEnVue(s, f)) } : {}),
      };
    }),
  }));
}

function jetsLus(s: Jeu): JetLuEnVue[] {
  const fenetre = fenetreDuJeu(s);
  if (!fenetre) return [];
  return fenetre.cle === 'cascade' ? jetsDeLaCascade(s) : fluxDeLaFenetre(fenetre.cle).flatMap((f) => {
    const v = LECTEURS[f](s);
    return v ? [v] : [];
  });
}

/** La charge du Test jeté `jet`, d'issue `r` (#4848), avant ce que le groupe en voit (`testJeteEnVue`). */
export function chargeDuJet(jet: JetDeTest, r: TestResult, origine: OrigineDuJet): TestJete {
  return {
    porteur: jet.porteur,
    reference: 'puissance' in jet.teste ? { genre: 'puissance' } : referenceDuSujet(jet.teste)!,
    issue: { roll: r.roll, cible: r.target, dr: r.sl, reussi: r.success },
    ...origine,
  };
}

/** Le Test jeté `jet` tel que le groupe le voit en `s` (#4848), `null` tant qu'une ligne ouverte de son porteur en masque
 *  le dé (jet figé). Un porteur hors de vue sort `null` ; une valeur que la ligne masque (marchand) sort masquée. */
export function testJeteEnVue(s: Jeu, jet: TestJete): TestJete | null {
  const masquante = jetsLus(s).flatMap((j) => j.lignes)
    .find((l) => l.genre === 'test' && l.qui === jet.porteur && (l.masque || l.jet?.dr === null));
  if (masquante?.masque) return null;
  const porteur = jet.porteur !== null && !porteurEnVue(s, jet.porteur) ? null : jet.porteur;
  return { ...jet, porteur, ...(masquante ? { issue: { ...jet.issue, cible: null, dr: null } } : {}) };
}
