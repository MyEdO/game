// Mécanique de scan du garde-fou « le moteur ne ROULE pas le nœud qu'il LIT » (#1657 train B3).
//
// Le garde d'exclusivité du seam (`rollSeamExclusivity.mjs`, #274) exempte TOUT `src/engine/**` de
// principe, et `docs/registre-jets.md` écrit la condition de cette exemption : « `rollSeamExcluded`
// exempte `src/engine/**` de principe (le moteur reçoit un rng, il ne décide pas du surfaçage) — CE
// QUI SUPPOSE QUE L'APPELANT PASSE PAR LE SEAM. » `battleRngEngineLeak.mjs` (#370) a fermé la moitié
// APPELANT du trou (un flux `state/**` qui remet un rng vivant à un résolveur moteur). Ce module ferme
// la moitié DONNÉE : un nœud `test` (`FlowTestNode`, `src/engine/flowCore.ts`) est la forme UNIQUE du
// jet en donnée ; un moteur qui LIT ce nœud le REND (patron `miscast.mkTest` → `MiscastResult.testFlow`
// → `runCombatFlow`) ou le DIFFÈRE (patron `UpkeepDeferTest`) — il ne le roule pas, sinon l'issue est
// décidée hors de toute fenêtre de joueur (ni Chance, ni Pacte, ni Résilience).
//
// Socle AST partagé (`typescript`, `ts.createSourceFile`) — MÊME parseur que `rollSeamExclusivity.mjs`
// et `battleRngEngineLeak.mjs`, aucun second socle ; la clôture transitive du roulage reprend
// l'algorithme de point fixe d'`engineRollerExports` (section (D) du registre des chemins de jet).
//
// CRITÈRES (deux, conjoints) — un site n'est rendu que si les deux tiennent :
//
//  (L) MANIPULATION du nœud. Une fonction MANIPULE un `FlowTest`/`FlowTestNode` si
//      (a) l'un de ses paramètres, ou l'une des déclarations ANNOTÉES de son corps, porte un type
//          qui référence `FlowTest`, `FlowTestNode`, `CritTestNode` ou `ShipCrewHit` (nu,
//          optionnel, en union) — la FABRIQUE compte au même titre que la lecture : forger le nœud
//          ET décider de son issue est la même faute que lire le nœud et le rouler ; ou
//      (b) son corps accède à un champ de `FlowTest` À TRAVERS la propriété `test` du nœud
//          (`x.test.difficulty`, `x.test.skill`, `x.test.characteristic`…).
//      Le simple passage du nœud en argument (`f(entry.test)`) n'est PAS une manipulation : c'est le
//      transport, et c'est précisément ce que la forme cible fait (le producteur rend le nœud).
//
//  (R) ROULAGE. `rollTest(` / `d100(` / `TestOutcome.seal(` appelés dans le corps, OU appel d'une
//      fonction de `src/engine/**` qui roule (clôture transitive — s'arrêter au direct raterait le
//      délégué, exactement comme pour `resolveClash` → `rollMightTest`).
//
// DEUX FAMILLES rendues, qui meurent ensemble avec le stock :
//  - `lecteur`  : le site de roulage lui-même, dans le corps d'une fonction qui lit le nœud ;
//  - `appelant` : le site d'appel, ailleurs dans `src/engine/**`, d'une fonction `lecteur` — c'est
//    par là que la lecture-roulage remonte au résolveur qui l'emploie (`applyHullCritical` →
//    `applyCrewHit`). Sans cette famille, supprimer l'appel ne serait mesuré nulle part.
//
// FORMES LÉGITIMES, vertes par CONSTRUCTION (le critère sépare, il ne liste pas) :
//  - `miscast.ts` `mkTest` FABRIQUE le nœud (`poserEnjeu` nomme son enjeu) et le REND — (R) faux ;
//  - `riverNavigation.ts` `opsDuCoup(hit: ShipCrewHit)` LIT le nœud par (a) et n'en tire aucun dé —
//    (R) faux ;
//  - un résolveur qui roule SES PROPRES dés (le d100 de sévérité de `resolveCritique`) sans lire de
//    nœud reste vert : (L) est faux pour lui, et la donnée qu'il transporte n'est pas une lecture.
//
// ANGLE MORT STRUCTUREL, celui qui a coûté (#1657 B3-1b) : un rouleur qui lit une FORME PROPRIÉTAIRE.
// `NODE_TYPES` nomme les types du NŒUD canonique ; une fonction qui roule un jet décrit par un type
// PROPRE au domaine (`Amputation` : `{difficulty, sequels, loss}` — 28 Tests de Résistance, LDB 18
// l.237) satisfait (R) mais jamais (L), et la garde rendait 7 sites là où le moteur en roulait 9. Le
// remède n'est PAS d'élargir `NODE_TYPES` (une liste de formes propriétaires est un registre qui
// grandit) : c'est de faire MOURIR la forme propriétaire — ce que B3-1b a fait, le type `Amputation`
// cessant de décrire un jet au profit du nœud `test` canonique. L'angle mort reste ENTIER pour toute
// forme propriétaire NEUVE : la garde ne peut pas voir un jet qui refuse le vocabulaire commun, et
// c'est le contrat de forme (`flowtest-derived-stake.test.ts`, `docs/registre-jets.md`) qui l'attrape.
//
// ANGLES MORTS assumés (faux négatifs préférés au bruit — doctrine des gardes du dépôt) :
//  - type ALIASÉ à l'import (`import type { FlowTestNode as N }`) : la comparaison est textuelle sur
//    le nom, pas structurelle (pas de TypeChecker ici — même angle mort que `battleRngEngineLeak`) ;
//  - paramètre SANS annotation (type inféré) : invisible à un scan de l'AST syntaxique seul ;
//  - import RENOMMÉ du rouleur (`import { d100 as des }`) : le motif est reconnu au nom APPELÉ ;
//  - homonymes de fonctions entre fichiers de `src/engine/**` : le drapeau « roule » est agrégé en OU
//    sur toutes les déclarations d'un même nom (fail-closed), jamais écrasé par la dernière lue ;
//  - PORTEURS de code que `functionOf` ne connaît pas (extraction partagée avec
//    `rollSeamExclusivity.mjs`) : méthode de classe (`MethodDeclaration`), méthode raccourcie d'un
//    littéral d'objet, et 2ᵉ..Nᵉ déclarateur d'un `const a = …, b = () => …`. Leur corps est lu
//    comme celui de la fonction ENGLOBANTE quand il y en a une (fail-closed) ; au niveau module, il
//    ne l'est pas. Mesuré au 2026-09-02 : `src/engine/**` ne déclare aucun rouleur sous ces formes —
//    0 morsure perdue. Les couvrir se fait AU SOCLE, pour les trois gardes à la fois, jamais ici seul.
import tsModule from 'typescript';
import { parUnitesDeCode } from './lister.mjs'

// Liaison LOCALE de l'API du compilateur — même FAIT mesuré qu'en tête de `rollSeamExclusivity.mjs`
// (2026-08-23) : sous Vitest, un `ts.x` de visiteur AST se relit sur l'objet d'import de vite-node.
const ts = tsModule;

/** Types dont un paramètre annoncé FAIT du corps un lecteur de nœud (critère (L)(a)). @type {Set<string>} */
const NODE_TYPES = new Set(['FlowTest', 'FlowTestNode', 'CritTestNode', 'ShipCrewHit']);

/** Champs de `FlowTest` (`src/engine/flowCore.ts`) — leur accès À TRAVERS `.test` est la lecture du
 *  nœud (critère (L)(b)). @type {Set<string>} */
const FLOWTEST_FIELDS = new Set([
  'skill', 'characteristic', 'difficulty', 'difficultyBy', 'requireSL', 'sense', 'stake', 'gate',
  'opposed', 'menace', 'noSupport', 'tool', 'argDifficulty', 'unlessImmune', 'onlyGroups',
  'exceptGroups', 'vsGroups', 'vsStatus', 'begging', 'vsCapricieux', 'easierIf',
]);

/** Motifs de roulage BRUT — les mêmes trois que `ROLL_SEAM_RX` (le seam et ce garde nomment le même
 *  forgeage d'issue). @type {Set<string>} */
const RAW_ROLLERS = new Set(['rollTest', 'd100']);

/** Nom appelé d'une CallExpression (`f(…)`, `o.f(…)` → `f`). @returns {string|null} */
function calleeName(call) {
  const e = call.expression;
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  return null;
}

/** Le nœud d'appel est-il un roulage brut ? Rend son motif, sinon null. @returns {string|null} */
function rawRollKind(node) {
  if (!ts.isCallExpression(node)) return null;
  const e = node.expression;
  if (ts.isIdentifier(e) && RAW_ROLLERS.has(e.text)) return e.text;
  if (ts.isPropertyAccessExpression(e) && e.name.text === 'seal'
    && ts.isIdentifier(e.expression) && e.expression.text === 'TestOutcome') return 'TestOutcome.seal';
  return null;
}

/** Le type référence-t-il (nu, optionnel, en union/intersection, en générique) un type de nœud ?
 *  @param {import('typescript').TypeNode | undefined} t @returns {boolean} */
function typeReferencesNode(t) {
  if (!t) return false;
  if (ts.isParenthesizedTypeNode(t)) return typeReferencesNode(t.type);
  if (ts.isUnionTypeNode(t) || ts.isIntersectionTypeNode(t)) return t.types.some(typeReferencesNode);
  if (ts.isArrayTypeNode(t)) return typeReferencesNode(t.elementType);
  if (ts.isTypeReferenceNode(t)) {
    const nm = ts.isQualifiedName(t.typeName) ? t.typeName.right.text : t.typeName.text;
    if (NODE_TYPES.has(nm)) return true;
    return (t.typeArguments ?? []).some(typeReferencesNode);
  }
  return false;
}

/** Fonction (déclaration ou `const f = (…) => …`) portée par ce nœud, sinon null. MÊME extraction que
 *  `rollSeamExclusivity.functionOf`. @returns {{ name, params, body, decl }|null} */
function functionOf(node) {
  if (ts.isFunctionDeclaration(node) && node.name && node.body) {
    return { name: node.name.text, params: node.parameters, body: node.body, decl: node };
  }
  if (ts.isVariableStatement(node)) {
    const d = node.declarationList.declarations[0];
    if (d && ts.isIdentifier(d.name) && d.initializer
      && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) {
      return { name: d.name.text, params: d.initializer.parameters, body: d.initializer.body, decl: node };
    }
  }
  return null;
}

/** Le corps DÉCLARE-t-il une valeur ANNOTÉE d'un type de nœud (critère (L)(a), volet fabrique) ?
 *  @returns {boolean} */
function bodyDeclaresNode(body) {
  let found = false;
  const visit = (n) => {
    if (found) return;
    if (ts.isVariableDeclaration(n) && typeReferencesNode(n.type)) { found = true; return; }
    ts.forEachChild(n, visit);
  };
  visit(body);
  return found;
}

/** Le corps accède-t-il à un champ de `FlowTest` à travers `.test` (critère (L)(b)) ? @returns {boolean} */
function bodyReadsThroughTest(body) {
  let found = false;
  const visit = (n) => {
    if (found) return;
    // `<expr>.test.<champ de FlowTest>` — le maillon `.test` est la propriété du NŒUD.
    if (ts.isPropertyAccessExpression(n) && FLOWTEST_FIELDS.has(n.name.text)) {
      let inner = n.expression;
      while (ts.isNonNullExpression(inner) || ts.isParenthesizedExpression(inner)) inner = inner.expression;
      if (ts.isPropertyAccessExpression(inner) && inner.name.text === 'test') { found = true; return; }
    }
    ts.forEachChild(n, visit);
  };
  visit(body);
  return found;
}

/**
 * Déclarations de fonctions de `src/engine/**` : lecture de nœud, roulage direct, appels sortants,
 * et sites (roulages bruts + appels) pour le rapport.
 * @param {{ rel: string, text: string }[]} engineFiles
 */
function collectDecls(engineFiles) {
  /** @type {{ name, file, line, reads, rollsDirectly, calls: Set<string>, rollSites, callSites }[]} */
  const decls = [];
  for (const { rel, text } of engineFiles) {
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      const fn = functionOf(node);
      if (fn) {
        const calls = new Set();
        const rollSites = [];
        const callSites = [];
        const cv = (x) => {
          if (ts.isCallExpression(x)) {
            const nom = calleeName(x);
            const ligne = sf.getLineAndCharacterOfPosition(x.getStart(sf)).line + 1;
            const kind = rawRollKind(x);
            if (kind) rollSites.push({ line: ligne, name: kind, detail: x.getText(sf).replace(/\s+/g, ' ').trim() });
            if (nom) {
              calls.add(nom);
              callSites.push({ line: ligne, name: nom, detail: x.getText(sf).replace(/\s+/g, ' ').trim() });
            }
          }
          ts.forEachChild(x, cv);
        };
        cv(fn.body);
        decls.push({
          name: fn.name,
          file: rel,
          line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
          reads: fn.params.some((p) => typeReferencesNode(p.type))
            || bodyDeclaresNode(fn.body) || bodyReadsThroughTest(fn.body),
          rollsDirectly: rollSites.length > 0,
          calls,
          rollSites,
          callSites,
        });
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sf, visit);
  }
  return decls;
}

/**
 * Noms de fonctions de `src/engine/**` qui ROULENT — direct puis clôture TRANSITIVE par point fixe.
 * Le drapeau est agrégé en OU par NOM (homonymes entre fichiers : fail-closed).
 * @param {ReturnType<typeof collectDecls>} decls @returns {Set<string>}
 */
function rollingNames(decls) {
  /** @type {Map<string, { rolls: boolean, calls: Set<string> }>} */
  const byName = new Map();
  for (const d of decls) {
    if (!byName.has(d.name)) byName.set(d.name, { rolls: false, calls: new Set() });
    const e = byName.get(d.name);
    e.rolls ||= d.rollsDirectly;
    for (const c of d.calls) e.calls.add(c);
  }
  const rollers = new Set();
  for (const [name, e] of byName) if (e.rolls) rollers.add(name);
  for (let changed = true; changed;) {
    changed = false;
    for (const [name, e] of byName) {
      if (rollers.has(name)) continue;
      if ([...e.calls].some((c) => rollers.has(c))) { rollers.add(name); changed = true; }
    }
  }
  return rollers;
}

/**
 * SCAN complet : les sites de `src/engine/**` où un nœud `test` LU est ROULÉ, et les sites qui
 * appellent une telle fonction. Rendu TRIÉ (fichier, ligne, famille, nom) — ordre TOTAL, donc
 * identique d'une machine à l'autre quel que soit l'ordre de marche du corpus.
 * `fnLine` = ligne de DÉCLARATION de `fn` : un doc généré qui NOMME le résolveur doit citer la ligne
 * où ce nom se lit (le symbole backtiqué se trouve à ±2 lignes du site cité), tandis que le CLIQUET reste sur
 * `line`, le site du dé. Les deux voyagent donc ensemble.
 * @param {{ rel: string, text: string }[]} engineFiles corpus `src/engine/**` (hors tests)
 * @returns {{ file: string, line: number, fn: string, fnLine: number, famille: 'lecteur'|'appelant', name: string, detail: string }[]}
 */
export function scanFlowTestEngineRoll(engineFiles) {
  const decls = collectDecls(engineFiles);
  const rollers = rollingNames(decls);
  // Une fonction est en FAUTE si elle lit le nœud ET roule (directement ou par délégation).
  const fautives = decls.filter((d) => d.reads && (d.rollsDirectly || [...d.calls].some((c) => rollers.has(c))));
  const nomsFautifs = new Set(fautives.map((d) => d.name));
  const out = [];
  for (const d of fautives) {
    for (const s of d.rollSites) out.push({ file: d.file, line: s.line, fn: d.name, fnLine: d.line, famille: 'lecteur', name: s.name, detail: s.detail });
    for (const s of d.callSites) {
      if (rollers.has(s.name) && !RAW_ROLLERS.has(s.name)) {
        out.push({ file: d.file, line: s.line, fn: d.name, fnLine: d.line, famille: 'lecteur', name: s.name, detail: s.detail });
      }
    }
  }
  // Famille `appelant` : ailleurs dans le moteur, l'appel d'une fonction fautive.
  for (const d of decls) {
    if (nomsFautifs.has(d.name)) continue;
    for (const s of d.callSites) {
      if (nomsFautifs.has(s.name)) out.push({ file: d.file, line: s.line, fn: d.name, fnLine: d.line, famille: 'appelant', name: s.name, detail: s.detail });
    }
  }
  out.sort((a, b) => parUnitesDeCode(a.file, b.file) || a.line - b.line || parUnitesDeCode(a.famille, b.famille) || parUnitesDeCode(a.name, b.name));
  return out;
}

/** Forme NOMINATIVE d'un site, pour la baseline et les messages : `fichier:ligne [famille fn → nom]`.
 *  @param {{ file: string, line: number, fn: string, famille: string, name: string }} s @returns {string} */
export function siteLabel(s) {
  return `${s.file}:${s.line} [${s.famille} ${s.fn} → ${s.name}]`;
}
