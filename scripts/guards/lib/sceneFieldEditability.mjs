// Mécanique de scan du garde-fou « tout champ de Scene a un chemin d'écriture d'UI » (#841).
//
// Le constat qui fonde le ticket : 22 champs du document de Scène n'étaient joignables QUE par le
// compilateur d'authoring (`mapSpec.ts`) ou un script `.mjs` — donc par un agent, jamais par un
// auteur au clic. L'omission est SILENCIEUSE : le champ existe au modèle, le moteur le lit, aucun
// test ne casse.
//
// La garde ferme la CLASSE, pas les 22 cas. Deux exigences la rendent réfutable :
//
//  1. PÉRIMÈTRE DÉRIVÉ. Les champs surveillés se déduisent du type `Scene` par le TypeChecker —
//     propriétés, éléments de tableau, membres d'union, types littéraux anonymes, valeurs d'index
//     (`Record<K,V>`). Aucune liste de types recopiée à la main.
//  2. CRÉDIT RATTACHÉ AU TYPE. Un écrivain ne compte que si le champ qu'il écrit REMONTE, via
//     `getRootSymbols`, à la déclaration exacte du champ dans `scene.ts`. Un `{ once: … }` d'un
//     symptôme de maladie, un `{ window: … }` de condition temporelle ou un `{ flags }` passé en
//     lecture à un contexte d'évaluation ne créditent rien : leur type porteur n'est pas celui du
//     document de scène.
//  3. CRÉDIT RATTACHÉ À UN APPELANT. Hors interface (`BRIDGE_PATH`), une primitive ne crédite que
//     si sa fonction porteuse est ATTEINTE depuis `src/ui/**` par une chaîne d'appels résolue au
//     TypeChecker (`uiReachableScopes`). L'EXISTENCE d'un écrivain ne prouve rien : une primitive
//     complète, testée, ré-exportée par l'éditeur et jamais appelée EST le défaut de #841 — c'est
//     l'état mesuré de `setSceneFlags` au 2026-07-26.
//
// FRONTIÈRE DU PÉRIMÈTRE — par PROPRIÉTÉ, et l'appartenance se juge par IDENTITÉ, jamais par
// module. L'ENSEMBLE D'IDENTITÉS du document se construit en marchant les schémas depuis
// `sceneSchema` (`data/schemas/defs-scenes/scene.ts`) : toute `PropertyAssignment` d'un shape
// atteint en fait partie, y compris celles d'un schéma FEUILLE d'un autre module (`communs.ts` :
// `ptSchema` ; `grammaire/valeurs.ts` : `moneyPartialSchema`) que le document compose. S'y ajoutent les `PropertySignature` des
// types encore MANUSCRITS (`src/state/scene.ts`). Une frontière posée sur le MODULE perdait ces
// feuilles dès qu'un corps manuscrit passait en `z.infer` (mesuré : `DialogueChoice.cost.{gold,
// silver,brass}` déclarés par `grammaire/valeurs.ts:moneyPartialSchema`).
// La marche S'ARRÊTE aux nœuds-frontière, désignés eux aussi par IDENTITÉ (module + nom du
// `export const`) : `conditionSchema`, `gameOpSchema`, `flowTestSchema`, `sceneFlowSchema`,
// `effectSchema`, `entityAppearanceSchema` — du vocabulaire PARTAGÉ, qui a ses propres primitives
// d'édition (`FlowEditor`, `GameOpEditor`) et ses propres gardes. Un `z.custom<T>()` est une
// frontière STRUCTURELLE (aucun shape à marcher), détectée et jamais listée.
// Le niveau importe : le SYMBOLE d'un type inféré d'un schéma zod est anonyme et déclaré dans
// `zod/v4/core/util.d.cts`, alors que ses PROPRIÉTÉS pointent la ligne exacte du shape. Une
// frontière posée sur le type lâchait donc en silence dès qu'un corps manuscrit passait en
// `z.infer` (243 → 102 champs sans rougir, mesure #1466 T3-b q24) ; d'où aussi le CLIQUET DE COMPTE
// de la garde. La frontière reste structurelle : une propriété ajoutée demain dans un module du
// document, atteignable depuis `Scene`, entre d'elle-même dans le périmètre.
//
// CE QUE CE DÉTECTEUR NE VOIT PAS — à lire AVANT de conclure d'une colonne vide qu'un champ est
// mort. Le scan reconnaît une écriture par le type PORTEUR du littéral, obtenu soit du type
// contextuel, soit d'un étalement, soit d'une ANNOTATION remontée le long de la position du nœud
// (`positionTypes`). Restent hors de portée, et rendent donc une colonne d'écrivains VIDE alors que
// le champ est bel et bien écrit :
//   - une collection SANS annotation dont le type ne vient que de l'inférence
//     (`const zones = […].map((b) => ({ … }))` puis `s = { ...s, effectZones: zones }`) ;
//   - une écriture via un helper générique dont le paramètre de type se résout à l'appel
//     (`assign<T>(cible, { … })`, `Object.assign`, un `structuredClone` retouché) ;
//   - une écriture par index/clé dynamique (`obj[k] = v`, `Object.entries(...).forEach`) ;
//   - une écriture depuis un fichier hors `AUTHOR_PATH`/`PIPELINE_PATH` : les scripts `.mjs` de
//     `scripts/`, non typés par le `tsconfig`, n'alimentent AUCUNE colonne.
//   - une écriture de `BRIDGE_PATH` appelée INDIRECTEMENT (table de dispatch, callback, `obj[k]()`) :
//     la fermeture d'appels de `uiReachableScopes` déclare ses propres angles morts, à lire là-bas.
// Précédent mesuré (2026-07-26) : `SceneEffectZone.tiles`, écrit par `src/state/mapSpec.ts` à
// travers `Array.prototype.map`, était rapporté « écrivains : AUCUN » — le littéral traverse le
// paramètre de type `U` de `map`, ce qui lui fait perdre sa freshness et prive `getContextualType`
// de tout rattachement. `tsc` a le même angle mort : supprimer le champ n'y produisait aucune
// erreur. Une colonne vide est donc un INDICE d'orphelin, jamais une preuve de champ mort.
//
// Module ESM pur — consommé par `src/ui/editor/scene-field-editability-guard.test.ts`.
import path from 'node:path';
import ts from 'typescript';
import { repoProgram } from './tsProgram.mjs';
import { estFichierVitest } from './fichierVitest.mjs';

/** Fichiers d'INTERFACE : un écrivain qui y vit est joignable au clic par construction — l'auteur
 *  ouvre l'écran. Crédit DIRECT. */
const UI_PATH = [/^src[\\/]ui[\\/]/];

/** Primitives d'édition qui ne sont PAS une interface : `sceneEdit.ts` n'a aucun écran. Une écriture
 *  qui y vit ne crédite QUE si sa fonction porteuse est ATTEINTE par une chaîne d'appels partant de
 *  `src/ui/**`. Une définition, fût-elle exportée, testée et ré-exportée par l'éditeur, ne crédite
 *  rien : `Scene.flags` ← `setSceneFlags` (`src/state/sceneEdit.ts:481`), ré-exporté par
 *  `src/ui/editor/editorState.ts:52` et appelé par AUCUN composant, est précisément le défaut de
 *  #841 — le travail s'arrête à la porte de l'interface. */
const BRIDGE_PATH = [/^src[\\/]state[\\/]sceneEdit\.ts$/];

/** Chemin d'écriture ATTEIGNABLE PAR L'AUTEUR = interface + primitives réellement appelées par elle. */
const AUTHOR_PATH = [...UI_PATH, ...BRIDGE_PATH];

/** Fichiers qui n'écrivent QUE via le pipeline : compilateur d'authoring, scènes en dur.
 *  Un champ dont c'est le SEUL écrivain est exactement le défaut de #841.
 *  Les scripts `.mjs` de `scripts/` ne sont pas typés par le `tsconfig` du dépôt : ils ne peuvent
 *  donc pas alimenter cette colonne INDICATIVE. Ils n'influent pas sur le verdict, qui ne dépend
 *  que de la colonne `authors`. */
const PIPELINE_PATH = [/^src[\\/]state[\\/]mapSpec\.ts$/, /^src[\\/]scenes[\\/]/];

const isUiPath = (rel) => UI_PATH.some((re) => re.test(rel));
const isAuthorPath = (rel) => AUTHOR_PATH.some((re) => re.test(rel));
const isPipelinePath = (rel) => PIPELINE_PATH.some((re) => re.test(rel));
const isTestFile = (rel) => estFichierVitest(rel);

const SCENE_FILE = 'src/state/scene.ts';

/** Racine de la marche d'IDENTITÉ : le schéma du document. */
const SCHEMA_FILE = 'src/data/schemas/defs-scenes/scene.ts';
const SCHEMA_ROOT = 'sceneSchema';

/** Nœuds-FRONTIÈRE par IDENTITÉ — `[module, nom du export const]`. Cf. FRONTIÈRE en tête. */
const FRONTIERE = [
  ['src/data/schemas/grammaire/mecanique.ts', 'conditionSchema'],
  ['src/data/schemas/grammaire/mecanique.ts', 'gameOpSchema'],
  ['src/data/schemas/grammaire/mecanique.ts', 'flowTestSchema'],
  ['src/data/schemas/grammaire/valeurs.ts', 'entityAppearanceSchema'],
  ['src/data/schemas/defs-scenes/effets.ts', 'sceneFlowSchema'],
  ['src/data/schemas/defs-scenes/effets.ts', 'effectSchema'],
];

/**
 * FOSSILES — champs qu'un document ancien porte encore, que le parse TOLÈRE et que le chargement
 * DÉPOUILLE : hors du périmètre éditable, puisque ce ne sont pas des données de scène. La liste est
 * NOMINATIVE et sa PHASE DE MORT est écrite : elle disparaît au reset des saves (L5).
 * Le gate est BIDIRECTIONNEL (`fossileAudit`) : un tag `@fossile` sans entrée ici est ROUGE — sinon
 * le tag serait un canal d'évasion, un champ NEUF tagué sortant du périmètre sans que rien ne rougisse
 * (mesuré, sonde `scratchprobe/1463/lotA-juge/j10-hatch-reel.mjs` cas B) ; une entrée sans tag est
 * ROUGE aussi (tout compromis de TRANSITION se tient au REGISTRE DES FOSSILES du ticket-mère avec la
 * phase qui le tue — `.claude/skills/orchestrer-des-agents/SKILL.md` § Brief).
 * Clé = `<nom du export const>.<champ>` pour un shape zod, `<Type>.<champ>` pour un corps manuscrit.
 */
export const FOSSILES = ['baseDEntiteSchema.foot'];

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

const norm = (p) => p.replace(/\\/g, '/');

/** Le Program du dépôt pour le PÉRIMÈTRE de cette garde — les fichiers scannés (interface, pont,
 *  pipeline) plus le document et son schéma —, MÉMOÏSÉ PAR RACINE : c'est tout ce que cette
 *  fonction ajoute à la fabrique `repoProgram`. Le mémo vit ICI et pas dans la fabrique : la suite
 *  de cette garde redemande le même Program cinq fois (audit, portée, gate `@fossile`) et chaque
 *  construction coûte ~8 s, là où la fabrique ne doit rien retenir pour ses autres consommateurs. */
const PROGRAM_CACHE = new Map();

export function programmeMemoise(root) {
  const key = norm(path.resolve(root));
  const hit = PROGRAM_CACHE.get(key);
  if (hit) return hit;
  // Racines = les fichiers SCANNÉS plus le schéma ; TypeScript tire leur fermeture d'imports, donc
  // les types restent complets tout en évitant de compiler le dépôt entier.
  const program = repoProgram(key, (fileNames) =>
    fileNames.filter((f) => {
      const rel = path.relative(key, f);
      return (
        !isTestFile(rel) &&
        (isAuthorPath(rel) || isPipelinePath(rel) || norm(rel) === SCENE_FILE || norm(rel) === SCHEMA_FILE)
      );
    })
  );
  PROGRAM_CACHE.set(key, program);
  return program;
}

function sceneSourceFile(program, root) {
  const want = norm(path.resolve(root, SCENE_FILE));
  return program.getSourceFiles().find((sf) => norm(sf.fileName) === want);
}

/** `VariableDeclaration`s auxquelles un identifiant se résout — alias d'import traversés. Résolution
 *  par SYMBOLE : un homonyme d'un autre module ne fait entrer personne dans le périmètre. */
function variableDeclarationsOf(checker, id) {
  let sym = checker.getSymbolAtLocation(id);
  if (!sym) return [];
  if (sym.flags & ts.SymbolFlags.Alias) {
    try {
      sym = checker.getAliasedSymbol(sym);
    } catch {
      return [];
    }
  }
  return (sym.declarations ?? []).filter(ts.isVariableDeclaration);
}

const isCustomSchema = (init) =>
  !!init &&
  ts.isCallExpression(init) &&
  ts.isPropertyAccessExpression(init.expression) &&
  init.expression.name.text === 'custom';

/**
 * ENSEMBLE D'IDENTITÉS du document : les `PropertyAssignment` des shapes atteints depuis
 * `sceneSchema`, frontières exclues (cf. FRONTIÈRE en tête). Vide si le module de schémas n'est pas
 * dans le programme — les programmes VIRTUELS des preuves ne déclarent que `src/state/scene.ts`.
 * @returns {Set<import('typescript').Node>}
 */
export function documentDeclarations(program, root) {
  const checker = program.getTypeChecker();
  const want = norm(path.resolve(root, SCHEMA_FILE));
  const sf = program.getSourceFiles().find((s) => norm(s.fileName) === want);
  const noeuds = new Set();
  if (!sf) return noeuds;

  const frontiere = new Set(FRONTIERE.map(([f, n]) => `${norm(path.resolve(root, f))}#${n}`));
  const idOf = (d) => `${norm(d.getSourceFile().fileName)}#${ts.isIdentifier(d.name) ? d.name.text : ''}`;

  const vues = new Set();
  const file = [];
  const enfiler = (d) => {
    if (!d || vues.has(d) || frontiere.has(idOf(d)) || isCustomSchema(d.initializer)) return;
    vues.add(d);
    file.push(d);
  };
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st)) continue;
    for (const d of st.declarationList.declarations)
      if (ts.isIdentifier(d.name) && d.name.text === SCHEMA_ROOT) enfiler(d);
  }
  if (file.length === 0) throw new Error(`\`${SCHEMA_ROOT}\` introuvable dans ${SCHEMA_FILE}`);

  for (let i = 0; i < file.length; i++) {
    const visiter = (n) => {
      if (ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) noeuds.add(n);
      if (ts.isIdentifier(n)) for (const d of variableDeclarationsOf(checker, n)) enfiler(d);
      ts.forEachChild(n, visiter);
    };
    if (file[i].initializer) visiter(file[i].initializer);
  }
  return noeuds;
}

const aTagFossile = (decl) => ts.getJSDocTags(decl).some((t) => t.tagName.text === 'fossile');

/** Clé de fossile d'une déclaration : `<export const>.<champ>` (shape zod) ou `<Type>.<champ>`
 *  (corps manuscrit). `undefined` si la déclaration n'est pas nommable. */
function fossileKey(decl) {
  const nom = decl.name && (ts.isIdentifier(decl.name) || ts.isStringLiteral(decl.name)) ? decl.name.text : undefined;
  if (!nom) return undefined;
  if (ts.isPropertyAssignment(decl) || ts.isShorthandPropertyAssignment(decl)) {
    const porteur = schemaConstName(decl);
    return porteur ? `${porteur}.${nom}` : undefined;
  }
  const p = decl.parent;
  if (p && (ts.isInterfaceDeclaration(p) || ts.isTypeAliasDeclaration(p)) && ts.isIdentifier(p.name))
    return `${p.name.text}.${nom}`;
  if (p && ts.isTypeLiteralNode(p) && p.parent && ts.isTypeAliasDeclaration(p.parent))
    return `${p.parent.name.text}.${nom}`;
  return undefined;
}

/**
 * Gate `@fossile` BIDIRECTIONNEL — cf. `FOSSILES`. Les deux sens sont des ROUGES.
 * @returns {{ taguesHorsListe: string[], entreesSansTag: string[] }}
 */
export function fossileAudit(program, root) {
  const tags = new Set();
  const collecte = (decl) => {
    if (!aTagFossile(decl)) return;
    const k = fossileKey(decl);
    tags.add(k ?? `<déclaration non nommable> ${norm(path.relative(root, decl.getSourceFile().fileName))}:${decl.getSourceFile().getLineAndCharacterOfPosition(decl.getStart()).line + 1}`);
  };
  for (const n of documentDeclarations(program, root)) collecte(n);
  const sf = sceneSourceFile(program, root);
  if (sf) {
    const visiter = (n) => {
      if (ts.isPropertySignature(n)) collecte(n);
      ts.forEachChild(n, visiter);
    };
    visiter(sf);
  }
  const listes = new Set(FOSSILES);
  return {
    taguesHorsListe: [...tags].filter((k) => !listes.has(k)).sort(),
    entreesSansTag: FOSSILES.filter((k) => !tags.has(k)).sort(),
  };
}

/**
 * Champs du DOCUMENT de scène, dérivés du type `Scene` par le TypeChecker.
 * @returns {{ id: string, owner: string, field: string, decl: import('typescript').Declaration }[]}
 */
export function sceneScope(program, root) {
  const checker = program.getTypeChecker();
  const sf = sceneSourceFile(program, root);
  if (!sf) throw new Error(`${SCENE_FILE} absent du programme`);
  const moduleSym = checker.getSymbolAtLocation(sf);
  const sceneSym = checker.getExportsOfModule(moduleSym).find((s) => s.name === 'Scene');
  if (!sceneSym) throw new Error('type `Scene` introuvable');

  // Périmètre par IDENTITÉ : les shapes atteints depuis `sceneSchema`, plus les corps encore
  // MANUSCRITS de `src/state/scene.ts`.
  const docNodes = documentDeclarations(program, root);
  const sceneFile = norm(path.resolve(root, SCENE_FILE));
  const declaredInScene = (decl) =>
    !!decl && (docNodes.has(decl) || norm(decl.getSourceFile().fileName) === sceneFile);
  // Un fossile GATÉ (tagué ET tenu au registre `FOSSILES`) sort du périmètre éditable ; tagué sans
  // entrée, il y RESTE — c'est `fossileAudit` qui en fait un rouge, jamais un silence.
  const gate = new Set(FOSSILES);
  const fossileGate = (decl) => aTagFossile(decl) && gate.has(fossileKey(decl));

  const out = [];
  const seenTypes = new Set();
  const seenIds = new Set();

  const visit = (type, ownerPath) => {
    if (!type || seenTypes.has(type)) return;
    seenTypes.add(type);

    if (type.isUnionOrIntersection()) {
      for (const m of type.types) visit(m, ownerPath);
      return;
    }
    if (checker.isArrayType(type) || checker.isTupleType(type)) {
      for (const arg of checker.getTypeArguments(type)) visit(arg, ownerPath);
      return;
    }
    if (!(type.flags & ts.TypeFlags.Object)) return;

    const idx = checker.getIndexInfoOfType(type, ts.IndexKind.String);
    if (idx) visit(idx.type, ownerPath);

    // FRONTIÈRE (par PROPRIÉTÉ) : un objet dont aucune propriété n'est déclarée par un module du
    // document est du vocabulaire PARTAGÉ (Flow/Condition/GameOp/EntityAppearance/CustomStatblock…),
    // on ne descend pas.
    // Un champ dont le type est UN SEUL littéral de chaîne (le discriminant d'un document qui
    // S'ANNONCE : `Scene.type: 'scene'`, #1552) n'a pas de contrôle d'auteur PAR CONSTRUCTION — il n'a
    // qu'une valeur, il n'y a rien à choisir. Exclusion STRUCTURELLE (la forme du type), jamais par
    // nom de champ : une union (`'interieur' | 'exterieur'`) reste dans le périmètre, elle SE CHOISIT.
    const discriminant = (p) => {
      const t = checker.getTypeAtLocation(p.declarations[0]);
      return !!(t.flags & ts.TypeFlags.StringLiteral);
    };
    const dedans = checker
      .getPropertiesOfType(type)
      .filter((p) => declaredInScene(p.declarations?.[0]) && !fossileGate(p.declarations[0]) && !discriminant(p));
    if (dedans.length === 0) return;

    const named = type.aliasSymbol?.name ?? type.symbol?.name;
    const owner =
      (named && !named.startsWith('__') ? named : undefined) ??
      dedans.map((p) => schemaOwner(p.declarations[0])).find(Boolean) ??
      ownerPath;
    for (const prop of dedans) {
      const decl = prop.declarations[0];
      const id = `${owner}.${prop.name}`;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        out.push({ id, owner, field: prop.name, decl });
      }
      visit(checker.getTypeOfSymbolAtLocation(prop, decl), id);
    }
  };

  visit(checker.getDeclaredTypeOfSymbol(sceneSym), 'Scene');
  return out;
}

function flatten(type, acc = []) {
  if (!type) return acc;
  if (type.isUnionOrIntersection()) for (const m of type.types) flatten(m, acc);
  else acc.push(type);
  return acc;
}

/** Noms écrits par une propriété de littéral d'objet. Une clé CALCULÉE (`{ [k]: v }` piloté par un
 *  tuple `as const` — l'idiome des rangées de cases à cocher de l'inspecteur) rend les littéraux de
 *  chaîne de son type ; toute autre clé calculée ne rend rien. */
function writtenNames(checker, prop) {
  if (!ts.isPropertyAssignment(prop) && !ts.isShorthandPropertyAssignment(prop)) return [];
  if (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) return [prop.name.text];
  if (ts.isComputedPropertyName(prop.name)) {
    return flatten(checker.getTypeAtLocation(prop.name.expression))
      .filter((t) => t.isStringLiteral())
      .map((t) => t.value);
  }
  return [];
}

/**
 * Champs du périmètre ÉCRITS par un fichier, rattachés au TYPE porteur.
 * Le crédit exige que la propriété écrite remonte (`getRootSymbols`) à la déclaration exacte du
 * champ dans `scene.ts` : les mappings (`Partial<WallSeg>`, `Pick`, accès indexé) sont donc suivis,
 * les homonymes d'autres types écartés.
 * `creditable(node)` filtre les sites d'écriture retenus — c'est par lui que passe l'exigence
 * d'ATTEIGNABILITÉ depuis l'interface pour les fichiers de `BRIDGE_PATH`.
 * @returns {Set<string>} ids de champ (`Porteur.champ`)
 */
export function fieldsWrittenIn(checker, sourceFile, declToId, fieldNames, creditable = () => true) {
  const out = new Set();

  /** Ids de champ du périmètre auxquels la propriété `name` de `type` se rattache. */
  const idsOf = (type, name) => {
    const ids = new Set();
    for (const t of flatten(type)) {
      const prop = checker.getPropertyOfType(t, name);
      if (!prop) continue;
      for (const root of [prop, ...checker.getRootSymbols(prop)]) {
        for (const d of root.declarations ?? []) {
          const id = declToId.get(d);
          if (id) ids.add(id);
        }
      }
    }
    return ids;
  };

  const credit = (type, name) => {
    for (const id of idsOf(type, name)) out.add(id);
  };

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
    const ann = ts.getEffectiveReturnTypeNode(fn);
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
            const d = prop?.declarations?.[0];
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
        if (ts.isClassLike(n) || ts.isSourceFile(n)) return [];
        if (ts.isFunctionLike(n)) return returnTypes(n, depth);
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
        (p.name && ts.isComputedPropertyName(p.name)) ||
        (p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && fieldNames.has(p.name.text))
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
        for (const s of spreads) {
          for (const prop of flatten(s).flatMap((t) => checker.getPropertiesOfType(t))) {
            const target = idsOf(b, prop.name);
            if (target.size === 0) continue;
            const origin = idsOf(s, prop.name);
            for (const id of target) if (!origin.has(id)) out.add(id);
          }
        }
      }
    } else if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      fieldNames.has(node.left.name.text) &&
      creditable(node)
    ) {
      credit(checker.getTypeAtLocation(node.left.expression), node.left.name.text);
    }
    ts.forEachChild(node, visit);
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
  for (let n = node.parent; n; n = n.parent) if (ts.isFunctionLike(n)) out.push(n);
  return out.length > 0 ? out : [node.getSourceFile()];
};

/** Déclarations visées par un appel — résolution de SYMBOLE, alias et ré-exports suivis. Jamais un
 *  rapprochement par NOM : un homonyme d'un autre module ne crée aucune arête. */
function calleeDeclarations(checker, call) {
  let sym = checker.getSymbolAtLocation(call.expression);
  if (!sym) return [];
  if (sym.flags & ts.SymbolFlags.Alias) {
    try {
      sym = checker.getAliasedSymbol(sym);
    } catch {
      return [];
    }
  }
  return (sym.declarations ?? []).map(calleeNode);
}

/**
 * Portées d'exécution ATTEIGNABLES depuis l'interface (`UI_PATH`), par fermeture transitive des
 * appels. Le crédit d'un fichier de `BRIDGE_PATH` en dépend : une primitive que personne n'appelle
 * n'est pas un chemin d'édition, c'est une définition.
 *
 * CE QUE CETTE FERMETURE NE VOIT PAS — donc autant de sources d'orphelins RAPPORTÉS à tort :
 *   - un appel INDIRECT (primitive rangée dans une table de dispatch, passée en callback, atteinte
 *     par `obj[k]()`) : aucun `CallExpression` ne nomme sa cible, aucune arête n'est bâtie ;
 *   - un appel depuis un fichier hors `AUTHOR_PATH` (moteur, store) qu'un écran déclencherait ;
 *   - à l'inverse elle SUR-crédite : une fonction d'un fichier d'interface est réputée atteignable
 *     même si aucun écran ne la monte, et un callback jamais rappelé compte pour sa porteuse. La
 *     frontière mesurée est celle du FICHIER — « une primitive hors interface a-t-elle un appelant
 *     dans l'interface ? » — pas la vivacité d'un composant.
 * @returns {Set<import('typescript').Node>}
 */
export function uiReachableScopes(checker, program, root) {
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

  for (const sf of program.getSourceFiles()) {
    if (sf.isDeclarationFile) continue;
    const rel = path.relative(root, sf.fileName);
    if (rel.startsWith('..') || isTestFile(rel) || !isAuthorPath(rel)) continue;
    const ui = isUiPath(rel);
    if (ui) {
      seed(sf);
      // Le corps de module d'une primitive IMPORTÉE par l'interface s'exécute au chargement.
      for (const st of sf.statements) {
        const spec = ts.isImportDeclaration(st) || ts.isExportDeclaration(st) ? st.moduleSpecifier : undefined;
        if (!spec) continue;
        for (const d of checker.getSymbolAtLocation(spec)?.declarations ?? [])
          if (ts.isSourceFile(d)) seed(d);
      }
    }
    const walk = (node) => {
      if (ts.isCallExpression(node)) {
        const targets = calleeDeclarations(checker, node);
        // Depuis l'interface, tout appel part d'un contexte déjà atteignable : le fichier fait foi.
        for (const from of ui ? [sf] : owningScopes(node)) for (const to of targets) edge(from, to);
      }
      ts.forEachChild(node, walk);
    };
    walk(sf);
  }

  for (let i = 0; i < queue.length; i++) for (const next of edges.get(queue[i]) ?? []) seed(next);
  return reachable;
}

/**
 * Audite le dépôt : pour chaque champ du document de scène, qui l'écrit et par quel chemin.
 * @param {string} root racine du dépôt
 * @param {import('typescript').Program} [program] programme déjà construit (preuves en mémoire)
 * @returns {{ id: string, owner: string, field: string, at: string, authors: string[], pipeline: string[] }[]}
 */
export function auditSceneFieldEditability(root, program = programmeMemoise(root)) {
  const checker = program.getTypeChecker();
  const scope = sceneScope(program, root);
  const declToId = new Map(scope.map((e) => [e.decl, e.id]));
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

  const reachable = uiReachableScopes(checker, program, root);
  // Hors interface, une écriture ne crédite que si l'une de ses portées d'exécution est atteinte
  // depuis `src/ui/**` : le crédit exige un APPELANT, jamais la seule existence d'une définition.
  const reachedFromUi = (node) => owningScopes(node).some((s) => reachable.has(s));

  for (const sf of program.getSourceFiles()) {
    if (sf.isDeclarationFile) continue;
    const rel = path.relative(root, sf.fileName);
    if (rel.startsWith('..')) continue;
    if (isTestFile(rel)) continue; // un champ écrit seulement par un test reste un trou
    const author = isAuthorPath(rel);
    const pipeline = isPipelinePath(rel);
    if (!author && !pipeline) continue;
    const creditable = author && !isUiPath(rel) ? reachedFromUi : () => true;
    for (const id of fieldsWrittenIn(checker, sf, declToId, fieldNames, creditable)) {
      const row = rows.get(id);
      if (row) (author ? row.authors : row.pipeline).push(norm(rel));
    }
  }
  return [...rows.values()];
}

/** Champs sans AUCUN écrivain sur le chemin de l'auteur — le défaut de #841. */
export function orphanFields(rows) {
  return rows.filter((r) => r.authors.length === 0);
}
