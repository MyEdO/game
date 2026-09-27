// QUARANTAINE d'import « rng vivant → résolveur moteur » (#370, ronde 2 du seam de jet). Le garde
// d'exclusivité (`rollSeamExclusivity.mjs`, #274) exempte TOUT `src/engine/**` au motif que « le
// moteur pur REÇOIT un rng sans jamais décider du surfaçage — c'est l'APPELANT (state/) qui choisit
// modale/MJ/inline ». Ce motif suppose que l'appelant, lui, PASSE PAR le seam (`openRoll`) — mais un
// flux state/** peut contourner l'hypothèse en appelant DIRECTEMENT un résolveur moteur importé
// (`../engine/...`) avec un rng VIVANT (`battleRng()`) au call-site : le résolveur roule ET décide de
// l'issue (Test opposé/étendu), sans jamais passer par la policy M/V/I. C'est EXACTEMENT le trou
// exploité par `tavernFlow.playTavernGame` → `resolveTavernGame(..., battleRng())` avant #370 — la
// classe, pas le cas : tout AUTRE flux state/** qui ferait la même chose doit être rouge ICI.
//
// Détection : repère les IMPORTS nommés depuis un module `engine/` (fonctions de résolution
// potentiellement « roule + décide »), puis les SITES D'APPEL de ces noms — au niveau du FICHIER
// entier (pas de la ligne) : si le même fichier appelle AUSSI `battleRng` quelque part (même via un
// rng hoisté dans une variable avant d'être repassé au résolveur), c'est la COEXISTENCE des deux qui
// est le signal — MAIS seulement pour les noms dont la SIGNATURE accepte réellement un `RNG` (#912
// affinage, ronde 3) : un résolveur PUR (`resolveOpposed`, `resolveTavernRound` — `TestResult,
// TestResult → issue`, aucun paramètre `RNG`) ne peut recevoir aucun générateur, vivant ou non ; le
// signaler par coexistence de fichier seule est un faux positif par construction (`portFlow.ts`/
// `tavernFlow.ts`, cf. `battleRngEngineLeakWhitelist.mjs`). Un fichier state/** NON listé dans la
// whitelist (`battleRngEngineLeakWhitelist.mjs`) qui matche un résolveur RNG-capable est un flux qui a
// contourné le seam. Module ESM pur (node nu), même patron que `weatherTestModQuarantine.mjs`/
// `batchNavalQuarantine.mjs` — la lecture de signature réutilise le MÊME socle AST (`typescript`,
// `ts.createSourceFile`) que `registryIdBranch.mjs`/`labelLogic.mjs`, aucun second socle.
//
// Critère de signature : un paramètre dont le TYPE référence l'identifiant `RNG` (`src/engine/dice.ts`),
// nu ou en union (`RNG | undefined`, paramètre optionnel avec valeur par défaut `= defaultRNG`).
// ANGLES MORTS assumés (faux négatifs préférés au bruit, cf. doctrine des gardes du dépôt) :
//  - un type ALIASÉ (`import type { RNG as Dice } from '...'; function f(x: Dice)`) — la comparaison
//    est TEXTUELLE sur le nom `RNG`, pas structurelle (pas de TypeChecker/Program ici) ;
//  - un paramètre SANS annotation explicite (`rng = defaultRNG`, type inféré par le compilateur) —
//    invisible à un scan lexical de l'AST syntaxique seul ;
//  - un import qui ne résout PAS vers un fichier direct (barrel `from '../engine'`, chemin calculé) :
//    dans ce cas précis, la garde bascule en FAIL-CLOSED (signale quand même) plutôt que d'exempter
//    silencieusement un résolveur qu'elle n'a pas pu lire — mesuré : au 2026-07-27, tous les imports
//    `resolveXxx` de `src/state/**` résolvent en un fichier direct (`../engine/<module>`), zéro barrel.
import tsModule from 'typescript';
import { scriptKindDe } from './dialecte.mjs';
// Vue CODE SEUL du texte (primitive PARTAGÉE) : les IMPORTS sont parsés AVANT sur le texte brut, et
// ce qui reste ne doit être QUE du code — un appel cité en commentaire ou en chaîne n'appelle rien,
// et les lignes sont préservées, donc les numéros rapportés restent ceux de la source.
import { codeSeul } from './codeSeul.mjs';

// Liaison LOCALE de l'API du compilateur — même FAIT mesuré qu'en tête de `sceneMutation.mjs`
// (2026-08-23) : sous Vitest, un `ts.x` de visiteur AST se relit sur l'objet d'import de vite-node.
const ts = tsModule;
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Échappe un nom pour usage en RegExp littérale. @param {string} s @returns {string} */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Collecte les imports nommés depuis un module dont le chemin contient `engine/`, RESTREINTS au
 * PATRON `resolveXxx` (convention du dépôt pour un résolveur de CONFRONTATION complète — Test opposé/
 * étendu, gagnant/DR : `resolveTavernGame`, `resolveMelee`, `resolveCasting`… — jamais une primitive
 * `rollXxx`/`testValue`/`effectiveChar` qui ne fait QUE lire une valeur). Restreindre au patron
 * `resolve*` est ce qui rend le scan PRÉCIS (zéro faux positif sur les lectures de valeur qui
 * partagent juste la ligne d'un `battleRng()` voisin).
 * @param {string} contenu @returns {{ name: string, modulePath: string }[]}
 */
function collectEngineImports(contenu) {
  const out = [];
  const rx = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = rx.exec(contenu)) !== null) {
    if (!/engine\//.test(m[2])) continue;
    for (const raw of m[1].split(',')) {
      const name = raw.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, '').trim();
      if (name && /^resolve[A-Z]/.test(name)) out.push({ name, modulePath: m[2] });
    }
  }
  return out;
}

/** Même collecte, réduite aux NOMS seuls (contrat public inchangé). @param {string} contenu @returns {string[]} */
export function collectEngineImportNames(contenu) {
  return collectEngineImports(contenu).map((e) => e.name);
}

/** Résout un spécificateur d'import RELATIF (`../engine/tests`) vers un fichier ABSOLU du dépôt, à
 *  partir du chemin (relatif racine) du fichier qui importe. `.ts`/`.tsx` directs uniquement (cf.
 *  angle mort barrel en en-tête). @param {string} fromRelPath @param {string} modulePath @returns {string|null} */
function resolveEngineFile(fromRelPath, modulePath) {
  const fromDir = dirname(fromRelPath.split('\\').join('/'));
  const base = join(fromDir, modulePath).split('\\').join('/');
  for (const ext of ['.ts', '.tsx']) {
    const candidate = join(ROOT, base + ext);
    if (existsSync(candidate)) return candidate;
  }
  const indexCandidate = join(ROOT, base, 'index.ts');
  if (existsSync(indexCandidate)) return indexCandidate;
  return null;
}

/** Le type référence-t-il (nu ou en union/intersection) l'identifiant `RNG` ? @param {import('typescript').TypeNode | undefined} t @returns {boolean} */
function typeReferencesRng(t) {
  if (!t) return false;
  if (ts.isParenthesizedTypeNode(t)) return typeReferencesRng(t.type);
  if (ts.isUnionTypeNode(t) || ts.isIntersectionTypeNode(t)) return t.types.some(typeReferencesRng);
  if (ts.isTypeReferenceNode(t)) {
    const nm = ts.isQualifiedName(t.typeName) ? t.typeName.right.text : t.typeName.text;
    return nm === 'RNG';
  }
  return false;
}

/** Retrouve les paramètres d'une fonction EXPORTÉE `name` (déclaration `function` ou `const` fléchée/
 *  expression) dans un SourceFile déjà parsé. null si non trouvée. @returns {import('typescript').NodeArray|null} */
function findFnParams(sf, name) {
  let params = null;
  const visit = (node) => {
    if (params) return;
    if (ts.isFunctionDeclaration(node) && node.name && node.name.text === name) { params = node.parameters; return; }
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.name.text === name && decl.initializer
          && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
          params = decl.initializer.parameters;
          return;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return params;
}

/** Contexte d'un PASSAGE de scan : AST des modules moteur lus (chemin absolu → SourceFile) et
 *  décisions déjà prises (clé composite → boolean). Objet de l'appelant, qui le passe à chaque
 *  fichier d'un même passage et le lâche ensuite (`tsProgram.mjs`, en-tête). */
export function contexteDeScanRng() {
  return { sources: new Map(), decisions: new Map() };
}

/** SourceFile TS du passage, par chemin absolu. @param {string} absPath */
function sourceFileFor(ctx, absPath) {
  let sf = ctx.sources.get(absPath);
  if (sf) return sf;
  const src = readFileSync(absPath, 'utf8');
  sf = ts.createSourceFile(absPath, src, ts.ScriptTarget.Latest, true, scriptKindDe(absPath));
  ctx.sources.set(absPath, sf);
  return sf;
}

/** La fonction moteur `name` importée depuis `modulePath` (relatif à `fromRelPath`) accepte-t-elle un
 *  `RNG` en paramètre ? FAIL-CLOSED (retourne `true`, donc « signaler ») si le fichier ou la fonction
 *  n'ont pas pu être résolus/trouvés — cf. angles morts en en-tête. @returns {boolean} */
function resolverAcceptsRng(ctx, fromRelPath, name, modulePath) {
  const key = `${fromRelPath}::${modulePath}::${name}`;
  const cached = ctx.decisions.get(key);
  if (cached !== undefined) return cached;
  const absPath = resolveEngineFile(fromRelPath, modulePath);
  let decision;
  if (!absPath) {
    decision = true;
  } else {
    const params = findFnParams(sourceFileFor(ctx, absPath), name);
    decision = params === null ? true : params.some((p) => typeReferencesRng(p.type));
  }
  ctx.decisions.set(key, decision);
  return decision;
}

/**
 * Scan complet d'un fichier, à l'échelle du FICHIER (pas de la ligne) : si le fichier appelle AU
 * MOINS UNE FOIS `battleRng` (n'importe où — y compris hoisté dans une variable réutilisée plus
 * loin) ET appelle AU MOINS UNE FOIS un nom importé d'`engine/` au patron `resolveXxx` DONT LA
 * SIGNATURE ACCEPTE UN `RNG` (cf. `resolverAcceptsRng`), chaque site d'appel `resolveXxx(` est une
 * violation — la coexistence des deux capacités dans le même fichier est le signal, pas leur ligne
 * commune (le hoisting `const rng = battleRng(); resolveX(rng)` contourne sinon la détection). Un
 * résolveur importé dont la signature ne prend PAS de `RNG` (`resolveOpposed`, `resolveTavernRound`)
 * ne produit AUCUNE violation, quelle que soit la coexistence de fichier.
 *
 * CONTRAT du texte scanné (#1788) : le scan porte sur la vue CODE SEUL (`codeSeul.mjs`) —
 * commentaires ET littéraux de chaîne blanchis. Un appel écrit DANS une chaîne n'est donc PAS un
 * appel : c'est une donnée, elle n'appelle rien, et le scan ne la voit pas. Le filtre de ligne
 * `^\s*import` (:199) n'en souffre pas — il ne lit que le mot-clé, que le blanchiment laisse intact.
 * Ce que ce contrat coûte et ce qu'il garde est mesuré par les deux cas #1788 de
 * `src/state/roll-seam-exclusivity-guard.test.ts`.
 * @param {string} relPath @param {string} contenu
 * @param {{ sources: Map<string, ts.SourceFile>, decisions: Map<string, boolean> }} [ctx] passage
 *   partagé (`contexteDeScanRng`) ; absent, un passage pour CET appel
 * @returns {{ line: number, name: string, detail: string }[]}
 */
export function scanBattleRngEngineLeak(relPath, contenu, ctx = contexteDeScanRng()) {
  const engineImports = collectEngineImports(contenu);
  if (engineImports.length === 0) return [];
  const stripped = codeSeul(contenu);
  if (!/\bbattleRng\s*\(/.test(stripped)) return [];
  const findings = [];
  const lines = stripped.split('\n');
  for (const { name, modulePath } of engineImports) {
    if (!resolverAcceptsRng(ctx, relPath, name, modulePath)) continue;
    const callRx = new RegExp(`\\b${escapeRegex(name)}\\s*\\(`);
    lines.forEach((line, i) => {
      if (/^\s*import/.test(line)) return;
      if (callRx.test(line)) {
        findings.push({ line: i + 1, name, detail: line.trim() });
      }
    });
  }
  return findings;
}
