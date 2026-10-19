// Mécanique de scan du garde-fou « kind de RevealEntry ↔ site d'émission » (#942, lots L0 puis L8).
// L'union `RevealEntry['kind']` (src/noyau/pendings.ts) est un CONTRAT d'affichage : chaque membre
// doit avoir au moins un site qui PRODUIT une telle entrée dans les sources (hors tests). Un membre
// sans producteur laisse vivre son câblage UI (icône `REVEAL_ICON`, libellé de table, branche de rendu
// de `ui/RevealBody.tsx`) pour un cas qui n'arrive jamais ; un producteur d'un kind hors union ne compile pas.
//
// FORMES de production reconnues :
//   (1) `pushReveal(set, { kind: '…' })` / `env.pushReveal({ kind: '…' })` — l'émetteur UNIQUE ;
//   (2) toute DÉCLARATION dont le type mentionne `RevealEntry` et dont l'initialiseur est un littéral
//       (`const x: RevealEntry = {…}`, `const xs: RevealEntry[] = [{…}, {…}]`,
//       `const F: Record<string, () => RevealEntry> = { a: () => ({…}) }`) — scan de TOUT le littéral ;
//   (3) fabrique annotée `…): RevealEntry {` / `…): RevealEntry =>` — scan du corps.
//
// ⚠ ANGLE MORT ASSUMÉ (fail-OPEN, formes hors de portée d'un scan statique) :
//   (a) `kind` en SHORTHAND (`{ kind, title, lines }`) — la valeur vient d'une variable ;
//   (b) littéral SANS annotation passé par variable nue (`const e = { kind: 'x' }; pushReveal(set, e)`) ;
//   (c) `new Map<…, RevealEntry>([[k, { kind: '…' }]])` — l'initialiseur est un APPEL, pas un littéral
//       (zéro occurrence dans l'arbre à ce jour ; la forme (2) ne la voit pas).
// Conséquence de méthode : un « 0 producteur » rendu par cette garde n'AUTORISE PAS à lui seul la purge
// d'un membre d'union — il exige une vérification MANUELLE (recherche du kind littéral dans tout `src/`)
// avant toute suppression. Dans l'autre sens la garde reste utile sans réserve : elle échoue dès qu'un
// membre perd son dernier producteur des formes (1)-(3), et dès qu'un producteur cite un kind hors union.
// Module ESM pur, exécutable par `node` nu — patron `tableLookup.mjs`.

/** Retire commentaires de bloc et de ligne (mêmes règles que `tableLookup.mjs`).
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

const KIND_RX = /(?<![.\w'"])kind:\s*'([A-Za-z][\w-]*)'/g;

/** Kinds cités dans un fragment de source. @param {string} frag @returns {string[]} */
function kindsIn(frag) {
  return [...frag.matchAll(KIND_RX)].map((m) => m[1]);
}

/**
 * Membres de l'union `RevealEntry['kind']` déclarés par `pendings.ts`.
 * @param {string} pendingsSrc contenu de src/noyau/pendings.ts
 * @returns {string[]}
 */
export function unionKinds(pendingsSrc) {
  const i = pendingsSrc.indexOf('interface RevealEntry {');
  if (i < 0) throw new Error('interface RevealEntry introuvable — le foyer du type a bougé');
  const body = pendingsSrc.slice(i, pendingsSrc.indexOf('\n}', i));
  const m = /kind:\s*([^;]+);/.exec(body);
  if (!m) throw new Error('champ `kind` de RevealEntry introuvable');
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

/** Tranche le littéral/bloc ÉQUILIBRÉ qui commence au premier `{`/`[`/`(` à partir de `from`
 *  (profondeur des trois paires, chaînes simples/doubles/gabarits ignorées). Renvoie `''` si aucun.
 * @param {string} src @param {number} from @returns {string} */
function sliceBalanced(src, from) {
  const open = { '{': '}', '[': ']', '(': ')' };
  let i = from;
  while (i < src.length && !(src[i] in open)) {
    if (src[i] === ';' || src[i] === '\n') { if (src[i] === ';') return ''; }
    i++;
  }
  if (i >= src.length) return '';
  const start = i;
  let depth = 0;
  /** @type {string|null} */ let quote = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '\'' || c === '"' || c === '`') { quote = c; continue; }
    if (c in open) depth++;
    else if (c === '}' || c === ']' || c === ')') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  return src.slice(start);
}

/**
 * Kinds PRODUITS par un fichier source (formes (1)-(3) de l'en-tête).
 * @param {string} relPath @param {string} contenu
 * @returns {{ kind: string, line: number, forme: 1|2|3 }[]}
 */
export function scanRevealProducers(relPath, contenu) {
  const src = stripComments(contenu);
  const lineOf = (idx) => src.slice(0, idx).split('\n').length;
  /** @type {{ kind: string, line: number, forme: 1|2|3 }[]} */
  const out = [];
  const push = (frag, idx, forme, firstOnly) => {
    const ks = kindsIn(frag);
    for (const k of firstOnly ? ks.slice(0, 1) : ks) out.push({ kind: k, line: lineOf(idx), forme });
  };
  // (1) appel `pushReveal` avec littéral d'objet — le `kind` est la 1ʳᵉ propriété de l'entrée poussée.
  for (const m of src.matchAll(/pushReveal\(\s*(?:[\w.]+\s*,\s*)?(?=\{)/g)) {
    push(sliceBalanced(src, m.index + m[0].length), m.index, 1, true);
  }
  // (2) DÉCLARATION dont le type mentionne `RevealEntry`, initialisée par un littéral : objet, TABLEAU
  //     (`RevealEntry[]`) ou record de FABRIQUES (`Record<…, () => RevealEntry>`) — tout le littéral est
  //     scanné (N entrées → N producteurs).
  // `(?:[^;\n=]|=>)` : la flèche d'un type de FABRIQUE (`() => RevealEntry`) n'est pas l'affectation —
  // seule une `=` non suivie de `>` (et avant tout `;`) ouvre l'initialiseur.
  for (const m of src.matchAll(/:\s*(?:[^;\n=]|=>)*?\bRevealEntry\b(?:[^;=]|=>)*=(?!>)\s*(?=[[{])/g)) {
    push(sliceBalanced(src, m.index + m[0].length), m.index, 2, false);
  }
  // (3) fabrique annotée : corps de fonction `): RevealEntry {` OU flèche `): RevealEntry =>`.
  for (const m of src.matchAll(/\)\s*:\s*RevealEntry\s*(\{|=>)/g)) {
    push(sliceBalanced(src, m[1] === '{' ? m.index + m[0].length - 1 : m.index + m[0].length), m.index, 3, false);
  }
  return out;
}
