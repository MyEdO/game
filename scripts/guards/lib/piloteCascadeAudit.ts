/**
 * AUDIT des PILOTES DE CASCADE RECOPIÉS dans un test (#1765) — définition UNIQUE de la mesure, partagée
 * par la garde `src/state/pilote-cascade.test.ts` et la régénération de `piloteCascadeStock.mjs`
 * (`regenerations`).
 *
 * Classe de défaut mesurée : une ITÉRATION d'une suite ou d'un kit de test (`fichierVitest.mjs`), dans tous
 * les dialectes que ses prédicats reconnaissent (`EXTENSIONS_DE_SCRIPT`) — boucle
 * (`for`, `for…of`, `for…in`, `while`, `do`), callback d'un itérateur (`ITERATEURS` ; le receveur ne
 * s'itère pas) ou fonction nommée qui s'appelle elle-même — qui PILOTE la cascade À LA MAIN : elle LIT
 * `pendingCascade` et JOUE un verbe `cascade*` du store, à côté du kit (`cascadeTestKit.ts`). Quand un flux
 * est refondu, c'est elle qui dérive. Une fonction À UNE ÉTAPE (lire, poser, valider) n'est pas un pilote :
 * c'est le grain auquel un test exerce et observe une étape ; la boucle qui l'appelle en est un.
 *
 * LIRE, c'est nommer `pendingCascade`, nu, par point ou par accès calculé à chaîne littérale
 * (`s['pendingCascade']`) — hors la CLÉ d'une propriété `pendingCascade: …`, qui l'écrit ; JOUER, c'est
 * appeler un verbe `cascade*`, par son nom, par point ou par accès calculé à chaîne littérale
 * (`s['cascadeNext']()`). Un appel au KIT n'est ni un verbe ni une exemption : un nom importé de
 * `cascadeTestKit` — par `import { … }`, ou par `import * as kit` (`kit.x(…)`, `kit['x'](…)`) — ne joue rien.
 *
 * HELPER : une fonction locale NOMMÉE (déclaration, ou `const` flèche/fonction), non récursive, dont aucune
 * itération ne lit ni ne joue DIRECTEMENT — un callback de DONNÉES (`participants.findIndex(…)`, `.map(…)`)
 * ne pilote pas et ne la disqualifie pas. Son statut est DIRECT, lu sur son seul corps : LECTRICE s'il lit,
 * JOUEUSE s'il joue, les deux à la fois s'il le faut. Une fonction dont une itération lit ou joue directement
 * ne prête aucun statut à ses appelants : cette itération est jugée là où elle est. La règle est
 * syntaxique : ni point fixe, ni cycle.
 *
 * SITE : une itération qui lit ET joue, chacun directement ou par l'appel d'un helper. Jugée en
 * POST-ORDRE : le sous-arbre d'une itération imbriquée déjà site ne compte pas pour celle qui l'englobe.
 * Un appel en ligne droite n'est pas une itération : il n'est pas compté.
 *
 * Un callback DIFFÉRÉ n'appartient pas à l'itération qui le DÉCLARE : il s'exécute plus tard. Est différé
 * le callback d'un appel dont la RACINE — l'identifiant au bout de la chaîne d'appels, d'accès par point ou
 * calculé à chaîne littérale (`it['skip']`), d'étiquettes de gabarit, de parenthèses et d'assertions non
 * nulles (`!`) — est un bloc de test (`it`, `test`, `describe`, modificateurs compris : `it.skip`,
 * `it.each(rows)(…)`, `` it.each`…`(…) ``) ou un hook (`beforeEach`, `afterEach`, `beforeAll`, `afterAll`),
 * importé ou global : un nom LIÉ dans une portée qui englobe l'appel (`const test = …`, paramètre, liaison
 * de `for`, fonction ou classe locale, nom propre d'une expression de fonction ou de classe — un `declare`
 * ambiant ne lie rien) n'en est pas un. Un receveur qui n'y remonte pas (`suite.test`) n'en déclare aucun.
 * Un bloc de test ouvre son contexte nommé ; un hook garde le contexte qui l'englobe.
 *
 * Une EXEMPTION se pose AU SITE (`EXEMPTIONS`, patron de `cylindreHorsSocle.mjs`) : `fichier`, `motif`
 * ANCRÉ `^…$` sur le `ref` du site, `raison`. Elle couvre EXACTEMENT un site de son fichier : un motif qui
 * en touche plusieurs n'en couvre aucun, et la garde exige un site par exemption. L'identité d'un site au
 * stock est `{ fichier, ref, occurrence }`, jamais son numéro de ligne.
 *
 * Lu sur l'ARBRE SYNTAXIQUE (`dialecte.mjs`), jamais sur le texte : un nom cité en commentaire ou en
 * chaîne ne compte pas. Le `ref` d'un site est son CONTEXTE nommé le plus proche — le titre du `it`/
 * `test`/`describe`, ou le nom de la fonction —, stable quand des lignes bougent au-dessus.
 *
 * LIMITES admises, chacune avec son COMPTE au corpus mesuré (2173 fichiers, 39 sites dont 3 exemptés) et
 * sa SONDE, collée au ticket : #1765 issuecomment-6195158339, références L-A à L-D :
 *  - un helper à DEUX niveaux : un helper qui n'atteint `pendingCascade` (ou un verbe) que par l'appel d'un
 *    autre helper n'est ni lecteur ni joueur, et ne prête rien à qui l'appelle — 4 occurrences, non
 *    pilotes : `cascade-parite-porteur.test.ts` (`it:CONTRÔLE POSITIF — les trois politiques rendent TROIS
 *    conduites DISTINCTES (la sonde discrimine)`), `miscast-step.test.ts` (`it:SONDE F — hors Colère, AUCUN
 *    modificateur n’est déclaré (le moteur n’en applique aucun)`), `scripts/recette/lib.test.mjs`
 *    (`test:tournerCamera : zéro sans événement, non fini et active refusés avant entrée`, `test:tournerCamera :
 *    angle immense et délai invalide refusés sans entrée`) (sonde : #1765 issuecomment-6195158339 L-B,
 *    variante `deuxNiveaux`) ;
 *  - une fonction dont une itération lit ou joue directement ne prête pas son statut : une boucle qui lit
 *    et appelle une fonction dont SEULE l'itération joue n'est pas un site (fonctions MUTUELLES comprises)
 *    — 0 occurrence (sonde : #1765 issuecomment-6195158339 L-B, variante `disqPrete`) ;
 *  - une itération qui ne pilote QUE par l'appel d'un helper ne disqualifie pas la fonction qui la porte :
 *    cette fonction prête encore ce qu'elle lit ou joue directement, et la boucle qui l'appelle peut
 *    devenir un SECOND site — 0 occurrence (sonde : #1765 issuecomment-6195158339 L-B, `L8`) ;
 *  - une MÉTHODE d'objet ou de classe (`h.etape()`), une fonction tenue par une PROPRIÉTÉ (`{ drain: () => … }`)
 *    et une fonction anonyme passée en argument hors d'un itérateur (`beforeEach`, `it`) ne sont pas des
 *    helpers : leurs boucles se jugent comme les autres, au `ref` du contexte nommé qui les englobe
 *    (`module` au besoin) — 0 occurrence (sonde : #1765 issuecomment-6195158339 L-B, variante `methodes`) ;
 *  - un statut se lit par NOM : deux fonctions locales homonymes de statuts différents se confondent — 3
 *    occurrences, aucune sous un site (sonde : #1765 issuecomment-6195158339 L-B, `homonymes`) ;
 *  - un verbe ou `pendingCascade` atteints par un ALIAS (`const suivant = s.cascadeNext`) ne comptent pas —
 *    5 occurrences, non pilotes (sonde : #1765 issuecomment-6195158339 L-B, `alias / acces calcule`) ;
 *  - un geste à côté d'un SOUS-SITE : l'itération qui l'englobe se juge hors du sous-arbre de TOUT sous-site
 *    déjà retenu (post-ordre), exempté ou non, que le geste le précède ou le suive ; l'exemption n'agit qu'au
 *    filtrage final (`bouclesPilotes`). Une lecture ou un verbe de l'itération englobante n'y fait un site
 *    qu'avec son complément hors de ces sous-arbres — 0 occurrence : sans l'exclusion post-ordre, 36 sites
 *    non exemptés avant comme après (sonde : #1765 issuecomment-6195158339 L-A, mesure N2 36 → 36) ;
 *  - un helper IMPORTÉ d'un autre module ne prête rien : seul le corps des fonctions LOCALES est lu — 0
 *    occurrence (sonde : #1765 issuecomment-6195158339 L-B, variante `importes`) ;
 *  - une liaison que `declareEnPropre` ne lit pas dans la portée de l'appel — un `var` hissé hors de son bloc,
 *    une liaison d'un `case` voisin — laisse sa racine au bloc de test homonyme — 0 occurrence (sonde :
 *    #1765 issuecomment-6195158339 L-A, `var` hissé et liaison de `case`/`default` d'un nom de `DIFFERES`) ;
 *  - un bloc de test atteint sous un AUTRE nom — un alias (`const t2 = it.extend(…)`), une conditionnelle
 *    (`(c ? it : it.skip)(…)`), une fonction locale qui lui transmet son callback (wrapper) — n'a pas de racine :
 *    son callback n'est pas différé et il n'ouvre aucun contexte. Conditionnelle : 1 occurrence, sans site,
 *    `EXCUSE_GUARD_ACTIVE ? it : it.skip` de `comment-poison-guard.test.ts` ; `it.extend` : 0 (sonde :
 *    #1765 issuecomment-6195158339 L-A). Wrapper : 4 occurrences, sans site, `detenteur.testkit.ts:32`,
 *    `walk-frame-loop.test.tsx:97`, `stocks-nominatifs.test.mjs:305` et `tri.test.mjs:120` (sonde : #1765
 *    issuecomment-6195158339 L-D) ;
 *  - un TITRE non littéral n'ouvre aucun contexte : le site prend le `ref` englobant. Compté : un appel dont
 *    la descente de `racineDeTest` (liaisons locales non lues) remonte à `it`, `test` ou `describe`, qui
 *    porte un callback, et dont le premier argument n'est ni une chaîne, ni un gabarit sans substitution, ni
 *    ce callback — 404 au corpus, 0 des 39 sites sous l'un d'eux comme bloc de test le plus proche (sonde :
 *    #1765 issuecomment-6195158339 L-A, recoupée par L-C).
 */
import { fileURLToPath } from 'node:url';
import type * as TS from 'typescript/unstable/ast';
import { analyserCorpus, EXTENSIONS_DE_SCRIPT, typescript, type FichierSource } from './dialecte.mjs';
import { estKitDeTest, estSuiteVitest } from './fichierVitest.mjs';
import { readCorpus } from './sourceCorpus.mjs';
import type { Site } from './stock.mjs';
import { DECROISSANT, type RegenerationDeStock } from './stockDeSites.mjs';

/** Les fichiers mesurés : les suites et les kits de test (`fichierVitest.mjs`), tous dialectes — le kit de la cascade
 *  (`cascadeTestKit.ts`) n'en est pas un. */
const estMesure = (rel: string): boolean => estSuiteVitest(rel) || estKitDeTest(rel);

/** Un verbe de la cascade du store (`cascadeNext`, `cascadeRoll`, `cascadeTableRoll`…). */
const VERBE = /^cascade[A-Z]/;

/** Les méthodes dont un callback ITÈRE (`Array.from({ length }, f)` compris). */
const ITERATEURS = new Set(['forEach', 'map', 'flatMap', 'filter', 'some', 'every', 'find', 'findIndex', 'reduce', 'from']);

/** Le module du kit, tel qu'un `import` le nomme. */
const MODULE_DU_KIT = /(^|\/)cascadeTestKit(\.ts)?$/;

/** Les appels qui NOMMENT un contexte de test par leur premier argument. */
const BLOCS_DE_TEST = new Set(['it', 'test', 'describe']);

/** Les appels dont les callbacks s'exécutent APRÈS l'itération qui les déclare : blocs de test et hooks. */
const DIFFERES = new Set([...BLOCS_DE_TEST, 'beforeEach', 'afterEach', 'beforeAll', 'afterAll']);

/** Une exemption AU SITE : la suite, le motif ANCRÉ du `ref` du site, la raison. */
export interface ExemptionPilote { fichier: string; motif: RegExp; raison: string }

const RAISON_GESTE_TESTE = 'la boucle porte sur des GRAINES ; le verbe joué est le geste que le titre teste, le confier au kit détruirait le test';
export const EXEMPTIONS: readonly ExemptionPilote[] = [
  { fichier: 'src/state/defense-hote-prete.test.ts', motif: /^it:un « Suivant » de trop sur l’étape de défense ne la franchit pas : sa fenêtre reste élue$/, raison: `${RAISON_GESTE_TESTE} (\`cascadeNext\`)` },
  { fichier: 'src/state/defense-hote-prete.test.ts', motif: /^it:« Tout lancer » des Tests de la Déstabilisante s’arrête sur la défense du maillon$/, raison: `${RAISON_GESTE_TESTE} (\`cascadeResolveAll\`)` },
  { fichier: 'src/state/combat/opposed-base-explicite.test.ts', motif: /^it:HÉROS MANUEL : nue haute \+ États lourds — le défenseur l’emporte au départage que ses CIBLES perdraient$/, raison: `${RAISON_GESTE_TESTE} (\`cascadeRoll\`)` },
];

/** Une itération-site repérée : son fichier, sa ligne (1-based), son contexte nommé, l'exemption qui la couvre. */
export interface BouclePilote { rel: string; ligne: number; ref: string; exemption?: ExemptionPilote }

/** Le corpus mesuré par défaut : les suites et kits de test de `src/` et `scripts/`, dans tous les dialectes
 *  qu'ils reconnaissent (`EXTENSIONS_DE_SCRIPT`). */
export const corpusMesure = (): FichierSource[] =>
  readCorpus(['src', 'scripts'], { exts: [...EXTENSIONS_DE_SCRIPT], tests: true }).filter((f) => estMesure(f.rel));

/** `e` est-il une chaîne LITTÉRALE — chaîne, ou gabarit sans substitution ? */
const chaineLitterale = (ts: typeof TS, e: TS.Node): e is TS.StringLiteral | TS.NoSubstitutionTemplateLiteral =>
  ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e);

/** Un accès NOMMÉ — par point (`s.cascadeNext`) ou calculé à chaîne littérale (`s['cascadeNext']`) : son
 *  receveur et le nom désigné. */
function accesNomme(ts: typeof TS, e: TS.Node): { receveur: TS.Expression; nom: string } | undefined {
  if (ts.isPropertyAccessExpression(e)) return { receveur: e.expression, nom: e.name.text };
  if (ts.isElementAccessExpression(e) && chaineLitterale(ts, e.argumentExpression)) return { receveur: e.expression, nom: e.argumentExpression.text };
  return undefined;
}

/** Le nom appelé par `call` : l'identifiant nu, ou le nom de l'accès (`get().cascadeNext`, `get()['cascadeNext']`). */
function nomAppele(ts: typeof TS, call: TS.CallExpression): string | undefined {
  const callee = call.expression;
  return ts.isIdentifier(callee) ? callee.text : accesNomme(ts, callee)?.nom;
}

/** `nom` est-il lié par `liaison` — identifiant, ou motif de déstructuration à toute profondeur ? */
function lie(ts: typeof TS, liaison: TS.BindingName, nom: string): boolean {
  if (ts.isIdentifier(liaison)) return liaison.text === nom;
  return liaison.elements.some((el) => !ts.isOmittedExpression(el) && !!el.name && lie(ts, el.name, nom));
}

/** `portee` DÉCLARE-t-elle `nom` en propre, hors de ses sous-portées : paramètre d'une fonction, liaison de
 *  l'en-tête d'un `for`, variable d'un `catch`, `const`/`let`/`var`, fonction ou classe d'une de ses
 *  instructions, nom propre d'une expression de fonction ou de classe ? Un `import` n'en est pas, ni un
 *  `declare` ambiant : le bloc de test importé ou déclaré reste une racine. */
function declareEnPropre(ts: typeof TS, portee: TS.Node, nom: string): boolean {
  const declarations = (l: TS.VariableDeclarationList) => l.declarations.some((d) => lie(ts, d.name, nom));
  if ((ts.isFunctionExpression(portee) || ts.isClassExpression(portee)) && portee.name?.text === nom) return true;
  if (ts.isFunctionDeclaration(portee) || ts.isFunctionExpression(portee) || ts.isArrowFunction(portee) || ts.isMethodDeclaration(portee)
    || ts.isConstructorDeclaration(portee) || ts.isGetAccessorDeclaration(portee) || ts.isSetAccessorDeclaration(portee)) return portee.parameters.some((p) => lie(ts, p.name, nom));
  if (ts.isForStatement(portee) || ts.isForOfStatement(portee) || ts.isForInStatement(portee)) {
    return !!portee.initializer && ts.isVariableDeclarationList(portee.initializer) && declarations(portee.initializer);
  }
  if (ts.isCatchClause(portee)) return !!portee.variableDeclaration && lie(ts, portee.variableDeclaration.name, nom);
  if (!(ts.isSourceFile(portee) || ts.isBlock(portee) || ts.isModuleBlock(portee) || ts.isCaseClause(portee) || ts.isDefaultClause(portee))) return false;
  return portee.statements.some((st) => (ts.isVariableStatement(st) || ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && !st.modifiers?.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword)
    && ((ts.isVariableStatement(st) && declarations(st.declarationList)) || ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && st.name?.text === nom)));
}

/** La RACINE de test de `call` : l'identifiant au bout de sa chaîne d'appels, d'accès par point ou calculé à
 *  chaîne littérale et d'étiquettes de gabarit (`it`, `it.skip`, `it['skip']`, `it.each(rows)`,
 *  `` it.each`…` ``, `(it.skip)`, `it!`), s'il est de `DIFFERES` et qu'aucune portée englobant l'appel ne le
 *  lie (`const test = …`, paramètre `it`). Un receveur qui n'y remonte pas (`suite.test`) n'en a aucune. */
function racineDeTest(ts: typeof TS, call: TS.CallExpression): string | undefined {
  let e: TS.Expression = call.expression;
  for (;;) {
    const acces = accesNomme(ts, e);
    if (acces) e = acces.receveur;
    else if (ts.isCallExpression(e) || ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e)) e = e.expression;
    else if (ts.isTaggedTemplateExpression(e)) e = e.tag;
    else break;
  }
  if (!ts.isIdentifier(e) || !DIFFERES.has(e.text)) return undefined;
  for (let p: TS.Node | undefined = call.parent; p; p = p.parent) if (declareEnPropre(ts, p, e.text)) return undefined;
  return e.text;
}

/** Le contexte NOMMÉ que `n` ouvre, ou `undefined` : `<racine>:<titre>`, le titre étant le premier argument
 *  de l'appel qui porte le callback (`it.each(rows)('t %s', cb)` → `it:t %s`). */
function contexteOuvert(ts: typeof TS, n: TS.Node): string | undefined {
  if (ts.isCallExpression(n)) {
    const racine = racineDeTest(ts, n);
    const titre = n.arguments[0];
    if (racine && BLOCS_DE_TEST.has(racine) && titre && chaineLitterale(ts, titre)) return `${racine}:${titre.text}`;
  }
  if ((ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)) && n.name && ts.isIdentifier(n.name)) return `fn:${n.name.text}`;
  if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer
    && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) return `fn:${n.name.text}`;
  return undefined;
}

/** Les enfants LUS de `n` : la clé non calculée d'une propriété (`pendingCascade: …`) nomme ce qu'on écrit,
 *  seule sa valeur se lit. */
function enfantsLus(ts: typeof TS, n: TS.Node, f: (c: TS.Node) => void): void {
  if (ts.isPropertyAssignment(n) && !ts.isComputedPropertyName(n.name)) f(n.initializer);
  else n.forEachChild(f);
}

const AUCUN: ReadonlySet<TS.Node> = new Set();

/** Les callbacks DIFFÉRÉS de `n` : ceux d'un bloc de test ou d'un hook, qu'une itération DÉCLARE sans les
 *  exécuter. Un autre callback (`act`) s'exécute sur-le-champ. */
function rappelsDifferes(ts: typeof TS, n: TS.Node): readonly TS.Node[] {
  return ts.isCallExpression(n) && racineDeTest(ts, n) ? n.arguments.filter((a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a)) : [];
}

/** Un nœud LU de `racine` (elle comprise), hors des sous-arbres `exclus`, satisfait-il `pred` ? `enIterant` :
 *  la preuve porte sur ce qu'une itération EXÉCUTE, ses callbacks différés n'en sont pas. */
function contient(ts: typeof TS, racine: TS.Node, pred: (n: TS.Node) => boolean, exclus = AUCUN, enIterant = false): boolean {
  let vu = false;
  const parcours = (n: TS.Node): void => {
    if (vu || exclus.has(n)) return;
    if (pred(n)) { vu = true; return; }
    const differes = enIterant ? rappelsDifferes(ts, n) : [];
    enfantsLus(ts, n, (c) => { if (!differes.includes(c)) parcours(c); });
  };
  parcours(racine);
  return vu;
}

/** La fonction NOMMÉE que `n` déclare — déclaration, ou fonction/flèche affectée à une variable. */
function fonctionNommee(ts: typeof TS, n: TS.Node): { nom: string; corps: TS.Node } | undefined {
  if (ts.isFunctionDeclaration(n) && n.name) return { nom: n.name.text, corps: n };
  if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer
    && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) return { nom: n.name.text, corps: n.initializer };
  return undefined;
}

const appelleIdentifiant = (ts: typeof TS, n: TS.Node, noms: ReadonlySet<string>): boolean =>
  ts.isCallExpression(n) && ts.isIdentifier(n.expression) && noms.has(n.expression.text);

/** Ce que `n` ITÈRE, s'il itère : la boucle entière (en-tête compris), les SEULS callbacks d'un appel
 *  d'itérateur (le receveur ne s'itère pas), le corps d'une fonction nommée qui s'appelle elle-même. */
function partiesIterees(ts: typeof TS, n: TS.Node): TS.Node[] | undefined {
  if (ts.isForStatement(n) || ts.isForOfStatement(n) || ts.isForInStatement(n) || ts.isWhileStatement(n) || ts.isDoStatement(n)) return [n];
  if (ts.isCallExpression(n)) {
    const nom = nomAppele(ts, n);
    const rappels = n.arguments.filter((a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a));
    return nom && ITERATEURS.has(nom) && rappels.length ? rappels : undefined;
  }
  const fn = fonctionNommee(ts, n);
  return fn && contient(ts, fn.corps, (m) => appelleIdentifiant(ts, m, new Set([fn.nom]))) ? [fn.corps] : undefined;
}

/** Une LECTURE de `pendingCascade` : le nom nu ou par point, ou l'accès calculé `s['pendingCascade']`. */
const litCascade = (ts: typeof TS, n: TS.Node): boolean =>
  (ts.isIdentifier(n) && n.text === 'pendingCascade') || (ts.isElementAccessExpression(n) && accesNomme(ts, n)?.nom === 'pendingCascade');

/** Un appel AU KIT : un nom importé (`avanceEtapeCascade(…)`), ou un membre de son espace de noms (`kit.x(…)`,
 *  `kit['x'](…)`). */
const appelleLeKit = (ts: typeof TS, call: TS.CallExpression, duKit: ReadonlySet<string>): boolean => {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return duKit.has(callee.text);
  const receveur = accesNomme(ts, callee)?.receveur;
  return !!receveur && ts.isIdentifier(receveur) && duKit.has(receveur.text);
};

/** Un appel de verbe `cascade*` du STORE : un appel au kit (`cascadeDeTest`…) n'en est jamais un. */
const appelleVerbe = (ts: typeof TS, n: TS.Node, duKit: ReadonlySet<string>): boolean => {
  if (!ts.isCallExpression(n) || appelleLeKit(ts, n, duKit)) return false;
  const nom = nomAppele(ts, n);
  return !!nom && VERBE.test(nom);
};

/** Les noms locaux qui désignent `cascadeTestKit` ou l'un de ses exports : liens nommés, défaut, espace de noms. */
function importesDuKit(ts: typeof TS, sourceFile: TS.SourceFile): ReadonlySet<string> {
  const duKit = new Set<string>();
  for (const st of sourceFile.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier) || !MODULE_DU_KIT.test(st.moduleSpecifier.text)) continue;
    if (st.importClause?.name) duKit.add(st.importClause.name.text);
    const liens = st.importClause?.namedBindings;
    if (liens && ts.isNamespaceImport(liens)) duKit.add(liens.name.text);
    if (liens && ts.isNamedImports(liens)) for (const el of liens.elements) duKit.add(el.name.text);
  }
  return duKit;
}

/** Les itérations-sites d'un fichier, en une passe : statuts DIRECTS des helpers, puis les itérations en
 *  post-ordre, chacune hors des sous-sites. */
function sitesDuFichier(ts: typeof TS, sourceFile: TS.SourceFile): ReadonlySet<TS.Node> {
  const duKit = importesDuKit(ts, sourceFile);
  const lectrices = new Set<string>();
  const joueuses = new Set<string>();
  /** Une itération qui lit ou joue DIRECTEMENT : un callback de données (`findIndex`, `map`) n'en est pas une. */
  const itereEnPilotant = (m: TS.Node): boolean =>
    !!partiesIterees(ts, m)?.some((p) => contient(ts, p, (k) => litCascade(ts, k) || appelleVerbe(ts, k, duKit), AUCUN, true));
  const statue = (n: TS.Node): void => {
    const fn = fonctionNommee(ts, n);
    if (fn && !partiesIterees(ts, n) && !contient(ts, fn.corps, itereEnPilotant)) {
      if (contient(ts, fn.corps, (m) => litCascade(ts, m), AUCUN, true)) lectrices.add(fn.nom);
      if (contient(ts, fn.corps, (m) => appelleVerbe(ts, m, duKit), AUCUN, true)) joueuses.add(fn.nom);
    }
    n.forEachChild(statue);
  };
  statue(sourceFile);

  const sites = new Set<TS.Node>();
  const exclus = new Set<TS.Node>();
  const lit = (m: TS.Node): boolean => litCascade(ts, m) || appelleIdentifiant(ts, m, lectrices);
  const joue = (m: TS.Node): boolean => appelleVerbe(ts, m, duKit) || appelleIdentifiant(ts, m, joueuses);
  const visite = (n: TS.Node): void => {
    n.forEachChild(visite);
    const parties = partiesIterees(ts, n);
    if (!parties || !parties.some((p) => contient(ts, p, lit, exclus, true)) || !parties.some((p) => contient(ts, p, joue, exclus, true))) return;
    sites.add(n);
    for (const p of parties) exclus.add(p);
  };
  visite(sourceFile);
  return sites;
}

/** Les itérations-sites de `fichiers`, dans l'ordre du balayage, chacune avec l'exemption qui la couvre —
 *  celle dont le motif ne touche, dans son fichier, qu'elle. */
export function bouclesPilotes(fichiers: Iterable<FichierSource> = corpusMesure(), exemptions: readonly ExemptionPilote[] = EXEMPTIONS): BouclePilote[] {
  const ts = typescript();
  const boucles: BouclePilote[] = [];
  for (const { fichier, sourceFile } of analyserCorpus(fichiers)) {
    if (!sourceFile) continue;
    const sites = sitesDuFichier(ts, sourceFile);
    const trouves: BouclePilote[] = [];
    const visite = (n: TS.Node, contexte: string): void => {
      const ici = contexteOuvert(ts, n) ?? contexte;
      if (sites.has(n)) trouves.push({ rel: fichier.rel, ligne: sourceFile.getLineAndCharacterOfPosition(n.getStart(sourceFile)).line + 1, ref: ici });
      n.forEachChild((c) => visite(c, ici));
    };
    visite(sourceFile, 'module');
    const touches = (e: ExemptionPilote): BouclePilote[] => trouves.filter((b) => e.fichier === b.rel && e.motif.test(b.ref));
    for (const b of trouves) boucles.push({ ...b, exemption: exemptions.find((e) => touches(e).length === 1 && touches(e)[0] === b) });
  }
  return boucles;
}

/** Les itérations-sites NON exemptées en SITES `{ file, ref }` — le fichier est la suite à migrer vers le kit. */
export const sitesDeBoucles = (boucles: readonly BouclePilote[]): Site[] =>
  boucles.filter((b) => !b.exemption).map((b) => ({ file: b.rel, ref: b.ref }));

export const sitesPiloteCascade = (fichiers?: Iterable<FichierSource>, exemptions?: readonly ExemptionPilote[]): Site[] =>
  sitesDeBoucles(bouclesPilotes(fichiers, exemptions));

export const MOTIF_PILOTE_CASCADE =
  "Une boucle neuve qui joue une cascade passe par le kit (`avanceEtapeCascade`, `draineCascade`), elle ne s'entérine pas ici.";

/** La RÉGÉNÉRATION de `piloteCascadeStock.mjs`, sur des sites (par défaut, la mesure du dépôt). Commande :
 *  `npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/piloteCascadeAudit.ts [--check]`. */
export const regenerations = (sites: readonly Site[] = sitesPiloteCascade()): RegenerationDeStock[] => [{
  chemin: fileURLToPath(new URL('./piloteCascadeStock.mjs', import.meta.url)),
  politique: DECROISSANT,
  collections: [{ nom: 'PILOTE_CASCADE_RATCHET', sites, motif: MOTIF_PILOTE_CASCADE }],
}];
