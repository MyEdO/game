import { ElementFlags, SymbolFlags, TypeFlags } from 'typescript/unstable/sync';
// Mécanique de scan du garde-fou « tout champ d'un document édité a un chemin d'écriture d'auteur » (#841, #4234) :
// pour chaque racine de `RACINES` (scène, carte du monde, narratif), l'éditeur Godot, méthode `editer` du pont
// (`hotes/godot/pont/CONTRAT.md`, #3508 décision 8), est la seule interface d'auteur.
//
// Le défaut fermé : un champ du document qui n'est joignable QUE par le compilateur d'authoring
// (`mapSpec.ts`), un script `.mjs` ou l'interface web (`src/ui/**`) — donc jamais par l'éditeur de l'auteur.
// L'omission est SILENCIEUSE : le champ existe au modèle, le moteur le lit, aucun test ne casse. La garde ferme la
// CLASSE ; quatre exigences la rendent réfutable :
//
//  1. PÉRIMÈTRE DÉRIVÉ. Les champs surveillés se déduisent du type de la RACINE (`RACINES`) par le TypeChecker —
//     propriétés, éléments de tableau, membres d'union, types littéraux anonymes, valeurs d'index
//     (`Record<string,V>`), clés LITTÉRALES d'un type mappé (`Record<'a' | 'b', V>`, un shape dérivé
//     par `tableTotale`) — propriétés SYNTHÉTIQUES, sans déclaration, rattachées à la déclaration du
//     champ qui porte le type. Aucune liste de types recopiée à la main. Le périmètre est ce que l'auteur CHOISIT
//     (`perimetreDeLaRacine`) : un champ REQUIS dont le type, lu dans son porteur, est UN SEUL littéral n'en est pas, sauf
//     s'il DISCRIMINE l'une des unions par lesquelles son porteur est atteint, sur tous les chemins de la marche : une
//     autre branche objet de l'union porte le même champ à un autre type, ou, toutes ses branches objets, une seule ne
//     le porte pas et chacune des autres le porte à un littéral texte, seule clé de l'union dans ce cas (discriminant de
//     PRÉSENCE).
//  2. CRÉDIT RATTACHÉ AU TYPE. Un écrivain ne compte que si le champ qu'il écrit REMONTE
//     à la déclaration exacte du champ dans le document — pour une propriété synthétique, au type
//     mappé qui la porte et à son nom (`idsOf`). Une propriété PRODUITE PAR UNE FABRIQUE (déclarée dans le corps d'une
//     fonction nommée de la grammaire : `objetDeRef`, `proseNommee`…) n'a qu'une déclaration pour autant de produits
//     que d'appels : elle se nomme, comme la synthétique, par son PORTEUR (le type du produit) et son nom
//     (`produitDeFabrique`, #3606 D1). Un champ est la déclaration de son type : deux produits d'un même type sont un
//     champ, une propriété HÉRITÉE (`RefASpecialisation.id`, déclarée par `RefDesignee`) est celui de sa déclaration,
//     nommé au premier type qui l'atteint. Un `{ once: … }` d'un
//     symptôme de maladie, un `{ window: … }` de condition temporelle ou un `{ flags }` passé en
//     lecture à un contexte d'évaluation ne créditent rien : leur type porteur n'est pas celui du
//     document de scène.
//  3. CRÉDIT RATTACHÉ À UN APPELANT. Une primitive d'édition (`AUTHOR_PATH`) ne crédite que
//     si sa fonction porteuse est ATTEINTE depuis la méthode `editer` du pont
//     Godot (`ENTREE_GODOT`) par une chaîne d'appels résolue au TypeChecker
//     (`auteurReachableScopes`). L'EXISTENCE d'un écrivain ne prouve rien : une primitive
//     complète, testée, ré-exportée par l'éditeur et jamais appelée EST le défaut de #841.
//  4. CRÉDIT PAR ALLER-RETOUR. Une écriture qu'un aller-retour a JOUÉE en jouant `editer` (le geste `valeur` du
//     formulaire tiré du schéma, à clé calculée, que le scan ne voit pas ; `ecrituresJouees` d'`auditerLEditabilite`)
//     ne crédite que si le document a changé à son chemin, que la valeur relue est la valeur jouée et que la saisie
//     n'est pas du JSON. Le dernier pas de chaque chemin prouvé par `cheminsCreditesJoues` reçoit le crédit :
//     (a) le chemin saisi, dont la valeur relue prouve l'écriture, y compris une position scalaire de liste,
//         tuple ou record, distincte du champ qui porte son conteneur ;
//     (b) les structures que le geste pose, chacune comparée sur le même porteur. Monter, insérer ou retirer peut
//         écrire la collection, sans écrire ce que portaient déjà les éléments déplacés ;
//     (c) les scalaires incidents présents avant et après sous un porteur apparié dans la même variante.
//     Le banc conserve le rang du geste et lit les clés du schéma. Le choix d'une VARIANTE crédite son discriminant
//     et les structures qu'il pose. Le chemin correspondant dans chaque document est joint au type de sa racine
//     (idsDuChemin) ; deux déclarations qui ne coïncident pas avant et après ne prouvent pas une écriture incidente.
//     Les champs calculés restent dans la mesure (#4289) : l'empreinte de fragment reçoit son crédit du rescellement,
//     le repère de la propagation du renommage. La garde exige un changement relu dans le porteur identifié.
//
// FRONTIÈRE DU PÉRIMÈTRE — par PROPRIÉTÉ, et l'appartenance se juge par IDENTITÉ, jamais par
// module. L'ENSEMBLE D'IDENTITÉS du document se construit en marchant les schémas depuis
// le schéma de la racine (`sceneSchema`, `data/schemas/defs-scenes/scene.ts`) : toute `PropertyAssignment` d'un shape
// atteint en fait partie, y compris celles d'un schéma FEUILLE d'un autre module (`communs.ts` :
// `ptSchema` ; `grammaire/valeurs.ts` : `moneyPartialSchema`) que le document compose. S'y ajoutent les `PropertySignature` des
// types encore MANUSCRITS du fichier du type de la racine (`src/noyau/monde/scene.ts`). Une frontière posée sur le MODULE perdrait ces
// feuilles dès qu'un corps manuscrit passe en `z.infer` (`DialogueChoice.cost.{gold,silver,brass}`, déclarés par
// `grammaire/valeurs.ts:moneyPartialSchema`).
// La marche suit chaque identifiant jusqu'à sa déclaration : le schéma d'un `const`, le CORPS d'une fabrique (une
// fonction de la grammaire, `conditionDe`, `arbreDeFlow`, `objetDeRef`…), dont les shapes sont ceux de ses produits,
// et l'ANNOTATION de type, qui masque le shape qu'elle déclare (`z.ZodType<{ id: string }>`, `as ChampsNommes`,
// `RefDesignee`, `TraitPose`) : un `interface` ou un `type` de la couche donnée (`typeDeLaDonnee`) entre avec ses
// `PropertySignature`, comme ceux qu'annotent les types MANUSCRITS du document (`SceneEntity.calage` : `Calage`).
// Aucun nœud listé ne l'arrête ; `z.custom<T>()` est une frontière STRUCTURELLE (aucun shape à marcher), détectée et
// jamais listée, et un type du MOTEUR (`Condition`, `Flow`, `GameOp`, `FlowTest`, `src/engine/`) n'est pas de la couche
// donnée : son intérieur reste hors du périmètre tant qu'il n'est pas la sortie de son schéma (#1468).
// Mesure au tronc 64465aeb0 : 462 champs en scène, 484 en carte et 392 en narratif, zéro issu du moteur.
// La mesure des positions et des déclarations de variantes (#4289) porte ces comptes à 497, 507 et 407.
// Le niveau importe : le SYMBOLE d'un type inféré d'un schéma zod est anonyme et déclaré dans
// `zod/v4/core/util.d.cts`, alors que ses PROPRIÉTÉS pointent la ligne exacte du shape. Une
// frontière posée sur le type lâcherait donc en silence dès qu'un corps manuscrit passe en
// `z.infer` ; d'où aussi le CLIQUET DE COMPTE de la garde. La frontière reste structurelle : une propriété ajoutée
// demain dans un module du document, atteignable depuis le type de la racine, entre d'elle-même dans le périmètre.
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
//     `scripts/`, non typés par le `tsconfig`, et l'interface web n'alimentent AUCUNE colonne.
//   - une écriture d'`AUTHOR_PATH` appelée INDIRECTEMENT (table de dispatch, callback, `obj[k]()`) :
//     la fermeture d'appels de `auteurReachableScopes` déclare ses propres angles morts, à lire là-bas.
// Un littéral qui traverse le paramètre de type `U` d'un `Array.prototype.map` perd sa freshness, ce qui prive
// `getContextualType` de tout rattachement (`SceneEffectZone.tiles` ← `src/noyau/mapSpec.ts`) : `positionTypes` le
// rattache par l'annotation de la collection. Une colonne vide est donc un INDICE d'orphelin, jamais une preuve de champ
// mort.
//
// Module ESM pur — consommé par les gardes des trois racines (`garderLaRacine`, `src/ecrituresJouees.testkit.ts`) et
// par les preuves virtuelles de `src/scene-field-editability-guard.test.ts`.
import path from 'node:path';
import * as ts from 'typescript/unstable/ast';
import { repoProgram, libererSessions } from './tsProgram.mjs';
import { estFichierVitest, estKitDeTest } from './fichierVitest.mjs';
import { dossierDe, porteeDeGarde } from './couches.mjs';
import { auChemin, estObjet } from '../../../src/lib/objet.mjs';
import { cheminsCreditesJoues } from './editabiliteEcritures.mjs';

export { cheminsCreditesJoues };

/** `rel` (relatif à la racine, séparateurs quelconques) est-il sous le dossier `dossier` ? */
const sous = (dossier) => (rel) => norm(rel).startsWith(`${dossier}/`);

/** Les zones des hôtes du noyau, dérivées de `COUCHES` (`porteeDeGarde`, qui lève si l'une quitte la table ou cesse de
 *  survivre à la bascule) : `hote`, le modèle de vue commun ; `hotes`, le pont Godot. */
const [DOSSIER_HOTE, DOSSIER_HOTES] = porteeDeGarde(['hote', 'hotes']);

/** Le point d'entrée de l'éditeur Godot : la méthode `editer` du pont (`hotes/godot/pont/CONTRAT.md`, #3508). Il est la
 *  seule racine de la fermeture d'appels : le pont sert aussi la partie, que l'auteur n'édite pas. */
const PONT = `${DOSSIER_HOTES}/godot/pont`;
const ENTREE_GODOT = { fichier: `${PONT}/pont.ts`, methode: 'editer' };

/** Le chemin d'écriture de l'AUTEUR : le pont Godot et le modèle de vue commun des hôtes (`src/hote/`), les modules
 *  d'édition du noyau (`src/noyau/*Edit*.ts`, dont `sceneEdit.ts` et ses lectures `sceneEditLecture.ts`), la session,
 *  le pointeur et l'historique de l'éditeur (`src/noyau/edition/`, #3508) et le parseur de saisie « format livre »
 *  (`src/data/refFormatLivre.ts`). Une écriture qui y vit ne crédite QUE si sa fonction porteuse est ATTEINTE par une
 *  chaîne d'appels partant d'`ENTREE_GODOT`. Une définition, fût-elle exportée, testée et ré-exportée par l'éditeur, ne
 *  crédite rien : `Scene.flags` ← `setSceneFlags`, exportée, testée et appelée par AUCUN geste d'édition, est
 *  précisément le défaut de #841 — le travail s'arrête à la porte de l'éditeur. */
const AUTHOR_PATH = [
  sous(PONT),
  sous(DOSSIER_HOTE),
  (rel) => path.posix.dirname(norm(rel)) === dossierDe('noyau') && /Edit[^/]*\.ts$/.test(rel),
  sous(`${dossierDe('noyau')}/edition`),
  (rel) => norm(rel) === `${dossierDe('data')}/refFormatLivre.ts`,
];

/** Fichiers qui n'écrivent QUE via le pipeline : compilateur d'authoring, scènes en dur.
 *  Un champ dont c'est le SEUL écrivain est exactement le défaut de #841.
 *  Les scripts `.mjs` de `scripts/` ne sont pas typés par le `tsconfig` du dépôt : ils ne peuvent
 *  donc pas alimenter cette colonne INDICATIVE. Ils n'influent pas sur le verdict, qui ne dépend
 *  que de la colonne `authors`. */
const PIPELINE_PATH = [(rel) => norm(rel) === `${dossierDe('noyau')}/mapSpec.ts`, sous(dossierDe('scenes'))];

const isPipelinePath = (rel) => PIPELINE_PATH.some((dans) => dans(rel));
const isAuthorPath = (rel) => AUTHOR_PATH.some((dans) => dans(rel));
const isTestFile = (rel) => estFichierVitest(rel) || estKitDeTest(rel);

/** Les RACINES auditées (#4234) : le schéma d'où part la marche d'IDENTITÉ (`fichierSchema`, `schema`) et le type d'où
 *  part le périmètre (`fichierType`, `type`). */
export const RACINES = {
  scene: { fichierSchema: 'src/data/schemas/defs-scenes/scene.ts', schema: 'sceneSchema', fichierType: 'src/noyau/monde/scene.ts', type: 'Scene' },
  carte: { fichierSchema: 'src/data/schemas/defs-scenes/worldmap.ts', schema: 'worldMapSchema', fichierType: 'src/noyau/worldMap.ts', type: 'WorldMap' },
  narratif: { fichierSchema: 'src/data/schemas/defs-scenes/narratif.ts', schema: 'narratifSchema', fichierType: 'src/data/schemas/defs-scenes/narratif.ts', type: 'NarratifBlock' },
};

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
const cleDuChamp = (e) => (e.porteur !== undefined ? `${e.porteur}#${e.field}` : e.decl);

const norm = (p) => p.replace(/\\/g, '/');

/** Le Program du dépôt pour le PÉRIMÈTRE de cette garde — les fichiers scannés (chemin de l'auteur,
 *  pipeline) plus le type et le schéma de chacune des `racines` (`RACINES`). Aucune rétention (`tsProgram.mjs`). */
export function programmeDuPerimetre(root, racines) {
  const key = norm(path.resolve(root));
  const documents = new Set(racines.flatMap((r) => [r.fichierType, r.fichierSchema]));
  // Racines = les fichiers SCANNÉS plus les documents ; TypeScript tire leur fermeture d'imports, donc
  // les types restent complets tout en évitant de compiler le dépôt entier.
  return repoProgram(key, (fileNames) =>
    fileNames.filter((f) => {
      const rel = path.relative(key, f);
      return !isTestFile(rel) && (isAuthorPath(rel) || isPipelinePath(rel) || documents.has(norm(rel)));
    })
  );
}

/** Le type de la `racine`, au TypeChecker du programme. */
function typeDeRacine(program, root, racine) {
  const checker = program.checker;
  const sf = fichierSource(program, root, racine.fichierType);
  if (!sf) throw new Error(`${racine.fichierType} absent du programme`);
  const sym = checker.getExportsOfModule(checker.getSymbolAtLocation(sf)).find((s) => s.name === racine.type);
  if (!sym) throw new Error(`type \`${racine.type}\` introuvable dans ${racine.fichierType}`);
  return checker.getDeclaredTypeOfSymbol(sym);
}

/** Le fichier `fichier` (relatif à `root`) du programme. */
function fichierSource(program, root, fichier) {
  const want = norm(path.resolve(root, fichier));
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
 * ENSEMBLE D'IDENTITÉS du document de la `racine` : les `PropertyAssignment` des shapes atteints depuis son schéma,
 * corps des fabriques et annotations de type de la donnée compris, `z.custom` et types du moteur exclus
 * (cf. FRONTIÈRE en tête). Vide si le fichier du schéma n'est pas
 * dans le programme — les programmes VIRTUELS des preuves ne déclarent que le fichier du type.
 * @returns {Set<import('typescript/unstable/ast').Node>}
 */
export function documentDeclarations(program, root, racine) {
  const checker = program.checker;
  const sf = fichierSource(program, root, racine.fichierSchema);
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
      if (ts.isIdentifier(d.name) && d.name.text === racine.schema) enfiler(d);
  }
  if (file.length === 0) throw new Error(`\`${racine.schema}\` introuvable dans ${racine.fichierSchema}`);
  // Les types encore MANUSCRITS du document (le fichier du type) : leurs annotations mènent aux types de la donnée qu'ils
  // composent (`SceneEntity.calage` : `Calage`).
  const manuscrit = fichierSource(program, root, racine.fichierType);
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
 * Champs du DOCUMENT de la `racine`, dérivés de son type par le TypeChecker.
 * @returns {{ id: string, owner: string, field: string, decl: import('typescript/unstable/ast').Declaration }[]}
 */
export function perimetreDeLaRacine(program, root, racine) {
  const checker = program.checker;
  const typeRacine = typeDeRacine(program, root, racine);

  // Périmètre par IDENTITÉ : les shapes atteints depuis le schéma de la racine, plus les corps encore
  // MANUSCRITS du fichier de son type.
  const docNodes = documentDeclarations(program, root, racine);
  const fichierType = norm(path.resolve(root, racine.fichierType));
  const duDocument = (decl) =>
    !!decl && (docNodes.has(decl) || norm(decl.getSourceFile().fileName) === fichierType);

  const out = [];
  const seenTypes = new Set();
  const seenCles = new Set();

  /** Les membres de chaque union par laquelle un type est atteint, sur TOUS les chemins de la marche : un type
   *  se visite une fois (`seenTypes`), ses unions s'inscrivent à chaque rencontre. */
  const unionsDe = new Map();
  const inscrire = (type, alternatives) => {
    if (type.isIntersectionType()) for (const m of flatten(type)) inscrire(m, alternatives);
    else (unionsDe.get(type) ?? unionsDe.set(type, []).get(type)).push(alternatives);
  };
  /** Les champs notés dans l'ordre de la marche ; un champ requis à un seul littéral (`litteral`), jugé après elle. */
  const candidats = [];

  /** `alternatives` : les membres, hors `undefined` et `null`, de l'union dont `type` est une branche, pour juger un
   *  discriminant. */
  const visit = (type, ownerPath, parentDecl, alternatives = [], contexte = []) => {
    if (!type) return;
    if (alternatives.length) inscrire(type, alternatives);
    if (seenTypes.has(type)) return;
    seenTypes.add(type);

    if ((type.isUnionType() || type.isIntersectionType())) {
      const membresDirects = membresDe(type);
      const branches = type.isUnionType() ? branchesSansVide(type) : alternatives;
      for (const m of membresDirects) visit(m, ownerPath, parentDecl, branches,
        type.isUnionType() && branches.length > 1 ? [...contexte, qualifierBranche(checker, branches, m)] : contexte);
      return;
    }
    const positions = positionsDeListe(checker, type);
    if (positions.length || checker.isTupleType(type)) {
      for (const [position, arg] of positions) visit(arg, ownerPath, parentDecl, [], position === '[]' ? contexte : [...contexte, position]);
      return;
    }
    if (!(type.flags & TypeFlags.Object)) return;

    const idx = indexTexte(checker, type);
    if (idx) visit(idx.valueType, ownerPath, parentDecl, [], contexte);

    // Un objet dont aucune propriété n'est déclarée par le document (un type MANUSCRIT du moteur, cf. FRONTIÈRE en
    // tête) : on ne descend pas.
    const proprietes = checker.getPropertiesOfType(type);
    const duType = proprietes.filter((p) => duDocument(p.declarations?.[0]?.resolve()));
    // Clés LITTÉRALES d'un type mappé : sans déclaration, elles sont du document quand le champ qui porte
    // le type en est.
    const synthetiques = duDocument(parentDecl) ? proprietes.filter((p) => !p.declarations?.length) : [];
    for (const prop of synthetiques) {
      const owner = schemaCompose(parentDecl) ?? ownerPath;
      const id = `${owner}.${prop.name}`;
      const t = typeDuChamp(checker, prop);
      if (sansValeur(t)) continue;
      candidats.push({ champ: { id, owner, field: prop.name, decl: parentDecl, porteur: type.id }, t, contexte, ownerPath });
      visit(t, id, parentDecl, [], contexte);
    }
    if (duType.length === 0) return;

    const named = type.getAliasSymbol()?.name ?? type.getSymbol()?.name;
    const owner =
      (named && !named.startsWith('__') ? named : undefined) ??
      duType.map((p) => schemaOwner(p.declarations[0].resolve())).find(Boolean) ??
      ownerPath;
    for (const prop of duType) {
      const decl = prop.declarations[0].resolve();
      const id = `${owner}.${prop.name}`;
      const t = typeDuChamp(checker, prop);
      if (sansValeur(t)) continue;
      candidats.push({ champ: { id, owner, field: prop.name, decl, ...(produitDeFabrique(decl) ? { porteur: type.id } : {}) }, t, contexte, ownerPath,
        ...(estLitteral(t) && !(prop.flags & SymbolFlags.Optional) ? { litteral: { porteur: type, prop, t } } : {}) });
      visit(t, id, decl, [], contexte);
    }
  };

  visit(typeRacine, racine.type, undefined);

  // Un champ REQUIS dont le type, lu dans son porteur, est UN SEUL littéral (`Scene.type: 'scene'`, #1552 ;
  // `z.literal('statblock')` ; le `type: T` d'une interface générique instanciée à `'x'`) n'a pas de contrôle d'auteur
  // PAR CONSTRUCTION — il n'a qu'une valeur, il n'y a rien à choisir —, sauf s'il DISCRIMINE l'une des unions par
  // lesquelles son porteur est atteint (`unionsDe`, tous chemins) : une autre branche objet porte le même champ à un
  // autre type, ou, toutes ses branches objets, une seule ne le porte pas et chacune des autres le porte à un littéral
  // texte (discriminant de PRÉSENCE, `discriminantDePresence` de `src/noyau/codex/editFields.ts`), s'il est l'UNIQUE
  // clé de l'union à le faire ; le choix de la variante l'écrit. Exclusion STRUCTURELLE (la forme du type), jamais par nom de champ : une union
  // (`'interieur' | 'exterieur'`) ou un littéral optionnel (`true | undefined`) reste dans le périmètre, il SE CHOISIT.
  // Le type de la DÉCLARATION n'en dit rien : celui d'un shape zod est le schéma, celui d'une interface générique son
  // paramètre.
  const objet = (b) => !!(b.flags & (TypeFlags.Object | TypeFlags.Intersection));
  const portesDe = (branches, nom) => branches.map((a) => (objet(a) ? checker.getPropertyOfType(a, nom) : undefined));
  const dePresence = (branches, nom) => {
    const portes = portesDe(branches, nom);
    return portes.filter((autre) => !autre).length === 1 && portes.every((autre) => !autre || typeDuChamp(checker, autre).isStringLiteralType());
  };
  const discrimine = ({ porteur, prop, t }) =>
    (unionsDe.get(porteur) ?? []).some((branches) => {
      if (portesDe(branches, prop.name).some((autre, i) => !!autre && branches[i] !== porteur && typeDuChamp(checker, autre) !== t)) return true;
      if (!branches.every(objet)) return false;
      const candidates = new Set(branches.flatMap((a) => checker.getPropertiesOfType(a).map((p) => p.name).filter((nom) => dePresence(branches, nom))));
      return candidates.size === 1 && candidates.has(prop.name);
    });
  const distincts = candidats.filter(({ champ, litteral }) => {
    const cle = cleDuChamp(champ);
    if (seenCles.has(cle) || (litteral && !discrimine(litteral))) return false;
    seenCles.add(cle);
    return true;
  });
  const comptes = new Map();
  for (const { champ } of distincts) comptes.set(champ.id, (comptes.get(champ.id) ?? 0) + 1);
  const noms = new Map();
  for (const { champ, t, contexte, ownerPath } of distincts) {
    const { owner, field, decl } = champ;
    const variante = contexte.filter(Boolean).join('');
    const qualifie = comptes.get(champ.id) > 1 ? (ownerPath ?? owner) + variante : owner;
    const id = qualifie + '.' + field;
    const occurrence = (noms.get(id) ?? 0) + 1;
    noms.set(id, occurrence);
    champ.owner = occurrence > 1 ? qualifie + '~' + occurrence : qualifie;
    champ.id = champ.owner + '.' + field;
    out.push(champ);
    for (const position of positionsScalaires(checker, t)) {
      out.push({ id: champ.id + position, owner: champ.owner, field: field + position, decl, position });
    }
  }
  return out;
}

/** Les membres d'une union ou d'une intersection : chaque `getTypes()` est un aller-retour vers `tsc --api`, que le
 *  client ne met pas en cache (`typescript/dist/api/sync/api.js`, `fetchTypes` sans poignées) ; un type est un objet
 *  stable de sa session, ses membres se lisent donc une fois. */
const membres = new WeakMap();
const membresDe = (type) => membres.get(type) ?? membres.set(type, type.getTypes()).get(type);

function flatten(type, acc = []) {
  if (!type) return acc;
  if (!type.isUnionType() && !type.isIntersectionType()) {
    acc.push(type);
    return acc;
  }
  for (const m of membresDe(type)) flatten(m, acc);
  return acc;
}

const typeDuChamp = (checker, p) => (p.declarations?.length
  ? checker.getTypeOfSymbolAtLocation(p, p.declarations[0].resolve())
  : checker.getTypeOfSymbol(p));

const sansValeur = (t) => !!(t.flags & (TypeFlags.Undefined | TypeFlags.Never));
const estLitteral = (t) => t.isStringLiteralType() || t.isNumberLiteralType() || t.isBooleanLiteralType();
const estObjetType = (t) => !!(t.flags & (TypeFlags.Object | TypeFlags.Intersection));
const indexTexte = (checker, t) => checker.getIndexInfosOfType(t).find((i) => i.keyType.flags & (TypeFlags.StringLike | TypeFlags.NumberLike));
const scalaireType = (t) => !!(t.flags & (TypeFlags.StringLike | TypeFlags.NumberLike | TypeFlags.BooleanLike | TypeFlags.Null));

/** Les positions d'un tuple ont chacune leur type. Une liste ordinaire et le reste d'un tuple sont homogènes. */
function positionsDeListe(checker, type) {
  if (!type.isObjectType()) return [];
  if (checker.isArrayType(type)) return checker.getTypeArguments(type).map((t) => ['[]', t]);
  if (!checker.isTupleType(type)) return [];
  const args = checker.getTypeArguments(type);
  const repos = type.getTarget().elementFlags.findIndex((f) => f & ElementFlags.Variable);
  return args.map((t, rang) => {
    if (rang === repos) return ['[]', t];
    const position = repos >= 0 && rang > repos ? rang - args.length : rang;
    return ['[' + position + ']', t];
  });
}

function positionsScalaires(checker, type) {
  const out = new Set();
  const vus = new Set();
  const descendre = (t, chemin) => {
    if (vus.has(t)) return;
    vus.add(t);
    for (const forme of flatten(t)) {
      const liste = positionsDeListe(checker, forme);
      const record = !liste.length && estObjetType(forme) ? indexTexte(checker, forme) : undefined;
      for (const [position, entree] of record ? [['{}', record.valueType]] : liste) {
        const ici = chemin + position;
        if (flatten(entree).some(scalaireType)) out.add(ici);
        descendre(entree, ici);
      }
    }
    vus.delete(t);
  };
  descendre(type, '');
  return out;
}

const nonVides = new WeakMap();
const branchesSansVide = (type) => nonVides.get(type) ?? nonVides.set(type,
  membresDe(type).filter((b) => !(b.flags & (TypeFlags.Undefined | TypeFlags.Null)))).get(type);

const signaturesDUnion = new WeakMap();
const naturesScalaires = new WeakMap();
const ABSENT = { nom: 'absent', optionnel: true, natures: [] };
const jetonLitteral = (v) => '=' + JSON.stringify(v);

/** Les valeurs scalaires dont le type suffit à distinguer une variante. */
function naturesDuType(type) {
  if (naturesScalaires.has(type)) return naturesScalaires.get(type);
  const membres = flatten(type).filter((t) => !sansValeur(t));
  const jetons = membres.map((t) => {
    if (estLitteral(t)) return jetonLitteral(t.value);
    if (t.flags & TypeFlags.StringLike) return 'string';
    if (t.flags & TypeFlags.NumberLike) return 'number';
    if (t.flags & TypeFlags.BooleanLike) return 'boolean';
    if (t.flags & TypeFlags.Null) return jetonLitteral(null);
    return undefined;
  });
  const natures = jetons.includes(undefined) ? undefined : [...new Set(jetons)].sort();
  naturesScalaires.set(type, natures);
  return natures;
}

function contrainteDuChamp(checker, prop, index) {
  if (!prop && !index) return ABSENT;
  const t = prop ? typeDuChamp(checker, prop) : index.valueType;
  if (sansValeur(t)) return ABSENT;
  const optionnel = !prop || !!(prop.flags & SymbolFlags.Optional);
  const natures = naturesDuType(t);
  const nom = natures?.map((n) => n.startsWith('=') ? n.slice(1) : n).join('|') || 'présent';
  return { nom: optionnel ? nom + '?' : nom, optionnel, natures };
}

/** Les seules propriétés qui permettent de distinguer les branches objets de l'union. */
function signaturesDe(checker, branches) {
  const memorisees = signaturesDUnion.get(branches);
  if (memorisees !== undefined) return memorisees;
  const objets = branches.filter((t) => estObjetType(t) && !positionsDeListe(checker, t).length);
  if (objets.length < 2) {
    signaturesDUnion.set(branches, []);
    return [];
  }
  const proprietes = objets.map((t) => new Map(checker.getPropertiesOfType(t).map((p) => [p.name, p])));
  const indexes = objets.map((t) => indexTexte(checker, t));
  const noms = new Set(proprietes.flatMap((ps) => [...ps.keys()]));
  const discriminants = [];
  for (const nom of noms) {
    const contraintes = proprietes.map((ps, i) => contrainteDuChamp(checker, ps.get(nom), indexes[i]));
    if (new Set(contraintes.map((c) => c.nom)).size > 1) discriminants.push([nom, contraintes]);
  }
  // Un discriminant littéral commun nomme la branche sans y encoder les autres champs.
  const litteraux = discriminants.filter(([, cs]) => cs.some((c) => c.natures?.some((n) => n.startsWith('='))));
  const presences = discriminants.filter(([, cs]) => cs.includes(ABSENT) && cs.some((c) => !c.optionnel));
  const nomment = litteraux.length ? litteraux : presences.length ? presences : discriminants;
  const signatures = objets.map((type, i) => ({
    type,
    tests: discriminants.map(([nom, cs]) => [nom, cs[i]]),
    nomment: nomment.map(([nom, cs]) => [nom, cs[i].nom]),
  }));
  signaturesDUnion.set(branches, signatures);
  return signatures;
}

function qualifierBranche(checker, branches, type) {
  const cas = signaturesDe(checker, branches).find((b) => b.type === type)?.nomment;
  return cas?.length ? '<' + cas.map(([nom, valeur]) => nom + '=' + valeur).join(',') + '>' : '';
}

function convientAuScalaire(natures, valeur) {
  if (natures === undefined) return true;
  if (valeur !== null && (estObjet(valeur) || Array.isArray(valeur))) return false;
  return natures.includes(typeof valeur) || natures.includes(jetonLitteral(valeur));
}

/** Les branches dont la forme peut porter la valeur relue. Plusieurs peuvent rester compatibles. */
function branchesDeLaValeur(checker, type, valeur) {
  const branches = membresDe(type);
  const signatures = signaturesDe(checker, branches);
  return branches.filter((t) => {
    if (valeur === undefined) return !sansValeur(t);
    if (Array.isArray(valeur)) return positionsDeListe(checker, t).length > 0;
    if (estObjet(valeur)) {
      if (!estObjetType(t) || positionsDeListe(checker, t).length) return false;
      const signature = signatures.find((b) => b.type === t);
      return !signature || signature.tests.every(([nom, { optionnel, natures }]) => {
        const lue = Object.hasOwn(valeur, nom) ? valeur[nom] : undefined;
        return lue === undefined ? optionnel : convientAuScalaire(natures, lue);
      });
    }
    return !estObjetType(t) && convientAuScalaire(naturesDuType(t), valeur);
  });
}

const branchesOuType = (type) => type.isUnionType() ? membresDe(type) : [type];

/** Les branches du type cible compatibles avec un porteur source. */
function branchesDeLaSource(checker, type, source) {
  if (!type.isUnionType()) return [type];
  if (source.isUnionType()) {
    return [...new Set(membresDe(source).flatMap((t) => branchesDeLaSource(checker, type, t)))];
  }
  const compatibles = [];
  const signatures = signaturesDe(checker, membresDe(type));
  for (const { type: t, tests } of signatures) {
    if (tests.every(([nom, contrainte]) => {
      const prop = checker.getPropertyOfType(source, nom);
      if (!prop || (prop.flags & SymbolFlags.Optional)) return true;
      const valeur = naturesDuType(typeDuChamp(checker, prop));
      if (valeur?.length === 0) return contrainte.optionnel;
      if (contrainte === ABSENT) return false;
      if (!valeur || !contrainte.natures) return true;
      return valeur.some((n) => contrainte.natures.includes(n) ||
        (n.startsWith('=') && contrainte.natures.includes(typeof JSON.parse(n.slice(1)))) ||
        contrainte.natures.some((c) => c.startsWith('=') && n === typeof JSON.parse(c.slice(1))));
    })) compatibles.push(t);
  }
  const objets = membresDe(type).filter(estObjetType);
  const candidats = signatures.length ? compatibles : objets;
  // Une écriture partielle ne possède pas forcément tous les champs requis.
  const assignees = candidats.filter((t) => checker.isTypeAssignableTo(source, t));
  return assignees.length ? assignees : candidats;
}

function idsCommuns(ensembles) {
  const [premier, ...autres] = ensembles;
  return new Set(premier ? [...premier].filter((id) => autres.every((ids) => ids.has(id))) : []);
}

/** Ids de champ du périmètre (`cles`, par `cleDuChamp`) auxquels la propriété `name` de `type` se rattache : sa
 *  déclaration, ou pour une propriété synthétique d'un type mappé ou produite par une fabrique, ce type et son nom. */
function idsOf(checker, cles, type, name) {
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

/** Identités du dernier pas, communes à toutes les branches compatibles quand la valeur n'en départage aucune. */
function idsDuChemin(checker, cles, slots, typeRacine, doc, chemin, crediterSlot = true) {
  function descendre(type, valeur, rang, adresses) {
    if (rang === chemin.length) return new Set(adresses);
    if (type.isUnionType()) {
      return idsCommuns(branchesDeLaValeur(checker, type, valeur)
        .map((branche) => descendre(branche, valeur, rang, adresses)));
    }
    const pas = chemin[rang];
    const relue = auChemin(valeur, [pas]);
    function poursuivre(position, enfant) {
      const sous = adresses.map((id) => id + position);
      if (rang + 1 < chemin.length) return descendre(enfant, relue, rang + 1, sous);
      return new Set(crediterSlot && !estObjet(relue) && !Array.isArray(relue) ? sous.filter((id) => slots.has(id)) : []);
    }
    if (typeof pas === 'number') {
      const positions = positionsDeListe(checker, type);
      const position = positions.find(([p]) => p === '[' + pas + ']')
        ?? (Array.isArray(valeur) ? positions.find(([p]) => p === '[' + (pas - valeur.length) + ']') : undefined)
        ?? positions.find(([p]) => p === '[]');
      return position ? poursuivre(position[0], position[1]) : new Set();
    }
    const prop = checker.getPropertyOfType(type, pas);
    if (prop) {
      const ids = idsOf(checker, cles, type, pas);
      return rang + 1 === chemin.length ? ids : descendre(typeDuChamp(checker, prop), relue, rang + 1, [...ids]);
    }
    const index = indexTexte(checker, type);
    return index ? poursuivre('{}', index.valueType) : new Set();
  }
  return descendre(typeRacine, doc, 0, []);
}

/** La marque d'un crédit par aller-retour dans la colonne `authors`. */
export const ALLER_RETOUR = 'editer (aller-retour)';

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
 * champ dans le document : les mappings (`Partial<WallSeg>`, `Pick`, accès indexé) sont donc suivis,
 * les homonymes d'autres types écartés.
 * `creditable(node)` filtre les sites d'écriture retenus — c'est par lui que passe l'exigence
 * d'ATTEIGNABILITÉ depuis `ENTREE_GODOT` pour les fichiers d'`AUTHOR_PATH`.
 * @returns {Set<string>} ids de champ (`Porteur.champ`)
 */
function fieldsWrittenIn(checker, sourceFile, cles, fieldNames, creditable = () => true) {
  const out = new Set();

  const idsDe = (type, name) => idsOf(checker, cles, type, name);

  const credit = (type, name) => {
    for (const id of idsDe(type, name)) out.add(id);
  };

  /** Ce qu'une valeur de type `source` APPORTE au porteur `cible` : les champs de `cible` homonymes d'un champ de
   *  `source` qui n'en viennent pas déjà (l'étalement du porteur lui-même ne fait que recopier). */
  const apporte = (cible, source) => {
    for (const origine of branchesOuType(source)) {
      if (!estObjetType(origine)) continue;
      const porteurs = branchesDeLaSource(checker, cible, origine);
      for (const prop of checker.getPropertiesOfType(origine)) {
        if (!fieldNames.has(prop.name)) continue;
        const idsOrigine = idsDe(origine, prop.name);
        const communs = idsCommuns(porteurs.map((porteur) => idsDe(porteur, prop.name)));
        for (const id of communs) if (!idsOrigine.has(id)) out.add(id);
      }
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
      const source = checker.getTypeAtLocation(parent.parent);
      return positionTypes(parent.parent, depth + 1).flatMap((t) =>
        branchesDeLaSource(checker, t, source).flatMap((f) =>
          names.flatMap((n) => {
            const prop = checker.getPropertyOfType(f, n);
            const d = prop?.declarations?.[0]?.resolve();
            return prop && d ? [checker.getTypeOfSymbolAtLocation(prop, d)] : [];
          })
        )
      );
    }

    if (ts.isArrayLiteralExpression(parent)) {
      const rang = parent.elements.indexOf(node);
      if (parent.elements.slice(0, rang).some((e) => ts.isSpreadElement(e))) return [];
      return positionTypes(parent, depth + 1).flatMap((t) => flatten(t).flatMap((f) =>
        positionsDeListe(checker, f).filter(([p]) => p === '[]' || p === '[' + rang + ']').map(([, type]) => type)));
    }

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
      const source = bearers.some((t) => t.isUnionType()) ? checker.getTypeAtLocation(node) : undefined;
      const groupes = [...new Set(bearers)].map((t) => source ? branchesDeLaSource(checker, t, source) : [t]);
      for (const groupe of groupes) for (const p of node.properties) for (const n of writtenNames(checker, p)) {
        for (const id of idsCommuns(groupe.map((b) => idsDe(b, n)))) out.add(id);
      }
      // Un étalement d'une autre forme apporte ses champs dans la branche que porte sa source.
      for (const cible of new Set(bearers)) for (const spread of spreads) apporte(cible, spread);
      for (const b of new Set(groupes.flat())) {
        // De même, la valeur d'un AUTRE type affectée à un champ (`{ ...part, foot: rectTiréAuPointeur }`) apporte ses
        // champs à celui du champ ; un littéral d'objet affecté se scanne de lui-même.
        for (const p of node.properties) {
          if (!ts.isPropertyAssignment(p) || ts.isObjectLiteralExpression(p.initializer)) continue;
          const valeur = checker.getTypeAtLocation(p.initializer);
          for (const n of writtenNames(checker, p)) {
            const prop = checker.getPropertyOfType(b, n);
            if (prop) apporte(typeDuChamp(checker, prop), valeur);
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
 * Portées d'exécution ATTEIGNABLES par l'auteur, par fermeture transitive des appels depuis une racine : l'éditeur
 * Godot (`ENTREE_GODOT`, la seule méthode `editer` du pont). Le crédit d'un fichier d'`AUTHOR_PATH` en dépend : une
 * primitive que personne n'appelle n'est pas un chemin d'édition, c'est une définition.
 *
 * CE QUE CETTE FERMETURE NE VOIT PAS — donc autant de sources d'orphelins RAPPORTÉS à tort :
 *   - un appel INDIRECT (primitive rangée dans une table de dispatch, passée en callback, atteinte
 *     par `obj[k]()`) : aucun `CallExpression` ne nomme sa cible, aucune arête n'est bâtie ;
 *   - un appel depuis un fichier hors `AUTHOR_PATH` (moteur) que l'éditeur déclencherait ;
 *   - une écriture au CORPS DE MODULE d'un fichier d'`AUTHOR_PATH` (table de constantes, corps neuf par défaut) : elle
 *     ne crédite jamais, un défaut posé n'est pas un geste d'auteur ;
 *   - à l'inverse elle SUR-crédite : un callback jamais rappelé compte pour sa porteuse. La frontière mesurée est
 *     celle de la méthode `editer` : tout ce qu'elle appelle, l'essai de la scène compris.
 * Un pont présent au programme sans sa méthode `editer` lève : la racine Godot ne se perd pas en silence.
 * @returns {Set<import('typescript/unstable/ast').Node>}
 */
function auteurReachableScopes(checker, program, root) {
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
    const walk = (node) => {
      if (ts.isCallExpression(node)) {
        const targets = calleeDeclarations(checker, node);
        for (const from of owningScopes(node)) for (const to of targets) edge(from, to);
      }
      node.forEachChild(walk);
    };
    walk(sf);
  }

  for (let i = 0; i < queue.length; i++) for (const next of edges.get(queue[i]) ?? []) seed(next);
  return reachable;
}

/**
 * Audite le dépôt : pour chaque champ du document de la `racine` (`RACINES`), qui l'écrit et par quel chemin. Une écriture jouée par
 * l'éditeur (`ecrituresJouees`, un aller-retour qui joue `editer` : le document avant et après, le chemin écrit depuis
 * la racine du document, la valeur jouée et sa saisie) crédite le dernier pas de chacun des chemins qu'elle
 * crédite (`cheminsCreditesJoues`, `idsDuChemin`), sous la marque `ALLER_RETOUR`.
 * @param {string} root racine du dépôt
 * @param {import('./tsProgram.mjs').SessionProgramme} [program] programme déjà construit — absent, bâti pour CET appel
 * @param {{ racine: import('./editabiliteDesChamps.mjs').Racine, ecrituresJouees?: readonly import('./editabiliteDesChamps.mjs').EcritureJouee[] }} options
 * @returns {{ id: string, owner: string, field: string, at: string, authors: string[], pipeline: string[] }[]}
 */
export function auditerLEditabilite(root, program, { racine, ecrituresJouees = [] }) {
  if (!program) {
    const session = programmeDuPerimetre(root, [racine]);
    const erreurs = [];
    try { return auditerLEditabilite(root, session, { racine, ecrituresJouees }); }
    catch (erreur) { erreurs.push(erreur); }
    finally { libererSessions([session], erreurs); }
  }
  const checker = program.checker;
  const scope = perimetreDeLaRacine(program, root, racine);
  const champs = scope.filter((e) => !e.position);
  const cles = new Map(champs.map((e) => [cleDuChamp(e), e.id]));
  const slots = new Set(scope.filter((e) => e.position).map((e) => e.id));
  const fieldNames = new Set(champs.map((e) => e.field));
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
  // Une écriture d'auteur ne crédite que si l'une de ses portées d'exécution est atteinte depuis `ENTREE_GODOT` : le
  // crédit exige un APPELANT, jamais la seule existence d'une définition.
  const atteinte = (node) => owningScopes(node).some((s) => reachable.has(s));

  for (const sf of program.program.getSourceFileNames().map((file) => program.program.getSourceFile(file))) {
    if (sf.isDeclarationFile) continue;
    const rel = path.relative(root, sf.fileName);
    if (rel.startsWith('..')) continue;
    if (isTestFile(rel)) continue; // un champ écrit seulement par un test reste un trou
    const author = isAuthorPath(rel);
    const pipeline = isPipelinePath(rel);
    if (!author && !pipeline) continue;
    const creditable = author ? atteinte : () => true;
    for (const id of fieldsWrittenIn(checker, sf, cles, fieldNames, creditable)) {
      const row = rows.get(id);
      if (row) (author ? row.authors : row.pipeline).push(norm(rel));
    }
  }
  const typeRacine = typeDeRacine(program, root, racine);
  for (const { apres, chemin, temoin, incident } of cheminsCreditesJoues(ecrituresJouees)) {
    const avant = temoin && idsDuChemin(checker, cles, slots, typeRacine, temoin.avant, temoin.chemin, !incident);
    for (const id of idsDuChemin(checker, cles, slots, typeRacine, apres, chemin, !incident)) {
      if (avant && !avant.has(id)) continue;
      const row = rows.get(id);
      if (row && !row.authors.includes(ALLER_RETOUR)) row.authors.push(ALLER_RETOUR);
    }
  }
  return [...rows.values()];
}

/** Champs sans AUCUN écrivain sur le chemin de l'auteur — le défaut de #841. */
export function orphanFields(rows) {
  return rows.filter((r) => r.authors.length === 0);
}
