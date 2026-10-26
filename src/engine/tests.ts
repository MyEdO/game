/**
 * Tests & Degrés de Réussite (DR) — Livre de base, chapitre « Tests ».
 *
 * On réussit un Test si le jet de d100 est inférieur ou égal à la valeur de
 * Compétence/Caractéristique (modifiée par la Difficulté). Le nombre de Degrés
 * de Réussite est la différence des dizaines : DR = dizaine(cible) − dizaine(jet).
 */
import { d100, RNG } from './dice';
import { DIFFICULTE_PAR_DEFAUT, Difficulty, DIFFICULTY_MODIFIERS } from './types';
import { type TestPolicy, getTestPolicy } from './testPolicy';
import type { ModLine } from './combat';

/** Chiffre des dizaines d'un d100 (00 = 100 → 10). SOURCE UNIQUE du calcul de DR. */
export const tens = (n: number): number => Math.floor(n / 10);

/** Échelle de Difficulté ORDONNÉE, du plus FACILE (tresFacile +60) au plus difficile (impossible −50, EDO App.2). */
export const DIFFICULTY_LADDER: Difficulty[] = ['tresFacile', 'facile', 'accessible', 'intermediaire', 'complexe', 'difficile', 'tresDifficile', 'presqueImpossible', 'impossible'];

/** La Difficulté que désigne l'argument d'instance `arg` d'un porteur, par son id (`LDB 85 l.423`). Un `arg`
 *  qui n'en désigne aucune vaut `DIFFICULTE_PAR_DEFAUT` sans règle qui le fonde — `LDB 85 l.425` ne vise
 *  que l'arg ABSENT, que `withArg` (`noyau/triggeredEffects.ts`) ne passe pas ici. Porteurs : la fourchette
 *  du Serpent (`LDB 78 l.104`, #1463) et « Moyen » de l'Araignée géante (`LDB 78 l.15`, #1463). */
export function difficulteDeLArg(arg: string): Difficulty {
  return Object.prototype.hasOwnProperty.call(DIFFICULTY_MODIFIERS, arg) ? (arg as Difficulty) : DIFFICULTE_PAR_DEFAUT;
}

/** Décale une difficulté de `steps` crans vers PLUS FACILE (bornée aux extrémités de l'échelle). PUR. */
export function easeDifficulty(base: Difficulty, steps: number): Difficulty {
  const i = DIFFICULTY_LADDER.indexOf(base);
  return DIFFICULTY_LADDER[Math.max(0, Math.min(DIFFICULTY_LADDER.length - 1, i - steps))];
}

/** Difficulté dont le modificateur est le plus proche de `mod` (échelle `DIFFICULTY_MODIFIERS`). PUR.
 *  Source unique pour composer une difficulté à partir d'un modificateur plat RAW (−10/−20/−30/+20…). */
export function difficultyFromModifier(mod: number): Difficulty {
  let best: Difficulty = 'intermediaire';
  let bestDist = Infinity;
  for (const key of Object.keys(DIFFICULTY_MODIFIERS) as Difficulty[]) {
    const dist = Math.abs(DIFFICULTY_MODIFIERS[key] - mod);
    if (dist < bestDist) { bestDist = dist; best = key; }
  }
  return best;
}

/** Difficulté dont le modificateur vaut EXACTEMENT `mod`, `undefined` sinon — pendant STRICT de
 *  `difficultyFromModifier` (plus proche voisin : un −15 y rend « Complexe (−10) », un −25
 *  « Difficile (−20) » — mesuré). Un palier NOMMÉ à partir d'une combinaison de modificateurs
 *  (`LDB 14 l.91-96`) ne peut se dire qu'à cette condition : à défaut, le jet garde sa Difficulté
 *  déclarée et ses modificateurs en chips. PUR. */
export function exactDifficultyFromModifier(mod: number): Difficulty | undefined {
  return (Object.keys(DIFFICULTY_MODIFIERS) as Difficulty[]).find((k) => DIFFICULTY_MODIFIERS[k] === mod);
}

/** Difficulté RÉSULTANTE d'une Difficulté RAW assortie d'un modificateur plat (`MSRC 13 l.176`) —
 *  composition PURE `difficultyFromModifier(mod(base) + delta)`. SOURCE UNIQUE : l'arithmétique de
 *  Difficulté vit dans le moteur, jamais recomposée au call-site (cliquet #1153). */
export function shiftDifficulty(base: Difficulty, delta: number): Difficulty {
  return difficultyFromModifier(DIFFICULTY_MODIFIERS[base] + delta);
}

export interface TestResult {
  roll: number;
  target: number; // valeur effective après difficulté
  /** Niveau de Compétence NU testé (`LDB 09 l.17`) : Caractéristique effective + Augmentations, AVANT
   *  Difficulté, modificateurs du jet ET modificateurs de la VALEUR (États, Encombrement, effets
   *  char-qualifiés). C'est elle qui départage un Test opposé à DR égal (`LDB 12 l.160`). ≠
   *  `RollBreakdown.base` (la valeur TESTÉE, qui en combat porte encore les mods de valeur) : c'est
   *  `RollBreakdown.nue` qui lui correspond, et `hydrateTR` la relit là. Absente quand le producteur du
   *  jet n'en pose aucune — le départage retombe alors sur les cibles des DEUX camps (`openValues`). */
  base?: number;
  success: boolean;
  /** Degrés de Réussite (positif = réussite, négatif = échec). */
  sl: number;
  /** Double réussi/raté (11,22,…,99,00) — déclenche Critique/Maladresse en combat. */
  isDouble: boolean;
  /** ÉCRÊTAGE RÉELLEMENT subi par la cible (`target − cible calculée`), quand `clamp` (bornes de
   *  `TestPolicy`) a mordu : négatif au plafond, positif au plancher. Purement INFORMATIF (aucun
   *  verdict n'en dépend) — c'est ce qui permet de NOMMER « plafond 99 : −N » à l'écran au lieu de
   *  le deviner d'une cible qui vaut 99 par coïncidence. Absent = aucun bornage. */
  clamped?: number;
}

/** ISSUE d'un Test que l'acteur ne peut pas tenter (`peutTenter` faux) : aucun dé, aucun RNG, ni cible
 *  ni jet à lire. LDB 09 l.30 ; #2588 Q1. Valeur CONSTANTE : toutes les lignes non tentables la partagent. */
export interface EchecSansJet {
  readonly sansJet: true;
  readonly success: false;
  readonly sl: 0;
  readonly roll?: undefined;
  readonly target?: undefined;
}
export const ECHEC_SANS_JET: EchecSansJet = Object.freeze({ sansJet: true, success: false, sl: 0 } as const);

/** Le dé a-t-il été JETÉ ? Faux pour une issue sans jet (`EchecSansJet`) comme pour un slot sans dé (`null`). */
export function estJete<T extends object>(r: T | EchecSansJet | null | undefined): r is Exclude<T, EchecSansJet> {
  return r != null && (r as { sansJet?: true }).sansJet !== true;
}

/** Ligne NON TENTABLE : l'issue constante et son refus NOMMÉ, posés ENSEMBLE — source UNIQUE de la paire
 *  (monteur `rollSeam.rollStep`, Test d'équipage `combatSlice.openCrewTestPending`). LDB 09 l.30 ; #2588 Q1. */
export function ligneSansJet<R>(refus: R): { result: EchecSansJet; refus: R } {
  return { result: ECHEC_SANS_JET, refus };
}

/** Refus NOMMÉ d'une ligne née sans jet, `undefined` pour une ligne tentable (jetée ou en attente de dé) :
 *  prédicat UNIQUE de « non tentable ⇒ témoin » (`rollSeam.temoinSiSansJet`, `buildParticipantRows`). */
export function refusSansJet<R>(ligne: { result?: object | null; refus?: R }): R | undefined {
  return ligne.result != null && !estJete(ligne.result) ? ligne.refus : undefined;
}

/** Effectue un Test simple contre une valeur cible (d100 ≤ valeur, LDB 12 l.7-13).
 *  Le `TestResult` rendu ne porte AUCUNE valeur nue (`base`) : `value` est la valeur TESTÉE, qui n'est
 *  la valeur nue du départage (`LDB 12 l.160`, `LDB 09 l.17`) que par coïncidence. Un site dont le jet
 *  atteint `resolveOpposed` pose SA nue explicitement (accesseur canon `skillBaseValue`/`combatBaseValue`/
 *  `defenseBaseValue`, ou la valeur elle-même quand elle EST nue) ; à défaut, `openValues` retombe sur
 *  les cibles des DEUX camps — jamais un départage mixte, et le repli se JOURNALISE en DEV
 *  (`REPLIS_DEUX_CIBLES`) : il tranche sur une grandeur que le RAW ne désigne pas. */
export function rollTest(
  value: number,
  difficulty: Difficulty,
  rng: RNG,
  modifier = 0,
  policy: TestPolicy = getTestPolicy(),
): TestResult {
  return evaluateTest(d100(rng), cibleDuTest(value, difficulty, modifier), undefined, policy);
}

/** Cible d'un Test AVANT bornage : valeur testée + Difficulté + modificateurs (LDB 12 l.92-94). C'est elle
 *  que reçoivent les constructeurs (`evaluateTest`, `forcedTR`) — un dé forcé AVANT le jet en part aussi. */
export function cibleDuTest(value: number, difficulty: Difficulty = 'intermediaire', modifier = 0): number {
  return value + DIFFICULTY_MODIFIERS[difficulty] + modifier;
}

/** Un d100 est-il un « double » (11, 22, …, 99, 00=100) ? Génère Critique (réussi) ou Maladresse (raté). */
export function isDoubleRoll(roll: number): boolean {
  return roll === 100 || roll % 11 === 0;
}

/** Évalue un jet déjà obtenu contre une cible (utile pour rejouer un jet). `cible` = la cible AVANT
 *  bornage (valeur + Difficulté + modificateurs ; `cibleBrute` d'un jet posé) : le constructeur la BORNE
 *  lui-même (`clampTarget`) et MESURE l'écrêtage (`clamped`) — aucun appelant ne borne ni ne relaie.
 *  `base` = valeur NUE testée (avant Difficulté/modificateurs) : un site qui la connaît la fait voyager
 *  jusqu'au départage d'un Test opposé (LDB 12 l.160). */
export function evaluateTest(r: number, cible: number, base?: number, policy: TestPolicy = getTestPolicy()): TestResult {
  const { target, clamped } = clampTarget(cible, policy);
  // 1) Réussite « numérique » : jet ≤ cible.
  let success = r <= target;
  // 2) Bandes automatiques (LDB 12 l.28). 'normal' = RAW (01..autoSuccessMax réussite auto,
  //    autoFailMin..00 échec auto) ; 'inverted' = maison (bandes échangées) ; 'off' = aucune.
  const lowBand = r <= policy.autoSuccessMax;
  const highBand = r >= policy.autoFailMin;
  let forced: 'success' | 'fail' | null = null;
  if (policy.bandsMode === 'normal') {
    if (lowBand) { success = true; forced = 'success'; }
    else if (highBand) { success = false; forced = 'fail'; }
  } else if (policy.bandsMode === 'inverted') {
    if (lowBand) { success = false; forced = 'fail'; }
    else if (highBand) { success = true; forced = 'success'; }
  }
  // 3) DR : 'fast' = dizaines du jet sur une RÉUSSITE (LDB 12 l.102) ; sinon différence de dizaines.
  const baseSL = policy.slMode === 'fast' && success ? tens(r) : tens(target) - tens(r);
  // 4) DR auto des bandes (LDB 12 l.119/l.121) : réussite forcée ≥ +1 ; échec forcé ≤ −1.
  const sl = forced === 'success' ? Math.max(1, baseSL) : forced === 'fail' ? Math.min(-1, baseSL) : baseSL;
  return { roll: r, target, success, sl, isDouble: isDoubleRoll(r), ...(base != null ? { base } : {}), ...(clamped ? { clamped } : {}) };
}

/** Cible d'un jet posé AVANT bornage — l'inverse de la mesure des constructeurs (`evaluateTest`,
 *  `forcedTR`) : un dé réévalué sur le MÊME jet repart de là, et le constructeur re-mesure son écrêtage. */
export function cibleBrute(t: { target: number; clamped?: number }): number {
  return t.target - (t.clamped ?? 0);
}

/** Cible d'un jet telle que son constructeur l'a MESURÉE : la cible bornée et son écrêtage voyagent
 *  ENSEMBLE dans toute forme RANGÉE d'un jet — aucun stockage ne garde l'une sans l'autre. */
export type CibleMesuree = Pick<TestResult, 'target' | 'clamped'>;
/** Projection UNIQUE de la paire (cible bornée, écrêtage) d'un jet vers une forme rangée ou affichée. */
export function cibleMesuree(t: CibleMesuree): CibleMesuree {
  return { target: t.target, ...(t.clamped ? { clamped: t.clamped } : {}) };
}

/** Forme RANGÉE d'un jet (`{ roll, target, sl, success }` + l'écrêtage de sa cible) : `cibleBrute`
 *  d'un jet rangé rend la cible du constructeur. */
export type JetPose = Pick<TestResult, 'roll' | 'sl' | 'success'> & CibleMesuree;
/** Projection UNIQUE d'un `TestResult` vers sa forme rangée (`JetPose`). */
export function jetPose(t: TestResult): JetPose {
  return { roll: t.roll, sl: t.sl, success: t.success, ...cibleMesuree(t) };
}

/** Valeur maximale d'un dé FORCÉ par la Résilience « Je ne faillirai pas ! » (LDB 17 l.68) : le dé
 *  choisi doit RESTER une réussite — ≤ cible ET hors bande d'échec auto. En mode 'normal' la bande
 *  haute (≥ autoFailMin) échoue toujours (LDB 12 l.28), d'où le plafond `autoFailMin − 1` — DÉRIVÉ
 *  de la policy, jamais un nombre en dur. SOURCE UNIQUE (sélecteur + résolveurs de jet forcé). */
export function maxForcedRoll(target: number, policy: TestPolicy = getTestPolicy()): number {
  const ceil = policy.bandsMode === 'normal' ? policy.autoFailMin - 1 : policy.targetMax;
  return Math.min(clamp(target, policy), ceil);
}

/** Le dé qui MAXIMISE le DR d'une réussite FORCÉE (« Je ne faillirai pas ! », LDB 17 l.68 : on choisit
 *  le résultat → LE MEILLEUR), selon le `slMode` — car le meilleur jet DÉPEND de la policy :
 *  - **fast** (DR = dizaines du jet, LDB 12 l.102) → le jet valide le PLUS HAUT (`maxForcedRoll` : dizaines max) ;
 *  - **standard** (DR = différence de dizaines) → **01** (le plus bas → dizaines de la cible).
 *  SOURCE UNIQUE du dé PAR DÉFAUT de la Résilience — remplace les `01` codés en dur (faux en Fast DR). */
export function bestForcedRoll(target: number, policy: TestPolicy = getTestPolicy()): number {
  return policy.slMode === 'fast' ? maxForcedRoll(target, policy) : 1;
}

/** Issue d'un Test Combiné (LDB 12 l.202-206, règle optionnelle) : UN seul d100 confronté à DEUX valeurs. */
export interface CombinedTestResult {
  roll: number;
  /** Résultat vs la 1ʳᵉ valeur (même jet). */
  a: TestResult;
  /** Résultat vs la 2ᵈᵉ valeur (même jet). */
  b: TestResult;
  /** `full` = les deux réussies ; `partial` = une seule ; `fail` = aucune. */
  level: 'full' | 'partial' | 'fail';
}

/** Test Combiné (LDB 12 l.202-206) : un MÊME jet d100 est évalué contre deux valeurs cibles (deux
 *  Compétences). Réutilise `evaluateTest` (bandes/DR identiques) pour chaque cible. PUR : la primitive
 *  est neutre ; l'activation (règle `test-combined`) et le branchement des issues vivent côté flux. */
export function evaluateCombinedTest(roll: number, target1: number, target2: number, policy: TestPolicy = getTestPolicy()): CombinedTestResult {
  const a = evaluateTest(roll, target1, undefined, policy);
  const b = evaluateTest(roll, target2, undefined, policy);
  const passed = (a.success ? 1 : 0) + (b.success ? 1 : 0);
  return { roll, a, b, level: passed === 2 ? 'full' : passed === 1 ? 'partial' : 'fail' };
}

/** Détail d'AFFICHAGE d'un Test (base + mod = cible · d100 · DR) — la forme des lignes de jet
 *  (RollLine / NightEntry.d). UNE construction partagée, au lieu d'objets recopiés par site.
 *  `mods` : le détail ÉTIQUETÉ (Soutien, allure forcée…) rendu en chips par `RollLine` — un site qui
 *  connaît l'origine de son écart la NOMME, il ne laisse pas un « −30 » anonyme. */
export function testDetail(label: string, base: number, t: TestResult, mods?: ModLine[]): {
  label: string; base: number; modifier: number; target: number; roll: number; success: boolean; sl: number; mods?: ModLine[];
} {
  return { label, base, modifier: t.target - base, target: t.target, roll: t.roll, success: t.success, sl: t.sl, ...(mods?.length ? { mods } : {}) };
}

export interface OpposedResult {
  attacker: TestResult;
  defender: TestResult;
  /** Vainqueur du test opposé. `tie` = statu quo (aucun vainqueur). */
  winner: 'attacker' | 'defender' | 'tie';
  /** Conservé pour compatibilité : true uniquement si `winner === 'attacker'`. */
  attackerWins: boolean;
  /** DR net du vainqueur (sert aux dégâts en combat). */
  netSL: number;
  /** Critère qui a TRANCHÉ, en ids STABLES (LDB 12 l.160) : `dr` = les DR diffèrent ; `valeur` =
   *  DR égaux, départage sur la valeur nue (`base`, à défaut la cible) ; `egalite` = rien n'a
   *  départagé (`winner === 'tie'`) ; `force` = victoire IMPOSÉE par une ressource/règle (Résilience
   *  LDB 17 l.68), aucun départage joué. Donnée d'AFFICHAGE en aval, aucun verdict n'en dépend. */
  decidedBy: 'dr' | 'valeur' | 'egalite' | 'force';
}

/**
 * Test opposé — LDB 12 l.160.
 * Arbitrage maison (jeu sans MJ, AGENTS.md règle 7) : l'égalité résiduelle que la source laisse
 * au choix du MJ est tranchée en statu quo (`tie`), jamais en relance.
 * Les deux jets sortent de `rollTest`, qui ne pose AUCUNE valeur nue : sans `bases`, le départage à DR
 * égal se fait sur les CIBLES — et avec deux Difficultés DIFFÉRENTES, elles ne sont plus comparables
 * (`LDB 12 l.166` applique les modificateurs aux deux groupes). `bases` porte les nues des DEUX camps
 * (TOUT-OU-RIEN par construction) : c'est le SEUL canal par lequel une nue entre dans un jet roulé ici.
 */
export function opposedTest(
  attackerValue: number,
  defenderValue: number,
  rng: RNG,
  attackerDifficulty: Difficulty = 'intermediaire',
  defenderDifficulty: Difficulty = 'intermediaire',
  /** Valeurs NUES des deux camps (`LDB 09 l.17`), grandeur du départage à DR égal (`LDB 12 l.160`). */
  bases?: { attacker: number; defender: number },
): OpposedResult {
  const attacker = { ...rollTest(attackerValue, attackerDifficulty, rng), ...(bases ? { base: bases.attacker } : {}) };
  const defender = { ...rollTest(defenderValue, defenderDifficulty, rng), ...(bases ? { base: bases.defender } : {}) };
  return resolveOpposed(attacker, defender);
}

/** Compteur DEV des départages retombés sur les CIBLES faute de nue (#1153) — sonde partagée, patron
 *  `ui/RollLine.ANONYMES` : un test ou un écran de recette y prouve qu'un chemin oppose bien deux nues.
 *  Inerte en PROD. */
export const REPLIS_DEUX_CIBLES = { count: 0 };

/** Grandeurs COMPARABLES des deux jets pour le départage (LDB 12 l.160) : les valeurs NUES quand les
 *  DEUX côtés la portent, sinon les cibles des deux côtés. TOUT-OU-RIEN : opposer la valeur nue d'un
 *  camp à la cible modifiée de l'autre comparerait deux grandeurs différentes (c'est le défaut que ce
 *  départage corrige) — un jet sans `base` fait donc retomber les DEUX sur la cible.
 *  Ce repli n'est PAS neutre : les cibles portent Difficulté, modificateurs et ÉCRÊTAGE (aux bornes de
 *  la policy, deux cibles écrêtées à 99 s'égalisent) — il tranche sur une grandeur que le RAW ne
 *  désigne pas. C'est un MANQUE assumé des chemins non migrés, pas une règle : en DEV il se JOURNALISE
 *  là où il se produit, au lieu de passer pour un verdict. */
function openValues(attacker: TestResult, defender: TestResult): [number, number] {
  if (attacker.base == null || defender.base == null) {
    if (import.meta.env?.DEV) {
      REPLIS_DEUX_CIBLES.count += 1;
      console.error(`[resolveOpposed] départage sans valeur nue (attaquant ${attacker.base ?? '—'}, défenseur ${defender.base ?? '—'}) : repli sur les cibles ${attacker.target}/${defender.target} — poser la nue au PRODUCTEUR du jet (LDB 12 l.160).`);
    }
    return [attacker.target, defender.target];
  }
  return [attacker.base, defender.base];
}

export function resolveOpposed(attacker: TestResult, defender: TestResult): OpposedResult {
  // LDB 12 l.160.
  let winner: 'attacker' | 'defender' | 'tie';
  let decidedBy: OpposedResult['decidedBy'];
  const [aVal, dVal] = openValues(attacker, defender);
  if (attacker.sl !== defender.sl) { winner = attacker.sl > defender.sl ? 'attacker' : 'defender'; decidedBy = 'dr'; }
  else if (aVal !== dVal) { winner = aVal > dVal ? 'attacker' : 'defender'; decidedBy = 'valeur'; }
  else { winner = 'tie'; decidedBy = 'egalite'; }
  const netSL = Math.abs(attacker.sl - defender.sl);
  return { attacker, defender, winner, attackerWins: winner === 'attacker', netSL, decidedBy };
}

/**
 * BRANCHE prise par le camp qui JETTE le Test opposé (le « défenseur » au sens de `resolveOpposed`) :
 * `true` = branche `success`, `false` = branche `fail`.
 *
 * `defenderMustWin` dit quel camp le RAW nomme « vous » — celui qui doit REMPORTER pour que la
 * conséquence tombe :
 *  - ABSENT (défaut) : le jeteur RÉSISTE, la conséquence est portée par `fail` (Assommante, `LDB 62
 *    l.235` : « Si vous remportez le Test, votre adversaire gagne un État Sonné » — « vous » = l'opposant) ;
 *  - `true` : le jeteur doit L'EMPORTER, la conséquence est portée par `success` (Piège-lame,
 *    `LDB 62 l.280` : « Si vous l'emportez, votre adversaire laisse tomber la lame »).
 *
 * Hors égalité les deux lectures coïncident ; le champ n'est lu qu'à l'ÉGALITÉ PARFAITE (même DR ET
 * même valeur nue). ARBITRAGE maison (`LDB 12 l.160` — le RAW y laisse le MJ choisir entre deux
 * solutions ; il n'y a pas de MJ, AGENTS.md règle 7) : le jeu retient la PREMIÈRE, statu quo — refaire
 * le Test rouvrirait la fenêtre en boucle, sans borne, sur un jet que le joueur croyait résolu. Statu
 * quo = la branche PORTEUSE de la conséquence n'est pas prise, quel qu'en soit le camp.
 */
export function opposedBranchSuccess(o: OpposedResult, defenderMustWin?: boolean): boolean {
  if (o.winner === 'tie') return !defenderMustWin;
  return o.winner !== 'attacker';
}

/** RAISON du verdict d'un Test opposé, prête pour la LIGNE (Z5) du camp qui la porte — zone Z5c de
 *  `docs/charte-ui.md`. Donnée d'AFFICHAGE en ids STABLES : le texte FR est rendu par `ui/RollLine`,
 *  aucun verdict n'en dépend. `own`/`other` = les grandeurs comparées au départage (`own` = celle de
 *  la ligne porteuse), renseignées pour `valeur` seulement. */
export interface VerdictReason {
  by: 'valeur' | 'egalite';
  own?: number;
  other?: number;
}

/** Ce que chaque ligne d'un Test opposé a à DIRE de son verdict (LDB 12 l.160) : `[attaquant,
 *  défenseur]`. Rien quand les DR ont tranché (`dr`) ou qu'une ressource a imposé la victoire
 *  (`force`) : le cas nominal ne se commente pas. `valeur` → la raison va au VAINQUEUR, avec les deux
 *  grandeurs comparées ; `egalite` → les deux lignes portent le statu quo, qu'aucune n'a emporté.
 *  Les grandeurs sortent de `openValues`, la MÊME source que le départage — jamais recomposées en aval. */
export function opposedReasons(opp: OpposedResult): [VerdictReason | undefined, VerdictReason | undefined] {
  const [aVal, dVal] = openValues(opp.attacker, opp.defender);
  if (opp.decidedBy === 'egalite') return [{ by: 'egalite' }, { by: 'egalite' }];
  if (opp.decidedBy !== 'valeur') return [undefined, undefined];
  return opp.winner === 'attacker'
    ? [{ by: 'valeur', own: aVal, other: dVal }, undefined]
    : [undefined, { by: 'valeur', own: dVal, other: aVal }];
}

/** Influence « +`by` DR » sur un jet DÉJÀ résolu (Chance, LDB 17 l.24 ; bonus de Piège-lame, LDB 62) :
 *  renvoie une copie du `TestResult` avec son Degré de Réussite augmenté, pour le RÉ-opposer ou le réappliquer.
 *  Atome PARTAGÉ des relances d'influence des Tests opposés — un seul point au lieu de `{ ...t, sl: t.sl + 1 }`
 *  recopié dans chaque résolveur (marchandage, désengagement, dissipation, opposition de sort, cascade). */
export function bumpSL(t: TestResult, by = 1): TestResult {
  return { ...t, sl: t.sl + by };
}

/** `TestResult` d'une réussite FORCÉE (Résilience « Je ne faillirai pas ! » LDB 17 l.68 / Résistance
 *  Menace LDB 10) au dé `roll`, DR `sl` imposé. Collapse le littéral `{ roll, target, success: true,
 *  sl, isDouble: isDoubleRoll(roll) }` recopié dans chaque résolveur forcé — atome PARTAGÉ, voisin de `bumpSL`.
 *  `cible` = la cible AVANT bornage, bornée et MESURÉE ici comme dans `evaluateTest` ;
 *  `base` = valeur nue, à fournir quand le site la connaît (départage opposé, LDB 12 l.160). */
export function forcedTR(roll: number, cible: number, sl: number, base?: number): TestResult {
  const { target, clamped } = clampTarget(cible);
  return { roll, target, success: true, sl, isDouble: isDoubleRoll(roll), ...(base != null ? { base } : {}), ...(clamped ? { clamped } : {}) };
}

/** `TestResult` RE-HYDRATÉ depuis un détail de jet stocké (RollBreakdown/attackerDetail/étape de
 *  cascade…) : ajoute `isDouble` dérivé du dé. `success` NATUREL préservé (≠ forcedTR qui force
 *  success:true). La valeur NUE est relue à `nue` EN PRIORITÉ (`RollBreakdown.nue`, `LDB 09 l.17`) et
 *  à `base` à défaut — les détails de COMBAT ont un `base` qui est la valeur TESTÉE, reprendre celui-là
 *  rouvrirait le départage mixte que #1153 ferme (`LDB 12 l.160`) ; hors combat les deux coïncident.
 *  Atome PARTAGÉ. */
export function hydrateTR(d: { roll: number; target: number; success: boolean; sl: number; base?: number; nue?: number; clamped?: number }): TestResult {
  const nue = d.nue ?? d.base;
  const { target, clamped } = clampTarget(cibleBrute(d));
  return { roll: d.roll, target, success: d.success, sl: d.sl, isDouble: isDoubleRoll(d.roll), ...(nue != null ? { base: nue } : {}), ...(clamped ? { clamped } : {}) };
}

/** Test Soutenu (LDB 12 l.187-200) — BONUS de coopération : chaque soutien octroie +10 au Test, MAIS le
 *  meneur ne peut être soutenu par plus de Personnages que son propre Bonus de Caractéristique de la carac
 *  testée (`cap`, l.198). Primitive PURE et GÉNÉRALE de la coopération : le « plus compétent lance » est
 *  porté par `partyBest`/`partyAssisted` (engine/skills) qui appelle ceci. Réutilisée PARTOUT où le groupe
 *  œuvre de concert (Test étendu, Tests de groupe hors combat, Dissipation à plusieurs LDB 46 l.162…). */
export function assistBonus(supporters: number, cap: number): number {
  return Math.min(Math.max(0, supporters), Math.max(0, cap)) * 10;
}

function clamp(v: number, policy: TestPolicy): number {
  return Math.max(policy.targetMin, Math.min(policy.targetMax, v));
}

/** Cible BORNÉE + l'écrêtage RÉELLEMENT subi (`clamped`, absent si aucun) — MÊME `clamp` que
 *  `rollTest`, pour les call-sites qui pré-calculent la cible d'un pending (`openSkillTest`) au lieu
 *  de la laisser à `rollTest`. Un site qui bornait à la main (`Math.min(99, …)`) perdait l'info. */
export function clampTarget(raw: number, policy: TestPolicy = getTestPolicy()): { target: number; clamped?: number } {
  const target = clamp(raw, policy);
  return target === raw ? { target } : { target, clamped: target - raw };
}

/** Un Round/passe d'un Test ÉTENDU (LDB 12 l.170-179) : le DR du Round s'AJOUTE au cumul `prev` (planché à
 *  0 — « si le DR total passe sous 0, recommencez depuis le début ») ; `done` quand il atteint `targetDR`.
 *  `minStep` (règle optionnelle l.208) : une réussite compte ≥ +1, un échec ≤ −1 (DR 0 non neutre). SOURCE
 *  UNIQUE du cumul, partagée par crochetage/porte (`extendedTest`), Artisanat (LDB 23), chirurgie (LDB 10)
 *  et le Test étendu de Calme contre la Peur (LDB 21 l.27) — fini les 4 copies de la même arithmétique. */
export function extendedTestStep(
  prev: number,
  r: { success: boolean; sl: number },
  targetDR: number,
  minStep = false,
): { total: number; done: boolean } {
  const sl = minStep ? (r.success ? Math.max(1, r.sl) : Math.min(-1, r.sl)) : r.sl;
  const total = Math.max(0, prev + sl);
  return { total, done: total >= targetDR };
}

// ── Tableau des Résultats : bandes de DR (LDB 12 l.104-114) — PRIMITIVE PARTAGÉE ─────────────────
// Source UNIQUE des seuils qualitatifs « Impressionnant / Stupéfiant » jusqu'ici recopiés en nombres
// magiques (critiques, maladies, soin, marchandage, interlude/évaluation, corruption, rencontres de
// voyage). Le « palier » dépend de la MAGNITUDE du DR ; la réussite/l'échec, du drapeau `success`.

/** Seuil de DR du palier « Impressionnant » (LDB 12 : « 4 ou 5 »). « ou mieux » = ≥ ce seuil. */
export const SL_IMPRESSIVE = 4;
/** Seuil de DR du palier « Stupéfiant » (LDB 12 : « 6+ » / « -6 ou moins »). */
export const SL_ASTOUNDING = 6;

/** Palier qualitatif d'un DR (par sa MAGNITUDE), indépendant du succès/échec (LDB 12). */
export type SLTier = 'minime' | 'normal' | 'impressionnant' | 'stupefiant';
export function slTier(sl: number): SLTier {
  const m = Math.abs(sl);
  if (m >= SL_ASTOUNDING) return 'stupefiant';
  if (m >= SL_IMPRESSIVE) return 'impressionnant';
  if (m >= 2) return 'normal';
  return 'minime';
}

/** « Succès Impressionnant ou mieux » (DR ≥ +4 sur une réussite, LDB 12 l.108/107). */
export const isImpressiveSuccess = (success: boolean, sl: number): boolean => success && sl >= SL_IMPRESSIVE;
/** « Échec Impressionnant ou pire » (DR ≤ -4 sur un échec, LDB 12 l.113/114). */
export const isImpressiveFailure = (success: boolean, sl: number): boolean => !success && sl <= -SL_IMPRESSIVE;
/** « Succès Stupéfiant » (DR ≥ +6, LDB 12 l.107). */
export const isAstoundingSuccess = (success: boolean, sl: number): boolean => success && sl >= SL_ASTOUNDING;
/** « Échec Stupéfiant » (DR ≤ -6, LDB 12 l.114). */
export const isAstoundingFailure = (success: boolean, sl: number): boolean => !success && sl <= -SL_ASTOUNDING;
