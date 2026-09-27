// Mécanique de scan du garde-fou « logique par LABEL interdite » (#142, doctrine CLAUDE.md bloc
// agents). Module ESM pur (opère sur du texte source), consommé par
// src/state/label-logic-guard.test.ts ET par le hook pre-commit (scripts/git-hooks/pre-commit.mjs) —
// SOURCE UNIQUE de la composition « map globale de déclarations id-param + résolution du shadowing »
// (`collectIdParamFnsAcrossDirs`/`effectiveIdParamFns` ci-dessous), pour que les deux consommateurs
// ne divergent jamais.
import { readFileSync } from 'node:fs';
import { parUnitesDeCode, listerArbre } from './lister.mjs';
import { scriptKindDe } from './dialecte.mjs';
import { join, relative, isAbsolute } from 'node:path';
import tsModule from 'typescript';

// Liaison LOCALE de l'API du compilateur — même FAIT mesuré qu'en tête de `sceneMutation.mjs`
// (2026-08-23) : sous Vitest, un `ts.x` de visiteur AST se relit sur l'objet d'import de vite-node.
const ts = tsModule;
// Substrat AST PARTAGÉ (portées, alias, opérateurs d'égalité, littéralité) — SOURCE UNIQUE
// `registryIdBranch.mjs` : le suivi d'alias `const k = def.id` y existe déjà, on l'importe.
import { Scopes, bindingNames, unwrap, isEntryLiteral, EQUALITY_OPS } from './registryIdBranch.mjs';
import { estFichierVitest } from './fichierVitest.mjs';

/** Retire les commentaires de bloc et de ligne (pas les chaînes).
 * @param {string} src @returns {string} */
export function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      return i >= 0 ? l.slice(0, i) : l;
    })
    .join('\n');
}

/** Carte par label : constante hurlante `XXX_BY_LABEL`/`XXXBYLABEL`, ou fonction/variable `byLabel`. */
export const BY_LABEL_RX = /(BY_?LABEL|byLabel)/;

/** Comparaison D'ÉGALITÉ sur `.label`, dans un sens ou l'autre. Le membre en face de `.label` doit
 *  être un accès `mot(.mot)*` COLLÉ (pas d'appel/parenthèse/optional-chaining entre les deux) : ça
 *  exclut `find((x) => x.id === id)?.label` (extraction d'AFFICHAGE après un lookup PAR ID), qui
 *  n'est pas une comparaison mais une résolution de libellé légitime. */
export const LABEL_EQ_RX = /\.label\s*===|===\s*[\w.]+\.label\b/;

/** PRÉDICAT sur `.label` : `.label` comme ARGUMENT d'un `.test(`/`.exec(` (regex évaluée contre un
 *  label), ou comme RÉCEPTEUR d'une méthode de chaîne prédicative (`.label.startsWith(`/`.endsWith(`/
 *  `.match(`/`.includes(`/`.test(`/`.search(`/`.indexOf(`). Même défaut que `LABEL_EQ_RX` : logique
 *  qui distingue des cas par IDENTITÉ de libellé plutôt que par `id` stable. */
export const LABEL_PREDICATE_RX = /\.test\([^)]*\.label\b|\.label\.(?:match|includes|startsWith|endsWith|test|search|indexOf)\(/;

/** `switch` sur `.label` : un aiguillage par libellé est la même famille de logique-par-label qu'une
 *  carte `BY_LABEL`, juste écrite en `switch`. */
export const LABEL_SWITCH_RX = /switch\s*\([^)]*\.label\b/;

/** DÉRIVATION D'IDENTITÉ depuis un libellé : `slugId(x.label)` (#637). Re-dériver un `id` à partir du
 *  `.label` (affichage multilangue) au runtime couple l'identité à la langue — une traduction change
 *  l'id, cassant lookups/références/sauvegardes. L'`id` est explicite et OBLIGATOIRE sur l'entité,
 *  jamais dérivé. Vise `.label` SEULEMENT (pas `.name` : la conversion d'un fragment TEXTE saisi en
 *  éditeur — `slugId(p.name)` d'un `splitLabel` — est la couture label→id d'authoring tolérée). */
export const SLUG_FROM_LABEL_RX = /slugId\s*\(\s*[\w.]+\.label\b/;

/** Champs d'AFFICHAGE d'une entité : `label` ET `name` (#598 — `Weapon.name`/`ItemInstance.name`/
 *  `Combatant.name` sont des libellés). ⚠ `name` est AMBIGU dans ce dépôt : `ConditionInstance.name`
 *  et l'instance de maladie portent un **id** sous ce nom (dette #598, résorbée par le renommage
 *  `name`→`id`) — d'où le baseline nommé côté test, JAMAIS un élargissement aveugle. */
const DISPLAY_FIELD = '(?:label|name)';

/** Champ d'affichage interpolé dans un littéral de gabarit qui sert de **CLÉ** (`key: \`x:${w.name}\``).
 *  C'est la forme qui a laissé vivre `weapon:${weapon.name}` (#598) : la garde `.label` d'origine ne
 *  voyait ni `name`, ni la construction de clé par template. On ne vise QUE la construction d'identité
 *  (`key` en propriété ou en affectation) — les ~700 interpolations d'AFFICHAGE (`${c.name} touche…`)
 *  restent hors de portée, la lecture d'un libellé pour l'afficher étant précisément son usage légitime. */
export const DISPLAY_KEY_TEMPLATE_RX = new RegExp('\\bkey\\s*[:=]\\s*`[^`]*\\$\\{[^}]*\\.' + DISPLAY_FIELD + '\\b');

/** Champ d'affichage d'une entité en INDEX de LECTURE : `manualOpen[cl.name]`, `NAME_TO_GROUP[w.name]`.
 *  Le `[` doit suivre un réceptacle (identifiant/`)`/`]`) — un littéral de TABLEAU (`[v.id, v.label]`,
 *  paire d'un `Object.fromEntries`) n'est pas une indexation. */
const DISPLAY_INDEX_RX = new RegExp('[\\w)\\]]\\[[^\\]]*\\.' + DISPLAY_FIELD + '\\b[^\\]]*\\]');

/** …mais une ÉCRITURE d'index (`m[x.label] = v`, `acc[it.name] ??= …`) CONSTRUIT un index par texte —
 *  la conversion label→id tolérée (CLAUDE.md) ; seule la LECTURE (une décision) est visée. */
const INDEX_WRITE_RX = /\]\s*(?:\?\?|\|\||&&|[-+*/%])?=[^=]/;

/** Méthodes d'INTERROGATION d'une collection — `set`/`add` en sont volontairement ABSENTS : REMPLIR un
 *  index depuis du texte est la couture tolérée ; INTERROGER une collection avec le libellé d'une entité
 *  qu'on tient (donc dont on a l'`id`) est la faute. */
const LOOKUP_CALL_RX = /\.(?:has|get|delete)\(/g;

/**
 * `.label`/`.name` d'une entité passé en CLÉ d'interrogation — `owned.has(x.label)`,
 * `idx.get(concreteLabel(e.label, s))` (#602). L'argument est délimité par COMPTAGE de parenthèses :
 * sans ça, `byId.get(id)?.label` (résolution d'un libellé APRÈS un lookup PAR ID — lecture d'affichage
 * légitime, ~50 sites) serait flaguée à tort.
 * @param {string} line @returns {boolean}
 */
export function hasDisplayLookupKey(line) {
  const FIELD_RX = new RegExp('\\.' + DISPLAY_FIELD + '\\b');
  for (const m of line.matchAll(LOOKUP_CALL_RX)) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    for (; i < line.length && depth > 0; i++) {
      if (line[i] === '(') depth++;
      else if (line[i] === ')') depth--;
    }
    if (FIELD_RX.test(line.slice(start, depth === 0 ? i - 1 : line.length))) return true;
  }
  return false;
}

/** Champ d'affichage comme CLÉ DE COLLECTION (#602) : interrogation `has`/`get`/`delete`, ou LECTURE
 *  d'index. @param {string} line @returns {boolean} */
export function hasDisplayCollectionKey(line) {
  return hasDisplayLookupKey(line) || (DISPLAY_INDEX_RX.test(line) && !INDEX_WRITE_RX.test(line));
}

/**
 * Scan complet d'un fichier source : toute logique par label — carte `BY_LABEL`/`byLabel`, comparaison
 * d'égalité sur `.label`, PRÉDICAT sur `.label` (regex/méthode de chaîne), `switch` sur `.label`, ou
 * champ d'AFFICHAGE (`label`/`name`) interpolé dans une CLÉ (`DISPLAY_KEY_TEMPLATE_RX`, #598), ou
 * champ d'affichage servant de CLÉ DE COLLECTION (`hasDisplayCollectionKey`, #602) — ligne par ligne,
 * commentaires retirés.
 *
 * Frontière de la règle #602 (doctrine, pas liste d'exceptions) : CONSTRUIRE un index depuis du texte
 * (`.set(x.label, …)`, `m[x.label] = …`) est la conversion label→id TOLÉRÉE ; INTERROGER une collection
 * (`has`/`get`/`delete`, lecture d'index) avec le libellé d'une entité qu'on tient — donc dont on a
 * l'`id` — est la faute. Une résolution de texte HUMAIN entrant (auto-liage de prose, import de
 * statbloc) se déclare par une fonction dont le paramètre EST du texte, et ne lit alors aucun `.label`.
 *
 * LIMITE CONNUE (heuristique volontairement précise plutôt qu'à faux positifs, cf. #142) : ce scan est
 * SYNTACTIQUE — il ne détecte que les sites où `.label` est TEXTUELLEMENT adjacent à l'opérateur/la
 * méthode incriminée. Un prédicat testé contre une VARIABLE qui *tient* un label sans que `.label`
 * apparaisse sur la même ligne (ex. `const lbl = x.label; regex.test(lbl)`) échappe au scan — à
 * détecter par revue de code, pas par cette garde mécanique.
 *
 * Chaque finding porte sa `rule` : les règles `.label` HISTORIQUES (#142) valent `label-logic` et
 * restent à TOLÉRANCE ZÉRO ; la règle `display-key` (#598, champ d'affichage interpolé en CLÉ) est
 * distinguée pour que l'appelant puisse lui adosser un baseline SANS relâcher les premières.
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string, rule: 'label-logic' | 'display-key' }[]}
 */
export function scanLabelLogic(relPath, contenu) {
  const findings = [];
  const body = stripComments(contenu);
  body.split('\n').forEach((line, i) => {
    const labelLogic =
      BY_LABEL_RX.test(line) ||
      LABEL_EQ_RX.test(line) ||
      LABEL_PREDICATE_RX.test(line) ||
      LABEL_SWITCH_RX.test(line) ||
      SLUG_FROM_LABEL_RX.test(line);
    // Une ligne qui viole les DEUX est rapportée sous `label-logic` (la règle la plus stricte prime,
    // sinon un baseline `display-key` amnistierait au passage une vraie logique-par-label).
    if (labelLogic) findings.push({ line: i + 1, detail: line.trim(), rule: 'label-logic' });
    else if (hasDisplayCollectionKey(line)) findings.push({ line: i + 1, detail: line.trim(), rule: 'collection-key' });
    else if (DISPLAY_KEY_TEMPLATE_RX.test(line)) findings.push({ line: i + 1, detail: line.trim(), rule: 'display-key' });
  });
  return findings;
}

// ── Libellés HORS du champ `label` (#142 LOT 7) ─────────────────────────────────────────────────
// Les règles ci-dessus ne voient un libellé que s'il est porté par un champ nommé `label`/`name`.
// Le dépôt en porte ailleurs : `reach` (« Très longue »), `loc` (« Tête »), `tier` (« Bronze »),
// `availability` (« Exotique »), `statut` (« réfuté »)… — c'est par `reach` que `weapon.reach ===
// 'Très longue'` a vécu dans `src/engine` sans qu'aucune garde ne le voie. Le critère ne porte donc
// plus sur le NOM du champ mais sur la FORME du LITTÉRAL comparé : un id de ce dépôt est un slug
// ASCII minuscule (`tres-longue`, `disc`, `melee`) ; une majuscule initiale, un accent ou une espace
// signent un texte destiné à l'œil humain, donc multilangue, donc interdit en logique.

/** Champs d'un nœud/événement DOM dont le vocabulaire est une norme W3C (`KeyboardEvent.key`/`.code`
 *  — `'Enter'`, `'ArrowLeft'`, `'KeyE'` ; `Element.tagName` — `'INPUT'`), pas de la donnée d'entité :
 *  aucune traduction ne les change, aucun id ne peut les remplacer. MESURÉ sur
 *  src/engine+state+gameIso+ui : 40 des 47 comparaisons à littéral de libellé du rendu/UI sont ces
 *  trois champs, AUCUNE n'est de la donnée de jeu — même mesure et même verdict que `ID_NAME_RX` de
 *  `registryIdBranch.mjs`, qui a écarté `key`/`code` pour la même raison. */
const DOM_VOCAB_FIELDS = new Set(['key', 'code', 'tagName']);

/** Le littéral est-il un TEXTE D'AFFICHAGE plutôt qu'un id ? Les ids de ce dépôt sont des slugs
 *  ASCII minuscules (`tres-longue`, `mains-nues`, `disc`) — la convention est tenue par les
 *  registres et par `slugId`. Une MAJUSCULE INITIALE, un ACCENT ou une ESPACE ne peuvent donc pas
 *  appartenir à un id : c'est du libellé. Le critère est structurel (forme du texte), pas une liste.
 *  @param {string} text @returns {boolean} */
export function isLabelLiteral(text) {
  if (text.length < 2) return false;
  return /^\p{Lu}/u.test(text) || /[À-ɏ]/.test(text) || /\s/.test(text);
}

/** Nom de propriété (identifiant, littéral de chaîne, ou clé calculée) — ou null si indéchiffrable. */
function propName(name) {
  if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return null;
}

/** L'expression LIT-ELLE un champ d'entité (hors champs d'événement DOM) ? `w.reach`, `it.loc`,
 *  `a.b.statut` — le nom du champ n'est PAS un critère d'inclusion (c'est précisément le trou qu'on
 *  ferme) ; il ne sert qu'à écarter les deux champs d'événement DOM. */
function readsEntityField(node) {
  const n = unwrap(node);
  if (!ts.isPropertyAccessExpression(n) || !ts.isIdentifier(n.name)) return false;
  return !DOM_VOCAB_FIELDS.has(n.name.text);
}

/** Valeur de champ TENUE PAR UNE VARIABLE (`const band = w.reach;` puis `band === 'Très longue'`) —
 *  le troisième angle mort déclaré par l'en-tête de `scanLabelLogic` (scan ligne à ligne). La
 *  mécanique de suivi d'alias est celle de `registryIdBranch.mjs` (`Scopes`/`bindingNames`/`unwrap`,
 *  qui suit déjà `const k = def.id`), IMPORTÉE et non recopiée. */
const FIELD_HOLDER = 'field-holder';

/** L'expression est-elle une valeur de champ d'entité, directement ou par alias ? */
function holdsFieldValue(node, scopes) {
  const n = unwrap(node);
  if (ts.isIdentifier(n)) return scopes.kindOf(n.text) === FIELD_HOLDER;
  return readsEntityField(n);
}

/** Table dont les clés sont des LIBELLÉS (`{ Tête: […], Bras: […] }`, `{ 'Très longue': 2 }`) : ce
 *  n'est pas un `Record` keyé par id, c'est un INDEX DE LIBELLÉS — il fige une langue dans la logique
 *  et se casse à la première traduction. Deux clés minimum (une table d'une entrée ne démontre aucun
 *  vocabulaire), TOUTES à majuscule initiale, et AU MOINS UNE portant un ACCENT ou une ESPACE — ce
 *  qu'aucun identifiant TypeScript ne peut porter. Sans cette dernière condition, MESURÉ : trois
 *  tables légitimes remontent à tort sur src/engine+state (un espace de noms d'ids `{ Flexible:
 *  'flexible' }`, un registre d'événements `{ TILE_CLICK: … }`, une table de codes clavier DOM) —
 *  leurs clés sont des NOMS TS en ASCII, pas les libellés eux-mêmes. Faux négatif assumé en retour :
 *  un vocabulaire de libellés entièrement sans accent ni espace (`{ Bronze: 0, Argent: 1 }`) reste
 *  indiscernable d'un espace de noms — la garde s'abstient plutôt que d'accuser à tort. */
function isLabelKeyedRecord(node) {
  const n = unwrap(node);
  if (!ts.isObjectLiteralExpression(n) || n.properties.length < 2) return false;
  const names = [];
  for (const p of n.properties) {
    if (!ts.isPropertyAssignment(p) && !ts.isShorthandPropertyAssignment(p)) return false;
    if (!p.name || ts.isComputedPropertyName(p.name)) return false;
    const name = propName(p.name);
    if (name == null) return false;
    names.push(name);
  }
  return names.every((s) => /^\p{Lu}/u.test(s) || /[À-ɏ]/.test(s) || /\s/.test(s))
    && names.some((s) => /[À-ɏ]/.test(s) || /\s/.test(s));
}

/** Méthodes qui prennent une DÉCISION sur un texte via une expression régulière (le résultat pilote
 *  un `if`/un `find`/un aiguillage). `replace`/`split` en sont écartés : ce sont des transformations
 *  de texte, pas une reconnaissance d'entité. */
const REGEX_DECIDING_METHODS = new Set(['test', 'exec', 'match', 'matchAll', 'search']);

/** Le motif d'une regex littérale contient-il un MOT de LIBELLÉ (majuscule initiale ou accent) ?
 *  Les classes de caractères (`[A-Z]`, `[À-ɏ]`) et les échappements (`\\S`, `\\p{Lu}`) sont retirés
 *  avant l'extraction : ce sont des critères de FORME, pas des mots du vocabulaire de jeu.
 *  @param {string} rxText texte SOURCE de la regex, délimiteurs et drapeaux compris @returns {boolean} */
export function hasLabelWordRegex(rxText) {
  const body = rxText.replace(/^\//, '').replace(/\/[a-z]*$/, '');
  const stripped = body.replace(/\\[a-zA-Z](\{[^}]*\})?/g, ' ').replace(/\[[^\]]*\]/g, ' ');
  for (const m of stripped.matchAll(/\p{L}[\p{L}\p{M}'’-]+/gu)) if (isLabelLiteral(m[0])) return true;
  return false;
}

/** Valeur DÉRIVÉE d'un champ de donnée : une variable dont l'initialiseur LIT un champ quelque part
 *  (`const t = (c.traits ?? []).map(f).find(g) ?? ''`), ou le paramètre d'un callback passé à une
 *  méthode appelée SUR une telle expression (`c.traits.find((s) => …)`). C'est la maille par laquelle
 *  la prose formatée d'une entité redevient une décision. */
const FIELD_DERIVED = 'field-derived';

/** L'expression LIT-ELLE un champ d'entité quelque part dans son sous-arbre ? Le NOM appelé d'une
 *  méthode (`xs.map`) n'en est pas un — seuls le receveur et les arguments sont visités. */
function containsEntityFieldRead(node) {
  let found = false;
  const walk = (n) => {
    if (found || !n) return;
    if (ts.isCallExpression(n)) {
      walk(ts.isPropertyAccessExpression(n.expression) ? n.expression.expression : n.expression);
      n.arguments.forEach(walk);
      return;
    }
    if (readsEntityField(n)) { found = true; return; }
    ts.forEachChild(n, walk);
  };
  walk(node);
  return found;
}

/** L'expression tient-elle une valeur de champ, directement, par alias, ou DÉRIVÉE ? */
function holdsOrDerivesFieldValue(node, scopes) {
  const n = unwrap(node);
  if (ts.isIdentifier(n)) return scopes.kindOf(n.text) === FIELD_HOLDER || scopes.kindOf(n.text) === FIELD_DERIVED;
  return containsEntityFieldRead(n);
}

/** La regex littérale de cet appel, s'il en applique une à un texte : `/^Taille/.test(x)` (receveur)
 *  ou `x.match(/Monstrueuse/)` (argument). Renvoie `{ rx, subject }` ou null. */
function regexDecisionOf(node) {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return null;
  if (!ts.isIdentifier(node.expression.name) || !REGEX_DECIDING_METHODS.has(node.expression.name.text)) return null;
  const recv = unwrap(node.expression.expression);
  if (ts.isRegularExpressionLiteral(recv)) return node.arguments.length === 1 ? { rx: recv, subject: node.arguments[0] } : null;
  const arg = node.arguments.length === 1 ? unwrap(node.arguments[0]) : null;
  if (arg && ts.isRegularExpressionLiteral(arg)) return { rx: arg, subject: recv };
  return null;
}

/** Déclare DÉRIVÉS les paramètres d'un callback passé à une méthode appelée sur une expression qui
 *  lit un champ de donnée (`(c.traits ?? []).map(f).find((s) => …)`) : `s` porte alors du texte
 *  d'entité. @param {import('typescript').SignatureDeclaration} fn */
function declareDerivedParams(fn, scopes) {
  const call = fn.parent;
  if (!call || !ts.isCallExpression(call) || !call.arguments.includes(fn)) return;
  if (!ts.isPropertyAccessExpression(call.expression)) return;
  if (!containsEntityFieldRead(call.expression.expression)) return;
  for (const p of fn.parameters) for (const n of bindingNames(p.name)) scopes.declare(n, FIELD_DERIVED);
}

/**
 * Scan STRUCTUREL (AST) des libellés portés par un champ AUTRE que `label`/`name`. Quatre formes :
 *  - `label-literal`  : `w.reach === 'Très longue'`, `t.availability !== 'Exotique'` — égalité entre
 *                       une valeur de champ (ou son alias) et un littéral de LIBELLÉ ;
 *  - `label-switch`   : `switch (w.reach) { case 'Très longue': … }` — même aiguillage, en `switch` ;
 *  - `label-record`   : `const T = { Tête: […], Bras: […] }` — table indexée par des libellés ;
 *  - `label-regex`    : `/^Taille/.test(t)`, `t.match(/Monstrueuse/)` — regex littérale portant un MOT
 *                       de libellé, appliquée à une valeur dérivée d'un champ de donnée (la prose
 *                       formatée d'une entité re-parseée : `harvestSizeOf`, #1318 V6).
 *
 * FRONTIÈRE (par FORME, aucune liste de noms) — ne lèvent PAS : un discriminant d'union en slug
 * ASCII (`area.kind === 'disc'`, `w.type === 'melee'`), une comparaison à une VARIABLE
 * (`a.reach === b.reach`), un champ d'ÉVÉNEMENT DOM (`e.key === 'Enter'`), le RENDU d'un libellé
 * (`{item.label}`) — seule une DÉCISION prise sur le texte est visée.
 *
 * ANGLE DÉCLARÉ de `label-regex` : le critère est le MOT du motif, pas son domaine — une regex de
 * CONVENTION DE CODE portant un mot capitalisé (`/Data$/` sur un nom de type, `/^Taille/` sur un
 * identifiant TS) mord au même titre qu'une regex de vocabulaire de jeu, dès lors que son sujet dérive
 * d'un champ. `scripts/**` n'étant pas scanné par ce volet, aucun site n'est concerné aujourd'hui ; le
 * jour où l'un se présente, il se REFORMULE (comparer un id) ou s'inscrit au stock — pas d'exception.
 *
 * CE QUE CE SCAN NE VOIT PAS (faux négatifs assumés, mesurés) : un libellé tenu par un PARAMÈTRE de
 * fonction (`function q(av: Availability) { if (av === 'Commune') … }`) — la provenance du texte
 * n'est pas lisible sans vérificateur de types ; un libellé ENTIÈREMENT en slug ASCII minuscule
 * (aucun n'existe : un libellé français porte accent, majuscule ou espace) ; un prédicat qui n'est
 * pas une égalité (`.startsWith('Très')`).
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string, rule: 'label-literal' | 'label-switch' | 'label-record' | 'label-regex' }[]}
 */
export function scanLabelLiteralCompare(relPath, contenu) {
  const sf = ts.createSourceFile(relPath, contenu, ts.ScriptTarget.Latest, true, scriptKindDe(relPath));
  const lines = contenu.split('\n');
  const findings = [];
  const seen = new Set();
  const scopes = new Scopes();

  const report = (node, rule) => {
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    const key = `${line}:${rule}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ line, detail: (lines[line - 1] || '').trim(), rule });
  };

  const visit = (node) => {
    if (ts.isFunctionLike(node) || ts.isBlock(node) || ts.isCaseBlock(node) || ts.isModuleBlock(node)) {
      scopes.push();
      if (ts.isFunctionLike(node)) declareDerivedParams(node, scopes);
      ts.forEachChild(node, visit);
      scopes.pop();
      return;
    }
    if (ts.isVariableDeclarationList(node)) {
      for (const d of node.declarations) {
        const holder = !!d.initializer && holdsFieldValue(d.initializer, scopes);
        const derived = !holder && !!d.initializer && containsEntityFieldRead(d.initializer);
        for (const n of bindingNames(d.name)) scopes.declare(n, holder ? FIELD_HOLDER : derived ? FIELD_DERIVED : 'value');
        if (d.initializer && isLabelKeyedRecord(d.initializer)) report(d, 'label-record');
      }
    }
    if (ts.isBinaryExpression(node) && EQUALITY_OPS.has(node.operatorToken.kind)) {
      const l = unwrap(node.left);
      const r = unwrap(node.right);
      if ((holdsFieldValue(l, scopes) && isEntryLiteral(r) && isLabelLiteral(r.text))
        || (holdsFieldValue(r, scopes) && isEntryLiteral(l) && isLabelLiteral(l.text))) report(node, 'label-literal');
    }
    if (ts.isSwitchStatement(node) && holdsFieldValue(node.expression, scopes)
      && node.caseBlock.clauses.some((c) => ts.isCaseClause(c) && isEntryLiteral(unwrap(c.expression)) && isLabelLiteral(unwrap(c.expression).text))) {
      report(node, 'label-switch');
    }
    const rxUse = regexDecisionOf(node);
    if (rxUse && hasLabelWordRegex(rxUse.rx.getText(sf)) && holdsOrDerivesFieldValue(rxUse.subject, scopes)) {
      report(node, 'label-regex');
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sf, visit);
  findings.sort((a, b) => a.line - b.line || parUnitesDeCode(a.rule, b.rule));
  return findings;
}

/**
 * Le RETOUR D'UN APPEL comparé à un LITTÉRAL FR — `rangeBandName(d, r, m) === 'Bout portant'`
 * (`engine/combat.ts`, décision de l'Esquive à Bout Portant) : le sujet n'est ni un champ (`x.label`,
 * `scanLabelLiteralCompare`) ni une variable qui en dérive, donc AUCUN des scans ci-dessus ne le
 * voyait — mesuré sur la ligne isolée, `scanLabelLogic` et `scanLabelLiteralCompare` rendent `[]`.
 * Critère STRUCTUREL : égalité dont un côté est un APPEL et l'autre un littéral de FORME libellé
 * (`isLabelLiteral` : majuscule initiale, accent, ou espace) — le pendant par id existe toujours
 * (ici `rangeBandId(...) === 'bout-portant'`).
 * CE QUE CE SCAN NE VOIT PAS : l'appel dont le retour est d'abord posé dans une variable puis comparé
 * (aucun lien de flot ici) ; et il ne juge PAS le retour d'un `t(...)`/`String(...)` (formatage), qui
 * reste une comparaison de texte fabriqué — cf. `FORMATTING_CALLS`.
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string, rule: 'label-call-literal' }[]}
 */
const FORMATTING_CALLS = new Set(['String', 't', 'JSON']);
export function scanCallResultLiteralCompare(relPath, contenu) {
 const sf = ts.createSourceFile(relPath, contenu, ts.ScriptTarget.Latest, true, scriptKindDe(relPath));
 const lines = contenu.split('\n');
 const findings = [];
 const seen = new Set();
 const calleeName = (call) => {
  const e = unwrap(call.expression);
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return ts.isIdentifier(e.expression) ? e.expression.text : null;
  return null;
};
 const visit = (node) => {
  if (ts.isBinaryExpression(node) && EQUALITY_OPS.has(node.operatorToken.kind)) {
   const l = unwrap(node.left);
   const r = unwrap(node.right);
   const paire = ts.isCallExpression(l) && isEntryLiteral(r) && isLabelLiteral(r.text) ? l
    : ts.isCallExpression(r) && isEntryLiteral(l) && isLabelLiteral(l.text) ? r
    : null;
   if (paire && !FORMATTING_CALLS.has(calleeName(paire))) {
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    if (!seen.has(line)) {
     seen.add(line);
     findings.push({ line, detail: (lines[line - 1] || '').trim(), rule: 'label-call-literal' });
    }
   }
  }
  ts.forEachChild(node, visit);
 };
 ts.forEachChild(sf, visit);
 findings.sort((a, b) => a.line - b.line);
 return findings;
}

/**
 * STOCK NOMINATIF GELÉ de `label-call-literal`, par fichier (même patron/cliquet que
 * `LABEL_LITERAL_STOCK`) — mesuré sur `src/engine` + `src/state` le 2026-09-09, 1 site :
 * `state/combatFlow.ts` `worstCorruptionExposure`, qui classe le Degré de Corruption d'un adversaire
 * en re-lisant le TEXTE authoré de l'argument du trait (`t.arg.toLowerCase() === 'modérée'`, à côté
 * d'un `rank` keyé par le même texte). Sa migration demande un vocabulaire d'ids pour l'argument du
 * trait `corruption` (donnée + authoring), hors du geste qui pose cette règle : GELÉ, pas exempté.
 * @type {Readonly<Record<string, number>>}
 */
export const LABEL_CALL_LITERAL_STOCK = {
 'src/state/combatFlow.ts': 1,
};

/** Écart au stock `label-call-literal`, cliquet STRICT dans les deux sens (cf. `labelLiteralStockDrift`).
 *  @param {Map<string, number> | Record<string, number>} measured @returns {string[]} */
export function labelCallLiteralStockDrift(measured) {
 const entries = measured instanceof Map ? [...measured] : Object.entries(measured);
 const out = [];
 for (const [rel, n] of entries) {
  const stock = LABEL_CALL_LITERAL_STOCK[rel] ?? 0;
  if (n > stock) out.push(`${rel} : ${n} retour(s) d'appel comparé(s) à un LIBELLÉ, stock = ${stock} — comparer l'id STABLE que la même couture expose.`);
  else if (n < stock) out.push(`${rel} : ${n} retour(s) d'appel comparé(s) à un LIBELLÉ, stock = ${stock} — dette SOLDÉE, mettre LABEL_CALL_LITERAL_STOCK à jour dans le même geste.`);
}
 return out;
}

/**
 * STOCK d'ANCIEN COMPORTEMENT, par fichier (patron `*Stock.mjs` du dépôt) : les vocabulaires de
 * LIBELLÉS encore employés comme logique, à la pose de la règle (2026-07-26, #142 LOT 7). Ce ne sont
 * pas des exemptions — aucun de ces sites n'est légitime : ce sont des AXES entiers qui restent à
 * migrer vers des ids (Disponibilité Commune/Limitée/Rare/Exotique, Statut social Bronze/Argent/Or,
 * récolte Rareté/Danger/Conservation, statut d'indice révélé/réfuté). Le compte est PAR FICHIER
 * (jamais `fichier:ligne` : la ligne dérive à chaque commit voisin et le cliquet crierait à faux).
 *
 * CLIQUET STRICT, dans les DEUX sens : un compte SUPÉRIEUR échoue (dette neuve), un compte
 * INFÉRIEUR échoue aussi (dette soldée → l'entrée se met à jour, ou disparaît, dans le MÊME geste).
 * Un fichier absent du stock est à tolérance ZÉRO. La migration d'un axe se solde en retirant ses
 * entrées, jamais en gonflant un nombre.
 * @type {Readonly<Record<string, number>>}
 */
export const LABEL_LITERAL_STOCK = {
  // Axe Disponibilité (LDB 59) — `Availability` EST le libellé ; `src/engine/disponibilite.ts` porte
  // le type, la table ET le prédicat `isTradable` (source unique de la comparaison aux 4 classes),
  // ses consommateurs suivent.
  'src/engine/activities.ts': 2,
  'src/engine/disponibilite.ts': 1,
  // Axes de récolte (Rareté / Danger / Taille / Conservation) — quatre vocabulaires FR en clés de table.
  'src/engine/harvest.ts': 5,
  // Axe Statut social (Bronze/Argent/Or) — `Status.tier` porte le libellé, lu du texte des carrières.
  'src/engine/creation.ts': 2,
  'src/engine/social.ts': 2,
  'src/ui/creator/CharacterCreator.tsx': 2,
  // Statut d'un indice de campagne (révélé/réfuté) — porté par la donnée de scène et les sauvegardes.
  'src/state/clues.ts': 2,
  'src/state/combatEffects.ts': 1,
  'src/ui/CarnetScreen.tsx': 3,
};

/** Écarts au stock pour un jeu de comptes MESURÉS (`fichier` → nombre de findings) : chaque écart est
 *  une phrase prête à afficher. Le cliquet ne juge que ce qui lui est PRÉSENTÉ : ce qui manque à
 *  `measured` ne rend aucun écart — c'est `couvertureDuBalayage` (`stock.mjs`) qui NOMME ce manque
 *  (gisement muet, entrée de stock hors corpus), et l'appelant qui joue les deux.
 *  @param {Map<string, number>|Record<string, number>} measured @returns {string[]} */
export function labelLiteralStockDrift(measured) {
  const entries = measured instanceof Map ? [...measured] : Object.entries(measured);
  const out = [];
  for (const [rel, n] of entries) {
    const stock = LABEL_LITERAL_STOCK[rel] ?? 0;
    if (n > stock) out.push(`${rel} : ${n} logique(s) par LIBELLÉ, stock = ${stock} — migrer vers un id STABLE (le libellé est de l'AFFICHAGE).`);
    else if (n < stock) out.push(`${rel} : ${n} logique(s) par LIBELLÉ, stock = ${stock} — dette SOLDÉE, mettre LABEL_LITERAL_STOCK à jour dans le même geste.`);
  }
  return out;
}

// ── Index CONSTRUIT sur un champ d'AFFICHAGE, dans le moteur/store (#909) ───────────────────────
// `scanLabelLogic` ne juge que l'INTERROGATION d'une collection par `.label` : la REMPLIR depuis du
// texte y est tolérée (contre-épreuve `NAME_TO_GROUP[norm(t.label)] = …`), la conversion label→id
// étant licite — mais à UN endroit : « Seule couture tolérée : la conversion label→id au CHARGEMENT
// des données, dans `src/data/index.ts` uniquement » (CLAUDE.md § Pour TOUT agent). Dans
// `src/engine`/`src/state`, la même construction est donc la faute, et elle était MUETTE : le
// `Record` `QUALITY_DESC` (`engine/qualities/describe.ts`) a vécu keyé par LIBELLÉ, bâti par
// `Object.fromEntries(… .map((q) => [q.label, q.desc]))` puis LU via une variable
// (`QUALITY_DESC[key]`) — hors de portée d'un scan syntaxique (cf. LIMITE CONNUE de `scanLabelLogic`).
// La CONSTRUCTION est la seule moitié structurellement visible : c'est elle qu'on vise.
const LABEL_PAIR_RX = new RegExp('\\[\\s*[\\w.]+\\.' + DISPLAY_FIELD + '\\s*,');
/** … une paire n'en est une que dans une construction de STRUCTURE (`map`/`fromEntries`/`new Map`) :
 *  `[a.label, b.label].join(', ')` est un tableau d'AFFICHAGE, aucune clé n'y naît. */
const PAIR_CONTEXT_RX = /\b(?:map|fromEntries|new Map|new Set)\s*\(/;
const LABEL_SET_RX = new RegExp('\\.set\\(\\s*[\\w.]+\\.' + DISPLAY_FIELD + '\\s*,');
const LABEL_INDEX_WRITE_RX = new RegExp('[\\w)\\]]\\[[^\\]]*\\.' + DISPLAY_FIELD + '\\b[^\\]]*\\]\\s*(?:\\?\\?|\\|\\||&&)?=[^=]');

/**
 * Sites qui CONSTRUISENT une structure keyée par un champ d'affichage : paire d'un `fromEntries`/
 * `Map`/tableau de paires (`[q.label, q.desc]`), `.set(x.label, …)`, écriture d'index
 * (`M[x.label] = …`). À n'appliquer qu'à `STRICT_DIRS` — hors `src/data`, aucune couture label→id
 * n'est tolérée. La CLÉ doit être le champ d'affichage : `[v.id, v.label]` (libellé en VALEUR) n'est
 * pas visé, c'est la lecture légitime d'un libellé.
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string, rule: 'label-keyed-index' }[]}
 */
export function scanLabelKeyedIndex(relPath, contenu) {
  const findings = [];
  stripComments(contenu).split('\n').forEach((line, i) => {
    if ((LABEL_PAIR_RX.test(line) && PAIR_CONTEXT_RX.test(line)) || LABEL_SET_RX.test(line) || LABEL_INDEX_WRITE_RX.test(line)) {
      findings.push({ line: i + 1, detail: line.trim(), rule: 'label-keyed-index' });
    }
  });
  return findings;
}

/**
 * Stock VIDE : la règle est à tolérance ZÉRO sur tout `STRICT_DIRS`. Cliquet strict dans les DEUX
 * sens comme `LABEL_LITERAL_STOCK` : une entrée neuve se migre, jamais s'inscrit.
 * @type {Readonly<Record<string, number>>}
 */
export const LABEL_KEYED_INDEX_STOCK = {};

/** Découpe une liste de PARAMÈTRES de déclaration sur les VIRGULES de premier niveau — profondeur
 *  `(){}[]`/générique `<>` comptée (types génériques `Map<string, T>` fréquents en signature),
 *  jamais une virgule à l'intérieur d'un objet/tableau/callback/liste de types imbriquée. Profondeur
 *  JAMAIS négative (clampée à 0) : un `>` SANS `<` ouvrant préalable — la flèche `=>` d'un paramètre
 *  typé callback (`(cb: () => void, id: string)`) en contient un — ne doit pas faire déraper le
 *  compteur pour le reste de la chaîne (sans quoi la virgule qui suit ne serait plus vue comme
 *  top-level, #142 LOT 6).
 *  @param {string} s @returns {string[]} */
function splitTopLevel(s) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(' || ch === '[' || ch === '{' || ch === '<') depth++;
    else if ((ch === ')' || ch === ']' || ch === '}' || ch === '>') && depth > 0) depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim() !== '') out.push(cur);
  return out;
}

/** Découpe une liste d'ARGUMENTS d'appel sur les virgules de premier niveau — profondeur `(){}[]`
 *  SEULEMENT, `<`/`>` ignorés (contrairement à `splitTopLevel`) : un opérateur de comparaison parmi
 *  les arguments (`f(a < b, sb.label, d)`) ne doit pas être pris pour l'ouverture d'un générique et
 *  casser tout le découpage qui suit — un générique explicite en position d'ARGUMENT d'appel est
 *  rarissime dans ce dépôt ; l'ignorer ici est le compromis qui couvre le cas réel (#142 LOT 6).
 *  @param {string} s @returns {string[]} */
function splitCallArgs(s) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim() !== '') out.push(cur);
  return out;
}

/** Index de la parenthèse FERMANTE correspondant à celle ouverte en `openIdx` (inclus), par
 *  comptage de profondeur — gère callbacks/génériques/objets imbriqués dans une liste de
 *  paramètres ou d'arguments SANS troncature prématurée (contrairement à un `[^)]*` naïf, qui
 *  s'arrête à la première `)` rencontrée, même celle d'un callback interne).
 *  @param {string} s @param {number} openIdx @returns {number} index de la ')' fermante, ou -1. */
function matchClosingParen(s, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Convertit un INDEX dans `body` en numéro de ligne 1-based. @param {string} body
 *  @param {number} index @returns {number} */
function lineOf(body, index) {
  return body.slice(0, index).split('\n').length;
}

/** Un paramètre de déclaration nommé `id`, OU dont le nom se TERMINE par `Id` (`creatureId`,
 *  `entityId`, `refId`…) — un identifiant au même titre que `id` (#142 LOT 6) : la doctrine
 *  (CLAUDE.md, IDs internes) ne réserve pas le suffixe au seul nom `id`. */
const ID_PARAM_RX = /^\s*(?:id|\w+Id)\s*(?::|$)/;

/** Mots-clés de contrôle/déclaration qui précèdent parfois `nom(` sans que `nom` soit une
 *  déclaration de méthode — exclus de la détection « méthode nue » de `findDeclarationHeads`
 *  (ils sont soit déjà couverts par la tête `function`, soit jamais des identifiants de fonction). */
const METHOD_HEAD_EXCLUDED = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'typeof', 'new', 'await', 'yield',
  'void', 'delete', 'in', 'of', 'async', 'do', 'else', 'try', 'with', 'class', 'const', 'let', 'var',
]);

/** Repère toutes les TÊTES de déclaration `nom(...)` d'un corps — fonction nommée (`function foo`,
 *  `async function foo`), const/let fléchée (`const foo = (...) =>`, `async`, générique `<T>`), et
 *  méthode de CLASSE ou d'OBJET LITTÉRAL (`foo(id: string) { … }`, raccourci sans `function`) —
 *  mécanique COMMUNE à `collectIdParamFunctions` et `collectDeclaredNames` (#142 LOT 6).
 *  Une tête « nue » (`nom(` sans mot-clé de déclaration devant) n'est retenue QUE si elle est
 *  suivie, après un type de retour éventuel, d'un `{` : c'est ce qui distingue une VRAIE
 *  déclaration (méthode/fonction, qui ouvre un CORPS) d'un simple APPEL — `foo(id);`, `if (foo(id))
 *  {` sont suivis d'un `;`/`)`, jamais directement d'un `{`.
 *  LIMITE ASSUMÉE : les signatures sans corps (méthodes d'`interface`/`type`, surcharges) sont hors
 *  de portée — elles ne fournissent aucun CODE dont le paramètre serait analysable de toute façon.
 *  @param {string} body @returns {{name: string, paramsInner: string}[]} */
function findDeclarationHeads(body) {
  const heads = [];
  const seenAt = new Set();
  const push = (name, openIdx) => {
    if (seenAt.has(openIdx)) return;
    const closeIdx = matchClosingParen(body, openIdx);
    if (closeIdx < 0) return;
    seenAt.add(openIdx);
    heads.push({ name, paramsInner: body.slice(openIdx + 1, closeIdx) });
  };

  const FN_HEAD_RX = /(?:function\s+(\w+)\s*(?:<[^>]*>)?\s*\(|(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?(?:<[^>]*>\s*)?\()/g;
  let m;
  while ((m = FN_HEAD_RX.exec(body))) {
    const name = m[1] || m[2];
    if (name) push(name, m.index + m[0].length - 1);
  }

  const METHOD_HEAD_RX = /(?<![.\w$])(\w+)\s*(?:<[^>]*>)?\s*\(/g;
  while ((m = METHOD_HEAD_RX.exec(body))) {
    const name = m[1];
    if (METHOD_HEAD_EXCLUDED.has(name) || seenAt.has(m.index + m[0].length - 1)) continue;
    const openIdx = m.index + m[0].length - 1;
    const closeIdx = matchClosingParen(body, openIdx);
    if (closeIdx < 0) continue;
    let j = closeIdx + 1;
    while (j < body.length && /\s/.test(body[j])) j++;
    if (body[j] === ':') {
      // type de retour éventuel — avance jusqu'au `{`/`;`/`=`/`,` de premier niveau qui suit. `{`
      // N'EST PAS compté comme ouvrant (contrairement à `(`/`[`/`<`) : c'est le marqueur d'ARRÊT
      // recherché (début du corps) — un type de retour EXCEPTIONNEL en littéral d'objet
      // (`(): { a: string } { … }`) reste géré correctement malgré tout, puisque ce `{` de type
      // fait alors, lui aussi, foi de « corps suit » (limite assumée, sans impact fonctionnel).
      j++;
      let depth = 0;
      while (j < body.length) {
        const c = body[j];
        if (c === '<' || c === '(' || c === '[') depth++;
        else if (c === '>' || c === ')' || c === ']') {
          if (depth === 0) break;
          depth--;
        } else if (depth === 0 && (c === '{' || c === ';' || c === '=' || c === ',')) break;
        j++;
      }
    }
    while (j < body.length && /\s/.test(body[j])) j++;
    if (body[j] !== '{') continue;
    push(name, openIdx);
  }
  return heads;
}

/** Déclarations de fonction (`function foo(...)`, `const foo = (...) =>`, méthode de classe/objet
 *  littéral) portant un paramètre `id`/`*Id` — collecte GLOBALE nom→index positionnel, cinquième
 *  forme du garde-fou #142 : une résolution PAR ID n'a pas besoin de s'appeler `*ById`
 *  (`bodyShapeOf(id: string)` en est un exemple réel, #142 LOT 5) — seul le PARAMÈTRE `id`/`*Id`
 *  fait foi, structurel, jamais un grep du nom de la fonction.
 * @param {string} contenu @returns {Map<string, number>} */
export function collectIdParamFunctions(contenu) {
  const body = stripComments(contenu);
  const map = new Map();
  for (const { name, paramsInner } of findDeclarationHeads(body)) {
    if (map.has(name)) continue;
    const idx = splitTopLevel(paramsInner).findIndex((p) => ID_PARAM_RX.test(p));
    if (idx >= 0) map.set(name, idx);
  }
  return map;
}

/** Tous les NOMS de fonction déclarés dans un fichier (même mécanique de déclaration que
 *  `collectIdParamFunctions`, paramètre `id` ou pas) — sert à détecter le SHADOWING local d'un nom
 *  global court (`toggle`, `set`…) : un fichier qui déclare SA PROPRE fonction homonyme sans paramètre
 *  `id` masque, pour SES appels, l'entrée globale sans rapport d'un autre fichier (#142 LOT 5, faux
 *  positif constaté : `SessionEndModal.tsx` déclare `toggle(id, key)`, `CharacterCreator.tsx` sa
 *  PROPRE `toggle(label)` — son appel `toggle(s.label)` vise la locale, pas l'homonyme).
 * @param {string} contenu @returns {Set<string>} */
export function collectDeclaredNames(contenu) {
  const body = stripComments(contenu);
  const names = new Set();
  for (const { name } of findDeclarationHeads(body)) names.add(name);
  return names;
}

/** Méthode d'INTERROGATION de collection dont le nom court collisionne, MESURÉ sur src/engine+state+
 *  gameIso+ui (#142 LOT 6bis), avec des déclarations homonymes sans rapport ailleurs dans le corpus :
 *  `set` SEUL — désactiver toute la liste (blacklist vidée) produit 5 faux positifs sur le corpus réel,
 *  TOUS dus à `set` (`set((s) => …)` du store Zustand ×3, `teamOf.set(x.label, …)`/`m.set(all[i].label, …)`
 *  = Map ×2) ; aucun autre nom (`has`/`get`/`delete`/`add`/`push`/`toggle`…) n'en produit UN SEUL. Élargir
 *  au-delà de `set` AVEUGLE en retour de vraies déclarations à paramètre `id` (mesuré, LOT 6bis) :
 *  `crewedWeapon.ts has(#0)`, `devtools.ts find(#0)`, `validateScene.ts add(#2)`,
 *  `quadSkeleton.ts set(#0)`, `SeaActivitiesModal.tsx set(#0)`, `SessionEndModal.tsx toggle(#0)`.
 *  `set` reste blacklisté malgré ce coût (2 sites ci-dessus aveuglés) car SANS information de TYPE, rien
 *  ne distingue structurellement `teamOf.set(x.label, …)` (Map, hors sujet) de `quadSkeleton.ts`
 *  `set(id)` (déclaration réelle) — même receveur inconnu. */
const COLLECTION_METHOD_NAMES = new Set(['set']);

/** L'argument (déjà découpé) désigne-t-il un `.label`, MODULO les enrobages qui ne changent pas
 *  l'IDENTITÉ de la valeur transportée : repli `??`/`||`, assertion de type `as …`, non-null `!`,
 *  coercion `String(...)`, interpolation SEULE dans un gabarit (`` `${x.label}` ``), ou chaînage
 *  d'une méthode de chaîne PURE sur `.label` (`.toLowerCase()`, `.trim()`…). L'ALIASING
 *  (`const n = x.label; f(n)`) et tout flux inter-variables ne sont PAS traités : une regex ne suit
 *  pas une variable à travers ses affectations — le faire semblant produirait de faux négatifs
 *  invisibles, pire qu'une limite assumée (#142 LOT 6).
 *  @param {string} arg @returns {boolean} */
function isLabelArg(arg) {
  let a = arg.trim();
  const fallback = a.match(/^([\s\S]+?)\s*(?:\?\?|\|\|)\s*[\s\S]+$/);
  if (fallback) a = fallback[1].trim();
  a = a.replace(/\s+as\s+[\w.<>[\], ]+$/, '').trim();
  a = a.replace(/!+$/, '').trim();
  const coerced = a.match(/^String\(\s*([\s\S]+?)\s*\)$/);
  if (coerced) a = coerced[1].trim();
  const tpl = a.match(/^`\$\{\s*([\s\S]+?)\s*\}`$/);
  if (tpl) a = tpl[1].trim();
  if (/\.label\s*$/.test(a)) return true;
  return /\.label\.(?:toLowerCase|toUpperCase|trim|trimStart|trimEnd|normalize)\(\s*\)\s*$/.test(a);
}

/**
 * `.label` passé en ARGUMENT, à la position du paramètre `id`, d'un appel à une fonction connue de
 * `idParamFns` (collectée par `collectIdParamFunctions` sur le CORPUS entier — déclaration et appel
 * peuvent vivre dans des fichiers différents). Le corps est scanné en ENTIER (pas ligne par ligne)
 * pour couvrir les appels MULTILIGNE ; l'argument est délimité par COMPTAGE de parenthèses
 * (`matchClosingParen`) puis découpé par `splitCallArgs`, robuste aux `<`/`>` de comparaison parmi
 * les arguments : `bodyShapeOf(sb.label)` matche (arg 0 = paramètre `id`, `.label` passé où une
 * résolution attend un id STABLE) ; `bodyShapeOf(creature.id)` ne matche pas (l'argument est `.id`,
 * pas `.label`). Couvre aussi les enrobages triviaux (`??`, `as`, `!`, template, `String(...)`,
 * méthode de chaîne pure — `isLabelArg`) et les appels de MÉTHODE dont le nom n'est pas une méthode
 * de collection connue (`COLLECTION_METHOD_NAMES` — `set` SEUL, mesuré #142 LOT 6bis).
 * @param {string} relPath @param {string} contenu @param {Map<string, number>} idParamFns
 * @returns {{ line: number, detail: string, rule: 'label-as-id-arg' }[]}
 */
export function scanLabelAsIdArg(relPath, contenu, idParamFns) {
  const findings = [];
  const body = stripComments(contenu);
  const lines = body.split('\n');
  // `(?:(\w+)\.)?` = receveur optionnel d'un appel de méthode (`teamOf.set(`, `helpers.bodyShapeOf(`) —
  // seul le nom de méthode (dernier segment) est confronté à `idParamFns`/`COLLECTION_METHOD_NAMES`.
  const CALL_RX = /(?<![.\w])(?:(\w+)\.)?(\w+)\s*\(/g;
  let m;
  while ((m = CALL_RX.exec(body))) {
    const fnName = m[2];
    // `COLLECTION_METHOD_NAMES` exclut AUSSI l'appel NU (sans receveur) : ces noms courts sont des
    // PARAMÈTRES ubiquitaires (le `set` de Zustand `(set, get) => ({...})`) que `collectDeclaredNames`
    // ne peut pas voir comme un SHADOWING (ce n'est pas une déclaration, c'est un paramètre de
    // closure) — une déclaration homonyme RÉELLE ailleurs dans le corpus (`const set = (id, x, z) =>
    // …` d'un helper de rig, #142 LOT 6) collisionnerait sinon avec CHAQUE `set(...)` de tout le
    // store. Limite DOCUMENTÉE et mesurée : ces noms restent hors de portée, receveur ou pas.
    if (COLLECTION_METHOD_NAMES.has(fnName)) continue;
    const idx = idParamFns.get(fnName);
    if (idx === undefined) continue;
    const openIdx = m.index + m[0].length - 1;
    const closeIdx = matchClosingParen(body, openIdx);
    if (closeIdx < 0) continue;
    const inner = body.slice(openIdx + 1, closeIdx);
    const arg = splitCallArgs(inner)[idx];
    if (arg && isLabelArg(arg)) {
      const line = lineOf(body, m.index);
      findings.push({ line, detail: (lines[line - 1] || '').trim(), rule: 'label-as-id-arg' });
    }
  }
  return findings;
}

/** `.ts`/`.tsx` sous des dossiers racine, récursif — même marche que le scan de corpus des gardes.
 *  @param {string[]} dirs (absolus, ou relatifs à `root` si `root` fourni via `isAbsolute`)
 *  @returns {string[]} chemins absolus */
function listTsFiles(dirs) {
  return dirs.flatMap((d) => listerArbre(d, { filtre: (rel) => /\.tsx?$/.test(rel) }).map((rel) => join(d, rel)));
}

/** Exclusion PARTAGÉE du scan de corpus (déclaration ET appel) : fichiers de TEST, et
 *  `src/data/index.ts` (couture label→id tolérée au CHARGEMENT, hors périmètre du garde-fou).
 *  @param {string} rel chemin relatif à la racine du projet, séparateurs `/` @returns {boolean} */
export function isCorpusExcluded(rel) {
  return estFichierVitest(rel) || rel === 'src/data/index.ts';
}

/** Map GLOBALE nom→index-paramètre-`id`, collectée en lisant le DISQUE sous `dirs` (déclaration et
 *  appel peuvent vivre dans des fichiers différents, cf. `collectIdParamFunctions`) — SOURCE UNIQUE
 *  de cette composition (parcours + lecture + fusion), consommée à l'identique par
 *  `label-logic-guard.test.ts` ET par le hook pre-commit (#142 LOT 6bis), sans copie.
 *  @param {string} root racine absolue du projet @param {string[]} dirs dossiers (absolus ou relatifs à `root`)
 *  @returns {Map<string, number>} */
export function collectIdParamFnsAcrossDirs(root, dirs) {
  const map = new Map();
  const absDirs = dirs.map((d) => (isAbsolute(d) ? d : join(root, d)));
  for (const f of listTsFiles(absDirs)) {
    const rel = relative(root, f).split('\\').join('/');
    if (isCorpusExcluded(rel)) continue;
    for (const [name, idx] of collectIdParamFunctions(readFileSync(f, 'utf8'))) if (!map.has(name)) map.set(name, idx);
  }
  return map;
}

/** Map EFFECTIVE (locale + globale) pour un fichier donné : un nom d'ID_PARAM_FNS global MASQUÉ par
 *  une déclaration homonyme LOCALE (shadowing, `collectDeclaredNames`) cède la place à la locale —
 *  composition PARTAGÉE, même raison d'être que `collectIdParamFnsAcrossDirs` ci-dessus (#142 LOT 6bis).
 *  @param {string} contenu @param {Map<string, number>} globalIdParamFns @returns {Map<string, number>} */
export function effectiveIdParamFns(contenu, globalIdParamFns) {
  const local = collectIdParamFunctions(contenu);
  const localNames = collectDeclaredNames(contenu);
  const eff = new Map(local);
  for (const [name, idx] of globalIdParamFns) if (!localNames.has(name)) eff.set(name, idx);
  return eff;
}


/** Dossiers TOLÉRANCE ZÉRO (`src/engine`, `src/state`) — SOURCE UNIQUE, consommée à l'identique par
 *  `label-logic-guard.test.ts` ET par le hook pre-commit (défaut constaté : liste dupliquée en dur
 *  aux deux endroits, divergente silencieusement au premier ajout d'un seul côté). */
export const STRICT_DIRS = ['src/engine', 'src/state'];

/** Dossiers RATCHET à exceptions justifiées (`src/gameIso`, `src/ui`, #289) — même source unique. */
export const RATCHET_DIRS = ['src/gameIso', 'src/ui'];

/** Exceptions JUSTIFIÉES du ratchet (#289) — `fichier:ligne` (relatif à `src/`) → justification.
 *  SOURCE UNIQUE (`label-logic-guard.test.ts` et le hook pre-commit la consomment TOUS DEUX, sans
 *  copie) : une entrée périmée (site déplacé/assaini) doit être retirée des DEUX consommateurs à la
 *  fois, jamais resynchronisée à la main de chaque côté. */
export const RATCHET_EXCEPTIONS = {
  'gameIso/rig/parts/equipment.ts:22':
    "isShield (fallback de RENDU rig) — détecte un bouclier d'abord par la Qualité Protectrice ; " +
    "repli texte sur x.label pour un objet custom/legacy dépourvu de cette Qualité. Classification " +
    "VISUELLE (quel gabarit dessiner), pas une FK de logique métier — aucune régression possible.",
  'ui/RollRow.tsx:92':
    "Nom ACCESSIBLE dérivé du libellé affiché de la ligne (« Fixer le dé — Voile », #1117) — display " +
    "pur, aucun branchement de comportement : rien n'est décidé selon le texte, il est seulement RENDU " +
    "dans un attribut. Le test de type est structurel, pas sémantique : `RollBreakdown.label` est une " +
    "chaîne, `PendingRoll.label` un ReactNode (chips) dont on ne peut extraire de texte sans le tester. " +
    "Sans ce nom, N spinbuttons « Fixer le dé » deviennent homonymes et le geste vise au hasard.",
  'ui/RollRow.tsx:93':
    'Même dérivation, branche du pré-jet (`row.pending.label`) — même justification que :92.',
};

/** Résout le `shortKey` (`fichier:ligne` relatif à `src/`) d'un finding porté par un chemin `src/…`
 *  — même calcul que `label-logic-guard.test.ts` (ratchet) et le hook pre-commit.
 *  @param {{ rel: string, line: number }} finding @returns {string} */
export function ratchetShortKey(finding) {
  return `${finding.rel.replace(/^src\//, '')}:${finding.line}`;
}

// ── Résolution d'ENTITÉ depuis un LIBELLÉ, appelée hors de sa seule couture légitime (#909) ────────
// La comparaison `.label === label` d'un résolveur (`findSpell`, `findTalent`…) vit DANS
// `src/data/index.ts`, seul fichier où `isCorpusExcluded`/`STRICT_DIRS` la tolère. Les scans
// ci-dessus ne voient QUE cette comparaison textuelle — pas le fait d'INVOQUER un tel résolveur
// depuis `src/engine`/`src/state`, où le paramètre reçu est déjà, la plupart du temps, un id : y
// appeler `findSpell(x)` bascule quand même toute la résolution sur le texte d'affichage.
//
// Reconnaissance du résolveur — critères structurels, jamais une liste de noms :
//  1. déclaré et exporté dans `src/data/index.ts` (seul fichier où la légitimité existe, doctrine
//     CLAUDE.md — un résolveur par label ailleurs serait une AUTRE faute, hors périmètre #909) ;
//  2. il RÉSOUT par libellé, sous l'une des trois formes que porte ce fichier :
//     a. fonction/flèche dont le paramètre s'appelle EXACTEMENT `label` et dont le type de retour est
//        une entité de catalogue — `XxxData` (`SpellData`, `TalentData`…), convention des
//        interfaces app-owned ;
//     b. ALIAS d'un binding construit par `indexParChamp(cle, entrees, (e) => e.label…)` — l'index
//        vif rend l'ENTRÉE elle-même, donc l'alias résout l'entité par son libellé exactement comme
//        (a) : un critère qui ne jugerait que la FORME SYNTAXIQUE (flèche avec corps) serait muet sur
//        ce résolveur, inchangé pour l'appelant.
//     c. fonction/flèche à paramètre `label` dont le NOM suit `…By…Label` (`traitIdByLabel`…) : la
//        conversion libellé→id est la même résolution, elle rend l'id au lieu de l'entrée (#1924).
// Critère de FORME plutôt qu'une liste de noms : une liste manque tout résolveur de même forme
// qu'elle ne nomme pas ; la forme retrouve le prochain sans toucher cette lib.
//
// CE QUE CE CRITÈRE NE VOIT PAS (faux négatifs assumés) :
//  - un paramètre nommé autrement que `label` pile (`labelText`, `lbl`, `name` — `speciesSingular`
//    prend `label` mais ne RÉSOUT rien, il reformate ; son retour `string` l'exclut déjà) ;
//  - un retour hors `XxxData` sous un nom hors `…By…Label` ;
//  - un résolveur déclaré hors de `src/data/index.ts` (hors périmètre par construction, cf. ci-dessus).

/** Le type est-il une TypeReference (traversant les unions) dont le nom se termine par `Data` —
 *  convention réelle des interfaces de catalogue app-owned de ce dépôt ? @param {ts.TypeNode=} t */
function isEntityDataType(t) {
  if (!t) return false;
  if (ts.isUnionTypeNode(t)) return t.types.some(isEntityDataType);
  return ts.isTypeReferenceNode(t) && ts.isIdentifier(t.typeName) && /Data$/.test(t.typeName.text);
}

/** `node` porte-t-il le modificateur `export` ? @param {ts.Node} node */
function isExported(node) {
  return (node.modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

/** L'initialiseur est-il un INDEX VIF keyé par le LIBELLÉ — `indexParChamp(cle, entrees, (e) =>
 *  e.label…)` (`src/data/versionDataset.ts`) ? Cet accesseur rend l'ENTRÉE de catalogue elle-même
 *  (`(k) => T | undefined`) : le binding qui le tient RÉSOUT une entité par son libellé, quelle que
 *  soit la forme sous laquelle un export le publie ensuite. La clef est lue par son CORPS (`d.label`,
 *  `t.label.toLowerCase()`, `norm(t.label)`, `slugId(q.label)`), pas par le nom du binding.
 *  @param {ts.Node} init */
function isLabelKeyedIndex(init) {
  const n = unwrap(init);
  if (!ts.isCallExpression(n) || !ts.isIdentifier(n.expression) || n.expression.text !== 'indexParChamp') return false;
  const clef = n.arguments[2];
  if (!clef || !(ts.isArrowFunction(clef) || ts.isFunctionExpression(clef))) return false;
  let litLeLabel = false;
  const voir = (x) => {
    if (ts.isPropertyAccessExpression(x) && ts.isIdentifier(x.name) && x.name.text === 'label') litLeLabel = true;
    ts.forEachChild(x, voir);
  };
  voir(clef.body);
  return litLeLabel;
}

/** Les bindings qui TIENNENT une résolution par libellé : index keyé par label, ou ALIAS NU d'un tel
 *  binding — les déclarations étant en ordre, une chaîne d'alias suit (même mécanique d'héritage par
 *  alias que `nomsVifsDuFichier`, `bindingsVifs.mjs`).
 *  @param {ts.SourceFile} sf @returns {Set<string>} */
function labelKeyedBindings(sf) {
  const noms = new Set();
  const visit = (node) => {
    if (ts.isVariableStatement(node)) {
      for (const d of node.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || !d.initializer) continue;
        const init = unwrap(d.initializer);
        if (isLabelKeyedIndex(init) || (ts.isIdentifier(init) && noms.has(init.text))) noms.add(d.name.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  return noms;
}

/**
 * Résolveurs d'entité par libellé déclarés dans `src/data/index.ts` — fonction nommée exportée
 * (`export function findX(label: string): XData {…}`) ou const fléchée exportée
 * (`export const findX = (label: …): XData | undefined => …`), premier paramètre nommé `label`,
 * retour `XxxData` (cf. en-tête ci-dessus pour la doctrine du critère) — ou retour d'un IDENTIFIANT
 * (`traitIdByLabel(label): string`, nom en `…By…Label`, #1924 : la conversion libellé→id est la même
 * résolution, elle rend l'id au lieu de l'entrée) ; OU export qui ALIASE un
 * binding keyé par le libellé (`export const findX: … = xParLabel;`, où `xParLabel
 * = indexParChamp('x', entrees, (e) => e.label)`) — la résolution est la même, seule la forme
 * syntaxique diffère.
 * @param {string} contenu — contenu de `src/data/index.ts` @returns {Set<string>}
 */
export function collectLabelEntityResolvers(contenu) {
  const sf = ts.createSourceFile('index.ts', contenu, ts.ScriptTarget.Latest, true, scriptKindDe('index.ts'));
  const names = new Set();
  const parLabel = labelKeyedBindings(sf);
  const hasLabelFirstParam = (params) => params.length >= 1 && ts.isIdentifier(params[0].name) && params[0].name.text === 'label';
  const resout = (nom, type) => isEntityDataType(type) || /By\w*Label$/.test(nom);
  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && isExported(node)
      && hasLabelFirstParam(node.parameters) && resout(node.name.text, node.type)) {
      names.add(node.name.text);
    }
    if (ts.isVariableStatement(node) && isExported(node)) {
      for (const d of node.declarationList.declarations) {
        if (!ts.isIdentifier(d.name)) continue;
        const init = d.initializer && unwrap(d.initializer);
        if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))
          && hasLabelFirstParam(init.parameters) && resout(d.name.text, init.type)) {
          names.add(d.name.text);
        }
        if (init && ts.isIdentifier(init) && parLabel.has(init.text)) names.add(d.name.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  return names;
}

/** Lit `src/data/index.ts` sous `root` et en extrait les résolveurs d'entité par libellé — SOURCE
 *  UNIQUE consommée par `label-logic-guard.test.ts` ET le hook pre-commit.
 *  @param {string} root racine absolue du projet @returns {Set<string>} */
export function labelEntityResolverNames(root) {
  return collectLabelEntityResolvers(readFileSync(join(root, 'src/data/index.ts'), 'utf8'));
}

/**
 * Appels à un résolveur d'entité par libellé (`resolverNames`) dans un fichier de `src/engine`/
 * `src/state` — la faute #909 : la comparaison `.label` est invisible ici (elle vit dans le
 * résolveur, à `src/data/index.ts`), seul l'APPEL l'est. Le nom appelé qui est SHADOWÉ par une
 * déclaration locale homonyme (`collectDeclaredNames`, même mécanique que `effectiveIdParamFns`)
 * est écarté — pas le même défaut si le fichier définit SA PROPRE fonction de ce nom.
 * @param {string} relPath @param {string} contenu @param {Set<string>} resolverNames
 * @returns {{ line: number, detail: string, rule: 'label-entity-resolver-call', fn: string }[]}
 */
export function scanLabelResolverCalls(relPath, contenu, resolverNames) {
  const local = collectDeclaredNames(contenu);
  const active = new Set([...resolverNames].filter((n) => !local.has(n)));
  if (active.size === 0) return [];
  const sf = ts.createSourceFile(relPath, contenu, ts.ScriptTarget.Latest, true, scriptKindDe(relPath));
  const lines = contenu.split('\n');
  const findings = [];
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && active.has(node.expression.text)) {
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      findings.push({ line, detail: (lines[line - 1] || '').trim(), rule: 'label-entity-resolver-call', fn: node.expression.text });
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  return findings;
}

// Stock cliqueté (`LABEL_RESOLVER_CALL_STOCK`) : `labelResolverCallStock.mjs` — l'écart au stock se
// calcule par la primitive partagée `ecartsDeStock` (`stock.mjs`), chez la garde appelante
// (patron whitelist-en-lib SÉPARÉE du dépôt — `entityOrphanStock.mjs`/`folioRatchetStock.mjs`/
// `manualDocsStock.mjs`), pour que le CONSTAT (ce module) reste distinct du STOCK (données figées
// à la pose de la règle) — même séparation que `folioIntegrity.mjs` / `folioRatchetStock.mjs`.
