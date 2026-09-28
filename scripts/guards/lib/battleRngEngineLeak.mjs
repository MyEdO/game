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
// Détection par `estAppelDeclare` (`canonUnique.mjs`) : au niveau du FICHIER entier (pas de la ligne),
// si le fichier appelle `battleRng` IMPORTÉ de `src/state/battleRng.ts` (même hoisté dans une variable
// avant d'être repassé au résolveur), c'est la COEXISTENCE des deux qui est le signal — et chaque appel
// lié à un résolveur de `src/engine` dont la SIGNATURE accepte un `RNG` est une violation (#912
// affinage, ronde 3) : un résolveur PUR (`resolveOpposed`, `resolveTavernRound` — `TestResult,
// TestResult → issue`, aucun paramètre `RNG`) ne peut recevoir aucun générateur, vivant ou non ; le
// signaler par coexistence de fichier seule est un faux positif par construction (`portFlow.ts`/
// `tavernFlow.ts`, cf. `battleRngEngineLeakWhitelist.mjs`). Un fichier state/** NON listé dans la
// whitelist (`battleRngEngineLeakWhitelist.mjs`) qui matche un résolveur RNG-capable est un flux qui a
// contourné le seam. Import renommé et appel `ns.f` comptent, sous le nom EXPORTÉ ; un homonyme local
// non importé ne compte pas.
//
// Critère de signature : un paramètre dont le TYPE référence l'identifiant `RNG` (`src/engine/dice.ts`),
// nu ou en union (`RNG | undefined`, paramètre optionnel avec valeur par défaut `= defaultRNG`).
// ANGLES MORTS (faux négatifs préférés au bruit, cf. doctrine des gardes du dépôt) :
//  - un type ALIASÉ (`import type { RNG as Dice } from '...'; function f(x: Dice)`) — la comparaison
//    est TEXTUELLE sur le nom `RNG`, pas structurelle (pas de TypeChecker/Program ici) ;
//  - un paramètre SANS annotation explicite (`rng = defaultRNG`, type inféré par le compilateur) —
//    invisible à un scan lexical de l'AST syntaxique seul ;
//  - une réexportation `export * from` (angle mort de `tableDesExports`).
import tsModule from 'typescript';
import { ast } from './dialecte.mjs';
import { estAppelDeclare, tableDesExports } from './canonUnique.mjs';
import { readCorpus } from './sourceCorpus.mjs';
// Vue CODE SEUL du texte (primitive PARTAGÉE) : la ligne rapportée ne porte que du code, lignes
// préservées, donc les numéros rapportés restent ceux de la source.
import { codeSeul } from './codeSeul.mjs';

// Liaison LOCALE de l'API du compilateur — même FAIT mesuré qu'en tête de `sceneMutation.mjs`
// (2026-08-23) : sous Vitest, un `ts.x` de visiteur AST se relit sur l'objet d'import de vite-node.
const ts = tsModule;

/** Le `battleRng` vivant, par son module. */
const RNG_VIVANT = { 'src/state/battleRng.ts': ['battleRng'] };

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

/** Contexte d'un PASSAGE de scan : la table des résolveurs à RNG (`resolveursARng`), bâtie au premier
 *  fichier qui la demande. Objet de l'appelant, qui le passe à chaque fichier d'un même passage et le
 *  lâche ensuite (`tsProgram.mjs`, en-tête).
 *  @returns {{ resolveurs: Record<string, string[]> | null }} */
export function contexteDeScanRng() {
  return { resolveurs: null };
}

/**
 * TABLE des résolveurs à RNG : `tableDesExports` des fichiers de `src/engine` hors fichiers Vitest, lus
 * au premier appel du passage, restreinte aux exports `resolve[A-Z]…` dont un paramètre est typé `RNG`
 * sur la déclaration (réexportations comprises, par leur nom d'origine).
 * @param {{ resolveurs: Record<string, string[]> | null }} ctx
 * @returns {Record<string, string[]>}
 */
function resolveursARng(ctx) {
  if (ctx.resolveurs) return ctx.resolveurs;
  const moteur = readCorpus(['src/engine']);
  const exporte = (n) => n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  const noms = new Set();
  for (const fichier of moteur) {
    for (const st of ast(fichier).statements) {
      /** @type {[string, import('typescript').NodeArray<import('typescript').ParameterDeclaration>][]} */
      const decls = [];
      if (ts.isFunctionDeclaration(st) && st.name && exporte(st)) decls.push([st.name.text, st.parameters]);
      if (ts.isVariableStatement(st) && exporte(st)) {
        for (const d of st.declarationList.declarations) {
          if (ts.isIdentifier(d.name) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) decls.push([d.name.text, d.initializer.parameters]);
        }
      }
      for (const [nom, params] of decls) if (/^resolve[A-Z]/.test(nom) && params.some((p) => typeReferencesRng(p.type))) noms.add(nom);
    }
  }
  return (ctx.resolveurs = tableDesExports(moteur, noms));
}

/**
 * Scan complet d'un fichier, à l'échelle du FICHIER (pas de la ligne) : si le fichier appelle AU
 * MOINS UNE FOIS `battleRng` importé (n'importe où — y compris hoisté dans une variable réutilisée
 * plus loin), chaque appel qu'`estAppelDeclare` lie à un résolveur à RNG (`resolveursARng`) est une
 * violation, dédupliquée par ligne et nom — la coexistence des deux capacités dans le même fichier
 * est le signal, pas leur ligne commune (le hoisting `const rng = battleRng(); resolveX(rng)`
 * contourne sinon la détection). Un résolveur importé dont la signature ne prend PAS de `RNG`
 * (`resolveOpposed`, `resolveTavernRound`) ne produit AUCUNE violation.
 *
 * CONTRAT (#1788) : un appel écrit DANS une chaîne ou un commentaire n'est pas un nœud d'appel, le scan
 * ne le voit pas ; `detail` est la ligne de la vue CODE SEUL (`codeSeul.mjs`). Ce que ce contrat
 * garde est mesuré par les deux cas #1788 de `src/state/roll-seam-exclusivity-guard.test.ts`.
 * @param {string} relPath @param {string} contenu
 * @param {{ resolveurs: Record<string, string[]> | null }} [ctx] contexte du passage (`contexteDeScanRng`)
 * @returns {{ line: number, name: string, detail: string }[]}
 */
export function scanBattleRngEngineLeak(relPath, contenu, ctx = contexteDeScanRng()) {
  if (!/\bbattleRng\b/.test(contenu) || !/\bresolve[A-Z]/.test(contenu)) return [];
  const sf = ast({ rel: relPath, text: contenu });
  const table = resolveursARng(ctx);
  /** @type {{ line: number, name: string }[]} */
  const appels = [];
  let vivant = false;
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      if (estAppelDeclare(node, sf, RNG_VIVANT)) vivant = true;
      const name = estAppelDeclare(node, sf, table);
      if (name) appels.push({ line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, name });
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  if (!vivant) return [];
  const lignes = codeSeul(contenu).split('\n');
  /** @type {Map<string, { line: number, name: string, detail: string }>} */
  const vus = new Map();
  for (const a of appels) vus.set(`${a.line}:${a.name}`, { ...a, detail: lignes[a.line - 1].trim() });
  return [...vus.values()];
}
