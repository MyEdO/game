// Mécanique de scan du garde-fou « exclusivité du seam de jet » (#274, #276). La porte déclarative
// (`openRoll`, `src/state/rollSeam.ts`) + `TestOutcome.seal(...)` (`src/engine/testOutcome.ts`) sont
// le SEUL chemin scellé pour produire une issue de Test ; un `rollTest(`/`d100(` inline ou un
// `TestOutcome.seal(` hors whitelist forge un jet SANS passer par la policy de surfaçage
// (M/V/I) — exactement le trou que ce garde ferme. Module ESM pur, exécutable par `node` nu —
// mécanique ICI, whitelist EN POLICY dans le test/pre-commit (même patron que `hardcode.mjs`).
//
// Détection par AST (`typescript`, `ts.createSourceFile` — MÊME socle que `battleRngEngineLeak.mjs`/
// `registryIdBranch.mjs`, aucun second socle) : un site est un APPEL, jamais une occurrence textuelle.
// Deux conséquences (#918) : les lignes rapportées sont EXACTES (un scan lexical qui retire
// commentaires bloc et imports multi-lignes sans leurs retours-ligne dérive de centaines de lignes
// sur un gros fichier), et deux FORMES de non-violation sont
// reconnues STRUCTURELLEMENT au lieu d'être portées par une entrée de whitelist :
//
//  (S) POSITION DE SPEC — le site est dans un callback (`resolve`/`reresolve`/`rollActor`/`actorTR`/
//      `foeTR`) d'un objet littéral passé en argument à `makeRollFlow(`/`opposedBinaryFlow(`/
//      `crewRoleFlowSpec(` : c'est le corps même d'une spec de flux, exécutée PAR la fabrique du seam.
//      Reconnu par remontée d'ancêtres AST, jamais par le nom de la fonction englobante.
//  (M) DÉ DE MONDE — un `d100(` (jamais `rollTest(`/`TestOutcome.seal(`, qui restent TOUJOURS des
//      violations hors (S)) dont NI l'instruction NI la FONCTION englobante ne porte de valeur de Test
//      (cf. `TEST_VALUE_STMT_RX`/`TEST_VALUE_BODY_RX`), et dont le résultat est consommé SOIT en
//      comparaison directe à un seuil (`<`/`<=`/`>`/`>=`), SOIT en lookup de table (`findTableEntry(`,
//      en argument direct ou via la liaison `const x = d100(...)` du même corps de fonction) : un
//      pourcentage d'événement, pas un Test — aucune issue à surfacer. La souillure se lit sur la
//      fonction ENTIÈRE parce que la valeur comparée transite par une variable au nom neutre
//      (`const cible = effectiveChar(c, 'ag'); if (d100(rng) <= cible)`) aussi souvent qu'en direct ;
//      lue sur la seule instruction, elle blanchit ce Test et un Test OPPOSÉ maison entier.
//
// ANGLE MORT assumé de (M) : le critère est celui de la CONSOMMATION IMMÉDIATE. Un dé dont le
// résultat transite par un appel intermédiaire (`mutationKindFor(roll)`, `petitePriereAnswered(roll,
// seuil)`) reste une violation — resserrement délibéré : la forme relâchée blanchirait aussi
// `massBattleFlow.ts` (`enemyRoll` passé à `openBattlePending`), qui est le jet de l'ADVERSAIRE d'un
// Test opposé.
//
// ANGLE MORT résiduel de CE scanner (fail-open assumé) : un import RENOMMÉ
// (`import { d100 as des } from '../engine/dice'`) lui échappe — il reconnaît le nom APPELÉ, sans
// résoudre la liaison. Les imports renommés de primitives de dé du dépôt (`roll as rollDice`) ne
// renomment ni `rollTest` ni `d100` : la population de ce scanner-ci reste exacte. La garde SŒUR
// (#1508), elle, RÉSOUT l'alias (`importsDuMoteur` : nom local → nom d'origine) — elle ne peut pas
// s'en remettre à la coïncidence qui fait tomber `roll as rollDice` sur un autre nom de son amorce.
import tsModule from 'typescript';
import { parUnitesDeCode } from './lister.mjs'
import { scriptKindDe } from './dialecte.mjs'
import { alternationDe } from '../../../src/lib/regex.ts';

// Liaison LOCALE de l'API du compilateur : sous Vitest ce module passe par vite-node, et chaque `ts.x`
// d'un visiteur AST se relirait sur l'objet d'import du runner. Même socle, même mesure qu'en tête de
// `sceneMutation.mjs`.
const ts = tsModule;

/** Les 3 formes de forgeage/roulage brut d'un Test, en UNE regex — PRÉ-FILTRE lexical bon marché (un
 *  fichier où elle ne matche pas n'est jamais parsé). Tolère les formes que l'AST sait lire mais
 *  qu'un `\(` collé raterait : espace avant la parenthèse, appel générique `rollTest<T>(`,
 *  `TestOutcome` et `.seal` séparés par un retour-ligne. @type {RegExp} */
export const ROLL_SEAM_RX = /\brollTest\s*[(<]|\bd100\s*\(|\bTestOutcome\s*\.\s*seal\s*\(/;

/** Fabriques dont l'argument objet littéral EST une spec de flux (cf. (S)). @type {Set<string>} */
const SPEC_FACTORIES = new Set(['makeRollFlow', 'opposedBinaryFlow', 'crewRoleFlowSpec']);

/** Propriétés-callbacks d'une spec de flux (cf. (S)). @type {Set<string>} */
const SPEC_CALLBACKS = new Set(['resolve', 'reresolve', 'rollActor', 'actorTR', 'foeTR']);

/** Marqueurs d'une valeur de TEST dans l'INSTRUCTION du dé (disqualifient (M)). @type {RegExp} */
const TEST_VALUE_STMT_RX = /\btestValue\b|\beffectiveChar\b|\bskillValue\b|\bcharacteristics\b|\.sl\b/;

/** Mêmes marqueurs, évalués sur la FONCTION englobante : la valeur comparée au dé transite souvent par
 *  une variable au nom neutre (`const cible = effectiveChar(c, 'ag'); if (d100(rng) <= cible)`) — lue
 *  sur la seule instruction, la souillure blanchirait ce Test, et un Test opposé maison entier.
 *  `.sl` en est EXCLU (et lui seul) : il souille par sa seule présence n'importe où dans une grosse
 *  fonction (`runActivityResolver`) et ferait basculer des dés de monde légitimes ; sur l'instruction,
 *  il reste précis. @type {RegExp} */
const TEST_VALUE_BODY_RX = /\btestValue\b|\beffectiveChar\b|\bskillValue\b|\bcharacteristics\b/;

/** Comparaisons à un seuil (cf. (M)). @type {Set<number>} */
const RELATIONAL = new Set([
  ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.LessThanEqualsToken,
  ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.GreaterThanEqualsToken,
]);

/** Nom appelé d'une CallExpression (`f(…)`, `f<T>(…)`, `o.f(…)` → `f`). @returns {string|null} */
function calleeName(call) {
  const e = call.expression;
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  return null;
}

/** Motif de roulage/scellement porté par ce nœud, sinon null. @returns {string|null} */
function siteKind(node) {
  if (!ts.isCallExpression(node)) return null;
  const e = node.expression;
  if (ts.isIdentifier(e) && (e.text === 'rollTest' || e.text === 'd100')) return e.text;
  if (ts.isPropertyAccessExpression(e) && e.name.text === 'seal'
    && ts.isIdentifier(e.expression) && e.expression.text === 'TestOutcome') return 'TestOutcome.seal';
  return null;
}

/** (S) : site dans un callback de spec d'un objet littéral passé à une fabrique de flux ? Les deux
 *  écritures légales du callback comptent : propriété (`resolve: (p) => …`) et méthode raccourcie
 *  (`resolve(p) { … }`). Un callback DÉPORTÉ (fonction libre référencée, objet construit puis passé)
 *  reste une violation — fail-closed : le scanner ne suit pas les liaisons. */
function inSpecCallback(node) {
  for (let n = node.parent; n; n = n.parent) {
    if (!ts.isPropertyAssignment(n) && !ts.isMethodDeclaration(n)) continue;
    if (!ts.isIdentifier(n.name) || !SPEC_CALLBACKS.has(n.name.text)) continue;
    const obj = n.parent;
    if (!ts.isObjectLiteralExpression(obj)) continue;
    const call = obj.parent;
    if (ts.isCallExpression(call) && call.arguments.includes(obj) && SPEC_FACTORIES.has(calleeName(call))) return true;
  }
  return false;
}

/** Remonte les parenthèses englobantes avant d'examiner le parent. */
function unparenthesizedParent(node) {
  let n = node;
  while (n.parent && ts.isParenthesizedExpression(n.parent)) n = n.parent;
  return { self: n, parent: n.parent };
}

/** Corps de fonction englobant (à défaut, le SourceFile). */
function enclosingBody(node) {
  for (let n = node.parent; n; n = n.parent) {
    if (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n)) return n;
  }
  return node.getSourceFile();
}

/** L'identifiant `name` est-il passé en argument d'un `findTableEntry(` dans `scope` ? */
function feedsTableLookup(scope, name) {
  let found = false;
  const visit = (n) => {
    if (found) return;
    if (ts.isCallExpression(n) && calleeName(n) === 'findTableEntry'
      && n.arguments.some((a) => ts.isIdentifier(a) && a.text === name)) { found = true; return; }
    ts.forEachChild(n, visit);
  };
  visit(scope);
  return found;
}

/** (M) : dé de MONDE — cf. en-tête. Ne s'applique qu'à `d100`. */
function isWorldDie(node, kind, sf) {
  if (kind !== 'd100') return false;
  const stmt = ts.findAncestor(node, ts.isStatement);
  if (stmt && TEST_VALUE_STMT_RX.test(stmt.getText(sf))) return false;
  if (TEST_VALUE_BODY_RX.test(enclosingBody(node).getText(sf))) return false;
  const { self, parent } = unparenthesizedParent(node);
  if (!parent) return false;
  if (ts.isBinaryExpression(parent) && RELATIONAL.has(parent.operatorToken.kind)) return true;
  if (ts.isCallExpression(parent) && calleeName(parent) === 'findTableEntry' && parent.arguments.includes(self)) return true;
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name) && parent.initializer === self) {
    return feedsTableLookup(enclosingBody(node), parent.name.text);
  }
  return false;
}

/**
 * Scan complet d'un fichier source : chaque APPEL de roulage/scellement brut qui n'est ni en position
 * de spec (S) ni un dé de monde (M).
 *
 * `opts.includeExcluded` (#1426) — rend AUSSI les sites que les formes (S)/(M) écartent, chacun marqué
 * `excludedBy: 'S'|'M'`. Ce paramètre existe parce qu'une exemption STRUCTURELLE ne laisse, par
 * construction, aucune liste visible : sans lui, (M) absorberait un stock sans qu'aucun chiffre ne
 * bouge ; un FORK instrumenté du scanner serait un second socle de scan (#918). Le garde d'exclusivité
 * appelle la forme NUE : les sites écartés ne sont jamais des violations, seulement des sites
 * COMPTÉS (`WORLD_DIE_SUBTRACTED_STOCK`).
 * @param {string} relPath @param {string} contenu @param {{ includeExcluded?: boolean }} [opts]
 * @returns {{ line: number, detail: string, excludedBy?: 'S'|'M' }[]}
 */
export function scanRollSeamExclusivity(relPath, contenu, opts = {}) {
  if (!ROLL_SEAM_RX.test(contenu)) return [];
  const sf = ts.createSourceFile(
    relPath, contenu, ts.ScriptTarget.Latest, true,
    scriptKindDe(relPath),
  );
  const findings = [];
  const visit = (node) => {
    const kind = siteKind(node);
    if (kind) {
      const excludedBy = inSpecCallback(node) ? 'S' : isWorldDie(node, kind, sf) ? 'M' : null;
      if (!excludedBy || opts.includeExcluded) {
        findings.push({
          line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
          detail: node.getText(sf).replace(/\s+/g, ' ').trim(),
          ...(excludedBy ? { excludedBy } : {}),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  findings.sort((a, b) => a.line - b.line);
  return findings;
}

// ===========================================================================================
// REGISTRE DES CHEMINS DE JET (#1066) — deux familles de plus, MÊME socle AST, MÊME patron
// stock/compte-par-fichier. Le garde ci-dessus ne mord que le roulage BRUT (`rollTest(`/`d100(`/
// `TestOutcome.seal(`) ; deux populations lui échappent par construction :
//   (F) la FABRICATION d'un pending de jet — l'objet qui décrit le jet à venir est monté à la main
//       au call-site au lieu d'être décrit à la porte (`openRoll`) ; le roulage, lui, arrive plus
//       tard et passe par le seam, donc rien ne le signale.
//   (D) le roulage DÉLÉGUÉ AU MOTEUR — `rollSeamExcluded` exempte `src/engine/**` de principe (le
//       moteur reçoit un rng, il ne décide pas du surfaçage) ; un export d'engine dont le corps
//       roule, appelé depuis un flux, rend le CALL-SITE invisible aux deux gardes
//       (`rollMightTest` → `rollTest` dans `engine/massBattle.ts`, appelé par `resolveClash` dans
//       `state/massBattleFlow.ts`).
// Les listes (stocks + justifications) restent EN POLICY dans `rollSeamWhitelist.mjs`.
// ===========================================================================================

/** Pré-filtre lexical de (F). @type {RegExp} */
export const PENDING_JET_RX = /\bskillValue\s*:/;

/** Le littéral porte-t-il `roll: null` (pending PAS ENCORE roulé) ? */
function hasRollNull(obj) {
  return obj.properties.some((p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)
    && p.name.text === 'roll' && p.initializer.kind === ts.SyntaxKind.NullKeyword);
}

/**
 * (F) FABRICATION D'UN PENDING DE JET — un littéral d'objet qui porte `skillValue:` ET (`target:` OU
 * `roll: null`). Signature DISCRIMINANTE : `skillValue:` seul remonte des faux positifs par centaines
 * (paramètres de résolveur, types, patches de champ) ; la conjonction ne retient que les objets qui
 * portent DÉJÀ la cible du jet (`target`, donc la Difficulté appliquée) ou son emplacement de dé
 * vide (`roll: null`) — c'est-à-dire un jet DÉCRIT hors de la porte.
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string }[]}
 */
export function scanPendingJetFabrication(relPath, contenu) {
  if (!PENDING_JET_RX.test(contenu)) return [];
  const sf = ts.createSourceFile(
    relPath, contenu, ts.ScriptTarget.Latest, true,
    scriptKindDe(relPath),
  );
  const findings = [];
  const visit = (node) => {
    if (ts.isObjectLiteralExpression(node)) {
      const names = new Set(node.properties.filter((p) => p.name && ts.isIdentifier(p.name)).map((p) => p.name.text));
      if (names.has('skillValue') && (names.has('target') || hasRollNull(node))) {
        findings.push({
          line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
          detail: [...names].join(','),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  findings.sort((a, b) => a.line - b.line);
  return findings;
}

/** Fonction (déclaration ou `const f = (…) => …`) portée par ce nœud, sinon null.
 *  @returns {{ name: string, body: import('typescript').Node, exported: boolean }|null} */
function functionOf(node) {
  if (ts.isFunctionDeclaration(node) && node.name && node.body) {
    return { name: node.name.text, body: node.body, exported: !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) };
  }
  if (ts.isVariableStatement(node)) {
    const d = node.declarationList.declarations[0];
    if (d && ts.isIdentifier(d.name) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) {
      return { name: d.name.text, body: d.initializer.body, exported: !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) };
    }
  }
  return null;
}

/** AMORCE de (D) : ce qui forge un TEST. @type {readonly string[]} */
export const AMORCE_TEST = ['rollTest', 'd100'];

/**
 * AMORCE ÉLARGIE (#1508) — ce qui tire PHYSIQUEMENT un dé, Test ou pas : les primitives de
 * `src/engine/dice.ts` au complet. La garde d'exclusivité (#274) ne connaît que le forgeage d'un
 * Test ; elle est donc AVEUGLE à une magnitude (`rollDice`), à une dispersion (`d10`), à une
 * expression authorée (`rollExpr`) et au d100 d'environnement (`deMonde`).
 * @type {readonly string[]}
 */
export const AMORCE_DES = ['rollTest', 'd100', 'd10', 'roll', 'rollDice', 'rollExpr', 'deMonde'];

/** PRÉ-FILTRE lexical de la garde sœur — strictement plus large que son critère AST (un appel
 *  `nom(` cite `nom` ; un `rng.int(` cite `int`). @type {RegExp} */
export const DES_HORS_PORTE_RX = new RegExp(`\\b(?:${alternationDe([...AMORCE_DES, 'int'])})\\s*\\(`);

/**
 * CRITÈRE STRUCTUREL du `.int(` — un dé de RNG porte SA PLAGE (`rng.int(1, 10)`, `base.int(min, max)`,
 * `battleRng().int(0, l.length - 1)` : `RNG.int(min, max)`, `src/engine/dice.ts:7`). Un `.int()` de
 * schéma zod ne tire rien et n'a pas d'argument, ou n'en porte qu'un message. Sans ce critère, les
 * `.int()` des schémas de `src/data/schemas/**` compteraient comme des dés.
 * @param {import('typescript').CallExpression} node @returns {boolean} */
function estAppelDeDe(node) {
  const e = node.expression;
  return ts.isPropertyAccessExpression(e) && e.name.text === 'int'
    && node.arguments.length > 0 && !node.arguments.some(ts.isStringLiteralLike);
}

/**
 * LIAISON des noms importés depuis `src/engine` dans ce fichier : nom LOCAL → nom D'ORIGINE
 * (`import { d10 } from '../engine/dice'` → `d10 → d10` ; `import { roll as rollDice }` →
 * `rollDice → roll`). Deux rôles, un seul passage :
 *  - elle distingue une primitive de dé d'un HOMONYME local (`roll`, déclencheur de flux en UI) ;
 *  - elle ferme l'ALIAS (`roll as rollDice`) : sans elle, un alias ne compterait que par la
 *    coïncidence de tomber sur un autre nom de l'amorce, et un `d100 as des` ne se verrait pas.
 * @returns {Map<string, string>} */
function importsDuMoteur(sf) {
  const out = new Map();
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) continue;
    if (!/(^|\/)engine\//.test(st.moduleSpecifier.text)) continue;
    const b = st.importClause?.namedBindings;
    if (b && ts.isNamedImports(b)) for (const el of b.elements) out.set(el.name.text, (el.propertyName ?? el.name).text);
  }
  return out;
}

/**
 * EXPORTS de `src/engine` derrière lesquels UN DÉ TOMBE SANS QU'AUCUNE FRONTIÈRE EXPORTÉE NE SOIT
 * FRANCHIE (#1508) — `applyFall`, `scatter`, `rollMiscast`, `rollStock`… : le dé tombe là, le nom le
 * masque, et c'est le CALL-SITE qui décide de la fenêtre.
 *
 * LA FRONTIÈRE EST L'EXPORT, pas le nombre de sauts. L'export compte s'il appelle une primitive de
 * dé (`AMORCE_DES`) ou un `.int(` DANS SON CORPS, **ou** s'il passe par un helper NON EXPORTÉ du
 * moteur qui, lui, tire : `merchantFlow.rollStock` → `fullStock` (module-local) → `rollDice`, ou
 * `creation.rollDetailFormula` (module-local) → `roll(n, 10, rng)` derrière `rollAge`/`rollEyes`/
 * `rollHair`/`rollHeight`. S'arrêter à UN SAUT rendrait ces dés INVISIBLES, `merchantFlow.ts` en
 * entier, que `ENGINE_DELEGATED_ROLL_STOCK` classe en dette : deux stocks du même dé ne peuvent pas se
 * contredire.
 *
 * CE QU'ELLE N'ASPIRE PAS, et c'est le point : un export qui traverse une AUTRE frontière exportée
 * n'entre pas. La clôture transitive complète de `engineRollerExports` sous amorce élargie, elle,
 * remonte jusqu'aux helpers GÉNÉRIQUES (`createHero`, `contractDisease`, `rollInitialWealth`,
 * `spellRangeTiles`, `zdeRadiusTiles`, `durationClockMinutes`…) et compterait les sites « où un dé
 * pourrait tomber » au lieu de ceux où le dé TOMBE — un stock bâti sur les premiers ne peut pas
 * descendre à zéro, ce serait un registre et non une dette.
 *
 * `applyOps` compte : il tire DANS SON CORPS (`rng.int` de ses désignations). Son canal propre,
 * `OpsCtx.des`, est suivi à #1508.
 * @param {{ rel: string, text: string }[]} engineFiles @returns {Set<string>}
 */
export function engineDiceRollers(engineFiles) {
  const amorce = new Set(AMORCE_DES);
  /** @type {Map<string, { exported: boolean, calls: Set<string>, direct: boolean }>} */
  const decls = new Map();
  for (const { rel, text } of engineFiles) {
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      const fn = functionOf(node);
      if (fn) {
        const calls = new Set();
        let direct = false;
        const cv = (x) => {
          if (ts.isCallExpression(x)) {
            const e = x.expression;
            if (ts.isIdentifier(e)) { calls.add(e.text); if (amorce.has(e.text)) direct = true; }
            if (estAppelDeDe(x)) direct = true;
          }
          ts.forEachChild(x, cv);
        };
        cv(fn.body);
        decls.set(fn.name, { exported: fn.exported, calls, direct });
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sf, visit);
  }
  const roule = new Set();
  for (let changed = true; changed;) {
    changed = false;
    for (const [nom, d] of decls) {
      if (roule.has(nom)) continue;
      // La propagation ne franchit QUE des helpers module-locaux : un appelé EXPORTÉ est une frontière
      // que le call-site verrait lui-même, il n'a pas à contaminer son appelant.
      const viaLocal = [...d.calls].some((c) => roule.has(c) && decls.get(c) && !decls.get(c).exported);
      if (d.direct || viaLocal) { roule.add(nom); changed = true; }
    }
  }
  const out = new Set([...roule].filter((n) => decls.get(n).exported && !amorce.has(n)));
  return out;
}

/**
 * GARDE SŒUR (#1508) — TOUT DÉ TIRÉ HORS PORTE, dans un fichier consommateur (`src/state`, `src/ui`,
 * `src/data`, `src/scenes`). Un site = un APPEL, au MÊME socle AST que les familles ci-dessus :
 *  - une PRIMITIVE de dé (`AMORCE_DES`) appelée en direct ;
 *  - un `.int(` de RNG (`rng.int(1, 6)`, `battleRng().int(…)`) — la désignation « lequel ? » tire un
 *    dé comme le reste ; l'appel doit porter SA PLAGE (`estAppelDeDe` : au moins un argument, aucun
 *    littéral chaîne), ce qui écarte le `.int()` de schéma zod, qui ne tire pas ;
 *  - un export de `src/engine` derrière lequel le dé tombe sans franchir d’autre frontière exportée
 *    (`engineDiceRollers` ci-dessus).
 * La forme (S) « position de spec » garde son exclusion STRUCTURELLE (le callback d'une spec de flux
 * est exécuté PAR la fabrique du seam). La forme (M) ne s'applique PAS : elle blanchit un `d100(`
 * consommé en seuil ou en table, ce qui était exactement la taxonomie que #1508 annule — sous la
 * doctrine « tous les jets passent par le même point d'entrée », un seuil est un dé comme un autre.
 *
 * Un site est rendu UNE fois (dédupliqué par ligne + nom) : `roll` est à la fois primitive et amorce,
 * et un helper homonyme ne doit pas compter double.
 * @param {string} relPath @param {string} contenu @param {Iterable<string>} rollerNames
 * @returns {{ line: number, name: string }[]}
 */
export function scanDesHorsPorte(relPath, contenu, rollerNames) {
  const noms = new Set([...AMORCE_DES, ...rollerNames]);
  if (!DES_HORS_PORTE_RX.test(contenu) && !rollerNameRx(noms).test(contenu)) return [];
  const sf = ts.createSourceFile(
    relPath, contenu, ts.ScriptTarget.Latest, true,
    scriptKindDe(relPath),
  );
  // Un nom ne compte que s'il est IMPORTÉ DU MOTEUR dans CE fichier, et il compte sous son nom
  // D'ORIGINE. Les primitives de dé portent des noms courants (`roll`) : sans cette condition, les
  // sites d'UI où `roll` est le déclencheur local du flux (`AuContactModal`, `jetProps/*`,
  // `CascadeModal`…) compteraient comme des dés ; et sans la résolution d'ALIAS, un `d100 as des` ne
  // compterait pas du tout (cf. `importsDuMoteur`).
  const duMoteur = importsDuMoteur(sf);
  /** @type {Map<string, { line: number, name: string }>} */
  const vus = new Map();
  const visit = (node) => {
    if (ts.isCallExpression(node) && !inSpecCallback(node)) {
      const e = node.expression;
      const origine = ts.isIdentifier(e) ? duMoteur.get(e.text) : undefined;
      const nom = origine && noms.has(origine) ? origine : (estAppelDeDe(node) ? 'rng.int' : null);
      if (nom) {
        const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
        vus.set(`${line}:${nom}`, { line, name: nom });
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  return [...vus.values()].sort((a, b) => a.line - b.line || parUnitesDeCode(a.name, b.name));
}

/**
 * (D) partie 1 — DÉRIVE la liste des exports de `src/engine` qui roulent : corps appelant `rollTest(`/
 * `d100(` DIRECTEMENT, puis clôture TRANSITIVE (un export qui appelle un rouleur roule aussi). La
 * transitivité n'est pas un luxe : `resolveClash` ne roule qu'à travers `rollMightTest` — s'arrêter
 * au direct rate exactement le site fondateur de #1066. `rollTest`/`d100` eux-mêmes sont RETIRÉS de
 * la liste : leurs call-sites de `src/state` sont déjà la population du garde d'exclusivité.
 * @param {{ rel: string, text: string }[]} engineFiles
 * @returns {Map<string, { file: string, line: number }>} nom exporté → site de déclaration
 */
export function engineRollerExports(engineFiles, amorce = AMORCE_TEST) {
  /** @type {Map<string, { file: string, line: number, calls: Set<string>, exported: boolean }>} */
  const decls = new Map();
  for (const { rel, text } of engineFiles) {
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      const fn = functionOf(node);
      if (fn) {
        const calls = new Set();
        const cv = (x) => { if (ts.isCallExpression(x) && ts.isIdentifier(x.expression)) calls.add(x.expression.text); ts.forEachChild(x, cv); };
        cv(fn.body);
        decls.set(fn.name, { file: rel, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, calls, exported: fn.exported });
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sf, visit);
  }
  const rollers = new Set();
  for (let changed = true; changed;) {
    changed = false;
    for (const [name, d] of decls) {
      if (rollers.has(name)) continue;
      if ([...amorce].some((a) => d.calls.has(a)) || [...d.calls].some((c) => rollers.has(c))) { rollers.add(name); changed = true; }
    }
  }
  for (const a of amorce) rollers.delete(a);
  const out = new Map();
  for (const name of [...rollers].sort()) {
    const d = decls.get(name);
    if (d.exported) out.set(name, { file: d.file, line: d.line });
  }
  return out;
}

/**
 * (D) angle mort SURVEILLÉ — noms de fonctions déclarés dans PLUSIEURS fichiers de `src/engine`.
 * `engineRollerExports` indexe à plat (un nom = une entrée) : la DERNIÈRE déclaration lue écrase les
 * précédentes. Conséquence (#1066) : un homonyme non-rouleur peut faire SORTIR un
 * vrai rouleur de la liste — et avec lui toute sa clôture transitive. Le drapeau `rollsDirectly` est
 * donc lu sur CHAQUE déclaration, pas sur l'index collapsé : sinon la surveillance est aveugle au cas
 * même qu'elle prétend couvrir.
 * @param {{ rel: string, text: string }[]} engineFiles
 * @returns {Map<string, { files: string[], rollsDirectly: boolean }>} nom déclaré 2+ fois → sites
 */
export function engineHomonyms(engineFiles) {
  /** @type {Map<string, { files: Set<string>, rollsDirectly: boolean }>} */
  const byName = new Map();
  for (const { rel, text } of engineFiles) {
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      const fn = functionOf(node);
      if (fn) {
        let rolls = false;
        const cv = (x) => {
          if (ts.isCallExpression(x) && ts.isIdentifier(x.expression)
            && (x.expression.text === 'rollTest' || x.expression.text === 'd100')) rolls = true;
          ts.forEachChild(x, cv);
        };
        cv(fn.body);
        if (!byName.has(fn.name)) byName.set(fn.name, { files: new Set(), rollsDirectly: false });
        const e = byName.get(fn.name);
        e.files.add(rel);
        e.rollsDirectly ||= rolls;
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sf, visit);
  }
  const out = new Map();
  for (const [name, e] of byName) {
    if (e.files.size > 1) out.set(name, { files: [...e.files].sort(), rollsDirectly: e.rollsDirectly });
  }
  return out;
}

/** PRÉ-FILTRE lexical de (D) : un fichier qui ne CITE aucun nom de rouleur n'est jamais parsé. La
 *  regex est strictement plus large que le critère AST (un appel `nom(` cite `nom`), donc sans faux
 *  négatif. La clé du cache est le CONTENU du jeu de noms (triés, joints) : le `Set` de l'appelant
 *  est mutable, un nom qu'on y ajoute change la clé, donc la regex rendue. Cache de taille UN — les
 *  fichiers d'un scan partagent le même jeu de rouleurs dérivés, et rien ne s'accumule d'un scan au
 *  suivant.
 *  @type {{ cle: string, rx: RegExp } | null} */
let _rollerRx = null;
function rollerNameRx(names) {
  const cle = [...names].sort().join('\u0000');
  if (_rollerRx && _rollerRx.cle === cle) return _rollerRx.rx;
  const rx = new RegExp(`\\b(?:${alternationDe(names)})\\b`);
  _rollerRx = { cle, rx };
  return rx;
}

/**
 * (D) partie 2 — CALL-SITES d'un rouleur d'engine dans un fichier consommateur. La forme (S)
 * « position de spec » garde son exclusion STRUCTURELLE (le callback `resolve` d'une spec de flux est
 * exécuté PAR la fabrique du seam, que le dé soit brut ou délégué). La forme (M) « dé de monde » ne
 * s'applique pas : elle se lit sur la CONSOMMATION immédiate d'un `d100(`, qu'un helper nommé masque.
 * @param {string} relPath @param {string} contenu @param {Iterable<string>} rollerNames
 * @returns {{ line: number, name: string }[]}
 */
export function scanEngineDelegatedRoll(relPath, contenu, rollerNames) {
  const names = rollerNames instanceof Set ? rollerNames : new Set(rollerNames);
  if (!rollerNameRx(names).test(contenu)) return [];
  const sf = ts.createSourceFile(
    relPath, contenu, ts.ScriptTarget.Latest, true,
    scriptKindDe(relPath),
  );
  const findings = [];
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && names.has(node.expression.text) && !inSpecCallback(node)) {
      findings.push({ line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, name: node.expression.text });
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  findings.sort((a, b) => a.line - b.line);
  return findings;
}
