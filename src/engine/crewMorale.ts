/**
 * MORAL d'un équipage de navire — MDG 14 « Navigation à bord de grands vaisseaux ». CODE GÉNÉRIQUE
 * lisant la DONNÉE verbatim (`crew-morale.json`). Système PROPRE à la Mer des Griffes : ni le LDB ni
 * Aux Armes ne définissent de score de Moral numérique (AA n'a qu'une « Loyauté »/« Désertion »
 * narrative) — aucune mécanique parallèle à réutiliser ici.
 *
 * Le Moral débute à 75 (nouveau capitaine / nouvel équipage) et est RECALCULÉ une fois par semaine :
 * chaque facteur ACTIF fait monter ou descendre le score. Sa bande détermine les bonus/malus de DR aux
 * Tests d'équipage et de Commandement, et le seuil de désertion en cas de relâche à terre.
 *
 * Le **Test d'équipage** (MDG 14) est un mécanisme PROPRE : « le total cumulé de ces Tests individuels »
 * (somme des DR de chaque contributeur, le DR du rôle ESSENTIEL étant DOUBLÉ) — ce n'est PAS le Test Soutenu
 * du LDB (+10 par soutien à UN seul jet) : on le résout donc avec son propre additionneur, en réutilisant
 * `rollTest` (un jet par contributeur) et la bande de Moral (`crewTestDR`). `rollExpr` évalue les
 * modificateurs de Moral (dés signés « +2d10 »/« -3d10 ») ; `findTableEntry` classe le score dans sa bande.
 */
import crewMoraleJson from '../data/crew-morale.json';
import { findTableEntry } from './tables';
import { rollExpr, type RNG, defaultRNG } from './dice';
import { rollTest, easeDifficulty } from './tests';
import { bestForSkills } from './skills';
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import { talentTestSLBonus } from './magic';
import { skillDRBonus } from './ops';
import { rule } from './policy';
import { findCrewRoleById, findCrewTestTypeById, type CrewRoleData } from '../data';
import { priceToMoney, toBrass } from './money';
import { effectRef, type Combatant, type Difficulty } from './types';
import type { ModLine } from './combat';
import type { PairedSense } from './ops';

/** Facteur de Moral (MODIFICATEURS DE MORAL, MDG 14) — `effect` = dés signés (« +2d10 », « -3d10 »). */
export interface MoraleFactor {
  /** id STABLE (slug) — toute réf passe par lui, jamais le `label`. */
  id: string;
  label: string;
  effect: string;
  /** Multiplicateur de SOLDE si ce facteur est un CHOIX de paie du Conseil de bord (donnée MAISON,
   *  cf. `payChoices`). Absent = facteur circonstanciel, pas un choix offert au capitaine. */
  wageMul?: number;
  /** Choix de paie mis en AVANT au Conseil de bord (action principale de la modale) — donnée MAISON,
   *  comme `wageMul` : le tableau MDG 14 ne hiérarchise pas les lignes « La paie … ». */
  recommendedPay?: boolean;
}

/** Bande d'effet du Moral (EFFETS DU MORAL, MDG 14). */
export interface MoraleBand {
  min: number;
  max: number;
  id: string;
  /** Titre de bande verbatim (MDG 14 l.187-202). */
  label: string;
  /** ±DR aux Tests de Commandement du capitaine. */
  captainCmdDR: number;
  /** ±DR à TOUS les Tests d'équipage. */
  crewTestDR: number;
  /** Relâche à terre : 1d100 par membre ; ≤ ce seuil → il ne revient pas (absent si aucune désertion). */
  desertionRoll?: number;
  /** Texte d'effet verbatim. */
  desc: string;
}

/** Moral de départ d'un nouvel équipage / nouveau capitaine (MDG 14). */
export const MORALE_BASE: number = crewMoraleJson.base;
export const MORALE_FACTORS: MoraleFactor[] = crewMoraleJson.factors;
export const MORALE_BANDS: MoraleBand[] = crewMoraleJson.bands as MoraleBand[];


/** Bande d'effet du Moral courant (DR aux Tests, seuil de désertion). PUR. */
export function moraleBand(score: number): MoraleBand {
  return findTableEntry(MORALE_BANDS, score);
}

export interface MoraleRecalc {
  /** Variation totale appliquée ce recalcul (somme des dés signés des facteurs actifs). */
  delta: number;
  /** Nouveau score (`current + delta`). */
  score: number;
  /** Un jet PAR facteur appliqué (id/label/valeur signée) — surface le recalcul en procès-verbal (#229). */
  rolls: { id: string; label: string; rolled: number }[];
  /** Une ligne par facteur appliqué (journal du recalcul). */
  lines: string[];
}

/**
 * Recalcul HEBDOMADAIRE du Moral (MDG 14) : chaque facteur ACTIF (référencé par `id`) roule son
 * effet en dés signés et fait MONTER ou DESCENDRE le Moral courant. PUR (RNG injecté pour le déterminisme).
 */
export function recalcMorale(current: number, activeFactorIds: string[], rng: RNG = defaultRNG): MoraleRecalc {
  let delta = 0;
  const rolls: { id: string; label: string; rolled: number }[] = [];
  const lines: string[] = [];
  for (const id of activeFactorIds) {
    const f = findMoraleFactor(id);
    if (!f) continue;
    const rolled = rollExpr(f.effect, rng);
    delta += rolled;
    rolls.push({ id: f.id, label: f.label, rolled });
    lines.push(`${f.label} : ${rolled >= 0 ? '+' : ''}${rolled} Moral.`);
  }
  return { delta, score: current + delta, rolls, lines };
}

/** Facteur de Moral par id (crew-morale.json) — lookup par id STABLE, AFFICHAGE du label. Lu sur le
 *  tableau LIVE (édition Codex visible en direct), jamais sur un index figé au chargement. */
export function findMoraleFactor(id: string): MoraleFactor | undefined {
  return MORALE_FACTORS.find((f) => f.id === id);
}

/** Un CHOIX de paie du Conseil de bord : le facteur de Moral + son multiplicateur de solde. */
export interface PayChoice {
  factorId: string;
  wageMul: number;
}

/**
 * CHOIX de paie offerts au Conseil de bord hebdomadaire (#229) : les facteurs de Moral de
 * crew-morale.json portant un `wageMul` (les lignes « La paie … » du tableau MDG 14 l.151-177). Le
 * tableau ne donne que l'effet de MORAL, jamais le montant de « généreuse »/« chiche » : le
 * multiplicateur est une valeur MAISON, en DONNÉE éditable (`crewMoraleFactors` au Codex), le barème
 * hebdomadaire (`weeklyCrewWageBrass`) valant la paie RÉGULIÈRE (×1). L'ORDRE d'affichage = celui de
 * la donnée. Ajouter/retirer un choix de paie = ajouter/retirer un `wageMul`, zéro ligne de code.
 */
export function payChoices(): PayChoice[] {
  return MORALE_FACTORS.filter((f) => f.wageMul != null).map((f) => ({ factorId: f.id, wageMul: f.wageMul! }));
}

/** Un id de facteur est-il un CHOIX de paie du Conseil de bord (#229) ? PUR. */
export function isPayChoice(factorId: string): boolean {
  return findMoraleFactor(factorId)?.wageMul != null;
}

/** Ce choix de paie est-il GRATUIT (barème `wageMul: 0` — l'équipage ne touche rien) ? Dérivé du
 *  registre, jamais d'un id : c'est ce qui rend le choix toujours offrable (0 ≤ toute bourse) et ce
 *  qui fait cumuler la solde due en dette. Un choix inconnu n'est pas gratuit (il n'est pas un choix). PUR. */
export function isFreePayChoice(factorId: string): boolean {
  return findMoraleFactor(factorId)?.wageMul === 0;
}

/** Le choix de paie GRATUIT offert par le registre (`wageMul: 0`) — repli d'un groupe insolvable.
 *  `null` si la donnée n'en offre aucun (le repli n'injecte alors aucun facteur). PUR. */
export function freePayChoiceId(): string | null {
  return MORALE_FACTORS.find((f) => f.wageMul === 0)?.id ?? null;
}

/** Le choix de paie RECOMMANDÉ par le registre (`recommendedPay`) — décision par défaut de la cadence
 *  auto et action principale du Conseil. `null` si la donnée n'en désigne aucun. PUR. */
export function recommendedPayChoiceId(): string | null {
  return MORALE_FACTORS.find((f) => f.recommendedPay && f.wageMul != null)?.id ?? null;
}

/** Solde EFFECTIVEMENT versée (sous de cuivre) pour un choix de paie, sur la base du barème hebdomadaire
 *  `wageBrass` (paie régulière) × multiplicateur de la donnée. `pas-de-paie` → 0. Choix inconnu → 0. PUR. #229 */
export function payChoiceCostBrass(wageBrass: number, factorId: string): number {
  return Math.round(Math.max(0, wageBrass) * (findMoraleFactor(factorId)?.wageMul ?? 0));
}

/** Un contributeur à un Test d'équipage (un rôle tenu par un Personnage). `essential` → son DR compte DOUBLE. */
export interface CrewContributor {
  /** Valeur de Compétence effective du contributeur pour ce Test. */
  value: number;
  /** Rôle ESSENTIEL (MDG 14) : « Tout DR, ou DR négatif, qu'il génère est alors doublé. » */
  essential?: boolean;
  /** Étiquette d'affichage (journal). */
  label?: string;
  /** Difficulté PROPRE à ce contributeur (sinon celle du Test) — sert au double-rôle « Manque de bras » (+2 crans). */
  difficulty?: Difficulty;
  /** +DR de Talent sur SON jet RÉUSSI (règle LDB 10 l.19, contexte Test d'équipage — Commandant émérite,
   *  MDG 09 l.54 : « Ce bonus s'applique aux Tests d'équipage »). Ajouté AVANT le doublement essentiel. */
  successDR?: number;
}

export interface CrewTestResult {
  /** Détail par contributeur (DR brut puis doublé si essentiel). */
  contributions: { label?: string; sl: number; essential: boolean; counted: number }[];
  /** Somme des DR (rôles essentiels doublés). */
  baseTotal: number;
  /** ±DR de la bande de Moral courante (MDG 14, EFFETS DU MORAL). */
  moraleDR: number;
  /** DR final = somme des contributions + DR de Moral + `extraDR` (ex. Manque de bras). */
  total: number;
  lines: string[];
}

/**
 * Résout un TEST D'ÉQUIPAGE (MDG 14) : chaque contributeur lance son Test à `difficulty` et son DR
 * s'ajoute au total (DR du rôle ESSENTIEL doublé). Le DR de la bande de Moral courante s'applique au total,
 * ainsi qu'un `extraDR` optionnel (Manque de bras, sabotage…). PUR (RNG injecté). Ce n'est PAS le Test
 * Soutenu du LDB : on additionne des DR de jets distincts, on n'ajoute pas +10 à un jet unique.
 */
export function resolveCrewTest(
  contributors: CrewContributor[],
  difficulty: Difficulty,
  moraleScore: number,
  rng: RNG = defaultRNG,
  extraDR = 0,
): CrewTestResult {
  const contributions = contributors.map((c) => {
    const t = rollTest(c.value, c.difficulty ?? difficulty, rng);
    const sl = t.sl + (t.success ? (c.successDR ?? 0) : 0); // +DR de Talent sur un jet RÉUSSI (Commandant émérite)
    const counted = c.essential ? sl * 2 : sl;
    return { label: c.label, sl, essential: !!c.essential, counted };
  });
  const baseTotal = contributions.reduce((s, c) => s + c.counted, 0);
  const moraleDR = moraleBand(moraleScore).crewTestDR;
  const total = baseTotal + moraleDR + extraDR;
  const lines = contributions.map((c) =>
    `${c.label ?? 'Rôle'} : ${c.sl >= 0 ? '+' : ''}${c.sl} DR${c.essential ? ` (essentiel ×2 → ${c.counted})` : ''}.`);
  if (moraleDR) lines.push(`Moral : ${moraleDR >= 0 ? '+' : ''}${moraleDR} DR.`);
  if (extraDR) lines.push(`Modificateur : ${extraDR >= 0 ? '+' : ''}${extraDR} DR.`);
  return { contributions, baseTotal, moraleDR, total, lines };
}

/** Pénalité de MANQUE DE BRAS d'un grand vaisseau (MDG 14 l.55). */
export interface UndercrewPenalty {
  /** Nombre de tranches de 10 % d'équipage manquantes. */
  tranches: number;
  /** −2 DR par tranche, appliqué au total du Test d'équipage. */
  dr: number;
  /** Vrai dès la 1re tranche : « ne peuvent jamais être meilleurs qu'un Succès Minime » (DR total plafonné à 0). */
  capSuccesMinime: boolean;
}

/**
 * Manque de bras GLOBAL d'un grand vaisseau (MDG 14 l.55) : « le modificateur ne s'applique que pour chaque
 * tranche de 10 % de l'équipage manquante » → −2 DR par tranche de 10 % manquant (`nominal` = équipage nominal du
 * type ; `present` = membres encore en état). Dès qu'au moins une tranche manque, le Test « ne peut jamais être
 * meilleur qu'un Succès Minime » (plafond du DR total, cf. `capToSuccesMinime`). Aucune pénalité si l'effectif est
 * complet ou si moins de 10 % manque. PUR. */
/** DR d'un Test d'équipage joué SOUS l'effectif minimal (MDG 14 l.55) : −2 DR. */
export const UNDERCREW_DR = -2;
/** Plafonne un total de DR d'équipage au Succès Minime — MDG 14 l.55, bande LDB 12 l.110 (« 0 ou 1 |
 *  Succès Minime ») : le plafond est le HAUT de la bande, 1 DR (arbitrage utilisateur [entériné 2026-08-03], #1019).
 *  SOURCE UNIQUE : aucun `total > 0 ? 0` en dur ailleurs. PUR. */
export const SUCCES_MINIME_CAP = 1;
export function capToSuccesMinime(total: number): number { return Math.min(SUCCES_MINIME_CAP, total); }

/**
 * SUCCÈS d'un Test d'équipage à partir de son total de DR (MDG 14 l.13) — SOURCE UNIQUE : aucun
 * `total >= 1` en dur ailleurs (moteur, flux de voyage, combat, modale). La règle optionnelle
 * `crew-test-zero-success` (l.13, seconde phrase) abaisse le seuil à 0. PUR.
 */
export function crewTestSuccess(total: number): boolean {
  return total >= (rule('crew-test-zero-success') ? 0 : 1);
}

export function undercrewPenalty(nominal: number, present: number): UndercrewPenalty {
  if (nominal <= 0 || present >= nominal) return { tranches: 0, dr: 0, capSuccesMinime: false };
  const tranches = Math.floor(((nominal - present) * 10) / nominal); // tranches de 10 % manquantes (arith. entière, <10 % → 0)
  return tranches >= 1 ? { tranches, dr: -2 * tranches, capSuccesMinime: true } : { tranches: 0, dr: 0, capSuccesMinime: false };
}

/** Un poste d'équipage SALARIÉ embauché (barème `crew-roles.json`) — `count` PNJ payés à ce rôle. #216 */
export interface CrewHire {
  roleId: string;
  count: number;
}

/** Solde HEBDOMADAIRE due par un roster salarié (Σ count × coût hebdomadaire du rôle), en sous de
 *  cuivre (MDG 14 l.293-302). Un rôle sans barème (`wage` absent) ne coûte rien. PUR. #216 */
export function weeklyCrewWageBrass(crew: CrewHire[] | undefined): number {
  return (crew ?? []).reduce((s, h) => {
    const w = findCrewRoleById(h.roleId)?.wage?.weekly;
    return s + (w ? toBrass(priceToMoney(w)) * Math.max(0, h.count) : 0);
  }, 0);
}

/** État de Moral PERSISTANT d'un navire (porté par l'instance de navire en campagne ; recalc hebdomadaire). */
export interface ShipMoraleState {
  score: number;
  /** Dernière semaine (jour ÷ 7) où le Moral a été recalculé — garde anti-double-comptage (cf. lastUpkeepDay). */
  lastMoraleWeek: number;
  /** Facteurs de Moral ACTIFS cette semaine (ids), édités par le MJ / l'éditeur. */
  factors: string[];
}

/**
 * RECALCUL HEBDOMADAIRE gardé (MDG 14) : recalcule le Moral une seule fois par semaine calendaire
 * (jour ÷ 7), sur le modèle de `lastUpkeepDay`. PUR — prêt à être appelé par l'entretien quotidien quand
 * un navire vit dans l'état de campagne. Renvoie un nouvel état (jamais muté en place).
 */
export function tickShipMorale(state: ShipMoraleState, currentDay: number, rng: RNG = defaultRNG): { state: ShipMoraleState; recalced: boolean; lines: string[] } {
  const week = Math.floor(currentDay / 7);
  if (week <= state.lastMoraleWeek) return { state, recalced: false, lines: [] };
  const r = recalcMorale(state.score, state.factors, rng);
  return { state: { ...state, score: r.score, lastMoraleWeek: week }, recalced: true, lines: r.lines };
}

/** Delta de MORAL d'un Test d'équipage de RUDE ÉPREUVE (MDG 14 l.110 : « Si le total de ce Test donne
 *  un ou plusieurs DR négatifs, réduisez le Moral d'un nombre égal au nombre de ces DR ») — un total
 *  négatif RETIRE autant de Moral ; un total ≥ 0 n'en rend PAS. PUR. */
export function rudeEpreuveMoraleDelta(total: number): number {
  return total < 0 ? total : 0;
}

/** Assignation d'un membre d'équipage à un rôle, pour un Test d'équipage piloté par les rôles (MDG 14). */
export interface CrewAssignment {
  /** Le Combattant d'équipage qui tient le rôle. */
  crew: Combatant;
  /** id du rôle tenu (crew-roles.json). */
  roleId: string;
  /** Le membre cumule DEUX rôles (Manque de bras, MDG 14 l.53) : CE jet subit +2 crans de difficulté. */
  doubleRole?: boolean;
}

/** COMPOSANTES du modificateur « Test d'équipage » porté par les effets ACTIFS du marin (op
 *  `crewTestMod` — chanson « Naviguons tous ensemble », MDG 09 l.224 : « un modificateur de +10 sur
 *  les Tests individuels de chaque membre d'équipage impliqué dans un Test d'équipage »). Chaque part
 *  tire son NOM de l'effet émetteur (`ActiveEffect.label`) et sa fiche de `effectRef` : la rangée
 *  d'équipage nomme la chanson, elle n'affiche pas un +10 anonyme. PUR. */
export function crewTestModParts(c: Combatant): ModLine[] {
  return (c.activeEffects ?? [])
    .filter((e) => !!e.crewTestMod)
    .map((e) => ({ label: e.label, value: e.crewTestMod!, famille: 'jet' as const, ref: effectRef(e) }));
}

/** Σ de `crewTestModParts` — SOURCE UNIQUE du montant (le jet et l'affichage lisent les MÊMES parts). */
export function crewTestModOf(c: Combatant): number {
  return crewTestModParts(c).reduce((s, m) => s + m.value, 0);
}

/** Valeur de Compétence d'un membre pour un rôle : la MEILLEURE de ses compétences (Mousse = Voile/Ramer),
 *  PLUS le modificateur « Test d'équipage » de ses effets actifs (`crewTestModOf` — chansons de marin).
 *  SEUL point de valeur des Tests d'équipage (manœuvre, bordée, générique, fiche du navire). `sense`
 *  (optionnel) : sens NARRATIVEMENT sollicité par CE Test précis (ex. Vigie qui « voit la lumière d'un
 *  phare », MDG 13 l.337 — visuel, transmis par l'appelant) ; restreint les `skillMod` sense-scopés
 *  (Surdité, LDB 18) via `testValue`. Absent = comportement historique. PUR. */
export function crewRoleValue(crew: Combatant, role: CrewRoleData, sense?: PairedSense): { value: number; used?: RefDesignee } {
  const b = bestForSkills([crew], role.skills ?? [], undefined, sense);
  return { value: (b?.value ?? 0) + crewTestModOf(crew), used: b?.skillId ? { id: b.skillId, spec: b.spec } : undefined };
}

/** +DR de TALENT d'un membre sur SON jet de rôle RÉUSSI, en contexte TEST D'ÉQUIPAGE — règle UNIVERSELLE
 *  `talentTestSLBonus` (LDB 10 l.19) évaluée avec le contexte `crewTest` VRAI : Commandant émérite
 *  (MDG 09 l.50-54, `when {crewTest}`) s'applique « aux Tests d'équipage comme aux Tests de Commandement
 *  individuels » — ici la moitié Tests d'équipage. Compétence = celle que le rôle utilise (`crewRoleValue.used`).
 *  S'y AJOUTE le +DR d'effet/trait/objet par Compétence (`skillDRBonus` — Boussole : +1 DR Orientation,
 *  MDG 14 l.275 ; MÊME règle d'application « sur un jet réussi » que dans le combat, combat.ts). PUR. */
export function crewTalentDR(crew: Combatant, role: CrewRoleData): number {
  const used = crewRoleValue(crew, role).used;
  if (!used) return 0;
  return talentTestSLBonus(crew, { skill: used.id, spec: used.spec }, (cond) => cond.kind === 'crewTest')
    + skillDRBonus(crew, used.id, used.spec);
}

/**
 * Test d'équipage PILOTÉ PAR LES RÔLES (MDG 14) — système PROPRE à la Mer des Griffes (vérifié ABSENT du
 * Compagnon de Mort sur le Reik, qui s'en tient au Personnage à la barre + Soutien LDB, déjà au moteur via
 * `partyAssisted`, et d'Aux Armes qui n'apporte que l'Atout « Arme d'équipe »). Pour chaque membre assigné à
 * un rôle, on lit sa VRAIE valeur de Compétence (la meilleure du rôle) ; le rôle désigné ESSENTIEL par le type
 * de Test voit son DR doublé ; on additionne via `resolveCrewTest`. Manque de bras : double rôle → +2 crans
 * sur SON jet (l.53) ; sous-effectif (`understaffed`) → −2 DR et jamais mieux qu'un Succès Minime (DR total
 * plafonné à 0, l.55). `extraDR` : modificateur PLAT au total — SABOTAGE (MDG 14 l.45-47 : le saboteur
 * « n'effectue pas ce Test… le MJ pourra imposer de -1 à -5 DR sur le Test d'équipage ») et tout « bonus ou
 * pénalité … en masse » (l.13). PUR (RNG injecté). NB : le bonus de chant du Chansonnier (l.32) n'est PAS
 * chiffré par le RAW (« des bonus ») — l'effet mécanisé vient des CHANSONS DE MARIN (MDG 09, `crewTestMod`).
 */
export function resolveCrewTestByRoles(
  assignments: CrewAssignment[],
  testTypeId: string,
  difficulty: Difficulty,
  moraleScore: number,
  rng: RNG = defaultRNG,
  opts: { understaffed?: boolean; extraDR?: number } = {},
): CrewTestResult {
  const essentialRole = findCrewTestTypeById(testTypeId)?.essential;
  const contributors: CrewContributor[] = assignments.map((a) => {
    const role = findCrewRoleById(a.roleId);
    return {
      value: role ? crewRoleValue(a.crew, role).value : 0,
      essential: a.roleId === essentialRole,
      label: role?.label ?? a.roleId,
      difficulty: a.doubleRole ? easeDifficulty(difficulty, -2) : undefined,
      successDR: role ? crewTalentDR(a.crew, role) : 0, // Commandant émérite (MDG 09 l.54)
    };
  });
  const res = resolveCrewTest(contributors, difficulty, moraleScore, rng, (opts.understaffed ? UNDERCREW_DR : 0) + (opts.extraDR ?? 0));
  const capped = capToSuccesMinime(res.total);
  if (opts.understaffed && res.total > capped) {
    // MDG 14 l.55 · LDB 12 l.110
    return { ...res, total: capped, lines: [...res.lines, `Manque de bras : jamais mieux qu’un Succès Minime (DR total plafonné à ${capped}).`] };
  }
  return res;
}
