// Mécanique de scan de la GARDE DE GRAMMAIRE (#1466 L1a) — lue à l'AST (TypeScript compiler API),
// jamais à la regex de ligne : un littéral zod s'écrit sur dix lignes, et `.extend(` se chaîne.
// Trois formes scannées, toutes par FORME (jamais par nom : une redéclaration s'appelle
// rarement comme le schéma qu'elle recopie) :
//  - `redeclaration` : un littéral `z.object`/`z.strictObject`/`z.looseObject` dont le jeu de clés
//    est EXACTEMENT la signature d'un schéma de la grammaire (`valeurs.ts`/`reference.ts`/`ref.ts`)
//    — la forme est déjà écrite, ce littéral en est une seconde graphie ;
//  - `alias` : un littéral qui porte une GRAPHIE HISTORIQUE de référence (`skillId`, `trappingId`,
//    `wildcard`…) — la référence re-tapée sous son ancien nom ;
//  - `extend` : un `.extend(` dont le RECEVEUR est un schéma de la grammaire (importé, ou déclaré
//    dans le module de grammaire lui-même). zod 4.4.3 PERD le registre et la `.meta()` au `.extend`
//    (cf. `grammaire/ref.ts` en tête) : une porte étendue n'est plus la porte.
// La lecture du corpus n'est PAS ici : elle vit dans `sourceCorpus.mjs` (`readCorpus`). Ce module
// reçoit UN fichier (`rel`, `contenu`) et les RÈGLES (signatures + alias, dérivées par l'appelant
// des schémas eux-mêmes — aucune liste de clés n'est recopiée ici) et rend des trouvailles.
import * as ts from 'typescript/unstable/ast';
import { analyserCorpus } from './dialecte.mjs';
import { contexteImports, liaisonImportee } from './canonUnique.mjs';

/** Fabriques d'objet zod dont l'argument littéral porte une forme DÉCLARÉE. */
const FABRIQUES_OBJET = new Set(['object', 'strictObject', 'looseObject']);

/**
 * FABRIQUE DE DOCUMENT (#1467) — `document(type, famille, champs, meta, exposition, options?)`.
 * Son 3ᵉ argument est un littéral de CHAMPS (clé → schéma zod) : c'est le MÊME plan de forme que
 * l'argument de `z.strictObject`, à ceci près qu'aucune fabrique zod ne l'entoure.
 */
const FABRIQUE_DOCUMENT = 'document';
/** Index de l'argument `champs` dans la signature de `document()`. */
const ARG_CHAMPS = 2;

/** Modules dont un schéma importé est « de la grammaire » (récepteur interdit d'un `.extend`). */
const MODULES_GRAMMAIRE = /(^|\/)(grammaire|defs-scenes)(\/|$)/;

/** Le fichier scanné EST-il un module de grammaire ? (ses consts locales y sont des schémas de la
 *  grammaire : `refSchema.extend(…)` dans `grammaire/reference.ts` étend bien une porte partagée). */
const estModuleGrammaire = (rel) => MODULES_GRAMMAIRE.test(rel.replace(/\/[^/]*$/, ''));

/** @param {ts.SourceFile} sf @param {ts.Node} n @returns {number} ligne 1-based */
const ligneDe = (sf, n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

/** Nom d'une clé de propriété (identifiant, chaîne, clé calculée littérale) ; `null` si dynamique.
 * @param {ts.PropertyName | undefined} name @returns {string | null} */
function nomDeCle(name) {
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  if (ts.isComputedPropertyName(name) && ts.isStringLiteralLikeNode(name.expression)) return name.expression.text;
  return null;
}

/** Le SITE d'un nœud : `<const porteuse>` + le chemin des clés d'objet traversées jusqu'à lui
 *  (`entityAppearanceSchema.colors`). Sans const porteuse : `<anonyme>`.
 * @param {ts.Node} n @returns {{ symbole: string, champ: string }} */
function siteDe(n) {
  const champs = [];
  let symbole = '<anonyme>';
  for (let p = n.parent; p; p = p.parent) {
    if (ts.isPropertyAssignment(p)) {
      const c = nomDeCle(p.name);
      if (c) champs.unshift(c);
    } else if (ts.isVariableDeclaration(p) && ('name' in p && ts.isIdentifier(p.name))) {
      symbole = p.name.text;
      break;
    } else if (ts.isFunctionDeclaration(p) && p.name) {
      symbole = `${p.name.text}()`;
      break;
    }
  }
  return { symbole, champ: champs.join('.') };
}

/** La valeur d'une propriété est-elle un `z.literal(…)` ? Un littéral qui en porte un est une
 *  VARIANTE de discriminée (un effet, un événement), jamais la forme d'une valeur.
 * @param {ts.ObjectLiteralAssignmentTarget | ts.ObjectLiteralElementLike} p @returns {boolean} */
function estDiscriminant(p) {
  const v = ts.isPropertyAssignment(p) ? p.initializer : undefined;
  if (!v || !ts.isCallExpression(v) || !ts.isPropertyAccessExpression(v.expression)) return false;
  return v.expression.name.text === 'literal';
}

/** Clés d'un littéral d'objet, présence d'un SPREAD (qui rend le relevé partiel) et présence d'un
 *  DISCRIMINANT (`z.literal`).
 * @param {ts.ObjectLiteralExpression} lit @returns {{ cles: string[], spread: boolean, discriminee: boolean }} */
function clesDuLitteral(lit) {
  const cles = [];
  let spread = false;
  let discriminee = false;
  for (const p of lit.properties) {
    if (ts.isSpreadAssignment(p)) { spread = true; continue; }
    if (estDiscriminant(p)) discriminee = true;
    const c = nomDeCle(p.name);
    if (c) cles.push(c);
  }
  return { cles, spread, discriminee };
}

/** Racine d'une chaîne d'appels/accès (`a.b().c` → `a`). @param {ts.Expression} e @returns {ts.Expression} */
function racineDe(e) {
  let r = e;
  for (;;) {
    if (ts.isCallExpression(r)) { r = r.expression; continue; }
    if (ts.isPropertyAccessExpression(r)) { r = r.expression; continue; }
    break;
  }
  return r;
}

/**
 * Trouvailles de grammaire d'UN fichier.
 * @param {string} rel chemin POSIX depuis la racine du dépôt (`readCorpus().rel`)
 * @param {string} contenu texte du fichier
 * @param {{ signatures: readonly { nom: string, cles: readonly string[] }[], alias: readonly string[], sansRedeclaration?: boolean }} regles
 *   `signatures` = les formes DÉJÀ écrites par la grammaire (≥2 clés), dérivées des schémas par
 *   l'appelant ; `alias` = les graphies historiques de référence ; `sansRedeclaration` = le fichier
 *   est une FABRIQUE de la grammaire (ses littéraux SONT le canon) : seul `.extend` y est scanné.
 * @returns {{ ligne: number, symbole: string, champ: string, motif: 'redeclaration'|'alias'|'extend', detail: string }[]}
 */
export function scan(rel, contenu, regles, sourceFile, checker) {
  if (!sourceFile) {
    for (const analyse of analyserCorpus([{ rel, text: contenu }])) return scan(rel, contenu, regles, analyse.sourceFile, analyse.checker);
  }
  const sf = sourceFile;
  const contexte = contexteImports(sf, checker);
  const local = estModuleGrammaire(rel);
  const alias = new Set(regles.alias);
  const signatures = regles.signatures.filter((s) => s.cles.length >= 2).map((s) => ({ nom: s.nom, cles: new Set(s.cles) }));
  const trouvailles = [];

  /** @param {ts.Node} n @param {'redeclaration'|'alias'|'extend'} motif @param {string} detail */
  const noter = (n, motif, detail) => {
    const { symbole, champ } = siteDe(n);
    trouvailles.push({ ligne: ligneDe(sf, n), symbole, champ, motif, detail });
  };

  /**
   * Scanne UN littéral de forme (argument d'une fabrique zod, ou `champs` de `document()`).
   * @param {ts.Node} site nœud à qui les trouvailles sont imputées
   * @param {ts.ObjectLiteralExpression} lit
   */
  const scanneLitteral = (site, lit) => {
    const { cles, spread, discriminee } = clesDuLitteral(lit);
    const jeu = new Set(cles);
    // ÉGALITÉ de jeux de clés, jamais inclusion : un document qui PORTE `id` et `type` n'est pas
    // une réf re-tapée — seule la forme reproduite À L'IDENTIQUE est une seconde graphie. La
    // recopie PARTIELLE ou CHARGÉE est mesurée côté donnée (`STRUCTURES_REDECLARATIONS`, `+…`).
    // Une VARIANTE discriminée (`type: z.literal('clearObjective')`) est hors volet : son `type`
    // nomme la variante, il ne désigne pas le type d'une entité.
    const memes = spread || discriminee ? [] : signatures.filter((s) => s.cles.size === jeu.size && [...s.cles].every((c) => jeu.has(c)));
    for (const s of memes) noter(site, 'redeclaration', `${s.nom} {${[...s.cles].sort().join(',')}}`);
    const graphies = cles.filter((c) => alias.has(c)).sort();
    if (graphies.length) noter(site, 'alias', graphies.join(','));
  };

  /** Consts d'objet du fichier — pour résoudre `document(…, champs, …)` passé par RÉFÉRENCE.
   *  @type {Map<string, ts.ObjectLiteralExpression>} */
  const constsObjet = new Map();
  const releveConsts = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && ts.isObjectLiteralExpression(n.initializer)) {
      constsObjet.set(n.name.text, n.initializer);
    }
    n.forEachChild(releveConsts);
  };
  releveConsts(sf);

  /** @param {ts.Node} n */
  const walk = (n) => {
    // FABRIQUE DE DOCUMENT : `document('x', famille, champs, …)`. Deux formes admises pour `champs`,
    // toutes deux mesurées sur les defs réels — littéral INLINE (`careers.ts`) et const NOMMÉE
    // référencée (`axes.ts`, `characteristics.ts`, qui exposent leur vue TS depuis `champs`).
    if (!regles.sansRedeclaration && ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === FABRIQUE_DOCUMENT) {
      const argChamps = n.arguments[ARG_CHAMPS];
      const lit = argChamps && ts.isObjectLiteralExpression(argChamps)
        ? argChamps
        : argChamps && ts.isIdentifier(argChamps)
          ? constsObjet.get(argChamps.text)
          : undefined;
      if (lit) scanneLitteral(lit, lit);
    }
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const nom = n.expression.name.text;
      const arg0 = n.arguments[0];
      if (!regles.sansRedeclaration && FABRIQUES_OBJET.has(nom) && arg0 && ts.isObjectLiteralExpression(arg0)) {
        scanneLitteral(n, arg0);
      }
      if (nom === 'extend') {
        const racine = racineDe(n.expression.expression);
        const origine = ts.isIdentifier(racine) ? liaisonImportee(racine, sf, contexte) : null;
        const importee = origine && MODULES_GRAMMAIRE.test(origine.spec)
          && contexte.liaisonsDuNom(racine.text).some((l) => l.forme === 'nommee' && l.spec === origine.spec && l.importe.nom === origine.nom);
        if (ts.isIdentifier(racine) && (importee || (local && /Schema$/.test(racine.text)))) {
          noter(n, 'extend', `${racine.text}.extend(…)`);
        }
      }
    }
    n.forEachChild(walk);
  };
  walk(sf);
  return trouvailles;
}
