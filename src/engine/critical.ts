/**
 * Résolution des Blessures critiques — LECTEUR UNIQUE des DEUX systèmes (#1657 B2a, #1682) :
 * le Livre de base (« Traumatisme », LDB 18) et l'approche ALTERNATIVE d'Aux Armes (AA 07,
 * l.13-186), activée par la règle facultative `combat-aa-blessures = 'aa'`.
 *
 * Le SOCLE résout la séquence, la même pour les deux jeux : lookup `findTableEntry` → jet de la
 * rangée → `onRepeat` → `traumas` → `amputation` → `stampCriticalEscalation` → `fireCritTriggers`.
 * Les FEUILLES n'adressent que ce qui diffère, déclaré une fois dans `REGIMES` : le modificateur de
 * SÉVÉRITÉ du d100 (LDB 18 l.17 : −20 quand l'overkill dépasse le Bonus d'Endurance, minimum 01 /
 * AA 07 l.36 : +10 par Blessure au-delà de 0) et le libellé de journal.
 */
import { d100, d10, RNG, defaultRNG } from './dice';
import { findTableEntry } from './tables';
import { bonus, effectiveChar } from './characteristics';
import { hitLocationByShape, locationLabel } from './combat';
import { BodyShape, Combatant, HitLocation, Trauma } from './types';
import {
  CRITIQUE_DOCS, critTableKeyFor, critiqueDoc, critiqueTable,
  type CritEntry, type CritTableKey, type JeuDeCritique,
} from '../data/criticals';
import { traumaById, traumaFicheById, stampCriticalEscalation, fireCritTriggers } from './trauma';
import { rule } from './policy';
import { EMPTY_FLOW, poserEnjeu, type Flow, type FlowTestNode } from './flowCore';
import { combatStakeRef, type StakeRef } from '../data';
import { type GameOp } from './ops';

export type { CritTableKey, JeuDeCritique };

/**
 * ENJEU (#1117) du Test d'une rangée de Critique — patron `miscast.mkTest` : le producteur nomme la
 * LIGNE qui exige le jet, et sa catégorie Codex se choisit au tirage parmi les 8 tables (porte (b)
 * `entryCategory`, `src/data/index.ts`). PUR.
 */
function enjeuDeRangee(jeu: JeuDeCritique, location: HitLocation, entryId: string): StakeRef {
  return combatStakeRef('critRowTest', { entryId, entryCategory: critEntryCodexCategory(critTableKeyFor(location), jeu) });
}

/**
 * Le nœud `test` d'une rangée, ENJEU POSÉ, prêt à partir par la porte — jumelle de `miscast.mkTest` :
 * une fabrique PURE, séparée du résolveur, qui ne tire AUCUN dé. Les branches `fail`/`success` sont
 * déjà en donnée ; il n'y a rien à composer, seulement l'enjeu à nommer.
 */
function noeudDeRangee(entry: CritEntry, jeu: JeuDeCritique, location: HitLocation): FlowTestNode | undefined {
  if (!entry.test) return undefined;
  const noeud: FlowTestNode = { ...entry.test, test: poserEnjeu(entry.test.test, enjeuDeRangee(jeu, location, entry.id)) };
  return noeud;
}

/** Feuille `do` d'une liste d'ops — la forme Flow d'un effet, écrite une fois pour ce module. */
const feuille = (ops: GameOp[]): Flow => ({ kind: 'do', effect: { type: 'ops', ops } });

/**
 * Le(s) Test(s) d'une Amputation (LDB 18 l.237), ENJEU POSÉ, prêts à partir par la porte — fabrique
 * PURE jumelle de `noeudDeRangee` : aucun dé n'est tiré ici, la porte les roule (avec les États du
 * porteur, sa Chance et sa Résilience). Les branches sont COMPOSÉES du vocabulaire existant
 * (`condition`, Condition `slThreshold`, op `amputer`) — rien n'est spécial à l'amputation.
 *
 * Trois formes, toutes PARAMÉTRIQUES (la DONNÉE décide, le code ne branche sur aucun cas nommé) :
 *  - `loss.difficulty` (l.171) — Test ENGLOBANT dont la réussite annule tout ; son échec joue le reste ;
 *  - `loss` sans gate (l.180) — le Test l.237 détermine LUI-MÊME la perte : `amputer` dans sa `fail` ;
 *  - sans `loss` (l.124, l.237) — la ligne fait perdre le membre quoi qu'il arrive : `amputer` suit le
 *    Test en séquence, et le Test ne décide que des États.
 * `loss.perDR` (l.180) devient `unitesPerSL {every:1, amount:1, onFailure:true}` : `ctx.sl` de la
 * branche `fail` porte le DR, `slBonus` en tire « un orteil par DR en dessous de 0 ».
 *
 * Le LIBELLÉ sépare les deux Tests d'une même ligne (`entry.label` pour le gate, la plaie pour l.237) :
 * `triggeredTestStepId` keye par (porteur, libellé, Compétence) — deux « Résistance » homonymes
 * rendraient la seconde étape injoignable.
 */
export function noeudAmputation(entry: CritEntry, jeu: JeuDeCritique, location: HitLocation): Flow | undefined {
  const amp = entry.amputation;
  if (!amp) return undefined;
  const enjeu = enjeuDeRangee(jeu, location, entry.id);
  const perteGateeParCeTest = !!amp.loss && !amp.loss.difficulty;
  const amputer = feuille([{
    op: 'amputer', sequels: amp.sequels, loc: location,
    ...(amp.unites != null ? { unites: amp.unites } : {}),
    ...(amp.loss?.perDR ? { unitesPerSL: { every: 1, amount: 1, onFailure: true } } : {}),
  }]);
  const etats: Flow[] = [
    feuille([{ op: 'condition', id: 'a-terre', value: 1 }]),
    { kind: 'if', cond: { kind: 'slThreshold', op: '<=', value: -2 }, then: feuille([{ op: 'condition', id: 'sonne', value: 1 }]) },
    { kind: 'if', cond: { kind: 'slThreshold', op: '<=', value: -4 }, then: feuille([{ op: 'condition', id: 'inconscient', value: 1 }]) },
  ];
  const noeud: FlowTestNode = {
    kind: 'test',
    test: poserEnjeu({ skill: { id: 'resistance' }, difficulty: amp.difficulty, label: traumaFicheById('amputation-plaie').label }, enjeu),
    success: EMPTY_FLOW,
    fail: { kind: 'seq', steps: perteGateeParCeTest ? [...etats, amputer] : etats },
  };
  if (perteGateeParCeTest) return noeud;
  const avecPerte: Flow = { kind: 'seq', steps: [noeud, amputer] };
  if (!amp.loss?.difficulty) return avecPerte;
  return {
    kind: 'test',
    test: poserEnjeu({ skill: { id: 'resistance' }, difficulty: amp.loss.difficulty, label: entry.label }, enjeu),
    success: EMPTY_FLOW,
    fail: avecPerte,
  };
}

/**
 * Amputations DIFFÉRÉES à la fin de la rencontre (LDB 18 l.171) — CONSOMME les marqueurs
 * `Trauma.pendingAmputation` armés par `resolveCritique` et rend les Flows à ouvrir par la porte
 * canonique. PUR au sens du jet : aucun dé n'est tiré ici (le nœud a été fabriqué au critique, enjeu
 * posé) ; seule la liste des séquelles de `c` est mutée, comme le faisait le retrait de marqueur.
 */
export function prendreAmputationsDifferees(c: Combatant): { label: string; flow: Flow }[] {
  const pending = (c.traumas ?? []).filter((t) => t.pendingAmputation);
  if (!pending.length) return [];
  c.traumas = (c.traumas ?? []).filter((t) => !t.pendingAmputation);
  return pending.map((t) => ({ label: t.label, flow: t.pendingAmputation! }));
}

export interface CriticalResolved {
  location: HitLocation;
  /** id STABLE de l'entrée de table (`criticals.json`) — appendé à `critEntriesSuffered`
   *  par `applyCriticalToTarget` pour l'historique d'occurrence (escalade `onRepeat`). */
  entryId: string;
  label: string;
  /** Effet IMMÉDIAT RÉSOLU (PB ignorant BE+PA + États immédiats + Amputation), appliqué par `applyOps`
   *  chez l'appelant — valeurs littérales (RNG déjà consommé ici). */
  ops: GameOp[];
  /** Le(s) Test(s) que la Blessure impose, à OUVRIR PAR LA PORTE canonique — le nœud `test` de la
   *  rangée (LDB 18 / AA 07) et ceux qu'un déclencheur de séquelle fait feu (`Trauma.critTrigger`,
   *  LDB 18 l.74), enjeu posé. Un nœud `test` EST déjà un `Flow` ; plusieurs voyagent en `seq`, joué
   *  en séquence par l'exécuteur. L'appelant `state` l'ouvre (`routeTriggeredTest`), le moteur ne le
   *  roule jamais — patron `MiscastResult.testFlow` (`miscast.ts`). */
  testFlow?: Flow;
  lethal: boolean;
  /** Traumatismes posés (LDB 18), à la localisation du critique. */
  traumas: Trauma[];
  /** Texte canon (LONG TERME), DISPLAY-ONLY — jamais parsé pour de la mécanique. */
  desc: string;
  /** Jet d100 effectif (après modificateur de sévérité). */
  roll: number;
  log: string;
}

/** Champs que le bandeau de la modale de Coup Critique sait restituer, par op. */
const CHAMPS_DU_BANDEAU: Partial<Record<GameOp['op'], readonly string[]>> = {
  wounds: ['op', 'amount', 'ignoreTB', 'ignoreAP'],
  condition: ['op', 'id', 'value'],
};

/** Op que le bandeau de la modale de Coup Critique (`critImmediateSummary`) restitue EN ENTIER :
 *  Blessures chiffrées ignorant BE et PA, ou État de valeur chiffrée (ou absente), sans aucun autre
 *  champ. Toute autre op est une ligne d'effet de la modale. */
export function opRestitueeParLeBandeau(o: GameOp): boolean {
  const champs = CHAMPS_DU_BANDEAU[o.op];
  if (!champs || !Object.keys(o).every((k) => champs.includes(k))) return false;
  if (o.op === 'wounds') return typeof o.amount === 'number' && o.ignoreTB !== false && o.ignoreAP !== false;
  return o.op === 'condition' && (o.value === undefined || typeof o.value === 'number');
}

/** Récapitulatif d'AFFICHAGE d'un effet immédiat (PB totaux + États) extrait des `ops` — pour la
 *  révélation de Coup Critique (modale enrichie), SANS dupliquer la donnée. */
export function critImmediateSummary(ops: GameOp[]): { woundsLost: number; conditions: { id: string; value: number }[] } {
  let woundsLost = 0;
  const conditions: { id: string; value: number }[] = [];
  for (const o of ops) {
    if (!opRestitueeParLeBandeau(o)) continue;
    if (o.op === 'wounds') woundsLost += o.amount as number;
    else if (o.op === 'condition') conditions.push({ id: o.id, value: (o.value as number | undefined) ?? 1 }); // défaut de l'op (`applyOps`, `condition`)
  }
  return { woundsLost, conditions };
}

/** Catégorie Codex EXACTE (`registry.ts`) d'un Coup Critique, par table + jeu (LDB/Aux Armes). */
export function critEntryCodexCategory(table: CritTableKey, jeu: JeuDeCritique): string {
  const seg = table === 'tete' ? 'Tete' : table === 'bras' ? 'Bras' : table === 'corps' ? 'Corps' : 'Jambe';
  return `${jeu === 'aa' ? 'aaCriticals' : 'criticals'}${seg}`;
}

/** Retrouve l'entrée de Coup Critique portant cet id STABLE — un id de `critEntriesSuffered`
 *  (`Combatant`) n'a PAS de localisation attachée (compteur d'occurrence pour l'escalade `onRepeat`
 *  seulement, LDB 18 l.71) : `bras`/`jambe` regroupent les deux côtés, on ne peut donc afficher que la
 *  TABLE (« Bras »/« Jambe »), pas le côté précis (G/D). SOURCE UNIQUE de lecture d'un id de
 *  `critEntriesSuffered` — l'onglet État (rendu du journal des Blessures critiques subies) et tout
 *  futur point d'affichage passent par ici. UNE boucle sur les 8 documents : un 9ᵉ tableau y entre
 *  sans une ligne de plus. */
export function findCritEntrySuffered(id: string): { entry: CritEntry; table: CritTableKey; jeu: JeuDeCritique } | undefined {
  for (const doc of CRITIQUE_DOCS) {
    const entry = doc.entries.find((e) => e.id === id);
    if (entry) return { entry, table: doc.localisation, jeu: doc.jeu };
  }
  return undefined;
}

/** Localisation d'un Coup Critique : 1d100 lu directement sur le Tableau de Localisation de la forme
 *  du corps (humanoïde p.159 / Localisations Alternatives p.312). */
export function critLocationRoll(rng: RNG = defaultRNG, shape: BodyShape = 'humanoide'): HitLocation {
  return hitLocationByShape(d100(rng), shape);
}

/** LDB 18 l.53 : la Localisation d'un Coup Critique est un 1d100 FRAIS (jamais l'inversion de la touche),
 *  SAUF `override` — le Critique déjà montré (Déviation) ou la loc choisie (« Je ne faillirai pas ! »,
 *  LDB 17 l.68). SOURCE UNIQUE de la règle : mêlée, défense opposée et tir/magie en dérivent, puis
 *  passent le résultat à `applyCriticalToTarget` qui ne re-tire JAMAIS → le double tirage est impossible. */
export function critWoundLocation(rng: RNG, bodyShape: BodyShape = 'humanoide', override?: HitLocation): HitLocation {
  return override ?? critLocationRoll(rng, bodyShape);
}

/**
 * Réduction du d100 de SÉVÉRITÉ d'une Blessure critique — LDB 18 l.17 (verbatim : « vous ôtez -20 à
 * votre résultat sur le Tableau des Critiques avec un résultat minimum de 01 »), quand les PB négatifs
 * dépassent le Bonus d'Endurance. SOURCE UNIQUE du modificateur : le régime `ldb` l'applique à SON
 * lookup, la DÉCLARATION d'étape à table le porte en `mod` (négatif) — les deux lisent la même valeur.
 */
export function critSeverityReduction(target: Combatant, overkill: number): number {
  return overkill > bonus(effectiveChar(target, 'endurance')) ? 20 : 0;
}

/** Décalage AA du jet de Critique (AA 07 l.36) : +10 par Blessure au-delà de 0. PUR. */
export function aaCriticalOffset(overkill: number): number {
  return 10 * Math.max(0, overkill);
}

/** Ce qu'un JEU adresse — le reste de la résolution est au socle. */
interface RegimeCritique {
  /** Modificateur appliqué au d100 NATUREL avant le lookup (le plancher 01 est au socle). */
  severite(target: Combatant, overkill: number): number;
  /** En-tête de la ligne de journal. */
  journal: string;
}

/**
 * CE QUE COÛTE UN JEU DE PLUS — une DÉCLARATION ici, et rien d'autre : la séquence de résolution, le
 * lookup, la lecture des id subis et l'exposition Codex sont entièrement pilotés par la DONNÉE (les
 * documents-tables de `criticals.json`). Table ouverte à l'écriture pour que la morsure N+1
 * (`crit-n-plus-1.test.ts`) puisse en poser une et la retirer — le moteur, lui, ne l'écrit jamais.
 */
export const REGIMES_DE_CRITIQUE: Record<string, RegimeCritique> = {
  ldb: { severite: (target, overkill) => -critSeverityReduction(target, overkill), journal: 'Blessure critique' },
  aa: { severite: (_target, overkill) => aaCriticalOffset(overkill), journal: 'Blessure critique AA' },
};

/** Régime d'un jeu — FAIL-FAST NOMINATIF : un document-table dont le `jeu` n'a pas de régime déclaré
 *  se résoudrait sinon sur `undefined`, et le critique crasherait loin de sa cause. */
function regimeDe(jeu: JeuDeCritique): RegimeCritique {
  const regime = REGIMES_DE_CRITIQUE[jeu];
  if (!regime) {
    throw new Error(
      `resolveCritique : le jeu « ${jeu} » n'a pas de régime déclaré (REGIMES_DE_CRITIQUE : ${Object.keys(REGIMES_DE_CRITIQUE).join(', ')}) — un tableau de plus déclare SA sévérité et SON libellé de journal.`,
    );
  }
  return regime;
}

/**
 * Le JEU qui résout un Coup Critique : l'approche alternative d'Aux Armes quand la règle facultative
 * `combat-aa-blessures` vaut `aa`. `twice` (Bénédiction de Sauvagerie, LDB 41 l.170) reste au chemin
 * LDB — l'Atout ne coexiste pas avec la variante AA. SOURCE UNIQUE du choix : la couche combat le lit
 * pour ses propres décisions (trivialité, déclaration d'étape à table) plutôt que de le recalculer.
 */
export function jeuDeCritique(twice = false): JeuDeCritique {
  return !twice && rule('combat-aa-blessures') === 'aa' ? 'aa' : 'ldb';
}

/** Lignes de la table d'un (jeu, clé) — passées PAR RÉFÉRENCE au registre d'étapes (zéro duplication). */
export function critTableRows(jeu: JeuDeCritique, key: CritTableKey): CritEntry[] {
  return critiqueDoc(jeu, key).entries;
}

/**
 * Une Blessure critique est-elle TRIVIALE (« T », AA 07 l.79) — non comptée pour la mort par
 * accumulation ? DÉRIVÉE, jamais authorée : une rangée non létale qui ne fait perdre AUCUNE Blessure.
 * Lue par la couche combat pour ne pas incrémenter `criticalWounds`. PUR.
 */
export function critiqueTriviale(jeu: JeuDeCritique, location: HitLocation, roll: number): boolean {
  const entry = findTableEntry(critiqueTable(jeu, location), Math.max(1, roll));
  return !entry.lethal && !(entry.ops ?? []).some((o) => o.op === 'wounds');
}

/** Mort par accumulation de Blessures Critiques (AA 07 l.73) : un combattant Inconscient à 0 PB dont
 *  le nombre de Blessures Critiques dépasse son Bonus d'Endurance succombe en fin de Round. PUR. */
export function aaDeathByCriticalCount(inconscient: boolean, wounds: number, criticalWounds: number, be: number): boolean {
  return inconscient && wounds <= 0 && criticalWounds > be;
}

/** Ce que l'appelant peut moduler sur un Coup Critique — tout est optionnel, le socle a ses défauts. */
export interface OptionsCritique {
  /** PB perdus au-delà des PB courants (LDB 18 l.17 : réduction de sévérité ; AA 07 l.36 : +10 chacun). */
  overkill?: number;
  /** Bénédiction de Sauvagerie (LDB 41 l.170) : deux lancers, le porteur béni CHOISIT lequel. */
  twice?: boolean;
  /**
   * d100 de sévérité INJECTÉ (dé de l'étape à table, dé posé, test) : c'est le dé NATUREL — le
   * modificateur de sévérité du jeu reste appliqué ICI, comme sur un dé tiré. Il PRIME sur `twice`
   * (aucun dé n'est tiré) : les DEUX lancers de la Bénédiction de Sauvagerie (LDB 41 l.170 : « Quand
   * votre cible inflige par la suite des Blessures Critiques, effectuez deux lancers et choisissez le
   * meilleur résultat. ») sont alors déjà tranchés en amont — par l'étape à table (`keepHighest`, qui
   * retient un dé et l'affiche) ou par le dé que POSE le joueur (le résultat gardé que `LDB 41 l.170` /
   * `AA 13 l.57` lui confient, nommé directement).
   *
   * Le CHOIX que le RAW confie au porteur béni (« choisissez ») a pour référent l'ATTAQUANT ; sa
   * surface joueur est portée par #982 (le tirage rend ici un dé déjà arbitré).
   */
  forcedRoll?: number;
}

/**
 * Résout une Blessure critique sur `target` à la `location`, dans le `jeu` donné. Le nœud `test` de
 * l'entrée n'est PAS joué ici : il ressort en `testFlow`, enjeu posé, et l'appelant `state` l'ouvre
 * par la porte canonique (`user-doctrine-forme-canonique-unique-jets`).
 * La Localisation n'est JAMAIS re-tirée ici (LDB 18 l.53 / AA 07 l.32) — l'appelant la fournit.
 */
export function resolveCritique(
  jeu: JeuDeCritique,
  target: Combatant,
  location: HitLocation,
  rng: RNG = defaultRNG,
  options: OptionsCritique = {},
): CriticalResolved {
  const { overkill = 0, twice = false, forcedRoll } = options;
  const regime = regimeDe(jeu);
  const be = bonus(effectiveChar(target, 'endurance'));
  const raw = forcedRoll ?? (twice ? Math.max(d100(rng), d100(rng)) : d100(rng));
  const roll = Math.max(1, raw + regime.severite(target, overkill));
  const entry = findTableEntry(critiqueTable(jeu, location), roll); // repli Bras (LDB 76 l.21) si loc sans table dédiée
  const ops: GameOp[] = [...(entry.ops ?? [])];
  // Nœud `test` de la rangée : FABRIQUÉ à part (enjeu à la LIGNE), jamais roulé — il part par la porte.
  const rangee = noeudDeRangee(entry, jeu, location);
  const tests: Flow[] = rangee ? [rangee] : [];
  // Occurrence-count PAR ID D'ENTRÉE (LDB 18 l.71 : « Si vous tombez une seconde fois sur cette blessure… » ;
  // AA 07 l.96) : la MÊME entrée déjà subie → effet ALTERNATIF `escalation.onRepeat` (séquelles REMPLACÉES,
  // ops immédiates AJOUTÉES). L'effet IMMÉDIAT de base reste appliqué (le coup blesse toujours).
  const repeated = (target.critEntriesSuffered ?? []).includes(entry.id);
  const repeat = repeated ? entry.escalation?.onRepeat : undefined;
  if (repeat?.ops) ops.push(...repeat.ops.map((o) => ({ ...o })));
  const traumaRefs = repeat?.traumas ?? entry.traumas ?? [];
  // Durée de convalescence (Jalon 5) : BE déjà calculé ; 1d10 tiré seulement pour les fractures (RAW 30+1d10)
  // afin de ne pas décaler le flux RNG des critiques sans fracture. Les refs d'id de fiche (`traumas.json`)
  // portent leur `kind` → on instancie à la localisation du coup.
  const traumas = traumaRefs.map((id) =>
    traumaById(id, { be, d10: traumaFicheById(id).kind === 'fracture' ? d10(rng) : undefined }, location));
  // Amputation (LDB 18 l.237 ; AA 07 « voir Amputation en page 180 de WFJDR ») : DÉCLARÉE STRUCTURELLEMENT
  // (`entry.amputation`, jamais lue par regex sur le texte). Son/ses Test(s) sont FABRIQUÉS ici et rejoignent
  // le `testFlow` APRÈS le nœud de la rangée (ordre RAW : la rangée, puis l'amputation qu'elle prononce) —
  // aucun dé n'est tiré. `timing: 'postEncounter'` (l.171 : « Une fois la rencontre terminée… ») → le nœud
  // est ARMÉ sur le marqueur `pendingAmputation`, ouvert par la porte au foyer de fin de combat.
  if (!entry.lethal && entry.amputation) {
    const noeud = noeudAmputation(entry, jeu, location)!;
    if (entry.amputation.timing === 'postEncounter') traumas.push({ label: entry.label, location, pendingAmputation: noeud });
    else tests.push(noeud);
  }
  // Escalade GATÉE par les soins (« Main ouverte » : doigt/Round ; « Pied écrasé » : perte du pied sans
  // Chirurgie sous 1d10 jours ; « Épaule luxée »/« Genou démis » : membre désactivé jusqu'au Test étendu de
  // Guérison) — placée en DERNIER (ne décale que les critiques à escalade).
  stampCriticalEscalation(traumas, entry.escalation, location, target, rng, target.traumas ?? [], enjeuDeRangee(jeu, location, entry.id));
  // Déclencheurs armés par un critique ANTÉRIEUR (« Commotion cérébrale » : autre critique tête pendant
  // Exténué, LDB 18 l.74) — lus sur `target.traumas` (jamais la séquelle stampée à l'instant : elle n'est pas
  // encore sur la cible), et kind-agnostiques (un critique LDB peut avoir armé ce qu'un critique AA fait
  // feu). Leurs nœuds rejoignent le `testFlow` : même porte, même fenêtre, dans le geste du critique.
  tests.push(...fireCritTriggers(target, location));
  return {
    location,
    entryId: entry.id,
    label: entry.label,
    ops,
    ...(tests.length ? { testFlow: tests.length === 1 ? tests[0] : { kind: 'seq' as const, steps: tests } } : {}),
    lethal: !!entry.lethal,
    traumas,
    desc: entry.desc,
    roll,
    log: `${regime.journal} (${locationLabel(location, target.bodyShape)}) — ${entry.label}${entry.lethal ? ' — MORT !' : ''}.`,
  };
}

export { critTableKeyFor };
