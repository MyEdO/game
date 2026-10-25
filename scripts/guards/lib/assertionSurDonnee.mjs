/**
 * ASSERTION FIGÉE SUR LA DONNÉE (#2995) : une assertion de test dont le SUJET dérive de la donnée réelle
 * et dont l'ATTENDU est un littéral. Motifs :
 *  - `compte` : `toHaveLength(N)` ; `toBe(N)`, `toEqual(N)`, `toStrictEqual(N)` sur un `.length`/`.size` ;
 *    `toEqual({ k: N, … })`, `toStrictEqual({ k: N, … })` (objet de comptes) ;
 *  - `liste` : `toEqual([…littéraux])`, `toStrictEqual([…littéraux])`, non vide (`[]` est une liste d'écarts) ;
 *  - `snapshot` : `toMatchSnapshot`, `toMatchInlineSnapshot`.
 *
 * « Dérive de la donnée » suit le FLUX DES IMPORTS, sans aucun nom de dataset ni de variable écrit ici :
 *  - source BRUTE : un import de VALEUR d'un JSON de `src/data/` ou d'un de ses registres `*.generated` ;
 *  - un import d'un autre module est une source si l'export lu y est une constante dont l'initialiseur dérive
 *    d'une source, suivi de proche en proche par `lireModule` (re-exports compris) ; sous `src/data/`, une
 *    fonction exportée dont le corps lit une source est un CHARGEUR (`findXById`), donc une source, et la
 *    dérivation y traverse les appels (un chargeur se bâtit par des aides : `indexParId`) ;
 *  - dans le fichier analysé, la dérivation suit les déclarations locales par PORTÉE (pas par nom) :
 *    initialiseur d'une variable (déstructuration comprise), itérable d'un `for…of`/`for…in`, corps d'une
 *    fonction locale, paramètres d'un rappel passé à une méthode d'un receveur dérivé, arguments d'une
 *    mutation (`s.add(x)`, `xs.push(x)`).
 * Une fonction hors `src/data/`, ou qui n'y lit aucune source (schéma, analyseur), n'est pas une source : sa
 * sortie, sur fixture comme sur une entrée, est une sortie de règle.
 *
 * `portee` : `ensemble` quand le sujet passe par l'ensemble (la source elle-même, un `.map`/`.filter`/…,
 * `Object.keys`…), sinon `entree` (une entrée lue de la donnée).
 *
 * ANGLE MORT : un appel d'une fonction liée non dérivée arrête la dérivation, même nourri de tout l'ensemble
 * (`compter(tables)`) ; `assert.*` de `node:assert` n'est pas lu ; un module importé par espace de noms (`import * as m`)
 * n'est une source que sous `src/data/` ; une donnée qui arrive par un rendu (`renderToStaticMarkup`) ou par un
 * appel de fonction d'un module non-donnée n'est pas suivie.
 */
import { posix } from 'node:path';
import { ast, typescript } from './dialecte.mjs';

const RACINE_DONNEE = 'src/data';
const MATCHERS_COMPTE_SCALAIRE = new Set(['toBe', 'toEqual', 'toStrictEqual']);
const MATCHERS_STRUCTURE = new Set(['toEqual', 'toStrictEqual']);
const MATCHERS_SNAPSHOT = new Set(['toMatchSnapshot', 'toMatchInlineSnapshot']);
const MODIFICATEURS = new Set(['not', 'resolves', 'rejects']);
const CARDINAUX = new Set(['length', 'size']);
const MUTATEURS = new Set(['push', 'unshift', 'add', 'set']);
const OPERATIONS_D_ENSEMBLE = new Set(['map', 'filter', 'flatMap', 'reduce', 'keys', 'values', 'entries', 'from', 'sort', 'toSorted', 'slice', 'concat', 'flat']);

/** Chemin résolu d'un spécificateur depuis `depuis` (relatif ou alias `@/`), sans extension connue ; `null` pour un paquet. */
export function cheminDuSpecificateur(depuis, specificateur) {
  let brut;
  if (specificateur.startsWith('@/')) brut = posix.join('src', specificateur.slice(2));
  else if (specificateur.startsWith('.')) brut = posix.join(posix.dirname(depuis.replaceAll('\\', '/')), specificateur);
  else return null;
  return posix.normalize(brut).replace(/\.(d\.)?(m|c)?(t|j)sx?$/, '');
}

/** Couche de donnée : ses fonctions qui lisent une source sont des CHARGEURS (`findXById`), donc des sources. */
const sousDonnee = (chemin) => chemin === RACINE_DONNEE || chemin.startsWith(`${RACINE_DONNEE}/`);
/** Source BRUTE : un JSON de la couche de donnée, ou un de ses registres générés. */
const estDonnee = (chemin) => sousDonnee(chemin) && (chemin.endsWith('.json') || chemin.endsWith('.generated'));

const ligneDe = (sf, n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
const texteDe = (sf, n) => n.getText(sf).replace(/\s+/g, ' ').trim();

/** Noms liés par un nom de liaison (identifiant ou motif de déstructuration). */
function nomsLies(nom, acc = []) {
  const ts = typescript();
  if (ts.isIdentifier(nom)) acc.push(nom);
  else if (ts.isObjectBindingPattern(nom) || ts.isArrayBindingPattern(nom)) {
    for (const el of nom.elements) if (ts.isBindingElement(el) && el.name) nomsLies(el.name, acc); // un trou `[, b]` n'a pas de nom
  }
  return acc;
}

const estFonction = (n) => {
  const ts = typescript();
  return ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n)
    || ts.isConstructorDeclaration(n) || ts.isGetAccessorDeclaration(n) || ts.isSetAccessorDeclaration(n);
};

/**
 * Analyse de dérivation d'un arbre : la table des liaisons (portée + nom) et l'ensemble de celles qui
 * dérivent de la donnée. `sourceDImport(decl)` dit si une liaison d'import est une source.
 */
function analyseDeDerivation(sf, sourceDImport, { regles = true } = {}) {
  const ts = typescript();
  /** @type {Map<any, Map<string, any>>} conteneur → nom → identifiant déclarant */
  const portees = new Map();
  /** @type {{ ids: any[], source: () => any, import?: any }[]} */
  const liaisons = [];
  const declarer = (conteneur, id) => {
    if (!portees.has(conteneur)) portees.set(conteneur, new Map());
    portees.get(conteneur).set(id.text, id);
  };
  const conteneurDeBloc = (n) => {
    let p = n.parent;
    while (p && !(ts.isBlock(p) || ts.isSourceFile(p) || ts.isModuleBlock(p) || ts.isCaseBlock(p) || estFonction(p)
      || ts.isForStatement(p) || ts.isForOfStatement(p) || ts.isForInStatement(p) || ts.isCatchClause(p))) p = p.parent;
    return p;
  };

  const mutations = [];
  const recense = (n) => {
    if (ts.isImportDeclaration(n) && n.importClause && !n.importClause.isTypeOnly) {
      const ic = n.importClause;
      const ajoute = (id, nomExporte) => {
        declarer(sf, id);
        liaisons.push({ ids: [id], source: null, import: { specificateur: n.moduleSpecifier.text, nomExporte } });
      };
      if (ic.name) ajoute(ic.name, 'default');
      if (ic.namedBindings && ts.isNamespaceImport(ic.namedBindings)) ajoute(ic.namedBindings.name, '*');
      if (ic.namedBindings && ts.isNamedImports(ic.namedBindings)) {
        for (const el of ic.namedBindings.elements) if (!el.isTypeOnly) ajoute(el.name, (el.propertyName ?? el.name).text);
      }
    } else if (ts.isVariableDeclaration(n)) {
      const liste = n.parent;
      const porteur = liste?.parent;
      const ids = nomsLies(n.name);
      if (porteur && (ts.isForOfStatement(porteur) || ts.isForInStatement(porteur))) {
        for (const id of ids) declarer(porteur, id);
        liaisons.push({ ids, source: porteur.expression, element: true });
      } else {
        const conteneur = porteur && ts.isForStatement(porteur) ? porteur : conteneurDeBloc(liste.parent ?? n);
        for (const id of ids) declarer(conteneur, id);
        if (n.initializer) liaisons.push({ ids, source: n.initializer });
      }
    } else if (ts.isFunctionDeclaration(n) && n.name) {
      declarer(conteneurDeBloc(n), n.name);
      if (n.body) liaisons.push({ ids: [n.name], source: n.body, fonction: true });
    } else if (ts.isClassDeclaration(n) && n.name) {
      declarer(conteneurDeBloc(n), n.name);
    }
    if (estFonction(n)) {
      const ids = n.parameters.flatMap((p) => nomsLies(p.name));
      for (const id of ids) declarer(n, id);
      // Paramètres d'un rappel passé à une méthode : ils dérivent du receveur de la méthode.
      const appel = n.parent;
      if (ids.length && appel && ts.isCallExpression(appel) && appel.arguments.includes(n)) {
        const callee = appel.expression;
        const receveur = ts.isPropertyAccessExpression(callee) ? callee.expression
          : ts.isCallExpression(callee) ? callee : null; // `it.each(x)(…, (e) => …)`
        if (receveur) liaisons.push({ ids, source: receveur, element: true });
      }
    }
    if (ts.isCatchClause(n) && n.variableDeclaration) for (const id of nomsLies(n.variableDeclaration.name)) declarer(n, id);
    // Collection remplie par MUTATION (`s.add(x)`, `xs.push(x)`) : elle dérive de ses arguments.
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && MUTATEURS.has(n.expression.name.text)
      && ts.isIdentifier(n.expression.expression) && n.arguments.length) mutations.push({ id: n.expression.expression, args: [...n.arguments] });
    n.forEachChild(recense);
  };
  recense(sf);

  const declarant = (id) => {
    for (let p = id.parent; p; p = p.parent) {
      const table = portees.get(p);
      if (table?.has(id.text)) return table.get(id.text);
    }
    return null;
  };

  const derives = new Set();
  /** L'identifiant `id` est-il une RÉFÉRENCE (pas un nom de propriété, pas une liaison) ? */
  const estReference = (id) => {
    const p = id.parent;
    if (!p) return false;
    if (ts.isPropertyAccessExpression(p) && p.name === id) return false;
    if ((ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p) || ts.isPropertyDeclaration(p)) && p.name === id) return false;
    if (ts.isQualifiedName(p)) return false;
    if (p.kind >= ts.SyntaxKind.FirstTypeNode && p.kind <= ts.SyntaxKind.LastTypeNode) return false;
    return true;
  };
  /** Une expression dérive de la donnée si elle lit une liaison dérivée, À TRAVERS les accès, les méthodes
   *  d'un receveur dérivé et les fonctions globales (`Object.keys`, `new Set`…). Un appel d'une fonction
   *  LIÉE non dérivée (une règle importée ou locale) est une SORTIE DE RÈGLE : la dérivation s'y arrête. */
  const derive = (expr) => {
    let trouve = false;
    const lie = (id) => ts.isIdentifier(id) && declarant(id) !== null;
    const visite = (n) => {
      if (trouve) return;
      if (n.kind >= ts.SyntaxKind.FirstTypeNode && n.kind <= ts.SyntaxKind.LastTypeNode) return;
      if (ts.isCallExpression(n) || ts.isNewExpression(n)) {
        const c = n.expression;
        if (regles && ts.isIdentifier(c) && lie(c)) { visite(c); return; }
        if (regles && ts.isPropertyAccessExpression(c) && ts.isIdentifier(c.expression) && lie(c.expression)
          && !derives.has(declarant(c.expression))) return;
        if (ts.isPropertyAccessExpression(c) && !(ts.isIdentifier(c.expression) && !lie(c.expression))) { visite(c.expression); return; }
      }
      if (ts.isIdentifier(n) && estReference(n)) {
        const d = declarant(n);
        if (d && derives.has(d)) { trouve = true; return; }
      }
      n.forEachChild(visite);
    };
    visite(expr);
    return trouve;
  };

  for (const { id, args } of mutations) {
    const d = declarant(id);
    if (d) liaisons.push({ ids: [d], source: args, element: true });
  }
  for (const l of liaisons) if (l.import && sourceDImport(l.import)) for (const id of l.ids) derives.add(id);
  let change = true;
  while (change) {
    change = false;
    for (const l of liaisons) {
      if (!l.source || l.ids.every((id) => derives.has(id))) continue;
      if (Array.isArray(l.source) ? l.source.some(derive) : derive(l.source)) { for (const id of l.ids) derives.add(id); change = true; }
    }
  }
  return { derive, declarant, derives, liaisons };
}

/**
 * Noms exportés par le module `chemin` qui sont des SOURCES (constantes dérivées de la donnée), suivis
 * de proche en proche. `lireModule(chemin)` rend `{ rel, text }` ou `null`.
 */
function exportsSources(chemin, lireModule, cache, enCours = new Set()) {
  if (cache.has(chemin)) return cache.get(chemin);
  if (enCours.has(chemin)) return new Set();
  enCours.add(chemin);
  const sources = new Set();
  const module = lireModule?.(chemin);
  const sf = module ? (module.sourceFile ?? ast(module)) : null;
  if (sf) {
    const ts = typescript();
    const chargeurs = sousDonnee(chemin);
    const sourceDImport = (imp) => estSourceDImport(module.rel, imp, lireModule, cache, enCours);
    const { derive, derives, liaisons } = analyseDeDerivation(sf, sourceDImport, { regles: !chargeurs });
    const constantes = new Map();
    for (const l of liaisons) {
      if (l.fonction && !chargeurs) continue;
      const valeur = l.source && (chargeurs || !(ts.isArrowFunction(l.source) || ts.isFunctionExpression(l.source)));
      for (const id of l.ids) if (derives.has(id) && (valeur || l.import)) constantes.set(id.text, id);
    }
    const exporte = (n) => n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    for (const st of sf.statements) {
      if (ts.isVariableStatement(st) && exporte(st)) {
        for (const d of st.declarationList.declarations) for (const id of nomsLies(d.name)) if (constantes.get(id.text) === id) sources.add(id.text);
      } else if (ts.isFunctionDeclaration(st) && exporte(st) && st.name) {
        if (constantes.get(st.name.text) === st.name) sources.add(st.name.text);
      } else if (ts.isExportDeclaration(st) && !st.isTypeOnly) {
        const cible = st.moduleSpecifier ? cheminDuSpecificateur(module.rel, st.moduleSpecifier.text) : null;
        if (st.moduleSpecifier && !cible) continue;
        if (!st.exportClause) {
          for (const nom of estDonnee(cible) ? ['*'] : exportsSources(cible, lireModule, cache, enCours)) sources.add(nom);
        } else if (ts.isNamedExports(st.exportClause)) {
          for (const el of st.exportClause.elements) {
            const local = (el.propertyName ?? el.name).text;
            const oui = cible ? (estDonnee(cible) || exportsSources(cible, lireModule, cache, enCours).has(local)) : constantes.has(local);
            if (oui && !el.isTypeOnly) sources.add(el.name.text);
          }
        }
      } else if (ts.isExportAssignment(st)) {
        if (derive(st.expression)) sources.add('default');
      }
    }
  }
  enCours.delete(chemin);
  cache.set(chemin, sources);
  return sources;
}

function estSourceDImport(depuis, { specificateur, nomExporte }, lireModule, cache, enCours) {
  const chemin = cheminDuSpecificateur(depuis, specificateur);
  if (chemin === null) return false;
  if (estDonnee(chemin)) return true;
  if (nomExporte === '*') return false;
  const sources = exportsSources(chemin, lireModule, cache, enCours);
  return sources.has(nomExporte) || sources.has('*');
}

const estNombre = (n) => {
  const ts = typescript();
  return ts.isNumericLiteral(n) || (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(n.operand));
};
const estPrimitif = (n) => {
  const ts = typescript();
  return estNombre(n) || ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)
    || n.kind === ts.SyntaxKind.TrueKeyword || n.kind === ts.SyntaxKind.FalseKeyword || n.kind === ts.SyntaxKind.NullKeyword;
};
const sansParentheses = (n) => {
  const ts = typescript();
  while (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isNonNullExpression(n) || ts.isSatisfiesExpression(n)) n = n.expression;
  return n;
};

/** `expect(x)`, `expect(x, 'msg')`, `expect.soft(x)` : le sujet, sinon `null`. */
function sujetDExpect(n) {
  const ts = typescript();
  if (!ts.isCallExpression(n) || !n.arguments.length) return null;
  const c = n.expression;
  const nu = ts.isIdentifier(c) && c.text === 'expect';
  const doux = ts.isPropertyAccessExpression(c) && ts.isIdentifier(c.expression) && c.expression.text === 'expect' && c.name.text === 'soft';
  return nu || doux ? n.arguments[0] : null;
}

/**
 * Sites `{ ligne, motif, sujet, attendu, portee }` d'un fichier de test.
 * @param {{ rel: string, text: string }} f
 * `lireModule(chemin)` rend le module `{ rel, text, sourceFile? }` d'un chemin sans extension, ou `null`.
 * @param {{ lireModule?: (chemin: string) => ({ rel: string, text: string, sourceFile?: import('typescript/unstable/ast').SourceFile } | null), cache?: Map<string, Set<string>>, sourceFile?: import('typescript/unstable/ast').SourceFile }} [options]
 */
export function sitesAssertionSurDonnee(f, { lireModule, cache = new Map(), sourceFile } = {}) {
  if (!f.text.includes('expect')) return [];
  const ts = typescript();
  const sf = sourceFile ?? ast(f);
  if (!sf) return [];
  const rel = f.rel.replaceAll('\\', '/');
  const { derive, declarant, derives, liaisons } = analyseDeDerivation(sf, (imp) => estSourceDImport(rel, imp, lireModule, cache, new Set()));
  const sourcesDirectes = new Set(liaisons.filter((l) => l.import).flatMap((l) => l.ids).filter((id) => derives.has(id)));
  const initialiseurs = new Map(liaisons.filter((l) => l.source && !l.element && l.ids.length === 1).map((l) => [l.ids[0], l.source]));

  /** Le sujet passe-t-il par l'ensemble (source elle-même, opération d'ensemble), en suivant les liaisons locales ? */
  const parEnsemble = (expr, vus = new Set()) => {
    let oui = false;
    const visite = (n) => {
      if (oui) return;
      if (ts.isCallExpression(n)) {
        const c = n.expression;
        const nom = ts.isPropertyAccessExpression(c) ? c.name.text : null;
        if (nom && OPERATIONS_D_ENSEMBLE.has(nom) && derive(n)) { oui = true; return; }
      }
      if (ts.isIdentifier(n)) {
        const d = declarant(n);
        if (d && sourcesDirectes.has(d)) {
          const p = n.parent;
          const lu = p && ((ts.isPropertyAccessExpression(p) && p.expression === n && !CARDINAUX.has(p.name.text)) || ts.isElementAccessExpression(p));
          const appele = p && ts.isCallExpression(p) && p.expression === n;
          if (!lu && !appele) { oui = true; return; }
        }
        if (d && derives.has(d) && !vus.has(d) && initialiseurs.has(d)) {
          vus.add(d);
          if (parEnsemble(initialiseurs.get(d), vus)) { oui = true; return; }
        }
      }
      n.forEachChild(visite);
    };
    visite(expr);
    return oui;
  };

  const sites = [];
  const visite = (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const matcher = n.expression.name.text;
      let r = n.expression.expression;
      while (ts.isPropertyAccessExpression(r) && MODIFICATEURS.has(r.name.text)) r = r.expression;
      const sujet = sujetDExpect(r);
      if (sujet && derive(sujet)) {
        const attendu = n.arguments[0] ? sansParentheses(n.arguments[0]) : null;
        const s = sansParentheses(sujet);
        const cardinal = ts.isPropertyAccessExpression(s) && CARDINAUX.has(s.name.text);
        let motif = null;
        if (MATCHERS_SNAPSHOT.has(matcher)) motif = 'snapshot';
        else if (attendu && matcher === 'toHaveLength' && estNombre(attendu)) motif = 'compte';
        else if (attendu && MATCHERS_COMPTE_SCALAIRE.has(matcher) && estNombre(attendu) && cardinal) motif = 'compte';
        else if (attendu && MATCHERS_STRUCTURE.has(matcher) && ts.isObjectLiteralExpression(attendu) && attendu.properties.length
          && attendu.properties.every((p) => ts.isPropertyAssignment(p) && estNombre(sansParentheses(p.initializer)))) motif = 'compte';
        else if (attendu && MATCHERS_STRUCTURE.has(matcher) && ts.isArrayLiteralExpression(attendu) && attendu.elements.length
          && attendu.elements.every(estPrimitif)) motif = 'liste';
        if (motif) {
          sites.push({
            ligne: ligneDe(sf, n),
            motif,
            sujet: texteDe(sf, sujet),
            attendu: attendu ? texteDe(sf, attendu) : `${matcher}()`,
            portee: parEnsemble(sujet) ? 'ensemble' : 'entree',
          });
        }
      }
    }
    n.forEachChild(visite);
  };
  visite(sf);
  return sites;
}
