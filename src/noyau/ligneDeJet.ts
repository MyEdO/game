/**
 * LA LIGNE D'UN JET (#1153) : le monteur canonique `rollLine` — qui teste quoi, à quelle Difficulté, la valeur
 * décomposée en base NUE et composantes NOMMÉES, la cible écrêtée — avec ses types et ses aides. Module FEUILLE : il ne
 * lit que le moteur, sans aucun flux ; `rollSeam` (les étapes et les cascades) et les flux le composent.
 */
import type { Combatant, Difficulty, Weapon } from '../engine/types';
import { DIFFICULTY_MODIFIERS } from '../engine/types';
import type { PairedSense } from '../engine/ops';
import type { ModLine } from '../engine/combat';
import { combatBaseValue, combatValueModParts, conditionModLines, combatCharKey, combineMods, composeDifficulty } from '../engine/combat';
import { volatileCharLines } from '../engine/characteristics';
import { precipitationTestMods, type SeaPrecipitationId } from '../engine/seaWeather';
import { testValue, testValueSplit, testValueParts, skillBaseValue, supportSplit, type SupportDetail } from '../engine/skills';
import type { SujetDuJet } from '../data/schemas/grammaire/mecanique';
import type { PlayerText } from '../i18n/playerText';
import { testStatePenaltyParts, testStatePenalty } from '../engine/conditions';
import { clampTarget, cibleDuTest } from '../engine/tests';

/** Ce qui est VRAI de tout jet : qui teste quoi, à quelle Difficulté, et ce qui pèse SUR LA CIBLE. */
interface RollLineBase {
  /** Le jeteur. Absent (côté MONDE : seuil d100 posé par l'appelant) ⇒ `valeur` tient lieu de base. */
  actor?: Combatant;
  /** Ids du Test — MÊME forme que `RollRequest['test']` (aucun texte : la ligne se NOMME depuis le catalogue). */
  test?: SujetDuJet & { sense?: PairedSense };
  difficulty: Difficulty;
  /** Modificateurs NOMMÉS qui s'ajoutent À LA CIBLE et que la valeur ne contient PAS (dérive MSRC 7
   *  l.38, hors de contrôle l.41, −5 cumulatif du redressement l.40, km déjà au pas de course EDOC 7
   *  l.229). Les déclarer ici les compte UNE fois — dans la cible et sur la ligne. */
  surLaCible?: ModLine[];
  /** PLAFONNEMENT des `surLaCible` (`LDB 14 l.91-96`) : le monteur combine lui-même les
   *  modificateurs (`combineMods`, plafonds data-driven `combat-plafond-bonus-difficulte`/`-malus`, appliqués
   *  aux seules `famille: 'circonstance'`) et, quand la combinaison diffère de la somme brute, ÉMET
   *  l'écart en ligne NOMMÉE « plafond Difficultés » liée à sa fiche de règle. Sans ce mode, un
   *  appelant qui plafonnait sa cible à la main laissait l'amputation en chip « autres ». Réservé aux
   *  jets de COMBAT : valeur MAISON (`LDB 12` silencieux sur le cumul ; `l.137`
   *  est permissif hors combat ; la combinaison vit au chapitre Combat, `LDB 14 l.48` et `l.95`). */
  plafond?: 'difficultes';
  /** Le Test est celui d'un Personnage SUR LE PONT d'un navire, sous ces Précipitations (MDG 13 l.185) :
   *  le monteur en tire la ligne « Météo : … », keyée par la Compétence du Test (`test.skill`/`test.spec`),
   *  SEUL lecteur des Précipitations hors du moteur de combat. Absent ou `undefined` : rien sur le pont. */
  pont?: SeaPrecipitationId;
  /** LIGNE NON TENTABLE (`peutTenter` faux, LDB 09 l.30 ; #2588 Q1) : le refus NOMMÉ du porteur. Le
   *  monteur (`rollStep`) rend alors la ligne RÉSOLUE — `ECHEC_SANS_JET`, aucun dé — avec ce refus. */
  refus?: PlayerText;
}

/**
 * CANAL de valeur d'un jet de COMBAT (#1153 L1a) — le combat ne se calcule pas avec `testValue` :
 *  - `'melee'`/`'distance'` : valeur d'ATTAQUE/de tir — base `combatBaseValue` (`engine/combat.ts`,
 *    Caractéristique + Spé du Groupe de l'arme) et composantes `combatValueModParts` ;
 *  - `'test'` : Test de combat NON-attaque (gate d'Action, Résistance de fin de rencontre) — base
 *    `rawCombatTestBase` (`engine/skills.ts` : `testValue` privée de la pénalité d'États HORS combat)
 *    et pénalité d'États en version COMBAT (`conditionModLines` → `combatTestPenaltyParts`), comptée
 *    une seule fois. Le contrat des deux grandeurs est celui du moteur, pas de ce monteur.
 *
 * BRANCHÉ à `volatileCharLines` (`engine/characteristics.ts:68`) sur `'melee'`/`'distance'` (#1153 L3a) :
 * ces lignes décomposent l'intérieur de la CARACTÉRISTIQUE (`effectiveChar`), donc de la valeur NUE.
 * Le canal les SORT de la base autant qu'il les pose en lignes — la valeur de combat et la cible
 * restent identiques au point près, seule la répartition base/chips change.
 */
export type RollLineCombat = { kind: 'melee' | 'distance'; weapon?: Weapon } | { kind: 'test'; weapon?: never };

/** LA valeur du jet — trois régimes EXCLUSIFS, et le compilateur tient l'exclusion :
 *  - DÉRIVÉE de l'acteur (`testValue`) : rien d'autre à déclarer ;
 *  - DÉRIVÉE du COMBAT (`combat`) : la valeur suit le canal, l'appelant peut la fournir FONDUE
 *    (`valeur`, ex. Soutien des servants d'une pièce) — l'oracle du canal vérifie qu'elle s'y réduit ;
 *  - FOURNIE par l'appelant (`valeur`) : alors, et alors seulement, il peut dire ce qu'il a fondu
 *    dedans (`soutien`, `dansLaValeur`) ou DÉCLARER une valeur d'une AUTRE formule (`valeurEtrangere`).
 *  Un `soutien` sans `valeur` est INEXPRIMABLE : le Soutien n'existe que fondu dans une valeur. */
type RollLineValeur =
  | {
    /** Valeur FONDUE dont la cible dérive : valeur SOUTENUE de `partyAssisted`, valeur d'un porteur MONDE. */
    valeur: number;
    /** Détail du Soutien (LDB 12) DÉJÀ fondu dans `valeur` — il ressort en ligne NOMMÉE. */
    soutien?: SupportDetail;
    /** Parts que l'appelant a lui-même fondues dans `valeur` et qu'il NOMME (−10 du réparateur de
     *  substitution `MSRC 5 l.113-117`) : elles SORTENT de la base pour prendre leur place de ligne.
     *  Les déclarer sans les avoir fondues fausse la base — la garde d'exactitude le refuse. */
    dansLaValeur?: ModLine[];
    /** La valeur vient d'une AUTRE formule que `testValue` (soigneur PNJ sans fiche, seuil de table) :
     *  la décomposition est alors IMPOSSIBLE et le drapeau la DÉCLARE — la base rendue n'est PAS un
     *  Niveau de Compétence. Sans lui, une reconstruction ratée est un BUG. Une valeur de COMBAT ne
     *  relève PLUS de ce drapeau : elle a son canal (`combat`). */
    valeurEtrangere?: true;
    combat?: never;
  }
  | {
    /** Canal COMBAT : la base et les composantes viennent des jumelles de `engine/combat.ts`. */
    combat: RollLineCombat;
    /** Valeur de combat DÉJÀ fondue par l'appelant (Soutien des servants) — omise, elle est dérivée. */
    valeur?: number;
    soutien?: SupportDetail;
    dansLaValeur?: ModLine[];
    valeurEtrangere?: never;
  }
  | { valeur?: never; soutien?: never; dansLaValeur?: never; valeurEtrangere?: never; combat?: never };

/** DÉCLARATION d'une ligne de jet — le CONTRAT d'entrée du monteur canonique `rollLine`. Aucun calcul
 *  chez l'appelant : il DIT l'acteur, le Test, la Difficulté, sa valeur et ses poches. */
export type RollLineSpec = RollLineBase & RollLineValeur;

/** MÊME déclaration, Difficulté EXCEPTÉE — pour les résolveurs qui savent QUI teste QUOI mais pas
 *  encore à quelle Difficulté (le meilleur réparateur de bateau, le meneur d'une enquête) : la
 *  Difficulté vient du SITE qui ouvre le jet. Se complète par `withDifficulty`. */
export type RollLineDecl = Omit<RollLineBase, 'difficulty'> & RollLineValeur;

/** Complète une déclaration par sa Difficulté. Générique : la branche EXACTE de l'union (valeur
 *  fournie / valeur dérivée) est CONSERVÉE, donc l'exclusivité `soutien` ⇒ `valeur` reste vérifiée
 *  par le compilateur après composition. */
export function withDifficulty<T extends RollLineDecl>(decl: T, difficulty: Difficulty): T & { difficulty: Difficulty } {
  return { ...decl, difficulty };
}

/** Ce qu'une étape-jet doit porter pour être lisible : base NUE, lignes NOMMÉES, cible, écrêtage —
 *  et, en mode plafonné, le PALIER de Difficulté que la combinaison des circonstances compose. */
export interface RollLineParts {
  base: number;
  mods: ModLine[];
  target: number;
  clamped?: number;
  /** Difficulté à AFFICHER : le palier COMPOSÉ quand les circonstances tombent sur un cran de
   *  l'échelle (`LDB 14 l.91-96`), la Difficulté déclarée sinon. */
  difficulty: Difficulty;
  /** Modificateur RÉEL des circonstances quand il ne tombe sur AUCUN cran de l'échelle (`LDB 14` n'en
   *  nomme pas) : l'AFFICHAGE en compose « Combinée (+30) ». Présent ⇒ `difficulty` est la DÉCLARÉE
   *  et ne doit JAMAIS s'afficher seule. DÉRIVÉ : absent de `RollLineSpec`, aucun site ne peut le poser. */
  difficultyCombined?: number;
  /** Composition du palier (les lignes `famille:'circonstance'` + l'écart du plafond) : elles ne sont
   *  PLUS dans `mods` — le palier les porte, son popover les détaille. Absente = Difficulté déclarée,
   *  tous les modificateurs restent en chips. */
  difficultyParts?: ModLine[];
}

/** Composantes de `testValue` HORS pénalité d'États : `testValueParts` les NOMME EN TÊTE (il ouvre sur
 *  `testStatePenaltyParts`, `engine/skills.ts`) — un Test de COMBAT leur substitue `conditionModLines`.
 *  Le découpage positionnel est VÉRIFIÉ par l'oracle du canal (`rawCombatTestBase`), jamais supposé. */
function partsHorsEtats(actor: Combatant, t: RollLineBase['test'] = {}): ModLine[] {
  const etats = testStatePenaltyParts(actor, t.skill?.id, { sense: t.sense }).filter((p) => p.value !== 0).length;
  return testValueParts(actor, t, t.sense).slice(etats);
}

/** DÉFAIT une valeur de COMBAT en base NUE + composantes NOMMÉES — jumeau de `testValueSplit` pour le
 *  canal `combat` : même contrat (`base + Σ mods === valeur`, `exact` DIT si la reconstruction a tenu),
 *  autres jumelles moteur. L'ORACLE est la valeur que le canal SAIT produire (`combatBaseValue + Σ
 *  combatValueModParts`, ou `rawCombatTestBase`) : une `valeur` fournie qui ne s'y réduit pas — au
 *  Soutien et au `fused` déclarés près — est refusée, exactement comme hors combat.
 *  Les lignes volatiles de la CARACTÉRISTIQUE (`volatileCharLines` : Bénédiction de Bataille,
 *  séquelle « Fracture −30 ») vivent DANS `combatBaseValue` via `effectiveChar` : le canal les
 *  RETIRE de la base à mesure qu'il les pose en lignes, jamais l'un sans l'autre. */
function combatValueSplit(
  actor: Combatant | undefined, canal: RollLineCombat, t: RollLineBase['test'],
  value: number, support?: SupportDetail, fused = 0,
): { base: number; mods: ModLine[]; exact: boolean } {
  const sup = supportSplit(value, support);
  if (!actor) return { ...sup, exact: true };
  const charLines = canal.kind === 'test' ? [] : volatileCharLines(actor, combatCharKey(canal.kind, canal.weapon));
  const nue = canal.kind === 'test'
    ? skillBaseValue(actor, t ?? {})
    : combatBaseValue(actor, canal.kind, canal.weapon) - charLines.reduce((s, l) => s + l.value, 0);
  const parts = canal.kind === 'test'
    ? [...partsHorsEtats(actor, t), ...conditionModLines(actor, { skill: t?.skill?.id, sense: t?.sense })]
    : [...charLines, ...combatValueModParts(actor, canal.kind, canal.weapon)];
  const sum = parts.reduce((s, p) => s + p.value, 0);
  if (nue + sum + fused !== sup.base) return { ...sup, exact: false };
  return { base: sup.base - sum, mods: [...sup.mods, ...parts], exact: true };
}

/** Valeur DÉRIVÉE d'un canal de combat quand l'appelant n'en fournit aucune. */
function combatChannelValue(actor: Combatant | undefined, canal: RollLineCombat, t: RollLineBase['test']): number {
  if (!actor) return 0;
  // `sense` transite des DEUX côtés (ici comme dans `partsHorsEtats`) : `rawCombatTestBase` ne le
  // prend pas, donc la valeur dérivée est composée à la main sur la MÊME formule (`testValue` privée
  // de la pénalité d'États hors combat). Sans cela, un Test de combat sense-scopé (Surdité, LDB 18)
  // verrait sa valeur et ses composantes diverger, et l'oracle THROW sur un site pourtant correct.
  return canal.kind === 'test'
    ? testValue(actor, t ?? {}, t?.sense) - testStatePenalty(actor, t?.skill?.id, { sense: t?.sense })
      + conditionModLines(actor, { skill: t?.skill?.id, sense: t?.sense }).reduce((s, m) => s + m.value, 0)
    : combatBaseValue(actor, canal.kind, canal.weapon) + combatValueModParts(actor, canal.kind, canal.weapon).reduce((s, m) => s + m.value, 0);
}

/**
 * SÉPARABILITÉ des familles sous plafond — invariant du monteur, pas une lecture du RAW.
 *
 * `LDB 14 l.95` dit la combinaison (« faire la somme des différents modificateurs sans dépasser Très
 * Difficile -30 ») sans distinguer d'où vient chaque modificateur. La partition en DEUX familles
 * (SITUATIONNEL du Test, plafonné / ressource ou état PROPRE du jeteur, hors plafond) est un
 * ARBITRAGE du projet, consigné #1218 — c'est `combineMods` qui l'applique, et c'est LUI que cette
 * garde surveille.
 *
 * Ce que l'arbitrage autorise : couper la ligne en deux (la Difficulté porte la combinaison des
 * circonstances, les chips portent le reste). Le jour où la combinaison mordrait aussi sur l'autre
 * famille, la Difficulté annoncée mentirait exactement de la part remboursée — et le TOTAL resterait
 * juste, donc le mensonge serait muet. Le fait se crie (THROW en DEV, journal en PROD — patron de la
 * garde d'exactitude ci-dessous).
 *
 * Exportée pour être jugée SEULE : le mock de MODULE est interdit ici (`isolate: false`, garde
 * `src/vi-mock-isolate-guard.test.ts`), la régression ne peut donc se simuler qu'en appelant
 * l'invariant avec une combinaison qui ment. `SEPARABILITE.vus` compte les passages RÉELS — c'est ce
 * compteur, et non la présence d'un appel dans le source, qui prouve le câblage.
 */
export const SEPARABILITE = { vus: 0 };

export function assertSeparabilite(surLaCible: ModLine[], combine: number, circCombined: number): void {
  SEPARABILITE.vus += 1;
  const horsTable = surLaCible.filter((m) => m.famille !== 'circonstance').reduce((s, m) => s + m.value, 0);
  if (combine === circCombined + horsTable) return;
  const msg = `[seam] rollLine : la combinaison plafonnée (${combine}) n'est pas séparable — circonstances ${circCombined} `
    + `+ hors table ${horsTable} ≠ ${combine} (arbitrage de familles #1218). La Difficulté composée serait FAUSSE.`;
  console.error(msg);
  if (import.meta.env?.DEV) throw new Error(msg);
}

/**
 * MONTEUR CANONIQUE d'une ligne de jet (#1153) — le SEUL endroit du jeu où `base`/`mods`/`target`
 * d'une étape se calculent. La porte du seam (`buildMonoStep`) comme les monteurs LOCAUX des flux
 * (voyage fluvial/maritime/terrestre, activités hors combat) le consomment : un
 * call-site DÉCLARE, il ne calcule plus — une erreur de cette famille se corrige ICI, une fois.
 *
 * INVARIANTS :
 *  - `base` = Niveau de Compétence NU (`skillBaseValue`, `LDB 09 l.17`), la grandeur qui s'affiche et
 *    qui DÉPARTAGE à DR égal (`LDB 12 l.160`) — SAUF côté MONDE (aucun acteur : la base EST le seuil
 *    posé par l'appelant), SAUF canal `combat` (base = valeur de combat NUE, `combatBaseValue`) et
 *    SAUF `valeurEtrangere` (formule hors `testValue`, assumée au call-site) ;
 *  - `base + Σ mods + Difficulté + écrêtage === target` : tout l'écart est NOMMÉ (Soutien, États,
 *    Encombrement, séquelles, passifs, outil manquant — `testValueSplit`/`combatValueSplit`), aucune
 *    chip « autres » ;
 *  - la CIBLE dérive de la valeur FONDUE, écrêtée par la MÊME primitive que `rollTest` (`clampTarget`).
 *
 * GARDE D'EXACTITUDE : l'invariant arithmétique seul est TAUTOLOGIQUE (la base est une soustraction,
 * elle absorbe l'erreur). Une reconstruction ratée non déclarée — modificateur annoncé mais jamais
 * fondu, ou fondu ET redéclaré en double — THROW en DEV et se journalise en PROD (patron
 * `rollSansPilote`) : le mensonge se voit au premier passage au lieu de se lire comme une base juste.
 * Une Difficulté inconnue est refusée de même : sans elle la cible serait `NaN`, en silence.
 */
export function rollLine(spec: RollLineSpec): RollLineParts {
  const t = spec.test ?? {};
  const dansLaValeur = spec.dansLaValeur ?? [];
  const fusedSum = dansLaValeur.reduce((s, m) => s + m.value, 0);
  if (typeof DIFFICULTY_MODIFIERS[spec.difficulty] !== 'number') throw new Error(`rollLine : Difficulté inconnue « ${String(spec.difficulty)} » — la cible serait NaN.`);
  // Un ACTEUR jette forcément QUELQUE CHOSE : sans valeur posée (`valeur`), sans canal de combat et
  // sans ids, `testValue` rendrait 0 et la ligne annoncerait une cible qui n'est la valeur de
  // personne — auto-échec MUET (#1657 B3-3). Le producteur nomme son Test, ou pose sa valeur.
  if (spec.actor && spec.valeur === undefined && !spec.combat && !t.skill && !t.characteristic) {
    throw new Error(`rollLine : Test de « ${spec.actor.label} » sans compétence ni caractéristique et sans valeur posée `
      + '— la porte le jouerait sur 0 (auto-échec muet). Nommer `test.skill`/`test.characteristic`, ou passer `valeur`.');
  }
  const value = spec.valeur ?? (spec.combat
    ? combatChannelValue(spec.actor, spec.combat, t)
    : (spec.actor ? testValue(spec.actor, t, t.sense) : 0));
  const split = spec.combat
    ? combatValueSplit(spec.actor, spec.combat, t, value, spec.soutien, fusedSum)
    : testValueSplit(spec.actor, value, {
      support: spec.soutien, sujet: t, sense: t.sense, fused: fusedSum,
    });
  if (!split.exact && !spec.valeurEtrangere) {
    const formule = spec.combat ? (spec.combat.kind === 'test' ? 'la valeur de Test de combat brute' : 'la valeur de combat NUE') : 'le Niveau de Compétence';
    const msg = `[seam] rollLine : la valeur (${value}) ne se reconstruit pas depuis ${formule} `
      + `(${t.skill?.id ?? t.characteristic ?? spec.combat?.kind ?? '?'} ${spec.actor ? `de « ${spec.actor.label} »` : 'sans acteur'}) + ses composantes + ${fusedSum} déclaré(s) `
      + '— une poche est mal remplie (modificateur non fondu, ou fondu ET redéclaré). La base affichée serait FAUSSE.';
    console.error(msg);
    if (import.meta.env?.DEV) throw new Error(msg);
  }
  // Canal COMBAT : la valeur dérive du moteur, qui lit déjà `Combatant.envPrecipitation` (`engine/combat.ts`).
  if (spec.combat && spec.pont) throw new Error('rollLine : `pont` sur un canal de combat — le moteur de combat lit `Combatant.envPrecipitation`, la ligne serait comptée deux fois.');
  const surLaCible = [...(spec.surLaCible ?? []), ...precipitationTestMods(spec.pont, t.skill)];
  const brut = surLaCible.reduce((s, m) => s + m.value, 0);
  // Mode plafonné (`LDB 14 l.91-96`) : la combinaison est celle du moteur, et la Difficulté AFFICHÉE
  // est celle que les circonstances composent — MÊME primitive que le post-jet (`bd`, `engine/combat.ts`).
  const plafonne = spec.plafond === 'difficultes';
  const combine = plafonne ? combineMods(surLaCible) : brut;
  const compo = plafonne ? composeDifficulty(spec.difficulty, surLaCible) : undefined;
  if (compo) assertSeparabilite(surLaCible, combine, compo.circCombined);
  const { target, clamped } = clampTarget(cibleDuTest(value, spec.difficulty, combine));
  return {
    base: split.base - fusedSum,
    mods: [...split.mods, ...dansLaValeur, ...(compo ? compo.mods : surLaCible)],
    target,
    ...(clamped ? { clamped } : {}),
    difficulty: compo?.difficulty ?? spec.difficulty,
    ...(compo?.difficultyCombined != null ? { difficultyCombined: compo.difficultyCombined } : {}),
    ...(compo?.difficultyParts ? { difficultyParts: compo.difficultyParts } : {}),
  };
}
