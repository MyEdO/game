import { SymbolFlags, TypeFlags } from 'typescript/unstable/sync';
// Mécanique de scan du garde-fou « tout champ de Scene a un chemin d'écriture d'auteur » (#841) : l'interface web
// (`src/ui/**`) ou l'éditeur Godot (méthode `editer` du pont, `hotes/godot/pont/CONTRAT.md`, #3508 décision 8).
//
// Le défaut fermé : un champ du document de Scène qui n'est joignable QUE par le compilateur d'authoring
// (`mapSpec.ts`) ou un script `.mjs` — donc par un agent, jamais par un auteur au clic. L'omission est SILENCIEUSE :
// le champ existe au modèle, le moteur le lit, aucun test ne casse. La garde ferme la CLASSE ; quatre exigences la
// rendent réfutable :
//
//  1. PÉRIMÈTRE DÉRIVÉ. Les champs surveillés se déduisent du type `Scene` par le TypeChecker —
//     propriétés, éléments de tableau, membres d'union, types littéraux anonymes, valeurs d'index
//     (`Record<string,V>`), clés LITTÉRALES d'un type mappé (`Record<'a' | 'b', V>`, un shape dérivé
//     par `tableTotale`) — propriétés SYNTHÉTIQUES, sans déclaration, rattachées à la déclaration du
//     champ qui porte le type. Aucune liste de types recopiée à la main.
//  2. CRÉDIT RATTACHÉ AU TYPE. Un écrivain ne compte que si le champ qu'il écrit REMONTE
//     à la déclaration exacte du champ dans `scene.ts` — pour une propriété synthétique, au type
//     mappé qui la porte et à son nom (`idsOf`). Une propriété PRODUITE PAR UNE FABRIQUE (déclarée dans le corps d'une
//     fonction nommée de la grammaire : `objetDeRef`, `proseNommee`…) n'a qu'une déclaration pour autant de produits
//     que d'appels : elle se nomme, comme la synthétique, par son PORTEUR (le type du produit) et son nom
//     (`produitDeFabrique`, #3606 D1). Un champ est la déclaration de son type : deux produits d'un même type sont un
//     champ, une propriété HÉRITÉE (`RefASpecialisation.id`, déclarée par `RefDesignee`) est celui de sa déclaration,
//     nommé au premier type qui l'atteint. Un `{ once: … }` d'un
//     symptôme de maladie, un `{ window: … }` de condition temporelle ou un `{ flags }` passé en
//     lecture à un contexte d'évaluation ne créditent rien : leur type porteur n'est pas celui du
//     document de scène.
//  3. CRÉDIT RATTACHÉ À UN APPELANT. Hors interface (`BRIDGE_PATH`), une primitive ne crédite que
//     si sa fonction porteuse est ATTEINTE depuis `src/ui/**` ou depuis la méthode `editer` du pont
//     Godot (`ENTREE_GODOT`) par une chaîne d'appels résolue au TypeChecker
//     (`auteurReachableScopes`). L'EXISTENCE d'un écrivain ne prouve rien : une primitive
//     complète, testée, ré-exportée par l'éditeur et jamais appelée EST le défaut de #841.
//  4. CRÉDIT PAR ALLER-RETOUR. Une écriture générique (le geste `valeur` du formulaire tiré du schéma, à clé calculée,
//     que le scan ne voit pas) crédite le dernier pas d'un chemin qu'un aller-retour a JOUÉ en jouant `editer`, et, d'un
//     objet ou d'une liste écrits entiers, chaque clé qu'ils portent, de proche en proche (`cheminsEcrits`), comme le scan
//     crédite chaque propriété d'un littéral
//     (`ecrituresJouees` d'`auditSceneFieldEditability`) : le document a changé à ce chemin, la valeur relue est la
//     valeur jouée, la saisie n'est pas du JSON (`ecritureCreditee`). Le chemin se joint au périmètre en marchant le
//     type `Scene` (`idsDuChemin`, par `idsOf`) : aucun second nommage.
//
// FRONTIÈRE DU PÉRIMÈTRE — par PROPRIÉTÉ, et l'appartenance se juge par IDENTITÉ, jamais par
// module. L'ENSEMBLE D'IDENTITÉS du document se construit en marchant les schémas depuis
// `sceneSchema` (`data/schemas/defs-scenes/scene.ts`) : toute `PropertyAssignment` d'un shape
// atteint en fait partie, y compris celles d'un schéma FEUILLE d'un autre module (`communs.ts` :
// `ptSchema` ; `grammaire/valeurs.ts` : `moneyPartialSchema`) que le document compose. S'y ajoutent les `PropertySignature` des
// types encore MANUSCRITS (`src/noyau/monde/scene.ts`). Une frontière posée sur le MODULE perdrait ces
// feuilles dès qu'un corps manuscrit passe en `z.infer` (`DialogueChoice.cost.{gold,silver,brass}`, déclarés par
// `grammaire/valeurs.ts:moneyPartialSchema`).
// La marche suit chaque identifiant jusqu'à sa déclaration : le schéma d'un `const`, le CORPS d'une fabrique (une
// fonction de la grammaire, `conditionDe`, `arbreDeFlow`, `objetDeRef`…), dont les shapes sont ceux de ses produits,
// et l'ANNOTATION de type, qui masque le shape qu'elle déclare (`z.ZodType<{ id: string }>`, `as ChampsNommes`,
// `RefDesignee`, `TraitPose`) : un `interface` ou un `type` de la couche donnée (`typeDeLaDonnee`) entre avec ses
// `PropertySignature`, comme ceux qu'annotent les types MANUSCRITS du document (`SceneEntity.calage` : `Calage`).
// Aucun nœud listé ne l'arrête ; `z.custom<T>()` est une frontière STRUCTURELLE (aucun shape à marcher), détectée et
// jamais listée, et un type du MOTEUR (`Condition`, `Flow`, `GameOp`, `FlowTest`, `src/engine/`) n'est pas de la couche
// donnée : son intérieur reste hors du périmètre tant qu'il n'est pas la sortie de son schéma (#3606 M2f2).
// Le niveau importe : le SYMBOLE d'un type inféré d'un schéma zod est anonyme et déclaré dans
// `zod/v4/core/util.d.cts`, alors que ses PROPRIÉTÉS pointent la ligne exacte du shape. Une
// frontière posée sur le type lâcherait donc en silence dès qu'un corps manuscrit passe en
// `z.infer` ; d'où aussi le CLIQUET DE COMPTE de la garde. La frontière reste structurelle : une propriété ajoutée
// demain dans un module du document, atteignable depuis `Scene`, entre d'elle-même dans le périmètre.
//
// CE QUE CE DÉTECTEUR NE VOIT PAS — à lire AVANT de conclure d'une colonne vide qu'un champ est
// mort. Le scan reconnaît une écriture par le type PORTEUR du littéral, obtenu soit du type
// contextuel, soit d'un étalement, soit d'une ANNOTATION remontée le long de la position du nœud
// (`positionTypes`). Restent hors de portée, et rendent donc une colonne d'écrivains VIDE alors que
// le champ est bel et bien écrit :
//   - une collection SANS annotation dont le type ne vient que de l'inférence
//     (`const zones = […].map((b) => ({ … }))` puis `s = { ...s, effectZones: zones }`) ;
//   - une écriture via un helper générique dont le paramètre de type se résout à l'appel
//     (`assign<T>(cible, { … })`, `Object.assign`, un `structuredClone` retouché) — sauf le helper
//     à clé `f<T, K extends keyof T>(o: T, k: K, …)` qui écrit `x[k] = …` : l'appel qui lui passe une clé
//     LITTÉRALE crédite ce champ du type de `o` (`ecrituresParCle`) ;
//   - une écriture par index/clé dynamique hors de ce helper (`obj[k] = v`, `Object.entries(...).forEach`), que seul
//     l'aller-retour joué crédite ;
//   - une écriture depuis un fichier hors `AUTHOR_PATH`/`PIPELINE_PATH` : les scripts `.mjs` de
//     `scripts/`, non typés par le `tsconfig`, n'alimentent AUCUNE colonne.
//   - une écriture de `BRIDGE_PATH` appelée INDIRECTEMENT (table de dispatch, callback, `obj[k]()`) :
//     la fermeture d'appels de `auteurReachableScopes` déclare ses propres angles morts, à lire là-bas.
// Un littéral qui traverse le paramètre de type `U` d'un `Array.prototype.map` perd sa freshness, ce qui prive
// `getContextualType` de tout rattachement (`SceneEffectZone.tiles` ← `src/noyau/mapSpec.ts`) : `positionTypes` le
// rattache par l'annotation de la collection. Une colonne vide est donc un INDICE d'orphelin, jamais une preuve de champ
// mort.
//
// Module ESM pur — consommé par `src/scene-field-editability-guard.test.ts`.
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import * as ts from 'typescript/unstable/ast';
import { repoProgram, libererSessions } from './tsProgram.mjs';
import { estFichierVitest, estKitDeTest } from './fichierVitest.mjs';
import { dossierDe, porteeDeGarde } from './couches.mjs';

/** `rel` (relatif à la racine, séparateurs quelconques) est-il sous le dossier `dossier` ? */
const sous = (dossier) => (rel) => norm(rel).startsWith(`${dossier}/`);

/** Les deux chemins d'auteur, dérivés de `COUCHES` (`porteeDeGarde`) : l'interface web (`ui`, qui lève dès que la zone
 *  quitte la table, #3556 lot D) et les zones des hôtes du noyau (`hote`, le modèle de vue commun ; `hotes`, le pont
 *  Godot). */
const [DOSSIER_HOTE, DOSSIER_HOTES, DOSSIER_UI] = porteeDeGarde(['hote', 'hotes'], ['ui']);

/** Fichiers d'INTERFACE : un écrivain qui y vit est joignable au clic par construction — l'auteur
 *  ouvre l'écran. Crédit DIRECT. */
const UI_PATH = [sous(DOSSIER_UI)];

/** Le point d'entrée de l'éditeur Godot : la méthode `editer` du pont (`hotes/godot/pont/CONTRAT.md`, #3508). Hors
 *  interface, il est la seule racine de la fermeture d'appels côté Godot : le pont sert aussi la partie, que l'auteur
 *  n'édite pas. */
const PONT = `${DOSSIER_HOTES}/godot/pont`;
const ENTREE_GODOT = { fichier: `${PONT}/pont.ts`, methode: 'editer' };

/** Primitives d'édition qui ne sont PAS une interface : le pont Godot et le modèle de vue commun des hôtes
 *  (`src/hote/`), les modules d'édition du noyau (`src/noyau/*Edit*.ts`, dont `sceneEdit.ts` et ses lectures
 *  `sceneEditLecture.ts`), la session, le pointeur et l'historique de l'éditeur (`src/noyau/edition/`, #3508) et le
 *  parseur de saisie « format livre » (`src/data/refFormatLivre.ts`) n'ont aucun écran. Une écriture
 *  qui y vit ne crédite QUE si sa fonction porteuse est ATTEINTE par une chaîne d'appels partant de
 *  `src/ui/**` ou d'`ENTREE_GODOT`. Une définition, fût-elle exportée, testée et ré-exportée par l'éditeur, ne crédite
 *  rien : `Scene.flags` ← `setSceneFlags`, exportée, testée et appelée par AUCUN composant,
 *  est précisément le défaut de #841 — le travail s'arrête à la porte de l'interface. */
const BRIDGE_PATH = [
  sous(PONT),
  sous(DOSSIER_HOTE),
  (rel) => path.posix.dirname(norm(rel)) === dossierDe('noyau') && /Edit[^/]*\.ts$/.test(rel),
  sous(`${dossierDe('noyau')}/edition`),
  (rel) => norm(rel) === `${dossierDe('data')}/refFormatLivre.ts`,
];

/** Chemin d'écriture ATTEIGNABLE PAR L'AUTEUR = interface + primitives réellement appelées par elle. */
const AUTHOR_PATH = [...UI_PATH, ...BRIDGE_PATH];

/** Fichiers qui n'écrivent QUE via le pipeline : compilateur d'authoring, scènes en dur.
 *  Un champ dont c'est le SEUL écrivain est exactement le défaut de #841.
 *  Les scripts `.mjs` de `scripts/` ne sont pas typés par le `tsconfig` du dépôt : ils ne peuvent
 *  donc pas alimenter cette colonne INDICATIVE. Ils n'influent pas sur le verdict, qui ne dépend
 *  que de la colonne `authors`. */
const PIPELINE_PATH = [(rel) => norm(rel) === `${dossierDe('noyau')}/mapSpec.ts`, sous(dossierDe('scenes'))];

const isUiPath = (rel) => UI_PATH.some((dans) => dans(rel));
const isPipelinePath = (rel) => PIPELINE_PATH.some((dans) => dans(rel));
const isAuthorPath = (rel) => AUTHOR_PATH.some((dans) => dans(rel));
const isTestFile = (rel) => estFichierVitest(rel) || estKitDeTest(rel);

const SCENE_FILE = 'src/noyau/monde/scene.ts';

/** Racine de la marche d'IDENTITÉ : le schéma du document. */
const SCHEMA_FILE = 'src/data/schemas/defs-scenes/scene.ts';
const SCHEMA_ROOT = 'sceneSchema';

/** Nom du `export const xSchema` dont le shape porte cette déclaration de propriété — chaînes
 *  `.optional()`/`.array()` traversées. Un littéral INLINE ne nomme rien. */
const schemaConstName = (decl) => {
  const shape = decl.parent;
  if (!shape || !ts.isObjectLiteralExpression(shape)) return undefined;
  let n = shape.parent;
  while (n && (ts.isCallExpression(n) || ts.isPropertyAccessExpression(n))) n = n.parent;
  if (!n || !ts.isVariableDeclaration(n) || !ts.isIdentifier(n.name) || !n.name.text.endsWith('Schema')) return undefined;
  return n.name.text;
};

/** Nom du PORTEUR quand le type est anonyme (`__type` — le lot des objets inférés d'un schéma zod). */
const schemaOwner = (decl) => {
  const nom = schemaConstName(decl);
  if (!nom) return undefined;
  const base = nom.slice(0, -'Schema'.length);
  return base.charAt(0).toUpperCase() + base.slice(1);
};

/** Nom du schéma qu'une déclaration de propriété COMPOSE (`parLocalisation: parLocalisationSchema.optional()`
 *  → `ParLocalisation`) — chaînes d'appels traversées. */
const schemaCompose = (decl) => {
  let n = ts.isPropertyAssignment(decl) ? decl.initializer : undefined;
  while (n && (ts.isCallExpression(n) || ts.isPropertyAccessExpression(n))) n = n.expression;
  if (!n || !ts.isIdentifier(n) || !n.text.endsWith('Schema')) return undefined;
  const base = n.text.slice(0, -'Schema'.length);
  return base.charAt(0).toUpperCase() + base.slice(1);
};

/** Une FABRIQUE : une fonction NOMMÉE (déclarée, ou affectée à un `const`), que chaque appel rejoue ; un rappel passé
 *  en argument (`z.lazy(() => …)`) n'en est pas une. */
const estFabrique = (n) =>
  ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n) || ((ts.isArrowFunction(n) || ts.isFunctionExpression(n)) && ts.isVariableDeclaration(n.parent));

/** La déclaration est-elle celle d'une propriété PRODUITE PAR UNE FABRIQUE : une seule déclaration pour chacun de ses
 *  produits ? */
const produitDeFabrique = (decl) => {
  for (let n = decl.parent; n; n = n.parent) if (estFabrique(n)) return true;
  return false;
};

/** Clé d'identité d'un champ : sa déclaration ; ou, pour une propriété sans déclaration propre (synthétique d'un type
 *  mappé, produit de fabrique), l'id de son porteur et son nom. */
export const cleDuChamp = (e) => (e.porteur !== undefined ? `${e.porteur}#${e.field}` : e.decl);

const norm = (p) => p.replace(/\\/g, '/');

/** Le Program du dépôt pour le PÉRIMÈTRE de cette garde — les fichiers scannés (interface, pont,
 *  pipeline) plus le document et son schéma. Aucune rétention (`tsProgram.mjs`). */
export function programmeDuPerimetre(root) {
  const key = norm(path.resolve(root));
  // Racines = les fichiers SCANNÉS plus le schéma ; TypeScript tire leur fermeture d'imports, donc
  // les types restent complets tout en évitant de compiler le dépôt entier.
  return repoProgram(key, (fileNames) =>
    fileNames.filter((f) => {
      const rel = path.relative(key, f);
      return (
        !isTestFile(rel) &&
        (isAuthorPath(rel) || isPipelinePath(rel) || norm(rel) === SCENE_FILE || norm(rel) === SCHEMA_FILE)
      );
    })
  );
}

/** Le type `Scene` du document, au TypeChecker du programme. */
function sceneType(program, root) {
  const checker = program.checker;
  const sf = sceneSourceFile(program, root);
  if (!sf) throw new Error(`${SCENE_FILE} absent du programme`);
  const sceneSym = checker.getExportsOfModule(checker.getSymbolAtLocation(sf)).find((s) => s.name === 'Scene');
  if (!sceneSym) throw new Error('type `Scene` introuvable');
  return checker.getDeclaredTypeOfSymbol(sceneSym);
}

function sceneSourceFile(program, root) {
  const want = norm(path.resolve(root, SCENE_FILE));
  return program.program.getSourceFileNames().map((file) => program.program.getSourceFile(file)).find((sf) => norm(sf.fileName) === want);
}

/** Une déclaration de TYPE de la couche donnée (`interface`, `type`) : la forme DÉCLARÉE d'un schéma (`RefDesignee`,
 *  `TraitPose`, le `{ id: string }` d'un `z.ZodType<…>`) ; un type du moteur (`Condition`, `Flow`, `GameOp`) n'en est pas
 *  une. */
const typeDeLaDonnee = (d) =>
  (ts.isInterfaceDeclaration(d) || ts.isTypeAliasDeclaration(d)) && norm(d.getSourceFile().fileName).includes(`/${dossierDe('data')}/`);

/** Déclarations de `const`, de fonction (une fabrique, à corps) et de type de la donnée (`typeDeLaDonnee`) auxquelles un
 *  identifiant se résout — alias d'import traversés. Résolution par SYMBOLE : un homonyme d'un autre module ne fait
 *  entrer personne dans le périmètre. */
function declarationsMarchees(checker, id) {
  let sym = checker.getSymbolAtLocation(id);
  if (!sym) return [];
  if (sym.flags & SymbolFlags.Alias) {
    try {
      sym = checker.getAliasedSymbol(sym);
    } catch {
      return [];
    }
  }
  return (sym.declarations ?? []).map((d) => d.resolve()).filter((d) => ts.isVariableDeclaration(d) || (ts.isFunctionDeclaration(d) && !!d.body) || typeDeLaDonnee(d));
}

const isCustomSchema = (init) =>
  !!init &&
  ts.isCallExpression(init) &&
  ts.isPropertyAccessExpression(init.expression) &&
  init.expression.name.text === 'custom';

/**
 * ENSEMBLE D'IDENTITÉS du document : les `PropertyAssignment` des shapes atteints depuis
 * `sceneSchema`, corps des fabriques et annotations de type de la donnée compris, `z.custom` et types du moteur exclus
 * (cf. FRONTIÈRE en tête). Vide si le module de schémas n'est pas
 * dans le programme — les programmes VIRTUELS des preuves ne déclarent que `src/noyau/monde/scene.ts`.
 * @returns {Set<import('typescript/unstable/ast').Node>}
 */
export function documentDeclarations(program, root) {
  const checker = program.checker;
  const want = norm(path.resolve(root, SCHEMA_FILE));
  const sf = program.program.getSourceFileNames().map((file) => program.program.getSourceFile(file)).find((s) => norm(s.fileName) === want);
  const noeuds = new Set();
  if (!sf) return noeuds;

  const vues = new Set();
  const file = [];
  const enfiler = (d) => {
    if (!d || vues.has(d) || (ts.isVariableDeclaration(d) && isCustomSchema(d.initializer))) return;
    vues.add(d);
    file.push(d);
  };
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st)) continue;
    for (const d of st.declarationList.declarations)
      if (ts.isIdentifier(d.name) && d.name.text === SCHEMA_ROOT) enfiler(d);
  }
  if (file.length === 0) throw new Error(`\`${SCHEMA_ROOT}\` introuvable dans ${SCHEMA_FILE}`);
  // Les types encore MANUSCRITS du document (`SCENE_FILE`) : leurs annotations mènent aux types de la donnée qu'ils
  // composent (`SceneEntity.calage` : `Calage`).
  const manuscrit = sceneSourceFile(program, root);
  for (const st of manuscrit?.statements ?? []) if (ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st)) enfiler(st);

  for (let i = 0; i < file.length; i++) {
    const visiter = (n) => {
      if (isCustomSchema(n)) return;
      if (ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n) || ts.isPropertySignatureDeclaration(n)) noeuds.add(n);
      if (ts.isIdentifier(n)) for (const d of declarationsMarchees(checker, n)) enfiler(d);
      n.forEachChild(visiter);
    };
    const d = file[i];
    const corps = ts.isFunctionDeclaration(d) ? [d.type, d.body] : ts.isVariableDeclaration(d) ? [d.type, d.initializer] : ts.isTypeAliasDeclaration(d) ? [d.type] : [d];
    for (const c of corps) if (c) visiter(c);
  }
  return noeuds;
}

/**
 * Champs du DOCUMENT de scène, dérivés du type `Scene` par le TypeChecker.
 * @returns {{ id: string, owner: string, field: string, decl: import('typescript/unstable/ast').Declaration }[]}
 */
export function sceneScope(program, root) {
  const checker = program.checker;
  const scene = sceneType(program, root);

  // Périmètre par IDENTITÉ : les shapes atteints depuis `sceneSchema`, plus les corps encore
  // MANUSCRITS de `src/noyau/monde/scene.ts`.
  const docNodes = documentDeclarations(program, root);
  const sceneFile = norm(path.resolve(root, SCENE_FILE));
  const declaredInScene = (decl) =>
    !!decl && (docNodes.has(decl) || norm(decl.getSourceFile().fileName) === sceneFile);

  const out = [];
  const seenTypes = new Set();
  const seenIds = new Set();
  /** Un champ est la déclaration de son type (`cleDuChamp`) : la propriété héritée (`RefASpecialisation.id`, déclarée par
   *  `RefDesignee`) est le champ de sa déclaration, nommé au premier type qui l'atteint. */
  const seenCles = new Set();
  const noter = (champ) => {
    const cle = cleDuChamp(champ);
    if (seenIds.has(champ.id) || seenCles.has(cle)) return;
    seenIds.add(champ.id);
    seenCles.add(cle);
    out.push(champ);
  };

  const visit = (type, ownerPath, parentDecl) => {
    if (!type || seenTypes.has(type)) return;
    seenTypes.add(type);

    if ((type.isUnionType() || type.isIntersectionType())) {
      for (const m of type.getTypes()) visit(m, ownerPath, parentDecl);
      return;
    }
    if (checker.isArrayType(type) || checker.isTupleType(type)) {
      for (const arg of checker.getTypeArguments(type)) visit(arg, ownerPath, parentDecl);
      return;
    }
    if (!(type.flags & TypeFlags.Object)) return;

    const idx = checker.getIndexInfosOfType(type).find((info) => info.keyType.flags & TypeFlags.String);
    if (idx) visit(idx.valueType, ownerPath, parentDecl);

    // Un objet dont aucune propriété n'est déclarée par le document (un type MANUSCRIT du moteur, cf. FRONTIÈRE en
    // tête) : on ne descend pas.
    // Un champ dont le type est UN SEUL littéral de chaîne (le discriminant d'un document qui
    // S'ANNONCE : `Scene.type: 'scene'`, #1552) n'a pas de contrôle d'auteur PAR CONSTRUCTION — il n'a
    // qu'une valeur, il n'y a rien à choisir. Exclusion STRUCTURELLE (la forme du type), jamais par
    // nom de champ : une union (`'interieur' | 'exterieur'`) reste dans le périmètre, elle SE CHOISIT.
    const discriminant = (p) => {
      const t = checker.getTypeAtLocation(p.declarations[0].resolve());
      return !!(t.flags & TypeFlags.StringLiteral);
    };
    const proprietes = checker.getPropertiesOfType(type);
    const dedans = proprietes.filter((p) => declaredInScene(p.declarations?.[0]?.resolve()) && !discriminant(p));
    // Clés LITTÉRALES d'un type mappé : sans déclaration, elles sont du document quand le champ qui porte
    // le type en est.
    const synthetiques = declaredInScene(parentDecl) ? proprietes.filter((p) => !p.declarations?.length) : [];
    for (const prop of synthetiques) {
      const owner = schemaCompose(parentDecl) ?? ownerPath;
      const id = `${owner}.${prop.name}`;
      noter({ id, owner, field: prop.name, decl: parentDecl, porteur: type.id });
      visit(checker.getTypeOfSymbolAtLocation(prop, parentDecl), id, parentDecl);
    }
    if (dedans.length === 0) return;

    const named = type.getAliasSymbol()?.name ?? type.getSymbol()?.name;
    const owner =
      (named && !named.startsWith('__') ? named : undefined) ??
      dedans.map((p) => schemaOwner(p.declarations[0].resolve())).find(Boolean) ??
      ownerPath;
    for (const prop of dedans) {
      const decl = prop.declarations[0].resolve();
      const id = `${owner}.${prop.name}`;
      noter({ id, owner, field: prop.name, decl, ...(produitDeFabrique(decl) ? { porteur: type.id } : {}) });
      visit(checker.getTypeOfSymbolAtLocation(prop, decl), id, decl);
    }
  };

  visit(scene, 'Scene', undefined);
  return out;
}

/** Les membres d'une union ou d'une intersection : chaque `getTypes()` est un aller-retour vers `tsc --api`, que le
 *  client ne met pas en cache (`typescript/dist/api/sync/api.js`, `fetchTypes` sans poignées) ; un type est un objet
 *  stable de sa session, ses membres se lisent donc une fois. */
const membres = new WeakMap();
function flatten(type, acc = []) {
  if (!type) return acc;
  if (!type.isUnionType() && !type.isIntersectionType()) {
    acc.push(type);
    return acc;
  }
  let lus = membres.get(type);
  if (!lus) membres.set(type, (lus = type.getTypes()));
  for (const m of lus) flatten(m, acc);
  return acc;
}

/** Ids de champ du périmètre (`cles`, par `cleDuChamp`) auxquels la propriété `name` de `type` se rattache : sa
 *  déclaration, ou pour une propriété synthétique d'un type mappé ou produite par une fabrique, ce type et son nom. */
export function idsOf(checker, cles, type, name) {
  const ids = new Set();
  for (const t of flatten(type)) {
    const prop = checker.getPropertyOfType(t, name);
    if (!prop) continue;
    const decls = prop.declarations ?? [];
    const id = decls.length ? undefined : cles.get(`${t.id}#${name}`);
    if (id) ids.add(id);
    for (const d of decls) {
      const decl = d.resolve();
      const id = cles.get(produitDeFabrique(decl) ? `${t.id}#${name}` : decl);
      if (id) ids.add(id);
    }
  }
  return ids;
}

/** Ids de champ du périmètre que le DERNIER pas du chemin `chemin` écrit dans le document `doc`, marché sur le type
 *  `Scene` : un rang mène à l'élément d'un tableau, une clé à la propriété (`idsOf`) ou à la valeur d'un index ; un
 *  membre d'union dont un discriminant littéral contredit la valeur du document est écarté. */
export function idsDuChemin(checker, cles, scene, doc, chemin) {
  let types = [scene];
  let valeur = doc;
  let ids = new Set();
  for (const pas of chemin) {
    const suivants = [];
    ids = new Set();
    for (const t of types.flatMap((x) => flatten(x))) {
      if (typeof pas === 'number') {
        if (checker.isArrayType(t) || checker.isTupleType(t)) suivants.push(...checker.getTypeArguments(t));
        continue;
      }
      const contredit = valeur !== null && typeof valeur === 'object' && checker.getPropertiesOfType(t).some((p) => {
        const d = p.declarations?.[0]?.resolve();
        const lt = d && checker.getTypeOfSymbolAtLocation(p, d);
        return !!lt && lt.isStringLiteralType() && p.name in valeur && valeur[p.name] !== lt.value;
      });
      if (contredit) continue;
      const prop = checker.getPropertyOfType(t, pas);
      if (prop) {
        for (const id of idsOf(checker, cles, t, pas)) ids.add(id);
        const decls = prop.declarations ?? [];
        // Une clé synthétique d'un type mappé n'a pas de déclaration où lire son type : le symbole le porte.
        if (decls.length === 0) suivants.push(checker.getTypeOfSymbol(prop));
        for (const d of decls) suivants.push(checker.getTypeOfSymbolAtLocation(prop, d.resolve()));
        continue;
      }
      const idx = checker.getIndexInfosOfType(t).find((i) => i.keyType.flags & TypeFlags.String);
      if (idx) suivants.push(idx.valueType);
    }
    types = suivants;
    valeur = valeur?.[pas];
  }
  return ids;
}

/** La marque d'un crédit par aller-retour dans la colonne `authors`. */
export const ALLER_RETOUR = 'editer (aller-retour)';

/** La valeur du document `doc` au chemin `chemin`. */
const lireAuChemin = (doc, chemin) => chemin.reduce((v, pas) => (v === null || v === undefined ? undefined : v[pas]), doc);

/** Les chemins qu'écrit la valeur `valeur` posée au chemin `chemin` : le sien, et, d'un objet ou d'une liste, celui de
 *  chaque clé ou rang qu'elle porte, de proche en proche. */
const cheminsEcrits = (chemin, valeur) =>
  valeur !== null && typeof valeur === 'object'
    ? [chemin, ...Object.entries(valeur).flatMap(([cle, v]) => cheminsEcrits([...chemin, Array.isArray(valeur) ? Number(cle) : cle], v))]
    : [chemin];

/** Une écriture jouée crédite-t-elle son dernier pas ? Le document a changé à son chemin, la valeur relue est la valeur
 *  jouée, et la saisie n'est pas du JSON (`saisieJson`). */
export const ecritureCreditee = ({ avant, apres, chemin, valeur, saisie }) =>
  saisie !== 'saisieJson' && valeur !== undefined && isDeepStrictEqual(lireAuChemin(apres, chemin), valeur) && !isDeepStrictEqual(lireAuChemin(avant, chemin), lireAuChemin(apres, chemin));

/** Noms écrits par une propriété de littéral d'objet. Une clé CALCULÉE (`{ [k]: v }` piloté par un
 *  tuple `as const` — l'idiome des rangées de cases à cocher de l'inspecteur) rend les littéraux de
 *  chaîne de son type ; toute autre clé calculée ne rend rien. */
function writtenNames(checker, prop) {
  if (!ts.isPropertyAssignment(prop) && !ts.isShorthandPropertyAssignment(prop)) return [];
  if (('name' in prop && ts.isIdentifier(prop.name)) || ts.isStringLiteral(prop.name)) return [prop.name.text];
  if (ts.isComputedPropertyName(prop.name)) {
    return flatten(checker.getTypeAtLocation(prop.name.expression))
      .filter((t) => t.isStringLiteralType())
      .map((t) => t.value);
  }
  return [];
}

/**
 * Champs du périmètre ÉCRITS par un fichier, rattachés au TYPE porteur.
 * Le crédit exige que la propriété écrite remonte à la déclaration exacte du
 * champ dans `scene.ts` : les mappings (`Partial<WallSeg>`, `Pick`, accès indexé) sont donc suivis,
 * les homonymes d'autres types écartés.
 * `creditable(node)` filtre les sites d'écriture retenus — c'est par lui que passe l'exigence
 * d'ATTEIGNABILITÉ depuis un chemin d'auteur pour les fichiers de `BRIDGE_PATH`.
 * @returns {Set<string>} ids de champ (`Porteur.champ`)
 */
export function fieldsWrittenIn(checker, sourceFile, cles, fieldNames, creditable = () => true) {
  const out = new Set();

  const idsDe = (type, name) => idsOf(checker, cles, type, name);

  const credit = (type, name) => {
    for (const id of idsDe(type, name)) out.add(id);
  };

  /** Ce qu'une valeur de type `source` APPORTE au porteur `cible` : les champs de `cible` homonymes d'un champ de
   *  `source` qui n'en viennent pas déjà (l'étalement du porteur lui-même ne fait que recopier). */
  const apporte = (cible, source) => {
    for (const prop of flatten(source).flatMap((t) => checker.getPropertiesOfType(t))) {
      if (!fieldNames.has(prop.name)) continue;
      const target = idsDe(cible, prop.name);
      if (target.size === 0) continue;
      const origin = idsDe(source, prop.name);
      for (const id of target) if (!origin.has(id)) out.add(id);
    }
  };

  /** Écritures d'un appel au helper à CLÉ `f<T, K extends keyof T>(o: T, k: K, …)` dont le corps écrit `x[k] = …` :
   *  le type de l'argument passé pour `o`, et les clés LITTÉRALES passées pour `k`. Résolution par SYMBOLE
   *  (`calleeDeclarations`), jamais par nom : la forme de la signature et l'écriture indexée du corps font le helper. */
  const ecrituresParCle = (call) =>
    calleeDeclarations(checker, call).flatMap((decl) => {
      if (!ts.isFunctionLikeDeclaration(decl) || !decl.body || !decl.typeParameters) return [];
      const nomDuType = (n) => (n && ts.isTypeReferenceNode(n) && ts.isIdentifier(n.typeName) ? n.typeName.text : undefined);
      return decl.typeParameters.flatMap((k) => {
        const c = k.constraint;
        if (!c || !ts.isTypeOperatorNode(c) || c.operator !== ts.SyntaxKind.KeyOfKeyword) return [];
        const t = nomDuType(c.type);
        const iK = decl.parameters.findIndex((p) => nomDuType(p.type) === k.name.text);
        const iT = decl.parameters.findIndex((p) => nomDuType(p.type) === t);
        const pK = decl.parameters[iK];
        if (!t || iK < 0 || iT < 0 || !ts.isIdentifier(pK.name) || !call.arguments[iK] || !call.arguments[iT]) return [];
        let ecrit = false;
        const chercher = (n) => {
          if (
            ts.isBinaryExpression(n) &&
            n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            ts.isElementAccessExpression(n.left) &&
            ts.isIdentifier(n.left.argumentExpression) &&
            n.left.argumentExpression.text === pK.name.text
          )
            ecrit = true;
          if (!ecrit) n.forEachChild(chercher);
        };
        chercher(decl.body);
        if (!ecrit) return [];
        const cles = flatten(checker.getTypeAtLocation(call.arguments[iK])).filter((x) => x.isStringLiteralType()).map((x) => x.value);
        return [{ cible: checker.getTypeAtLocation(call.arguments[iT]), cles }];
      });
    });

  const elementsOf = (types) =>
    types.flatMap((t) =>
      flatten(t).flatMap((f) =>
        checker.isArrayType(f) || checker.isTupleType(f) ? checker.getTypeArguments(f) : []
      )
    );

  /** `{ name, recv }` si l'appel est une MÉTHODE sur un récepteur de type tableau/tuple — la garde
   *  qui distingue `xs.map(cb)` d'un `map` maison portant le même nom. */
  const arrayMethod = (call) => {
    if (!ts.isPropertyAccessExpression(call.expression)) return undefined;
    const recv = flatten(checker.getTypeAtLocation(call.expression.expression));
    if (!recv.some((t) => checker.isArrayType(t) || checker.isTupleType(t))) return undefined;
    return { name: call.expression.name.text, recv };
  };

  const CLIMB_MAX = 16;

  /** Types que le RETOUR de `fn` doit satisfaire : son annotation de retour, sinon — pour un
   *  callback de `map`/`flatMap`/`reduce` sur un tableau — ce que la position de l'APPEL impose. */
  const returnTypes = (fn, depth) => {
    const ann = fn.type;
    if (ann) return [checker.getTypeFromTypeNode(ann)];
    if (!ts.isArrowFunction(fn) && !ts.isFunctionExpression(fn)) return [];
    const call = fn.parent;
    if (!ts.isCallExpression(call) || !call.arguments.includes(fn)) return [];
    const m = arrayMethod(call);
    if (!m) return [];
    if (m.name === 'map' || m.name === 'flatMap') return elementsOf(positionTypes(call, depth + 1));
    if (m.name === 'reduce' || m.name === 'reduceRight') return positionTypes(call, depth + 1);
    return [];
  };

  /** Types imposés par la POSITION d'un nœud, remontés jusqu'à une ANNOTATION explicite.
   *  Comble l'angle mort de `getContextualType` : un littéral qui traverse le paramètre de type d'un
   *  `map`/`flatMap`/`reduce` perd sa freshness, mais l'annotation de la collection qu'il alimente
   *  (`const zones: SceneEffectZone[] = […].map(…)`, un type de retour de fonction annoté) dit
   *  toujours quel type il écrit. Chaque règle part d'un type ÉCRIT par un humain : rien n'est
   *  crédité sur une inférence. */
  const positionTypes = (node, depth = 0) => {
    const parent = node.parent;
    if (!parent || depth > CLIMB_MAX) return [];

    if (
      ts.isParenthesizedExpression(parent) ||
      ts.isAsExpression(parent) ||
      ts.isSatisfiesExpression(parent) ||
      ts.isNonNullExpression(parent)
    )
      return positionTypes(parent, depth + 1);

    if (ts.isVariableDeclaration(parent) && parent.initializer === node)
      return parent.type ? [checker.getTypeFromTypeNode(parent.type)] : [];

    if (ts.isPropertyAssignment(parent) && parent.initializer === node) {
      const names = writtenNames(checker, parent);
      return positionTypes(parent.parent, depth + 1).flatMap((t) =>
        flatten(t).flatMap((f) =>
          names.flatMap((n) => {
            const prop = checker.getPropertyOfType(f, n);
            const d = prop?.declarations?.[0]?.resolve();
            return prop && d ? [checker.getTypeOfSymbolAtLocation(prop, d)] : [];
          })
        )
      );
    }

    if (ts.isArrayLiteralExpression(parent)) return elementsOf(positionTypes(parent, depth + 1));

    if (ts.isSpreadElement(parent)) {
      if (ts.isArrayLiteralExpression(parent.parent)) return positionTypes(parent.parent, depth + 1);
      if (ts.isCallExpression(parent.parent)) {
        const m = arrayMethod(parent.parent);
        return m && (m.name === 'push' || m.name === 'unshift') ? m.recv : [];
      }
      return [];
    }

    if (ts.isCallExpression(parent) && parent.arguments.includes(node)) {
      const m = arrayMethod(parent);
      return m && (m.name === 'push' || m.name === 'unshift') ? elementsOf(m.recv) : [];
    }

    if (ts.isReturnStatement(parent)) {
      for (let n = parent.parent; n; n = n.parent) {
        if (ts.isClassLikeDeclaration(n) || ts.isSourceFile(n)) return [];
        if (ts.isFunctionLikeDeclaration(n)) return returnTypes(n, depth);
      }
      return [];
    }
    if (ts.isArrowFunction(parent) && parent.body === node) return returnTypes(parent, depth);

    return [];
  };

  /** Un littéral qui ne nomme AUCUN champ du périmètre et ne reprend aucune valeur existante ne peut
   *  rien créditer : le scan court-circuite alors la résolution de types, l'essentiel de son coût. */
  const mayWrite = (node) =>
    node.properties.some(
      (p) =>
        ts.isSpreadAssignment(p) ||
        ('name' in p && p.name && ts.isComputedPropertyName(p.name)) ||
        ('name' in p && p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && fieldNames.has(p.name.text))
    ) || (ts.isArrayLiteralExpression(node.parent) && node.parent.elements.some((e) => ts.isSpreadElement(e)));

  const visit = (node) => {
    if (ts.isObjectLiteralExpression(node) && mayWrite(node) && creditable(node)) {
      const ctx = checker.getContextualType(node);
      const spreads = node.properties
        .filter((p) => ts.isSpreadAssignment(p))
        .map((p) => checker.getTypeAtLocation(p.expression));
      // Le type PORTEUR du littéral : son contexte d'écriture, ou à défaut ce dont il repart —
      // l'objet étalé, ou la COLLECTION que le littéral rejoint (`[...scene.layers, { z, tiles }]`).
      const joined = ts.isArrayLiteralExpression(node.parent)
        ? node.parent.elements
            .filter((e) => ts.isSpreadElement(e))
            .flatMap((e) => flatten(checker.getTypeAtLocation(e.expression)))
            .filter((t) => checker.isArrayType(t) || checker.isTupleType(t))
            .flatMap((t) => checker.getTypeArguments(t))
        : [];
      // …et l'ANNOTATION que sa position impose, seule voie quand le littéral traverse le paramètre
      // de type d'un `map`/`flatMap`/`reduce` (freshness perdue, `getContextualType` muet).
      const annotated = positionTypes(node);
      const bearers = ctx ? [ctx, ...spreads, ...joined, ...annotated] : [...spreads, ...joined, ...annotated];
      for (const b of bearers) {
        for (const p of node.properties) for (const n of writtenNames(checker, p)) credit(b, n);
        // Un étalement d'une valeur d'un AUTRE type (`{ ...rectTiréAuPointeur }`) APPORTE ses
        // champs au porteur ; l'étalement du porteur lui-même (`{ ...trigger, … }`) les recopie.
        for (const s of spreads) apporte(b, s);
        // De même, la valeur d'un AUTRE type affectée à un champ (`{ ...part, foot: rectTiréAuPointeur }`) apporte ses
        // champs à celui du champ ; un littéral d'objet affecté se scanne de lui-même.
        for (const p of node.properties) {
          if (!ts.isPropertyAssignment(p) || ts.isObjectLiteralExpression(p.initializer)) continue;
          const valeur = checker.getTypeAtLocation(p.initializer);
          for (const n of writtenNames(checker, p))
            for (const f of flatten(b)) {
              const prop = checker.getPropertyOfType(f, n);
              const d = prop?.declarations?.[0]?.resolve();
              if (prop && d) apporte(checker.getTypeOfSymbolAtLocation(prop, d), valeur);
            }
        }
      }
    } else if (ts.isCallExpression(node) && node.arguments.some((a) => ts.isStringLiteral(a) && fieldNames.has(a.text)) && creditable(node)) {
      for (const { cible, cles: noms } of ecrituresParCle(node)) for (const n of noms) credit(cible, n);
    } else if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      fieldNames.has(node.left.name.text) &&
      creditable(node)
    ) {
      credit(checker.getTypeAtLocation(node.left.expression), node.left.name.text);
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  return out;
}

/** Nœud CANONIQUE d'une déclaration appelable : `export const f = () => …` déclare la fonction sur
 *  son initialiseur, jamais sur la variable. */
const calleeNode = (decl) =>
  ts.isVariableDeclaration(decl) &&
  decl.initializer &&
  (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))
    ? decl.initializer
    : decl;

/** Portées d'EXÉCUTION d'un nœud : chaque fonction qui l'englobe (une fonction imbriquée s'exécute
 *  dans la portée de sa porteuse — un callback de `map` appartient à la fonction qui le passe), ou
 *  le corps du module quand il n'y en a aucune. */
const owningScopes = (node) => {
  const out = [];
  for (let n = node.parent; n; n = n.parent) if (ts.isFunctionLikeDeclaration(n)) out.push(n);
  return out.length > 0 ? out : [node.getSourceFile()];
};

/** Déclarations visées par un appel — résolution de SYMBOLE, alias et ré-exports suivis. Jamais un
 *  rapprochement par NOM : un homonyme d'un autre module ne crée aucune arête. */
function calleeDeclarations(checker, call) {
  let sym = checker.getSymbolAtLocation(call.expression);
  if (!sym) return [];
  if (sym.flags & SymbolFlags.Alias) {
    try {
      sym = checker.getAliasedSymbol(sym);
    } catch {
      return [];
    }
  }
  return (sym.declarations ?? []).map((d) => d.resolve()).map(calleeNode);
}

/**
 * Portées d'exécution ATTEIGNABLES par l'auteur, par fermeture transitive des appels depuis deux racines : l'interface
 * web (`UI_PATH`, tout le fichier) et l'éditeur Godot (`ENTREE_GODOT`, la seule méthode `editer` du pont). Le crédit
 * d'un fichier de `BRIDGE_PATH` en dépend : une primitive que personne n'appelle n'est pas un chemin d'édition, c'est
 * une définition.
 *
 * CE QUE CETTE FERMETURE NE VOIT PAS — donc autant de sources d'orphelins RAPPORTÉS à tort :
 *   - un appel INDIRECT (primitive rangée dans une table de dispatch, passée en callback, atteinte
 *     par `obj[k]()`) : aucun `CallExpression` ne nomme sa cible, aucune arête n'est bâtie ;
 *   - un appel depuis un fichier hors `AUTHOR_PATH` (moteur, store) qu'un écran déclencherait ;
 *   - à l'inverse elle SUR-crédite : une fonction d'un fichier d'interface est réputée atteignable
 *     même si aucun écran ne la monte, et un callback jamais rappelé compte pour sa porteuse. La
 *     frontière mesurée est celle du FICHIER — « une primitive hors interface a-t-elle un appelant
 *     dans l'interface ? » — pas la vivacité d'un composant. Côté Godot, elle est celle de la méthode
 *     `editer` : tout ce qu'elle appelle, l'essai de la scène compris.
 * Un pont présent au programme sans sa méthode `editer` lève : la racine Godot ne se perd pas en silence.
 * @returns {Set<import('typescript/unstable/ast').Node>}
 */
export function auteurReachableScopes(checker, program, root) {
  const reachable = new Set();
  const queue = [];
  const edges = new Map();
  const seed = (n) => {
    if (n && !reachable.has(n)) {
      reachable.add(n);
      queue.push(n);
    }
  };
  const edge = (from, to) => {
    let set = edges.get(from);
    if (!set) edges.set(from, (set = new Set()));
    set.add(to);
  };

  for (const sf of program.program.getSourceFileNames().map((file) => program.program.getSourceFile(file))) {
    if (sf.isDeclarationFile) continue;
    const rel = path.relative(root, sf.fileName);
    if (rel.startsWith('..') || isTestFile(rel) || !isAuthorPath(rel)) continue;
    const ui = isUiPath(rel);
    if (norm(rel) === ENTREE_GODOT.fichier) {
      const entrees = [];
      const chercher = (n) => {
        if (ts.isMethodDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === ENTREE_GODOT.methode) entrees.push(n);
        n.forEachChild(chercher);
      };
      chercher(sf);
      if (entrees.length !== 1) throw new Error(`${ENTREE_GODOT.fichier} : ${entrees.length} méthode(s) \`${ENTREE_GODOT.methode}\`, l’entrée de l’éditeur Godot en attend une`);
      seed(entrees[0]);
    }
    if (ui) {
      seed(sf);
      // Le corps de module d'une primitive IMPORTÉE par l'interface s'exécute au chargement.
      for (const st of sf.statements) {
        const spec = ts.isImportDeclaration(st) || ts.isExportDeclaration(st) ? st.moduleSpecifier : undefined;
        if (!spec) continue;
        for (const d of checker.getSymbolAtLocation(spec)?.declarations ?? [])
          if (ts.isSourceFile(d.resolve())) seed(d.resolve());
      }
    }
    const walk = (node) => {
      if (ts.isCallExpression(node)) {
        const targets = calleeDeclarations(checker, node);
        // Depuis l'interface, tout appel part d'un contexte déjà atteignable : le fichier fait foi.
        for (const from of ui ? [sf] : owningScopes(node)) for (const to of targets) edge(from, to);
      }
      node.forEachChild(walk);
    };
    walk(sf);
  }

  for (let i = 0; i < queue.length; i++) for (const next of edges.get(queue[i]) ?? []) seed(next);
  return reachable;
}

/**
 * Audite le dépôt : pour chaque champ du document de scène, qui l'écrit et par quel chemin. Une écriture jouée par
 * l'éditeur (`ecrituresJouees`, un aller-retour qui joue `editer` : le document avant et après, le chemin écrit depuis
 * la scène, la valeur jouée et sa saisie) crédite, quand `ecritureCreditee`, le dernier pas de chacun des chemins qu'elle
 * écrit (`cheminsEcrits`, `idsDuChemin`), sous la marque `ALLER_RETOUR`.
 * @param {string} root racine du dépôt
 * @param {import('./tsProgram.mjs').SessionProgramme} [program] programme déjà construit — absent, bâti pour CET appel
 * @param {{ ecrituresJouees?: { avant: unknown, apres: unknown, chemin: (string | number)[], valeur: unknown, saisie: string }[] }} [options]
 * @returns {{ id: string, owner: string, field: string, at: string, authors: string[], pipeline: string[] }[]}
 */
export function auditSceneFieldEditability(root, program, { ecrituresJouees = [] } = {}) {
  if (!program) {
    const session = programmeDuPerimetre(root);
    const erreurs = [];
    try { return auditSceneFieldEditability(root, session, { ecrituresJouees }); }
    catch (erreur) { erreurs.push(erreur); }
    finally { libererSessions([session], erreurs); }
  }
  const checker = program.checker;
  const scope = sceneScope(program, root);
  const cles = new Map(scope.map((e) => [cleDuChamp(e), e.id]));
  const fieldNames = new Set(scope.map((e) => e.field));
  const rows = new Map(
    scope.map((e) => {
      const sf = e.decl.getSourceFile();
      const line = sf.getLineAndCharacterOfPosition(e.decl.getStart()).line + 1;
      return [
        e.id,
        {
          id: e.id,
          owner: e.owner,
          field: e.field,
          at: `${norm(path.relative(root, sf.fileName))}:${line}`,
          authors: [],
          pipeline: [],
        },
      ];
    })
  );

  const reachable = auteurReachableScopes(checker, program, root);
  // Hors interface, une écriture ne crédite que si l'une de ses portées d'exécution est atteinte
  // depuis `src/ui/**` ou `ENTREE_GODOT` : le crédit exige un APPELANT, jamais la seule existence d'une définition.
  const atteinte = (node) => owningScopes(node).some((s) => reachable.has(s));

  for (const sf of program.program.getSourceFileNames().map((file) => program.program.getSourceFile(file))) {
    if (sf.isDeclarationFile) continue;
    const rel = path.relative(root, sf.fileName);
    if (rel.startsWith('..')) continue;
    if (isTestFile(rel)) continue; // un champ écrit seulement par un test reste un trou
    const author = isAuthorPath(rel);
    const pipeline = isPipelinePath(rel);
    if (!author && !pipeline) continue;
    const creditable = author && !isUiPath(rel) ? atteinte : () => true;
    for (const id of fieldsWrittenIn(checker, sf, cles, fieldNames, creditable)) {
      const row = rows.get(id);
      if (row) (author ? row.authors : row.pipeline).push(norm(rel));
    }
  }
  const scene = sceneType(program, root);
  for (const e of ecrituresJouees.filter(ecritureCreditee))
    for (const id of cheminsEcrits(e.chemin, e.valeur).flatMap((chemin) => [...idsDuChemin(checker, cles, scene, e.apres, chemin)])) {
      const row = rows.get(id);
      if (row && !row.authors.includes(ALLER_RETOUR)) row.authors.push(ALLER_RETOUR);
    }
  return [...rows.values()];
}

/** Champs sans AUCUN écrivain sur le chemin de l'auteur — le défaut de #841. */
export function orphanFields(rows) {
  return rows.filter((r) => r.authors.length === 0);
}
