// Mécanique de scan du garde-fou « logique par LABEL interdite » (#142, doctrine CLAUDE.md bloc
// agents). Module ESM pur (opère sur du texte source), consommé par
// src/state/label-logic-guard.test.ts, le hook pre-commit (scripts/git-hooks/pre-commit.mjs) ET le
// hook au stylo (scripts/hooks/poison-postcheck.mjs) — SOURCE UNIQUE du corpus (`estDansLeCorpus`),
// du contexte inter-fichiers (`contexteDeLaGarde`), de la composition des volets
// (`scanLabelLogicFichier`, en fin de fichier) et des volets sans stock (`clesInterditesAuStock`),
// pour que les trois consommateurs ne divergent jamais.
import { parUnitesDeCode } from './lister.mjs';
import { scriptKindDe } from './dialecte.mjs';
import tsModule from 'typescript';

// Liaison LOCALE de l'API du compilateur — même FAIT mesuré qu'en tête de `sceneMutation.mjs`
// (2026-08-23) : sous Vitest, un `ts.x` de visiteur AST se relit sur l'objet d'import de vite-node.
const ts = tsModule;
// Substrat AST PARTAGÉ (portées, alias, opérateurs d'égalité, littéralité) — SOURCE UNIQUE
// `registryIdBranch.mjs` : le suivi d'alias `const k = def.id` y existe déjà, on l'importe.
import { Scopes, bindingNames, unwrap, isEntryLiteral, EQUALITY_OPS } from './registryIdBranch.mjs';
import { estRetenu, readCorpus } from './sourceCorpus.mjs';
// Vue CODE des volets lexicaux (lignes et colonnes préservées) — `codeSeul.mjs`, #1790.
import { codeSeul } from './codeSeul.mjs';

/** Carte par label : constante hurlante `XXX_BY_LABEL`/`XXXBYLABEL`, ou fonction/variable `byLabel`. */
export const BY_LABEL_RX = /(BY_?LABEL|byLabel)/;

/** Comparaison D'ÉGALITÉ sur `.label`, dans un sens ou l'autre. Le membre en face de `.label` doit
 *  être un accès `mot(.mot)*` COLLÉ (pas d'appel/parenthèse/optional-chaining entre les deux) : ça
 *  exclut `find((x) => x.id === id)?.label` (extraction d'AFFICHAGE après un lookup PAR ID), qui
 *  n'est pas une comparaison mais une résolution de libellé légitime. Un `.label` sous `typeof`
 *  (`typeof p.label === 'string'`) compare le TYPE du champ, pas son texte : il n'est pas visé. */
export const LABEL_EQ_RX = /(?<!\btypeof\s+[\w.?]*)\.label\s*===|===\s*[\w.]+\.label\b/;

/** PRÉDICAT sur `.label` : `.label` comme ARGUMENT d'un `.test(`/`.exec(` (regex évaluée contre un
 *  label), ou comme RÉCEPTEUR d'une méthode de chaîne prédicative (`.label.startsWith(`/`.endsWith(`/
 *  `.match(`/`.includes(`/`.test(`/`.search(`/`.indexOf(`). Même défaut que `LABEL_EQ_RX` : logique
 *  qui distingue des cas par IDENTITÉ de libellé plutôt que par `id` stable. */
export const LABEL_PREDICATE_RX = /\.test\([^)]*\.label\b|\.label\.(?:match|includes|startsWith|endsWith|test|search|indexOf)\(/;

// Espèce en RÉCEPTEUR : identifiant `species*` (`species`, `x.species`, `speciesId`), accès indexé
// `x['species']`, ou groupe parenthésé qui la contient (`(x.species ?? '')`, `String(x.species)`) —
// un appel `f({ species })` n'en est pas un.
const ESPECE = String.raw`(?:\bspecies\w*|\[\s*['"]species\w*['"]\s*\])`;
const RECEPTEUR_ESPECE = String.raw`(?:${ESPECE}|(?:(?<![\w$\])\]])|\bString)\([^()]*\bspecies[^()]*\))`;
const LITTERAUX = String.raw`(?:'[^']*'|"[^"]*")(?:\s*,\s*(?:'[^']*'|"[^"]*"))*\s*,?`;

/** PRÉDICAT de MOTIF sur une espèce : méthode de chaîne prédicative sur son récepteur (`!`/`?.`
 *  compris, après `split`/`toLowerCase`/`toUpperCase` éventuels), `.test(` d'une regex, liste
 *  LITTÉRALE d'ids qui la teste (`[…].includes`, `new Set([…]).has`), comparaison à un littéral (hors
 *  `typeof`). L'appartenance d'une espèce se lit dans sa DONNÉE (`grantGroups`, `groupsFor`), jamais
 *  dans la forme de son id ni de son libellé (#1897). Une liste NOMMÉE (`allowed.includes(x.species)`)
 *  et un prédicat sur un alias (`const s = species.toLowerCase()`) échappent : lexicalement
 *  indiscernables d'un lookup par id. */
export const SPECIES_PREDICATE_RX = new RegExp(
  [
    String.raw`${RECEPTEUR_ESPECE}\s*!?(?:\??\.(?:split|toLowerCase|toUpperCase)\([^()]*\))*\??\.(?:match|includes|startsWith|endsWith|test|search|indexOf)\(`,
    String.raw`\.test\([^)]*\bspecies`,
    String.raw`\[\s*${LITTERAUX}\s*\]\s*\.(?:includes|indexOf)\([^)]*\bspecies`,
    String.raw`new Set\(\s*\[\s*${LITTERAUX}\s*\]\s*\)\s*\.has\([^)]*\bspecies`,
    String.raw`(?<!\btypeof\s+[\w$.?]*)${ESPECE}\s*[!=]==?\s*['"]`,
    String.raw`['"]\s*[!=]==?\s*[\w$.?]*${ESPECE}`,
  ].join('|'),
);

/** Clé LITTÉRALE d'un accès indexé (`x['species']`), blanchie par `codeSeul`, restituée depuis la
 *  source aux mêmes colonnes : un nom de propriété est du CODE, le récepteur que lit
 *  `SPECIES_PREDICATE_RX`. @param {string} code ligne de `codeSeul` @param {string} source même ligne,
 *  brute @returns {string} */
function avecClesDAcces(code, source) {
  return code.replace(/\[\s*(['"]) *\1\s*\]/g, (m, _q, debut) => source.slice(debut, debut + m.length));
}

/** `switch` sur `.label` : un aiguillage par libellé est la même famille de logique-par-label qu'une
 *  carte `BY_LABEL`, juste écrite en `switch`. */
export const LABEL_SWITCH_RX = /switch\s*\([^)]*\.label\b/;

/** DÉRIVATION D'IDENTITÉ depuis un libellé (#637) : un argument de `slugId(…)` qui LIT un `.label`,
 *  quelle que soit la chaîne qui y mène — `slugId(x.label)`, `slugId(f(x)?.label ?? y)`,
 *  `slugId(a?.b.label)`, un gabarit. Re-dériver un `id` du `.label` (affichage multilangue) au runtime
 *  couple l'identité à la langue — une traduction change l'id, cassant lookups/références/sauvegardes.
 *  Vise `.label` SEULEMENT (pas `.name` : la conversion d'un fragment TEXTE saisi en éditeur —
 *  `slugId(p.name)` d'un `splitLabel` — est la couture label→id d'authoring tolérée). Lecture par l'AST
 *  (`litLeLabel`, le critère du volet (c) de la garde de face), jamais par une regex de ligne.
 *  @param {string} relPath @param {string} contenu @returns {Set<number>} lignes des appels fautifs */
function lignesDeSlugDepuisLabel(relPath, contenu) {
  const lignes = new Set();
  if (!contenu.includes('slugId')) return lignes;
  const sf = arbre(relPath, contenu);
  const voir = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'slugId' && n.arguments.some(litLeLabel)) lignes.add(ligneDe(sf, n));
    ts.forEachChild(n, voir);
  };
  voir(sf);
  return lignes;
}

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
 * sur la vue CODE (`codeSeul` : commentaires et contenu des chaînes blanchis) ; `detail` cite la ligne
 * SOURCE.
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
 * Chaque finding porte sa `rule`, qui entre dans la clé du stock `DETTES_DE_LIBELLE` : les règles
 * `.label` HISTORIQUES (#142) valent `label-logic`, volet SANS stock (`VOLETS_SANS_STOCK`) ; les règles
 * `collection-key` (#602) et `display-key` (#598) sont distinguées pour qu'une dette y soit stockée
 * SANS amnistier au passage une `label-logic`.
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string, rule: 'label-logic' | 'collection-key' | 'display-key' }[]}
 */
export function scanLabelLogic(relPath, contenu) {
  const findings = [];
  const source = contenu.split('\n');
  const slugDeLabel = lignesDeSlugDepuisLabel(relPath, contenu);
  codeSeul(contenu).split('\n').forEach((line, i) => {
    const detail = source[i].trim();
    const labelLogic =
      BY_LABEL_RX.test(line) ||
      LABEL_EQ_RX.test(line) ||
      LABEL_PREDICATE_RX.test(line) ||
      SPECIES_PREDICATE_RX.test(avecClesDAcces(line, source[i])) ||
      LABEL_SWITCH_RX.test(line) ||
      slugDeLabel.has(i + 1);
    // Une ligne qui viole les DEUX est rapportée sous `label-logic` (la règle la plus stricte prime,
    // sinon un baseline `display-key` amnistierait au passage une vraie logique-par-label).
    if (labelLogic) findings.push({ line: i + 1, detail, rule: 'label-logic' });
    else if (hasDisplayCollectionKey(line)) findings.push({ line: i + 1, detail, rule: 'collection-key' });
    else if (DISPLAY_KEY_TEMPLATE_RX.test(line)) findings.push({ line: i + 1, detail, rule: 'display-key' });
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
 *  Deux formes de CODE échappent au critère, par leur forme aussi : le NOM d'un type d'erreur
 *  (`'AbortError'` de `DOMException.name`, `fsPersist.ts` — un identifiant en casse de chameau fini
 *  par `Error`, vocabulaire des normes ECMAScript/WebIDL), et un jeton de grammaire entre accolades
 *  (`'{clé}'`, segment de chemin de `src/data/schemas/grammaire/descente.ts`). Toute AUTRE casse de
 *  chameau reste un libellé candidat : `'InfMoyenne'` (`HarvestSize`) en est un.
 *  @param {string} text @returns {boolean} */
export function isLabelLiteral(text) {
  if (text.length < 2) return false;
  if (/^[A-Z][A-Za-z]*Error$/.test(text) || /^\{[^{}\s]+\}$/.test(text)) return false;
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
 * DETTES de la garde de libellé, par FICHIER et par VOLET (patron `*Stock.mjs` du dépôt) : clé
 * `fichier#règle` (la `rule` du site, `cleDeDette`) → compte des sites que la garde voit (TOUS volets,
 * `scanLabelLogicFichier`) hors des coutures légitimes de `RATCHET_EXCEPTIONS`. Ce ne sont pas des
 * exemptions — aucun de ces sites n'est légitime : chacun meurt par sa migration vers un id, sous le
 * ticket `#N` que nomme la rubrique qui le précède (test « chaque rubrique du stock nomme son
 * ticket »). Les volets de `VOLETS_SANS_STOCK` n'y entrent jamais. Jamais `fichier:ligne` : la ligne
 * dérive à chaque commit voisin et le cliquet crierait à faux. La RÈGLE est dans la clé pour qu'une
 * dette ne passe pas d'un volet à l'autre d'un même fichier à compte constant, et pour que la porte
 * des stocks nominatifs (`stocksNominatifs.mjs`, une entrée par clé qui nomme un fichier) voie chaque
 * (fichier, volet) neuf.
 *
 * CLIQUET STRICT, dans les DEUX sens et par clé : un compte SUPÉRIEUR échoue (dette neuve), un compte
 * INFÉRIEUR échoue aussi (dette soldée → l'entrée se met à jour, ou disparaît, dans le MÊME geste).
 * Une clé absente est à tolérance ZÉRO. La migration d'un axe se solde en retirant ses entrées, jamais
 * en gonflant un nombre.
 * @type {Readonly<Record<string, number>>}
 */
export const DETTES_DE_LIBELLE = {
  // #2104 — Axe Disponibilité (LDB 59) — `Availability` EST le libellé ; `src/engine/disponibilite.ts` porte
  // le type, la table ET le prédicat `isTradable` (source unique de la comparaison aux 4 classes),
  // ses consommateurs suivent.
  'src/engine/activities.ts#label-literal': 1,
  'src/engine/activities.ts#label-record': 1,
  'src/engine/disponibilite.ts#label-literal': 1,
  // #2104 — Axes de récolte (Rareté / Danger / Taille / Conservation) — quatre vocabulaires FR en clés de table.
  'src/engine/harvest.ts#label-literal': 1,
  'src/engine/harvest.ts#label-record': 4,
  // #2104 — Axe Statut social (Bronze/Argent/Or) — `Status.tier` porte le libellé, lu du texte des carrières.
  'src/engine/creation.ts#label-literal': 2,
  'src/engine/social.ts#label-literal': 2,
  'src/ui/creator/CharacterCreator.tsx#label-literal': 2,
  // #2104 — Statut d'un indice de campagne (révélé/réfuté) — porté par la donnée de scène et les sauvegardes.
  'src/state/clues.ts#label-literal': 2,
  'src/state/combatEffects.ts#label-literal': 1,
  'src/ui/CarnetScreen.tsx#label-literal': 3,
  // #1957 — `worstCorruptionExposure` : Degré de Corruption lu au texte authoré de l'argument du trait.
  'src/state/combatFlow.ts#label-call-literal': 1,
  // #1924 — résolveurs libellé→id (`qualityIdByLabel`, `traitIdByLabel`) appelés depuis le moteur.
  'src/engine/qualities/normalize.ts#label-entity-resolver-call': 1,
  'src/engine/traits/dispatch.ts#label-entity-resolver-call': 1,
  // #1330 — `conditionIdInText` : le journal FR re-parsé par libellé d'État.
  'src/engine/conditions.ts#face-affichage-identite': 1,
  // #1816 lot 4 — `rollObsession` : copie runtime de libellé (`cible`/`arg` du moteur).
  'src/data/obsessions.ts#face-donnee-string': 1,
  // #2070 — scénarios de test résolus par libellé (`findSkill`/`findTalent`).
  'src/scenes/test-scenarios/_casters.ts#label-entity-resolver-call': 2,
  'src/scenes/test-scenarios/magie-hors-combat.ts#label-entity-resolver-call': 1,
  // #1632 — index du Codex par libellé (`codexLookup`) ; sort classé par libellé (`classifySpellByLabel`).
  'src/ui/compendium/registry.ts#label-keyed-index': 1,
  'src/gameIso/rig/anim/spellClips.ts#label-entity-resolver-call': 1,
};

/** Volets SANS stock : aucune clé de `DETTES_DE_LIBELLE` ne peut les porter, quel que soit le
 *  fichier — `label-logic` (règles `.label` de #142) et `label-as-id-arg` (libellé passé où la
 *  déclaration attend un `id`). Pour eux le stock admis est 0 (`stockDe`), et une clé qui les
 *  porterait est un écart (`clesInterditesAuStock`). */
export const VOLETS_SANS_STOCK = new Set(['label-logic', 'label-as-id-arg']);

/** Stock ADMIS pour une clé `fichier#règle` : 0 pour un volet de `VOLETS_SANS_STOCK`, quoi
 *  qu'écrive `DETTES_DE_LIBELLE`. @param {string} cle @returns {number} */
export function stockDe(cle) {
  return VOLETS_SANS_STOCK.has(regleDeDette(cle)) ? 0 : DETTES_DE_LIBELLE[cle] ?? 0;
}

/** Clés du stock qui portent un volet sans stock, en phrases prêtes à afficher — la porte que le
 *  test ET le hook pre-commit jouent. @param {Record<string, number>} [stock] @returns {string[]} */
export function clesInterditesAuStock(stock = DETTES_DE_LIBELLE) {
  return Object.keys(stock)
    .filter((cle) => VOLETS_SANS_STOCK.has(regleDeDette(cle)))
    .map((cle) => `${cle} : le volet « ${regleDeDette(cle)} » n'a pas de stock (VOLETS_SANS_STOCK) — retirer la clé de DETTES_DE_LIBELLE et migrer le site vers un id STABLE.`);
}

/** Clé de dette d'un site : `fichier#règle`. @param {{ rel: string, rule: string }} site @returns {string} */
export function cleDeDette(site) {
  return `${site.rel}#${site.rule}`;
}

/** Le fichier d'une clé de dette. @param {string} cle @returns {string} */
export function fichierDeDette(cle) {
  return cle.slice(0, cle.lastIndexOf('#'));
}

/** La règle (volet) d'une clé de dette. @param {string} cle @returns {string} */
function regleDeDette(cle) {
  return cle.slice(cle.lastIndexOf('#') + 1);
}

/** Écarts aux dettes pour un jeu de comptes MESURÉS (`fichier#règle` → nombre, `dettesParVolet`) :
 *  chaque écart est une phrase prête à afficher. Le cliquet ne juge que ce qui lui est PRÉSENTÉ : ce qui
 *  manque à `measured` ne rend aucun écart — c'est `couvertureDuBalayage` (`stock.mjs`) qui NOMME ce
 *  manque (gisement muet, entrée de stock hors corpus), et l'appelant qui joue les deux. `hausseSeule` :
 *  le hook pre-commit, qui ne voit que les fichiers stagés, ne juge que la dette NEUVE.
 *  @param {Map<string, number>|Record<string, number>} measured @param {{ hausseSeule?: boolean }} [options]
 *  @returns {string[]} */
export function ecartsAuxDettesDeLibelle(measured, { hausseSeule = false } = {}) {
  const entries = measured instanceof Map ? [...measured] : Object.entries(measured);
  const out = [];
  for (const [cle, n] of entries) {
    const stock = stockDe(cle);
    if (n > stock) out.push(`${cle} : ${n} logique(s) par LIBELLÉ, stock = ${stock} — migrer vers un id STABLE (le libellé est de l'AFFICHAGE).`);
    else if (n < stock && !hausseSeule) out.push(`${cle} : ${n} logique(s) par LIBELLÉ, stock = ${stock} — dette SOLDÉE, mettre DETTES_DE_LIBELLE à jour dans le même geste.`);
  }
  return out;
}

// ── Index CONSTRUIT sur un champ d'AFFICHAGE, hors de la couture de chargement (#909) ────────────
// `scanLabelLogic` ne juge que l'INTERROGATION d'une collection par `.label` : la REMPLIR depuis du
// texte y est tolérée (contre-épreuve `NAME_TO_GROUP[norm(t.label)] = …`), la conversion label→id
// étant licite — mais à UN endroit : « Seule couture tolérée : la conversion label→id au CHARGEMENT
// des données, dans `src/data/index.ts` uniquement » (CLAUDE.md § Pour TOUT agent). Partout
// ailleurs dans `src/`, la même construction est donc la faute, et elle était MUETTE : le
// `Record` `QUALITY_DESC` (`engine/qualities/describe.ts`) a vécu keyé par LIBELLÉ, bâti par
// `Object.fromEntries(… .map((q) => [q.label, q.desc]))` puis LU via une variable
// (`QUALITY_DESC[key]`) — hors de portée d'un scan syntaxique (cf. LIMITE CONNUE de `scanLabelLogic`).
// La CONSTRUCTION est la seule moitié structurellement visible : c'est elle qu'on vise.
const DISPLAY_FIELD_NAME_RX = new RegExp('^' + DISPLAY_FIELD + '$');

/** Lignes des PAIRES `[x.label, …]` d'une construction de STRUCTURE : le tableau vit sous un appel
 *  `map`/`fromEntries` ou un `new Map`/`new Set`. Receveur d'une chaîne de méthodes, il n'est une clé
 *  que si le RÉSULTAT de la chaîne est l'élément 0 d'une paire de la construction
 *  (`[[x.label, x.kind].join(':'), x.id]`) — `[a.label, b.label].join(', ')`,
 *  `{ v: [r.label, suffixe].filter(Boolean).join(' ') }` sont des tableaux d'AFFICHAGE, aucune clé n'y
 *  naît. @param {string} relPath @param {string} contenu @returns {Set<number>} */
function lignesDePaireParLibelle(relPath, contenu) {
  const lignes = new Set();
  if (!/\.(?:label|name)\b/.test(contenu)) return lignes;
  const sf = arbre(relPath, contenu);
  const sousUneConstruction = (n) => {
    for (let p = n.parent; p && !ts.isSourceFile(p); p = p.parent) {
      if (ts.isNewExpression(p) && ts.isIdentifier(p.expression) && (p.expression.text === 'Map' || p.expression.text === 'Set')) return true;
      if (ts.isCallExpression(p)) {
        const e = unwrap(p.expression);
        if (ts.isPropertyAccessExpression(e) && (e.name.text === 'map' || e.name.text === 'fromEntries')) return true;
      }
    }
    return false;
  };
  /** Le résultat de la chaîne de méthodes dont `n` est le receveur (`n` lui-même s'il n'en est pas un). */
  const resultatDeChaine = (n) => {
    let cur = n;
    let chaine = false;
    for (;;) {
      const p = cur.parent;
      if (ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || ts.isNonNullExpression(p)) cur = p;
      else if (ts.isPropertyAccessExpression(p) && p.expression === cur && ts.isCallExpression(p.parent) && p.parent.expression === p) {
        cur = p.parent;
        chaine = true;
      } else return chaine ? cur : n;
    }
  };
  const estPaire = (a) => ts.isArrayLiteralExpression(a) && a.elements.length >= 2;
  const voir = (n) => {
    if (estPaire(n)) {
      const cle = unwrap(n.elements[0]);
      const resultat = resultatDeChaine(n);
      const paire = resultat === n ? n : resultat.parent;
      const enCle = resultat === n || (estPaire(paire) && paire.elements[0] === resultat);
      if (enCle && ts.isPropertyAccessExpression(cle) && DISPLAY_FIELD_NAME_RX.test(cle.name.text) && sousUneConstruction(paire)) lignes.add(ligneDe(sf, n));
    }
    ts.forEachChild(n, voir);
  };
  voir(sf);
  return lignes;
}
const LABEL_SET_RX = new RegExp('\\.set\\(\\s*[\\w.]+\\.' + DISPLAY_FIELD + '\\s*,');
const LABEL_INDEX_WRITE_RX = new RegExp('[\\w)\\]]\\[[^\\]]*\\.' + DISPLAY_FIELD + '\\b[^\\]]*\\]\\s*(?:\\?\\?|\\|\\||&&)?=[^=]');

/**
 * Sites qui CONSTRUISENT une structure keyée par un champ d'affichage : paire d'un `fromEntries`/
 * `Map`/tableau de paires (`[q.label, q.desc]`), `.set(x.label, …)`, écriture d'index
 * (`M[x.label] = …`). Hors des coutures de `RATCHET_EXCEPTIONS`, aucune construction label→id n'est
 * tolérée. La CLÉ doit être le champ d'affichage : `[v.id, v.label]` (libellé en VALEUR) n'est
 * pas visé, c'est la lecture légitime d'un libellé.
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string, rule: 'label-keyed-index' }[]}
 */
export function scanLabelKeyedIndex(relPath, contenu) {
  const findings = [];
  const source = contenu.split('\n');
  const paires = lignesDePaireParLibelle(relPath, contenu);
  codeSeul(contenu).split('\n').forEach((line, i) => {
    if (paires.has(i + 1) || LABEL_SET_RX.test(line) || LABEL_INDEX_WRITE_RX.test(line)) {
      findings.push({ line: i + 1, detail: source[i].trim(), rule: 'label-keyed-index' });
    }
  });
  return findings;
}

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
  const body = codeSeul(contenu);
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
  const body = codeSeul(contenu);
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
 * Le rang du paramètre `id` n'est demandé à `idParamFns` que pour un appel dont un argument passe
 * `isLabelArg` (condition nécessaire d'un site) : un contexte PARESSEUX ne calcule que ces noms-là.
 * @param {string} relPath @param {string} contenu @param {RangsDuParametreId} idParamFns
 * @returns {{ line: number, detail: string, rule: 'label-as-id-arg' }[]}
 */
export function scanLabelAsIdArg(relPath, contenu, idParamFns) {
  const findings = [];
  if (!contenu.includes('.label')) return findings;
  const body = codeSeul(contenu);
  const lines = contenu.split('\n');
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
    const openIdx = m.index + m[0].length - 1;
    const closeIdx = matchClosingParen(body, openIdx);
    if (closeIdx < 0) continue;
    const args = splitCallArgs(body.slice(openIdx + 1, closeIdx));
    if (!args.some(isLabelArg)) continue;
    const idx = idParamFns.get(fnName);
    if (idx === undefined) continue;
    const arg = args[idx];
    if (arg && isLabelArg(arg)) {
      const line = lineOf(body, m.index);
      findings.push({ line, detail: (lines[line - 1] || '').trim(), rule: 'label-as-id-arg' });
    }
  }
  return findings;
}

/** Recherche nom → rang du paramètre `id` (une `Map` en est une). @typedef {{ get(nom: string): number | undefined }} RangsDuParametreId */

/** Rangs EFFECTIFS (locaux + globaux) pour un fichier donné : un nom global MASQUÉ par une
 *  déclaration homonyme LOCALE (shadowing, `collectDeclaredNames`) cède la place à la locale
 *  (#142 LOT 6bis). Les déclarations locales ne se lisent qu'à la première demande.
 *  @param {string} contenu @param {RangsDuParametreId} globalIdParamFns @returns {RangsDuParametreId} */
export function effectiveIdParamFns(contenu, globalIdParamFns) {
  let local;
  let localNames;
  return {
    get(nom) {
      local ??= collectIdParamFunctions(contenu);
      localNames ??= collectDeclaredNames(contenu);
      if (local.has(nom)) return local.get(nom);
      return localNames.has(nom) ? undefined : globalIdParamFns.get(nom);
    },
  };
}

/** Rangs du paramètre `id` sur un CORPUS, calculés À LA DEMANDE et mémoïsés : pour un nom, la
 *  PREMIÈRE déclaration dans l'ordre du corpus (`collectIdParamFunctions` du premier fichier qui le
 *  déclare avec un paramètre `id`). Un fichier dont le texte ne porte aucune TÊTE possible du nom —
 *  les trois formes de `findDeclarationHeads`, `function nom`, `const|let nom =`, `nom(` non précédé
 *  de `.`/mot — ne peut pas le déclarer : il n'est pas analysé (`x.includes(` n'en est pas une).
 *  @param {{ rel: string, text: string }[]} corpus @returns {RangsDuParametreId} */
function rangsDuCorpus(corpus) {
  const parFichier = new Map();
  const memo = new Map();
  return {
    get(nom) {
      if (memo.has(nom)) return memo.get(nom);
      const tete = new RegExp(`function\\s+${nom}\\b|(?:const|let)\\s+${nom}\\s*=|(?<![.\\w$])${nom}\\s*(?:<[^>]*>)?\\s*\\(`);
      let rang;
      for (let i = 0; i < corpus.length && rang === undefined; i++) {
        if (!corpus[i].text.includes(nom) || !tete.test(corpus[i].text)) continue;
        if (!parFichier.has(i)) parFichier.set(i, collectIdParamFunctions(corpus[i].text));
        rang = parFichier.get(i).get(nom);
      }
      memo.set(nom, rang);
      return rang;
    },
  };
}


/** Le CORPUS de la garde, tous volets confondus (lignes, stock, face) — défini ICI seulement : tout
 *  `src/` `.ts`/`.tsx` hors instruments Vitest et hors déclarations `.d.ts` — les deux exclusions de
 *  `readCorpus` (`sourceCorpus.mjs`), par son prédicat `estRetenu`. Le statut d'un site ne dépend jamais de son dossier :
 *  couture légitime (`RATCHET_EXCEPTIONS`), dette au stock (`DETTES_DE_LIBELLE`), ou faute. */
export const CORPUS_RACINE = 'src';

/** @param {string} rel chemin POSIX relatif à la racine du projet @returns {boolean} */
export function estDansLeCorpus(rel) {
  return rel.startsWith(`${CORPUS_RACINE}/`) && estRetenu(rel);
}

/** COUTURES LÉGITIMES — `fichier:ligne` (relatif à `src/`) → justification. N'y entrent que la couture
 *  de chargement et de saisie de `src/data/index.ts` (#909) et le parseur de saisie « format livre » de
 *  l'éditeur (`refFormatLivre.ts`) ; chacune a son test de légitimité (`label-logic-guard.test.ts`,
 *  « coutures légitimes »), qui juge le SITE par la déclaration qui le porte. Une DETTE n'y entre
 *  jamais : elle va au stock `DETTES_DE_LIBELLE`, avec son ticket. */
export const RATCHET_EXCEPTIONS = {
  'data/index.ts:3348':
    "(c) `qualityIdByLabel` rend un ID, pas un texte : couture libellé→id d'AUTHORING (invariant 1, « aider " +
    'à la saisie »), déjà recensée comme résolveur par libellé (#909, `collectLabelEntityResolvers`).',
  'ui/editor/refFormatLivre.ts:20':
    '(b) Parseur de SAISIE « format livre » (invariant 1, « aider à la saisie »), même régime que :41 : la ' +
    'saisie « (Au choix) » se reconnaît au mot que l’affichage compose (`ref.motAuChoix`) ; elle rend `choix`.',
  'ui/editor/refFormatLivre.ts:41':
    '(b) Parseur de SAISIE « format livre » de l’éditeur (invariant 1, « aider à la saisie ») : le texte ' +
    'saisi retrouve l’id de spécialisation dont le libellé affiché est ce texte ; il rend un id.',
  'ui/editor/refFormatLivre.ts:52':
    'Parseur de SAISIE « format livre » : le nom de Compétence saisi retrouve son id (`findSkill`, #909).',
  'ui/editor/refFormatLivre.ts:67':
    'Parseur de SAISIE « format livre » : le nom de Talent saisi retrouve son id (`findTalent`, #909).',
  // Résolveurs par LIBELLÉ de la couture de chargement/saisie (#909) — chacun est reconnu par
  // `collectLabelEntityResolvers`, donc chacun de ses appels hors couture est une dette au stock.
  'data/index.ts:3151':
    '`findSkill` : résolveur libellé→entrée de la couture de saisie (statblocs de campagne, #909).',
  'data/index.ts:3185':
    '`findTalent` : résolveur libellé→entrée de la couture de saisie (#909).',
  'data/index.ts:3288':
    '`findSpell` : résolveur libellé→entrée de la couture de saisie (#909).',
  'data/index.ts:3309':
    '`instanciableParLabelMinuscule` : index du libellé des objets instanciables, lu par `trappingIdsByLabel` SEUL (#909).',
  'data/index.ts:3343':
    '`qualiteParSlugDeLabel` : index du slug de libellé, lu par `qualityIdByLabel` SEUL (#909).',
  'data/index.ts:3354':
    '`qualityIdByLabel` : l’entrée CANONIQUE d’un libellé doublon est celle dont l’id est son slug (#909).',
};

/** Résout le `shortKey` (`fichier:ligne` relatif à `src/`) d'un finding porté par un chemin `src/…`
 *  — même calcul que `label-logic-guard.test.ts` (ratchet) et le hook pre-commit.
 *  @param {{ rel: string, line: number }} finding @returns {string} */
export function ratchetShortKey(finding) {
  return `${finding.rel.replace(/^src\//, '')}:${finding.line}`;
}

// ── Résolution d'ENTITÉ depuis un LIBELLÉ, appelée hors de sa seule couture légitime (#909) ────────
// La comparaison `.label === label` d'un résolveur (`findSpell`, `findTalent`…) vit DANS
// `src/data/index.ts`, où `RATCHET_EXCEPTIONS` la tolère, au site. Les scans ci-dessus ne voient
// QUE cette comparaison textuelle — pas le fait d'INVOQUER un tel résolveur hors de la couture, où
// le paramètre reçu est déjà, la plupart du temps, un id : y appeler `findSpell(x)` bascule quand
// même toute la résolution sur le texte d'affichage.
//
// Reconnaissance du résolveur — critères structurels, jamais une liste de noms :
//  1. déclaré et exporté dans `src/data/index.ts` (seul fichier où la légitimité existe, doctrine
//     CLAUDE.md — un résolveur par label ailleurs serait une AUTRE faute, hors périmètre #909) ;
//  2. il RÉSOUT par libellé, sous l'une des trois formes que porte ce fichier :
//     a. fonction/flèche dont le paramètre s'appelle EXACTEMENT `label` et dont le type de retour est
//        une entité de catalogue — `XxxData` (`SpellData`, `TalentData`…), convention des
//        interfaces app-owned ;
//     b. ALIAS d'un binding construit par `indexParChamp(cle, entrees, (e) => e.label…)` — l'index
//        vivant rend l'ENTRÉE elle-même, donc l'alias résout l'entité par son libellé exactement comme
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

/** L'initialiseur est-il un INDEX VIVANT keyé par le LIBELLÉ — `indexParChamp(cle, entrees, (e) =>
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
 *  alias que `nomsVivantsDuFichier`, `bindingsVivants.mjs`).
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

/**
 * Appels à un résolveur d'entité par libellé (`resolverNames`) dans un fichier — la faute #909 : la comparaison `.label` est invisible ici (elle vit dans le
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

// ── FACE D'AFFICHAGE en position d'IDENTITÉ (#1988 §7) ─────────────────────────────────────────────
// Une « face d'affichage » est une fonction exportée de `src/` dont le retour DÉCLARÉ est `PlayerText`
// (`src/i18n/playerText.ts`) : ce qu'elle rend est montré au joueur, et change avec la langue. Critère
// de TYPE, jamais une liste de noms ni un fichier d'origine : `t()` (`i18n/index.ts`), les faces de
// `data/**` et toute face N+1 déclarée ailleurs sont collectées par l'AST.
//
// (b) Un appel de face d'affichage — ou l'ALIAS qui en tient le résultat (`const k = f()`, `let k; k =
//     f()`, `const b = k`), ou une méthode qui en GARDE le texte (`f().toLowerCase()`, `.trim()`,
//     `.normalize()`, `String(f())`) — en position d'IDENTITÉ ou de PRÉDICAT est refusé : clé calculée
//     (`{ [f()]: … }`), index (`x[f()]`), opérande de `===`/`!==`/`==`/`!=`, opérande gauche de `in`,
//     discriminant de `switch`, premier argument de `includes`/`indexOf`/`lastIndexOf`/`has`/`get`/
//     `set`/`delete`, receveur de `includes`/`startsWith`/`endsWith`/`match`/`search`, argument de
//     `RegExp#test`, première case d'une paire `[f(), …]` d'un `new Map(…)`/`Object.fromEntries(…)`.
//     HORS DU VOLET : l'attribut JSX `key=` — identité de RENDU React (réconciliation d'une liste), pas
//     logique métier : aucun comportement n'en dépend.
// (c) Une fonction exportée de `src/data/**` qui lit `.label` et rend `string` — DÉCLARÉ, ou INFÉRÉ faute
//     de type de retour — est refusée : la face d'affichage neuve naît `PlayerText`, donc visible de (b) ;
//     un export qui rend autre chose (id, entrée) le DÉCLARE.
// (d) Dans le corps d'une fonction de `src/data/index.ts` au retour `PlayerText` (exportée ou non : un
//     assembleur privé comme `ouListe` compose le même texte), un littéral chaîne, une
//     tête ou un morceau de gabarit d'au moins deux lettres qui PRODUIT du texte est refusé : un liant
//     de composition vit au catalogue (`src/i18n/messages/fr.ts`). Ne produisent pas de texte : un
//     argument d'appel (clé de `t()`, catégorie de `refLabel`, id), hors les méthodes qui ASSEMBLENT
//     du texte (`join`, `concat`, `padStart`, `padEnd`, `replace`, `dataLabel`) ; un opérande de
//     comparaison ou de `in` ; une clé d'index.
// Coutures légitimes AU SITE par `RATCHET_EXCEPTIONS`, dettes au stock `DETTES_DE_LIBELLE`.
//
// CE QUE CE SCAN NE VOIT PAS (faux négatifs assumés) :
//  - une face passée par un `map` puis rangée en collection : `new Set(xs.map(face))` — la face y est
//    une RÉFÉRENCE de fonction, jamais un appel, et le `Set` n'est pas une position d'identité suivie ;
//  - une face rangée dans une PROPRIÉTÉ d'objet puis relue (`o.k = face(x)` … `m[o.k]`) : seuls les
//    identifiants locaux sont suivis comme alias ;
//  - un alias par GABARIT (`const k = \`${face(x)}\``) : un gabarit fabrique un texte neuf, il n'est
//    pas suivi comme la face ;
//  - un tri ou une comparaison par `localeCompare` (`face(a).localeCompare(face(b))`) : ORDONNER par le
//    texte n'est pas une position d'identité du volet ;
//  - pour (c), une fonction exportée par une clause séparée (`export { f }`) ou par `export default` :
//    `fonctionsExportees` ne lit que le modificateur `export` posé sur la déclaration.

/** Le type déclaré nomme-t-il `PlayerText` (nu ou dans une union) ? @param {ts.TypeNode=} t */
function declarePlayerText(t) {
  if (!t) return false;
  if (ts.isUnionTypeNode(t)) return t.types.some(declarePlayerText);
  return ts.isTypeReferenceNode(t) && ts.isIdentifier(t.typeName) && t.typeName.text === 'PlayerText';
}

/** Le type déclaré est-il `string` (nu ou dans une union) ? @param {ts.TypeNode=} t */
function declareString(t) {
  if (!t) return false;
  if (ts.isUnionTypeNode(t)) return t.types.some(declareString);
  return t.kind === ts.SyntaxKind.StringKeyword;
}

/** Les fonctions de PREMIER NIVEAU d'un fichier — EXPORTÉES seules par défaut —, avec leur type de
 *  retour déclaré et leur corps.
 *  @param {ts.SourceFile} sf @param {boolean} [privees] inclure les fonctions non exportées
 *  @returns {{ nom: string, type: ts.TypeNode | undefined, corps: ts.Node | undefined, noeud: ts.Node }[]} */
function fonctionsExportees(sf, privees = false) {
  const out = [];
  ts.forEachChild(sf, (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && (privees || isExported(n))) out.push({ nom: n.name.text, type: n.type, corps: n.body, noeud: n });
    if (ts.isVariableStatement(n) && (privees || isExported(n))) {
      for (const d of n.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || !d.initializer) continue;
        const init = unwrap(d.initializer);
        if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) out.push({ nom: d.name.text, type: init.type, corps: init.body, noeud: d });
      }
    }
  });
  return out;
}

const arbre = (rel, contenu) => ts.createSourceFile(rel, contenu, ts.ScriptTarget.Latest, true, scriptKindDe(rel));
const ligneDe = (sf, node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

/** Les FACES D'AFFICHAGE d'un corpus : nom → fichier déclarant (le premier rencontré).
 *  @param {{ rel: string, text: string }[]} fichiers @returns {Map<string, string>} */
export function collectFacesDAffichage(fichiers) {
  const faces = new Map();
  for (const { rel, text } of fichiers) {
    if (!text.includes('PlayerText')) continue;
    for (const f of fonctionsExportees(arbre(rel, text))) if (declarePlayerText(f.type) && !faces.has(f.nom)) faces.set(f.nom, rel);
  }
  return faces;
}

/** Méthodes dont le premier argument est une CLÉ (appartenance, recherche, lecture/écriture de collection). */
const METHODES_DE_CLE = new Set(['includes', 'indexOf', 'lastIndexOf', 'has', 'get', 'set', 'delete']);
/** Méthodes de chaîne dont le RECEVEUR est jugé : un prédicat sur le texte. */
const PREDICATS_DE_TEXTE = new Set(['includes', 'startsWith', 'endsWith', 'match', 'search']);
/** Méthodes de chaîne qui GARDENT le texte (casse, blancs, forme Unicode) : leur résultat reste la face. */
const GARDENT_LE_TEXTE = new Set(['toLowerCase', 'toUpperCase', 'toLocaleLowerCase', 'toLocaleUpperCase', 'trim', 'trimStart', 'trimEnd', 'normalize']);
const ALIAS_DE_FACE = 'alias-de-face:';
const FACE_IMPORTEE = 'face:';
const LOCAL = 'local';

/**
 * (b) Appels de face d'affichage en position d'identité dans un fichier. Portée suivie : un nom de face
 * redéclaré localement (paramètre `t` d'un prédicat, variable homonyme) n'est plus la face ; un import
 * RENOMMÉ (`import { t as tr }`) l'est encore.
 * @param {string} relPath @param {string} contenu @param {ReadonlyMap<string, string>} faces
 * @returns {{ line: number, detail: string, rule: 'face-affichage-identite', face: string }[]}
 */
export function scanFaceDAffichageIdentite(relPath, contenu, faces) {
  const sf = arbre(relPath, contenu);
  const lines = contenu.split('\n');
  const findings = [];
  const seen = new Set();
  const scopes = new Scopes();
  for (const st of sf.statements) {
    const liaisons = ts.isImportDeclaration(st) ? st.importClause?.namedBindings : undefined;
    if (!liaisons || !ts.isNamedImports(liaisons)) continue;
    for (const s of liaisons.elements) {
      const origine = (s.propertyName ?? s.name).text;
      if (faces.has(origine)) scopes.declare(s.name.text, FACE_IMPORTEE + origine);
    }
  }
  const faceAppelee = (node) => {
    const n = unwrap(node);
    if (!ts.isCallExpression(n) || !ts.isIdentifier(n.expression)) return undefined;
    const nom = n.expression.text;
    const k = scopes.kindOf(nom);
    if (k === undefined) return faces.has(nom) ? nom : undefined;
    return k.startsWith(FACE_IMPORTEE) ? k.slice(FACE_IMPORTEE.length) : undefined;
  };
  const faceTenue = (node) => {
    let n = unwrap(node);
    for (;;) {
      if (!ts.isCallExpression(n)) break;
      const e = unwrap(n.expression);
      if (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.name) && GARDENT_LE_TEXTE.has(e.name.text)) n = unwrap(e.expression);
      else if (ts.isIdentifier(e) && e.text === 'String' && n.arguments.length === 1) n = unwrap(n.arguments[0]);
      else break;
    }
    if (ts.isIdentifier(n)) {
      const k = scopes.kindOf(n.text);
      return k && k.startsWith(ALIAS_DE_FACE) ? k.slice(ALIAS_DE_FACE.length) : undefined;
    }
    return faceAppelee(n);
  };
  /** La paire est-elle une entrée d'une TABLE construite (`new Map(…)`, `Object.fromEntries(…)`) ? */
  const entreeDeTable = (paire) => {
    for (let p = paire.parent; p && !ts.isSourceFile(p); p = p.parent) {
      if (ts.isNewExpression(p) && ts.isIdentifier(p.expression) && p.expression.text === 'Map') return true;
      if (ts.isCallExpression(p)) {
        const e = unwrap(p.expression);
        if (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === 'Object' && e.name.text === 'fromEntries') return true;
      }
    }
    return false;
  };
  const report = (node, face) => {
    const line = ligneDe(sf, node);
    if (seen.has(line)) return;
    seen.add(line);
    findings.push({ line, detail: (lines[line - 1] || '').trim(), rule: 'face-affichage-identite', face });
  };
  const declarer = (list) => {
    for (const d of list.declarations) {
      const face = d.initializer && ts.isIdentifier(d.name) ? faceTenue(d.initializer) : undefined;
      if (face) scopes.declare(d.name.text, ALIAS_DE_FACE + face);
      else for (const n of bindingNames(d.name)) scopes.declare(n, LOCAL);
    }
  };
  const visit = (node) => {
    if (ts.isFunctionLike(node)) {
      if (ts.isFunctionDeclaration(node) && node.name) scopes.declare(node.name.text, LOCAL);
      scopes.push();
      for (const p of node.parameters) for (const n of bindingNames(p.name)) scopes.declare(n, LOCAL);
      ts.forEachChild(node, visit);
      scopes.pop();
      return;
    }
    if (ts.isBlock(node) || ts.isCaseBlock(node) || ts.isModuleBlock(node) || ts.isForStatement(node)
      || ts.isForOfStatement(node) || ts.isForInStatement(node) || ts.isCatchClause(node)) {
      scopes.push();
      if (ts.isCatchClause(node) && node.variableDeclaration) for (const n of bindingNames(node.variableDeclaration.name)) scopes.declare(n, LOCAL);
      ts.forEachChild(node, visit);
      scopes.pop();
      return;
    }
    if (ts.isVariableDeclarationList(node)) declarer(node);
    if (ts.isComputedPropertyName(node)) { const f = faceTenue(node.expression); if (f) report(node, f); }
    if (ts.isElementAccessExpression(node)) { const f = faceTenue(node.argumentExpression); if (f) report(node, f); }
    if (ts.isBinaryExpression(node) && EQUALITY_OPS.has(node.operatorToken.kind)) {
      const f = faceTenue(node.left) ?? faceTenue(node.right);
      if (f) report(node, f);
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.InKeyword) { const f = faceTenue(node.left); if (f) report(node, f); }
    if (ts.isSwitchStatement(node)) { const f = faceTenue(node.expression); if (f) report(node, f); }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(node.left)) {
      const f = faceTenue(node.right);
      scopes.assign(node.left.text, f ? ALIAS_DE_FACE + f : LOCAL);
    }
    if (ts.isCallExpression(node)) {
      const callee = unwrap(node.expression);
      if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.name)) {
        const m = callee.name.text;
        const f = (node.arguments.length > 0 && (METHODES_DE_CLE.has(m) || m === 'test') ? faceTenue(node.arguments[0]) : undefined)
          ?? (PREDICATS_DE_TEXTE.has(m) ? faceTenue(callee.expression) : undefined);
        if (f) report(node, f);
      }
    }
    if (ts.isArrayLiteralExpression(node) && node.elements.length >= 2) {
      const f = faceTenue(node.elements[0]);
      if (f && entreeDeTable(node)) report(node, f);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  return findings;
}

/** Le corps lit-il un champ `.label` ? @param {ts.Node | undefined} corps */
function litLeLabel(corps) {
  let lu = false;
  const voir = (x) => {
    if (lu) return;
    if (ts.isPropertyAccessExpression(x) && ts.isIdentifier(x.name) && x.name.text === 'label') lu = true;
    ts.forEachChild(x, voir);
  };
  if (corps) voir(corps);
  return lu;
}

/** (c) Exports de `src/data/**` qui lisent `.label` sans DÉCLARER un retour autre que `string`.
 *  @param {string} relPath @param {string} contenu
 *  @returns {{ line: number, detail: string, rule: 'face-donnee-string', face: string }[]} */
export function scanFaceDeDonneeString(relPath, contenu) {
  if (!relPath.startsWith('src/data/')) return [];
  const sf = arbre(relPath, contenu);
  const lines = contenu.split('\n');
  return fonctionsExportees(sf)
    .filter((f) => (!f.type || declareString(f.type)) && litLeLabel(f.corps))
    .map((f) => {
      const line = ligneDe(sf, f.noeud);
      return { line, detail: (lines[line - 1] || '').trim(), rule: 'face-donnee-string', face: f.nom };
    });
}

/** Méthodes et minteur qui ASSEMBLENT du texte : un littéral en argument EST un liant. */
const ASSEMBLEURS = new Set(['join', 'concat', 'padStart', 'padEnd', 'replace', 'dataLabel']);
const auMoinsDeuxLettres = (s) => (s.match(/\p{L}/gu) ?? []).length >= 2;

/** Le littéral (ou gabarit) PRODUIT-il du texte, ou n'est-il qu'une clé, un id, un opérande ? @param {ts.Node} lit */
function produitDuTexte(lit) {
  let enfant = lit;
  for (let p = lit.parent; p; enfant = p, p = p.parent) {
    if (ts.isParenthesizedExpression(p) || ts.isTemplateSpan(p) || ts.isTemplateExpression(p)) continue;
    if (ts.isConditionalExpression(p)) {
      if (enfant === p.condition) return false;
      continue;
    }
    if (ts.isBinaryExpression(p)) {
      const op = p.operatorToken.kind;
      if (op === ts.SyntaxKind.PlusToken || op === ts.SyntaxKind.QuestionQuestionToken
        || op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.AmpersandAmpersandToken) continue;
      return false;
    }
    if (ts.isCallExpression(p)) {
      if (enfant === p.expression) return false;
      const callee = unwrap(p.expression);
      const nom = ts.isPropertyAccessExpression(callee) ? callee.name.text : ts.isIdentifier(callee) ? callee.text : '';
      return ASSEMBLEURS.has(nom);
    }
    if (ts.isElementAccessExpression(p) || ts.isCaseClause(p)) return false;
    if (ts.isPropertyAssignment(p) && enfant === p.name) return false;
    return true;
  }
  return true;
}

/** (d) Liants littéraux dans le corps des fonctions au retour `PlayerText` de `src/data/index.ts`.
 *  @param {string} relPath @param {string} contenu
 *  @returns {{ line: number, detail: string, rule: 'liant-litteral-de-face', face: string }[]} */
export function scanLiantsLitterauxDesFaces(relPath, contenu) {
  if (relPath !== 'src/data/index.ts') return [];
  const sf = arbre(relPath, contenu);
  const lines = contenu.split('\n');
  const findings = [];
  for (const f of fonctionsExportees(sf, true)) {
    if (!declarePlayerText(f.type) || !f.corps) continue;
    const voir = (x) => {
      const gabarit = ts.isTemplateHead(x) || ts.isTemplateMiddle(x) || ts.isTemplateTail(x);
      const texte = ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x) || gabarit ? x.text : undefined;
      if (texte !== undefined && auMoinsDeuxLettres(texte)) {
        const porteur = ts.isTemplateHead(x) ? x.parent : gabarit ? x.parent.parent : x;
        if (produitDuTexte(porteur)) {
          const line = ligneDe(sf, x);
          findings.push({ line, detail: (lines[line - 1] || '').trim(), rule: 'liant-litteral-de-face', face: f.nom });
        }
      }
      ts.forEachChild(x, voir);
    };
    voir(f.corps);
  }
  return findings;
}

/** Le corpus de la garde, lu sur le disque : `readCorpus` de `src/` (sans instruments Vitest ni `.d.ts`,
 *  soit `estDansLeCorpus`) — la lecture du test, du hook pre-commit et du hook au stylo.
 *  @returns {readonly { rel: string, text: string }[]} */
export function corpusDeLaGarde() {
  return readCorpus([CORPUS_RACINE]);
}

/** Contexte INTER-FICHIERS de la garde, sur le corpus : rang du paramètre `id` par nom de fonction
 *  (`rangsDuCorpus`, à la demande), faces d'affichage (`collectFacesDAffichage`), résolveurs par
 *  libellé de `src/data/index.ts` (`collectLabelEntityResolvers`).
 *  @param {readonly { rel: string, text: string }[]} fichiers @returns {GardeContexte} */
export function contexteDeLaGarde(fichiers) {
  const corpus = fichiers.filter(({ rel }) => estDansLeCorpus(rel));
  const index = corpus.find(({ rel }) => rel === 'src/data/index.ts');
  return { idParamFns: rangsDuCorpus(corpus), faces: collectFacesDAffichage(corpus), resolveurs: index ? collectLabelEntityResolvers(index.text) : new Set() };
}

/** @typedef {{ idParamFns: RangsDuParametreId, faces: Map<string, string>, resolveurs: Set<string> }} GardeContexte */

/**
 * TOUS les volets de la garde sur UN fichier — la seule composition, appelée par le test (corpus
 * entier, `scanLabelLogicCorpus`) et par le hook pre-commit (fichiers stagés). Chaque site porte son
 * statut : `couture` (`RATCHET_EXCEPTIONS`), `dette` (clé `fichier#règle` au stock `DETTES_DE_LIBELLE`,
 * que `ecartsAuxDettesDeLibelle` juge en compte), ou `nu`. Hors corpus : aucun site.
 * @param {string} rel @param {string} text @param {GardeContexte} ctx
 * @returns {{ rel: string, line: number, detail: string, rule: string, statut: 'couture' | 'dette' | 'nu' }[]}
 */
export function scanLabelLogicFichier(rel, text, ctx) {
  if (!estDansLeCorpus(rel)) return [];
  return [
    ...scanLabelLogic(rel, text),
    ...scanLabelAsIdArg(rel, text, effectiveIdParamFns(text, ctx.idParamFns)),
    ...scanLabelLiteralCompare(rel, text),
    ...scanCallResultLiteralCompare(rel, text),
    ...scanLabelKeyedIndex(rel, text),
    ...scanLabelResolverCalls(rel, text, ctx.resolveurs),
    ...scanFaceDAffichageIdentite(rel, text, ctx.faces),
    ...scanFaceDeDonneeString(rel, text),
    ...scanLiantsLitterauxDesFaces(rel, text),
  ].map((f) => {
    const site = { rel, ...f };
    const statut = ratchetShortKey(site) in RATCHET_EXCEPTIONS ? 'couture' : stockDe(cleDeDette(site)) > 0 ? 'dette' : 'nu';
    return { ...site, statut };
  });
}

/** La garde sur un corpus : les fichiers balayés (ceux du corpus) et tous leurs sites.
 *  @param {{ rel: string, text: string }[]} fichiers */
export function scanLabelLogicCorpus(fichiers) {
  const corpus = fichiers.filter(({ rel }) => estDansLeCorpus(rel));
  const ctx = contexteDeLaGarde(corpus);
  return { fichiers: corpus.map(({ rel }) => rel), sites: corpus.flatMap(({ rel, text }) => scanLabelLogicFichier(rel, text, ctx)) };
}

/** Compte des sites HORS couture, par `fichier#règle` — la mesure que juge `ecartsAuxDettesDeLibelle`.
 *  Chaque clé du stock dont le fichier est balayé est présente, à 0 si elle est soldée.
 *  @param {{ fichiers: string[], sites: { rel: string, rule: string, statut: string }[] }} balayage @returns {Map<string, number>} */
export function dettesParVolet({ fichiers, sites }) {
  const balayes = new Set(fichiers);
  const n = new Map(Object.keys(DETTES_DE_LIBELLE).filter((cle) => balayes.has(fichierDeDette(cle))).map((cle) => [cle, 0]));
  for (const s of sites) if (s.statut !== 'couture') n.set(cleDeDette(s), (n.get(cleDeDette(s)) ?? 0) + 1);
  return n;
}
