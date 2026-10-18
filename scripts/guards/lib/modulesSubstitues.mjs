// Détecteur de la classe « module de `scripts/` évalué, sous test, avec des octets différents du disque » (#2586).
// Un SITE est un crochet de chargement ÉCRIT par du code de test (fichier de test ou de kit de `scripts/`,
// ou code porté dans un littéral de ce fichier, re-parsé) dont l'EFFET substitue un module :
//   - un `load` qui rend une propriété `source` ;
//   - un `resolve` qui rend une propriété `url` hors d'une garde `<spécificateur> === 'node:…'` ;
//   - des crochets OPAQUES (`registerHooks(f())`, `register(<non littéral>)`) qui ne proviennent pas
//     d'un module de production.
// Les crochets d'un fichier chargeur (`export function load|resolve`) se lisent à leur définition,
// quelle que soit leur activation (`register`, `--loader`, `--import`).
import { posix } from 'node:path';
import { corpusDesGardes } from './commentPoison.mjs';
import { analyserTexte, typescript } from './dialecte.mjs';
import { estFichierVitest, estKitDeTest } from './fichierVitest.mjs';
import { analyserEnLots, liaisonsDe } from './importGraph.mjs';

const MODULE = /^(?:node:)?module$/;
const API = new Set(['registerHooks', 'register']);
const CROCHETS = new Set(['load', 'resolve']);
const EFFET = { load: 'source', resolve: 'url' };
const EGALITES = new Set(['===', '==']);
const DIFFERENCES = new Set(['!==', '!=']);
const TEMPORAIRES = new Set(['mkdtempSync', 'mkdtemp', 'tmpdir']);
const CODE_DE_CROCHET = /registerHooks|\bregister\s*\(|\bexport\b[^\n]*\b(?:load|resolve)\b/;
const JETON = /__substitution_(\d+)__/;
const PROFONDEUR_MAX = 3;
const PROVENANCE_MAX = 500;

/** Code écrit par le TEST : un instrument Vitest ou un kit de test sous `scripts/`. Hors de là, production. */
const estCodeDeTest = (rel) => rel.startsWith('scripts/') && (estFichierVitest(rel) || estKitDeTest(rel));

const deballer = (n) => {
  const ts = typescript();
  while (n && (ts.isParenthesizedExpression(n) || ts.isAwaitExpression(n) || ts.isAsExpression(n) || ts.isNonNullExpression(n) || ts.isSatisfiesExpression(n))) n = n.expression;
  return n;
};

const nomDePropriete = (nom) => {
  const ts = typescript();
  return nom && (ts.isIdentifier(nom) || ts.isStringLiteralLikeNode(nom)) ? nom.text : null;
};

/** Les sites du texte `texte` d'un contexte de lecture : fichier de `scripts/` ou code porté en chaîne. */
function lireContexte(ctx, sf) {
  const ts = typescript();
  const sites = [];
  const ligne = (n) => ctx.versExterne(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line);
  const declarations = new Map();
  const fonctions = new Map();
  const empiler = (table, nom, valeur) => table.set(nom, [...(table.get(nom) ?? []), valeur]);
  const recenser = (n) => {
    if (ts.isVariableDeclaration(n) && n.initializer) {
      if (ts.isIdentifier(n.name)) empiler(declarations, n.name.text, n.initializer);
      const init = deballer(n.initializer);
      if (ts.isIdentifier(n.name) && (ts.isFunctionExpression(init) || ts.isArrowFunction(init))) empiler(fonctions, n.name.text, init);
    }
    if (ts.isFunctionDeclaration(n) && n.name && n.body) empiler(fonctions, n.name.text, n);
    n.forEachChild(recenser);
  };
  recenser(sf);
  ctx.declarations = declarations;

  const espaces = new Set();
  const apis = new Map();
  const imports = new Map();
  for (const l of liaisonsDe(ctx.fichier, sf, [])) {
    if (!l.local || l.typeSeul || l.spec === null) continue;
    imports.set(l.local.nom, l.spec);
    if (!MODULE.test(l.spec)) continue;
    if (l.forme === 'nommee') { if (API.has(l.importe?.nom)) apis.set(l.local.nom, l.importe.nom); }
    else espaces.add(l.local.nom);
  }
  const estModule = (e) => {
    e = deballer(e);
    if (!e) return false;
    if (ts.isIdentifier(e)) return espaces.has(e.text);
    return ts.isCallExpression(e) && e.arguments.length > 0 && ts.isStringLiteralLikeNode(e.arguments[0]) && MODULE.test(e.arguments[0].text);
  };
  for (let change = true; change;) {
    change = false;
    const lier = (table, cle, valeur) => {
      if (table.has(cle)) return;
      if (table instanceof Set) table.add(cle);
      else table.set(cle, valeur);
      change = true;
    };
    const visiter = (n) => {
      if (ts.isVariableDeclaration(n) && n.initializer) {
        const init = deballer(n.initializer);
        if (ts.isIdentifier(n.name) && estModule(init)) lier(espaces, n.name.text);
        else if (ts.isObjectBindingPattern(n.name) && estModule(init)) {
          for (const el of n.name.elements) {
            const api = nomDePropriete(el.propertyName ?? el.name);
            if (API.has(api) && ts.isIdentifier(el.name)) lier(apis, el.name.text, api);
          }
        } else if (ts.isIdentifier(n.name) && ts.isPropertyAccessExpression(init) && API.has(init.name.text) && estModule(init.expression)) lier(apis, n.name.text, init.name.text);
      }
      n.forEachChild(visiter);
    };
    visiter(sf);
  }
  const apiDe = (appele) => {
    appele = deballer(appele);
    if (ts.isIdentifier(appele)) return apis.get(appele.text) ?? null;
    if (ts.isPropertyAccessExpression(appele) && API.has(appele.name.text) && estModule(appele.expression)) return appele.name.text;
    if (ts.isElementAccessExpression(appele) && ts.isStringLiteralLikeNode(appele.argumentExpression) && API.has(appele.argumentExpression.text) && estModule(appele.expression)) return appele.argumentExpression.text;
    return null;
  };

  const unique = (table, nom) => (table.get(nom)?.length === 1 ? table.get(nom)[0] : null);
  const racineDe = (e) => {
    e = deballer(e);
    while (e && (ts.isCallExpression(e) || ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e))) e = deballer(e.expression);
    return e && ts.isIdentifier(e) ? e.text : null;
  };
  const provientDeProduction = (e) => {
    const nom = racineDe(e);
    return nom !== null && imports.has(nom) && estProduction(evaluerTexte(imports.get(nom), ctx));
  };

  const fonctionDe = (p) => {
    if (ts.isMethodDeclaration(p)) return p;
    const valeur = ts.isShorthandPropertyAssignment(p) ? p.name : ts.isPropertyAssignment(p) ? deballer(p.initializer) : null;
    if (!valeur) return null;
    if (ts.isFunctionExpression(valeur) || ts.isArrowFunction(valeur)) return valeur;
    return ts.isIdentifier(valeur) ? unique(fonctions, valeur.text) : null;
  };
  const effetsDesCrochets = (arg) => {
    arg = deballer(arg);
    const objet = arg && ts.isIdentifier(arg) ? deballer(unique(declarations, arg.text)) : arg;
    if (!objet || !ts.isObjectLiteralExpression(objet)) return arg && provientDeProduction(arg) ? [] : ['opaque'];
    const effets = new Set();
    for (const p of objet.properties) {
      if (ts.isSpreadAssignment(p)) { if (!provientDeProduction(p.expression)) effets.add('opaque'); continue; }
      const nom = nomDePropriete(p.name);
      if (!CROCHETS.has(nom)) continue;
      const fn = fonctionDe(p);
      if (!fn) { if (!provientDeProduction(ts.isPropertyAssignment(p) ? p.initializer : p.name)) effets.add('opaque'); continue; }
      const effet = effetDuCrochet(nom, fn);
      if (effet) effets.add(effet);
    }
    return [...effets];
  };

  const effetDuCrochet = (nom, fn) => {
    const cle = EFFET[nom];
    const premier = fn.parameters[0]?.name;
    const parametre = premier && ts.isIdentifier(premier) ? premier.text : null;
    const produits = [];
    const fouiller = (n) => {
      if ((ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) && nomDePropriete(n.name) === cle) produits.push(n);
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(n.left) && n.left.name.text === cle) produits.push(n);
      n.forEachChild(fouiller);
    };
    if (fn.body) fouiller(fn.body);
    if (!produits.length) return null;
    if (parametre === null) return cle;
    if (nom === 'resolve') return produits.every((p) => gardeParBuiltin(p, fn, parametre)) ? null : cle;
    return cibleTemporaire(fn, parametre) ? null : cle;
  };

  const estParametre = (e, parametre) => { e = deballer(e); return !!e && ts.isIdentifier(e) && e.text === parametre; };
  const estBuiltin = (e) => { e = deballer(e); return !!e && ts.isStringLiteralLikeNode(e) && e.text.startsWith('node:'); };
  const compare = (e, parametre, operateurs) => {
    e = deballer(e);
    return !!e && ts.isBinaryExpression(e) && operateurs.has(e.operatorToken.getText(sf)) &&
      ((estParametre(e.left, parametre) && estBuiltin(e.right)) || (estParametre(e.right, parametre) && estBuiltin(e.left)));
  };
  const operandes = (e, operateur) => {
    e = deballer(e);
    return e && ts.isBinaryExpression(e) && e.operatorToken.kind === operateur ? [...operandes(e.left, operateur), ...operandes(e.right, operateur)] : [e];
  };
  const retourne = (st) => ts.isReturnStatement(st) || (ts.isBlock(st) && st.statements.length > 0 && ts.isReturnStatement(st.statements.at(-1)));
  const gardeParBuiltin = (produit, fn, parametre) => {
    for (let n = produit; n && n !== fn; n = n.parent) {
      const parent = n.parent;
      if (ts.isIfStatement(parent) && parent.thenStatement === n &&
        operandes(parent.expression, ts.SyntaxKind.AmpersandAmpersandToken).some((c) => compare(c, parametre, EGALITES))) return true;
      if (ts.isConditionalExpression(parent) && parent.whenTrue === n &&
        operandes(parent.condition, ts.SyntaxKind.AmpersandAmpersandToken).some((c) => compare(c, parametre, EGALITES))) return true;
      if (ts.isBlock(parent)) {
        for (const st of parent.statements) {
          if (st === n) break;
          if (ts.isIfStatement(st) && !st.elseStatement && retourne(st.thenStatement) &&
            operandes(st.expression, ts.SyntaxKind.BarBarToken).some((c) => compare(c, parametre, DIFFERENCES))) return true;
        }
      }
    }
    return false;
  };

  const cibleTemporaire = (fn, parametre) => {
    const cibles = [];
    const fouiller = (n) => {
      if (ts.isBinaryExpression(n) && (EGALITES.has(n.operatorToken.getText(sf)) || DIFFERENCES.has(n.operatorToken.getText(sf)))) {
        if (estParametre(n.left, parametre)) cibles.push(n.right);
        else if (estParametre(n.right, parametre)) cibles.push(n.left);
      }
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && estParametre(n.expression.expression, parametre) && n.arguments.length) cibles.push(n.arguments[0]);
      n.forEachChild(fouiller);
    };
    if (fn.body) fouiller(fn.body);
    return cibles.length > 0 && cibles.every((c) => provenanceTemporaire(c, ctx));
  };

  const ajouter = (n, effets, raison) => {
    if (effets.length) sites.push({ fichier: ctx.fichier, ligne: ligne(n), effets: [...effets].sort(), raison, enChaine: ctx.profondeur > 0 });
  };
  const exporte = (n) => n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  const dejaLus = new Set();
  const visiter = (n) => {
    if (dejaLus.has(n)) return;
    if (ts.isCallExpression(n)) {
      const api = apiDe(n.expression);
      if (api === 'registerHooks') ajouter(n, effetsDesCrochets(n.arguments[0]), 'registerHooks');
      if (api === 'register') {
        const spec = deballer(n.arguments[0]);
        const litteral = spec && ts.isStringLiteralLikeNode(spec) && !JETON.test(spec.text) && !spec.text.startsWith('data:');
        if (!litteral && evaluer(spec, ctx) === null) ajouter(n, ['opaque'], 'register');
      }
    }
    if (ts.isFunctionDeclaration(n) && n.name && CROCHETS.has(n.name.text) && exporte(n)) {
      const effet = effetDuCrochet(n.name.text, n);
      if (effet) ajouter(n, [effet], 'chargeur');
    }
    if (ts.isVariableStatement(n) && exporte(n)) {
      for (const d of n.declarationList.declarations) {
        const init = deballer(d.initializer);
        if (ts.isIdentifier(d.name) && CROCHETS.has(d.name.text) && init && (ts.isFunctionExpression(init) || ts.isArrowFunction(init))) {
          const effet = effetDuCrochet(d.name.text, init);
          if (effet) ajouter(d, [effet], 'chargeur');
        }
      }
    }
    if (ctx.profondeur < PROFONDEUR_MAX) {
      const morceaux = morceauxDeChaine(n, sf, ctx, dejaLus);
      if (morceaux) sites.push(...lireChaine(ctx, morceaux));
    }
    n.forEachChild(visiter);
  };
  visiter(sf);
  return sites;
}

/** Les morceaux de code porté par `n` : un littéral de chaîne, un gabarit (substitutions en jetons), ou un
 *  tableau de chaînes joint (`[…].join(sep)`). `null` hors de ces formes ou sans code de crochet. */
function morceauxDeChaine(n, sf, ctx, dejaLus) {
  const ts = typescript();
  const ligne0 = (noeud) => sf.getLineAndCharacterOfPosition(noeud.getStart(sf)).line;
  const substitutions = [];
  const jeton = (expression) => {
    substitutions.push({ noeud: expression, ctx });
    return { texte: `"__substitution_${substitutions.length - 1}__"`, ligne0: ligne0(expression), unParUn: false };
  };
  const partie = (noeud, texte, brut) => ({ texte, ligne0: ligne0(noeud), unParUn: brut !== undefined && brut.split('\n').length === texte.split('\n').length });
  const deLitteral = (e) => {
    if (ts.isStringLiteral(e)) return [partie(e, e.text)];
    if (ts.isNoSubstitutionTemplateLiteral(e)) return [partie(e, e.text, e.rawText)];
    if (ts.isTemplateExpression(e)) {
      return [partie(e, e.head.text, e.head.rawText), ...e.templateSpans.flatMap((s) => [jeton(s.expression), partie(s.literal, s.literal.text, s.literal.rawText)])];
    }
    return null;
  };
  const deTableauJoint = () => {
    const appel = n.parent?.parent;
    if (!ts.isArrayLiteralExpression(n) || !ts.isPropertyAccessExpression(n.parent) || n.parent.name.text !== 'join' || !appel || !ts.isCallExpression(appel) || appel.expression !== n.parent) return undefined;
    const separateur = appel.arguments[0];
    const sep = separateur === undefined ? ',' : ts.isStringLiteralLikeNode(separateur) ? separateur.text : null;
    if (sep === null) return null;
    return n.elements.flatMap((e, i) => {
      const lus = deLitteral(e) ?? [jeton(e)];
      if (deLitteral(e)) dejaLus.add(e);
      return i === 0 ? lus : [{ texte: sep, ligne0: ligne0(e), unParUn: false }, ...lus];
    });
  };
  const joint = deTableauJoint();
  const morceaux = joint === undefined ? deLitteral(n) : joint;
  if (!morceaux || !CODE_DE_CROCHET.test(morceaux.map((m) => m.texte).join(''))) return null;
  return { morceaux, substitutions };
}

/** Les sites du code porté : re-parsé dans un contexte enfant dont les lignes se rapportent au fichier. */
function lireChaine(parent, { morceaux, substitutions }) {
  let texte = '';
  const lignes = [];
  for (const m of morceaux) {
    m.texte.split('\n').forEach((morceau, i) => {
      if (i > 0) { texte += '\n'; lignes.push(m.unParUn ? m.ligne0 + i : m.ligne0); }
      else if (lignes.length === 0) lignes.push(m.ligne0);
      texte += morceau;
    });
  }
  const ctx = {
    fichier: parent.fichier, dossier: null, substitutions,
    profondeur: parent.profondeur + 1, versExterne: (l) => parent.versExterne(lignes[l] ?? lignes.at(-1)),
  };
  return lireContexte(ctx, analyserTexte({ rel: ctx.fichier, text: texte }).sourceFile);
}

/** Le module désigné par une expression de spécificateur : `{ paquet }`, `{ fichier }` (POSIX depuis la
 *  racine), ou `null` quand il n'est pas statiquement connu. */
function evaluer(e, ctx, profondeur = 0) {
  const ts = typescript();
  e = deballer(e);
  if (!e || profondeur > 8) return null;
  if (ts.isStringLiteralLikeNode(e)) return evaluerTexte(e.text, ctx, profondeur);
  if (ts.isPropertyAccessExpression(e) && e.name.text === 'href') return evaluer(e.expression, ctx, profondeur + 1);
  if (ts.isCallExpression(e) && e.arguments.length > 0 && /^(?:JSON\.stringify|String)$/.test(e.expression.getText())) return evaluer(e.arguments[0], ctx, profondeur + 1);
  if (ts.isNewExpression(e) && e.expression.getText() === 'URL' && e.arguments?.length === 2 && e.arguments[1].getText() === 'import.meta.url' && ts.isStringLiteralLikeNode(e.arguments[0])) {
    return ctx.dossier === null ? null : { fichier: posix.join(ctx.dossier, e.arguments[0].text.replace(/[?#].*$/, '')) };
  }
  if (ts.isIdentifier(e)) {
    const inits = ctx.declarations?.get(e.text);
    return inits?.length === 1 ? evaluer(inits[0], ctx, profondeur + 1) : null;
  }
  return null;
}

function evaluerTexte(texte, ctx, profondeur = 0) {
  const jeton = JETON.exec(texte);
  if (jeton) {
    const s = ctx.substitutions[Number(jeton[1])];
    return s ? evaluer(s.noeud, s.ctx, profondeur + 1) : null;
  }
  if (/^(?:\.{1,2}\/)/.test(texte)) return ctx.dossier === null ? null : { fichier: posix.join(ctx.dossier, texte.replace(/[?#].*$/, '')) };
  if (/^(?:[a-z]+:|\/)/i.test(texte) && !texte.startsWith('node:')) return null;
  return { paquet: texte };
}

const estProduction = (module) => module !== null && (module.paquet !== undefined || !estCodeDeTest(module.fichier));

/** La cible `e` d'un crochet est-elle PROUVÉE fixture temporaire : sa provenance (déclarations, substitutions)
 *  passe par `mkdtemp`/`tmpdir` et jamais par `import.meta` ? */
function provenanceTemporaire(e, ctx) {
  const ts = typescript();
  const vus = new Set();
  const pile = [{ noeud: e, ctx }];
  let temporaire = false;
  let depot = false;
  while (pile.length && !depot) {
    if (vus.size > PROVENANCE_MAX) return false;
    const { noeud, ctx: c } = pile.pop();
    if (vus.has(noeud)) continue;
    vus.add(noeud);
    const fouiller = (n) => {
      if (depot) return;
      if (ts.isMetaProperty(n) && n.keywordToken === ts.SyntaxKind.ImportKeyword) depot = true;
      if (ts.isCallExpression(n)) {
        const appele = deballer(n.expression);
        const nom = ts.isIdentifier(appele) ? appele.text : ts.isPropertyAccessExpression(appele) ? appele.name.text : null;
        if (TEMPORAIRES.has(nom)) temporaire = true;
      }
      if (ts.isIdentifier(n) && !(ts.isPropertyAccessExpression(n.parent) && n.parent.name === n)) for (const init of c.declarations?.get(n.text) ?? []) pile.push({ noeud: init, ctx: c });
      if (ts.isStringLiteralLikeNode(n)) {
        const jeton = JETON.exec(n.text);
        const s = jeton && c.substitutions[Number(jeton[1])];
        if (s) pile.push({ noeud: s.noeud, ctx: s.ctx });
      }
      n.forEachChild(fouiller);
    };
    fouiller(noeud);
  }
  return temporaire && !depot;
}

const contexteDeFichier = (fichier) => ({
  fichier, dossier: posix.dirname(fichier), substitutions: [], profondeur: 0, versExterne: (l) => l + 1,
});

/** Les sites de substitution du fichier `fichier` (chemin POSIX depuis la racine) de texte `texte`. Un fichier
 *  hors du code de test de `scripts/` n'en porte aucun. */
export function sitesDeSubstitution(fichier, texte) {
  if (!estCodeDeTest(fichier)) return [];
  return lireContexte(contexteDeFichier(fichier), analyserTexte({ rel: fichier, text: texte }).sourceFile);
}

/** Les sites de substitution du corpus `fichiers` (`{ rel, text }`), par défaut `corpusDesGardes()`. */
export function sitesDuDepot(fichiers = corpusDesGardes()) {
  const sites = [];
  for (const { fichier, sourceFile } of analyserEnLots(fichiers.filter((f) => estCodeDeTest(f.rel)))) {
    sites.push(...lireContexte(contexteDeFichier(fichier.rel), sourceFile));
  }
  return sites;
}
