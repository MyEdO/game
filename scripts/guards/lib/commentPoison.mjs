// Mécanique de scan du garde-fou commentaires (#136, CLAUDE.md règle 6). Module ESM pur, exécutable
// par `node` nu (pas de tsx/TS) : extraction de commentaires, familles de regex, matching.
//
// CE MODULE EST LUI-MÊME SCANNÉ (#828) — les gardes sont soumises à la règle qu'elles font respecter.
// Un détecteur se spécifie donc par ses TESTS, pas par sa prose : les formes couvertes et les faux
// positifs écartés sont plantés en LITTÉRAUX DE CHAÎNE dans `src/comment-poison-guard.test.ts`, que
// `extractComments` ignore par construction (il ne lit que les commentaires). Aucun marqueur
// d'échappement, aucune liste d'exception : le mécanisme n'est pas transposable ailleurs, puisqu'il
// ne consiste qu'à ne pas ÉCRIRE dans un commentaire le texte que la regex cherche.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { allAbbrAlternation } from '../../raw/_lib.mjs';
import { LEGACY_VOCAB_SITES } from './legacyVocabStock.mjs';

/** PÉRIMÈTRE des gardes anti-poison — SOURCE UNIQUE des trois portes (suite Vitest, pre-commit,
 *  hook au stylo). Un fichier hors de ces racines/extensions n'est scanné par aucune ; un fichier
 *  dedans l'est par les TROIS, tests compris (le poison écrit dans un test est du poison). */
export const POISON_DIRS = ['src', 'scripts'];
export const POISON_EXTS = ['.ts', '.tsx', '.mts', '.mjs'];

/** @param {string} cheminRelatifOuAbsolu @returns {boolean} */
export function estFichierScanne(cheminRelatifOuAbsolu) {
  const p = String(cheminRelatifOuAbsolu).replace(/\\/g, '/');
  if (!POISON_EXTS.some((e) => p.endsWith(e))) return false;
  return POISON_DIRS.some((d) => p === d || p.startsWith(`${d}/`) || p.includes(`/${d}/`));
}

/**
 * @typedef {{ text: string, line: number, start: number, end: number }} Comment
 * Commentaire extrait, délimiteurs inclus. Les lignes `//` consécutives sur des lignes sources
 * adjacentes sont FUSIONNÉES en un seul commentaire logique (un tag porté sur la ligne suivante
 * neutralise l'excuse de la ligne précédente, comme le lirait un humain).
 * `start`/`end` sont les OFFSETS dans la source d'origine (`[start, end)`, groupe fusionné compris) :
 * ils donnent son inverse à l'extraction — `codeSeul` blanchit ces spans pour rendre le CODE seul.
 */

/**
 * Blanchit les MARQUEURS DE CONTINUATION en tête de ligne d'un commentaire (`*` d'un bloc, `//` d'une
 * suite de lignes fusionnées). Ils séparent deux mots exactement comme une espace : sans ce passage,
 * toute famille dont la regex exige une espace entre ses mots rate la phrase COUPÉE à cet endroit,
 * alors qu'elle la détecte sur une seule ligne (angle mort de la famille 4 ; les formes couvertes
 * sont plantées en LITTÉRAUX dans `src/comment-poison-guard.test.ts`).
 * Chaque marqueur est remplacé par le MÊME nombre d'espaces et les `\n` sont conservés : les index de
 * match — donc `matchLine` et `excerptAt` — restent exacts au caractère près.
 * @param {string} text @returns {string}
 */
function blankContinuations(text) {
  const lignes = text.split('\n');
  for (let i = 1; i < lignes.length; i++) {
    const m = /^[ \t]*(?:\*+\/?|\/\/+)[ \t]*/.exec(lignes[i]);
    if (m && m[0]) lignes[i] = ' '.repeat(m[0].length) + lignes[i].slice(m[0].length);
  }
  return lignes.join('\n');
}

// Un `/` ouvre un littéral de regex quand ce qui le précède attend une VALEUR (opérateur, ouvrante,
// mot-clé) ; après un identifiant, un nombre ou une fermante, c'est une division. Liste STRICTE :
// hors d'elle, on retombe sur le balayage ordinaire, jamais sur un saut à l'aveugle.
const AVANT_VALEUR = /[=(,:[!&|?{};+\-*%~^<>]$/;
const MOTS_AVANT_VALEUR = /\b(return|typeof|instanceof|in|of|new|delete|void|case|do|else|yield|await)$/;

/** @param {string} src @param {number} i @returns {boolean} */
function estDebutRegex(src, i) {
  // `/>` FERME une balise JSX auto-fermante (`<F attr={x} />`) : le `}` qui la précède attend
  // pourtant une valeur, et sans cette sortie le balayage sauterait la fin de la ligne,
  // commentaire compris (site réel : src/ui/PlaqueRow.test.tsx). Un littéral `/>/`, lui, se balaie
  // caractère à caractère comme du code ordinaire : sans guillemet, il n'a rien à désynchroniser.
  if (src[i + 1] === '>') return false;
  let j = i - 1;
  while (j >= 0 && (src[j] === ' ' || src[j] === '\t' || src[j] === '\n' || src[j] === '\r')) j--;
  if (j < 0) return true;
  // `++` / `--` DOUBLÉS : post-incrément suivi d'une DIVISION (`a++ / 2`), jamais une regex. Le
  // simple `+`/`-` reste, lui, un opérateur qui attend une valeur.
  if ((src[j] === '+' || src[j] === '-') && src[j - 1] === src[j]) return false;
  const avant = src.slice(Math.max(0, j - 11), j + 1);
  return AVANT_VALEUR.test(avant) || MOTS_AVANT_VALEUR.test(avant);
}

/** Index APRÈS le `/` fermant d'un littéral de regex ouvert en `i`, ou `-1` si la ligne se termine
 *  avant (donc : pas un littéral de regex — le balayage ordinaire reprend la main).
 *  @param {string} src @param {number} i @returns {number} */
function finRegex(src, i) {
  let j = i + 1;
  let classe = false;
  while (j < src.length && src[j] !== '\n') {
    const c = src[j];
    if (c === '\\') {
      j += 2;
      continue;
    }
    if (c === '[') classe = true;
    else if (c === ']') classe = false;
    else if (c === '/' && !classe) return j + 1;
    j++;
  }
  return -1;
}

/**
 * Extrait tous les commentaires (lignes `//` et blocs) d'un source TS/TSX, en ignorant le contenu
 * des chaînes ('…', "…", `…`) — une occurrence dans une chaîne ou un littéral de scénario n'est
 * PAS un commentaire. Heuristique volontairement simple : suffisante pour du TypeScript/TSX
 * standard, pas un vrai lexer.
 * @param {string} src
 * @returns {Comment[]}
 */
export function extractComments(src) {
  const raw = [];
  let i = 0;
  let line = 1;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (ch === '\n') {
      line++;
      i++;
      continue;
    }
    if (ch === '/' && src[i + 1] === '/') {
      const startLine = line;
      let j = i + 2;
      while (j < n && src[j] !== '\n') j++;
      raw.push({ kind: 'line', text: src.slice(i, j), line: startLine, start: i, end: j });
      i = j;
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      const startLine = line;
      let j = i + 2;
      while (j < n && !(src[j] === '*' && src[j + 1] === '/')) {
        if (src[j] === '\n') line++;
        j++;
      }
      j = Math.min(j + 2, n);
      raw.push({ kind: 'block', text: src.slice(i, j), line: startLine, start: i, end: j });
      i = j;
      continue;
    }
    // Littéral de REGEX : ses guillemets ne sont pas des chaînes. Sans ce saut, une
    // regex comme `("[^"]*"|…)` désynchronise le balayage de chaînes et TOUT le reste du fichier
    // devient invisible aux gardes.
    if (ch === '/' && estDebutRegex(src, i)) {
      const fin = finRegex(src, i);
      if (fin > 0) {
        i = fin;
        continue;
      }
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      let j = i + 1;
      while (j < n && src[j] !== quote) {
        if (src[j] === '\\') {
          j++;
          if (src[j] === '\n') line++;
          j++;
          continue;
        }
        if (src[j] === '\n') line++;
        j++;
      }
      i = Math.min(j + 1, n);
      continue;
    }
    i++;
  }

  // Fusion des `//` consécutifs (lignes sources adjacentes, sans code entre eux) : un seul
  // commentaire logique — sinon un tag `[entériné …]` posé sur la ligne suivante ne « couvrirait »
  // jamais l'excuse énoncée sur la ligne précédente.
  const merged = [];
  let k = 0;
  while (k < raw.length) {
    const cur = raw[k];
    if (cur.kind === 'line') {
      let text = cur.text;
      let endLine = cur.line;
      let end = cur.end;
      let m = k + 1;
      while (m < raw.length && raw[m].kind === 'line' && raw[m].line === endLine + 1) {
        text += '\n' + raw[m].text;
        endLine = raw[m].line;
        end = raw[m].end;
        m++;
      }
      merged.push({ text: blankContinuations(text), line: cur.line, start: cur.start, end });
      k = m;
    } else {
      merged.push({ text: blankContinuations(cur.text), line: cur.line, start: cur.start, end: cur.end });
      k++;
    }
  }
  return merged;
}

/**
 * INVERSE d'`extractComments` : la source privée de ses commentaires, le CODE seul. Chaque span de
 * commentaire est BLANCHI (caractères remplacés par des espaces, `\n` conservés) — la longueur et la
 * numérotation des lignes sont donc identiques à la source, un `fichier:ligne` calculé sur le rendu
 * vaut pour l'original. SOCLE des gardes qui traquent une forme dans le CODE et pas dans la prose
 * (`src/portable-paths-guard.test.ts` : une graphie de chemin CITÉE en JSDoc documente, elle ne casse
 * aucune machine ; le même littéral dans une expression, si).
 * @param {string} src @returns {string}
 */
export function codeSeul(src) {
  let out = '';
  let pos = 0;
  // `extractComments` rend ses spans dans l'ordre de la source et sans recouvrement.
  for (const c of extractComments(src)) {
    out += src.slice(pos, c.start) + src.slice(c.start, c.end).replace(/[^\n]/g, ' ');
    pos = c.end;
  }
  return out + src.slice(pos);
}

/** Ligne absolue (1-based) d'un index de match DANS `comment.text`.
 * @param {Comment} comment @param {number} matchIndex @returns {number} */
export function matchLine(comment, matchIndex) {
  return comment.line + comment.text.slice(0, matchIndex).split('\n').length - 1;
}

/** Extrait de contexte lisible autour d'un match (une ligne, tronquée).
 * @param {Comment} comment @param {number} matchIndex @returns {string} */
export function excerptAt(comment, matchIndex) {
  const lineStart = comment.text.lastIndexOf('\n', matchIndex) + 1;
  let lineEnd = comment.text.indexOf('\n', matchIndex);
  if (lineEnd < 0) lineEnd = comment.text.length;
  return comment.text.slice(lineStart, lineEnd).trim().slice(0, 140);
}

// ---------------------------------------------------------------------------------------------
// Famille 1 — PIERRE TOMBALE (CLAUDE.md règle 6). Tolérance ZÉRO, pas d'exception.
// ---------------------------------------------------------------------------------------------

// Bâti via String.fromCharCode (pas un caractère back-tick littéral dans CE fichier) : un back-tick
// littéral serait lu par les outils qui parsent ce module comme un template string et désynchroniserait
// le reste du fichier.
const BT = String.fromCharCode(96);
const CODE_TOMBSTONE_RETIRE_RX = new RegExp(
  '(ancien\\w*|' + BT + '[^' + BT + ']+' + BT + '|«[^»]+»)[\\s\\S]{0,200}?a été (retiré|supprimé|renommé)',
  'i',
);
// ANGLE MORT (#1728) : le PARTICIPE NU derrière un artefact back-tiqué (« `x` retiré », sans « a
// été ») n'entre PAS dans la famille. Sur `src/**`+`scripts/**`, la quasi-totalité de ses sites
// décrit une OPÉRATION COURANTE (« `type` retiré des deux côtés », « `usable` retiré de chaque
// entité à places », « `«` `»` SUPPRIMÉS avec l'espace adjacent ») — du contrat au présent, pas du
// code disparu. Aucun discriminant syntaxique ne sépare les deux sens, et une famille qui exigerait
// une exemption par site serait un stock nominatif : la forme reste hors garde.
// ANGLE MORT (#1759) : le DÉPLACEMENT « X est passé à/vers Y » n'entre PAS dans les familles. Sur
// `src/**`+`scripts/**`, la MAJORITÉ de ses sites, avec ou sans l'auxiliaire, dit le PASSAGE D'UN
// ARGUMENT au présent (« la valeur passée à `buildScene` », « l'acteur est passé à
// `InfluenceRow` », « les lookups sont passés à `findTableEntry` »), soit le contrat COURANT du
// site. Les deux discriminants essayés échouent : l'artefact back-tiqué est présent des DEUX
// côtés, et l'auxiliaire laisse une majorité de contrats au présent. Aucune forme propre ne sépare
// les deux sens : la famille n'est pas posée.

// Apostrophe (droite ou typographique), bâtie par ÉCHAPPEMENT : aucun caractère apostrophe littéral
// dans les regex de ce fichier, qui déséquilibrerait le balayage de chaînes d'`extractComments`.
const APOS = '[\\u0027\\u2019]';
// Négation TEMPORELLE (adverbe de cessation, jamais celui de simple absence) suivie d'un artefact
// de CODE nommé : forme que les familles voisines laissent passer (ni parenthèse, ni tiret, ni
// participe passé).
// Le complément doit nommer un artefact de code : le même tour de phrase sur une ressource de JEU (une
// place libre, une provision, un souffle) décrit un état de partie VIVANT, pas du code disparu — d'où
// le vocabulaire fermé ci-dessous, et le lookahead qui interdit d'attraper un mot plus long.
// Formes couvertes et faux positifs écartés : LITTÉRAUX dans `src/comment-poison-guard.test.ts`.
const DEAD_ARTIFACT_NOUN =
  '(?:entrée|applier|handler|hook|repli|fallback|bouton|ancre|drapeaux|drapeau|flag|champ|propriété' +
  '|paramètre|argument|branche|module|registre|wrapper|alias|surcharge|mode|slot|méthode|fonction)';
// Espace INTER-MOTS tolérant le retour à la ligne d'un commentaire : le marqueur de continuation
// (`*` d'un bloc, `//` d'une suite de lignes fusionnées) sépare les mots aussi bien qu'une espace —
// sans lui, la même tombale échapperait à la garde selon l'endroit où la phrase est coupée.
const GAP = '[\\s*/]{1,24}';
const NO_MORE_ARTIFACT_RX = new RegExp(
  '\\bn' + APOS + '(?:a|ont)' + GAP + 'plus' + GAP + 'd(?:e' + GAP + '|' + APOS + ')' +
    DEAD_ARTIFACT_NOUN + 's?(?![\\wÀ-ÿ])',
  'i',
);
// Le passé nostalgique nomme un état que le lecteur ne peut plus ouvrir, quel que soit son sujet :
// aucune restriction de vocabulaire n'est nécessaire ici (locution sans emploi de jeu).
const OF_YORE_RX = new RegExp('\\bd' + APOS + 'antan\\b', 'i');

// La NATURE révolue d'un site : la négation temporelle dont le complément est le mot `code` lui-même.
// Le lecteur ne peut pas ouvrir ce qui a disparu, et le contrat courant se dit au présent. Forme
// ÉTROITE, complément FERMÉ à ce seul mot. Les LITTÉRAUX (formes couvertes, faux positifs
// écartés) vivent dans `src/comment-poison-guard.test.ts` — jamais ici : le fichier de la garde est
// lui-même scanné. ANGLE MORT ASSUMÉ, déclaré à l'en-tête du test : la même cessation devant un
// artefact BACK-TICKÉ n'entre PAS dans la famille (ses sites sont en majorité des prédicats VIVANTS
// sur une clé de donnée ou un nœud zod scellé — plus de faux positifs que de sites).
const NO_MORE_CODE_RX = new RegExp(
  '\\bn(?:' + APOS + '|e' + GAP + ')(?:est|sont)' + GAP + 'plus' + GAP + 'du' + GAP + 'code\\b',
  'i',
);

// Le SITE quitté : la négation temporelle dont le complément est l'adverbe de lieu qui désigne CE
// fichier. Le lecteur y cherche le contrat courant, pas ce qu'un autre module a repris. Forme
// ÉTROITE — quatre verbes (état et résidence), complément FERMÉ à l'adverbe de PROXIMITÉ. L'adverbe
// de DISTANCE est exclu par construction : ses sites décrivent une absence À L'EXÉCUTION (une
// entrée de cache libérée, un héros sorti du groupe, un composant démonté) — un état de partie
// VIVANT, jamais du code disparu.
// Formes couvertes et faux positifs écartés : LITTÉRAUX dans `src/comment-poison-guard.test.ts`.
const NO_MORE_HERE_RX = new RegExp(
  '\\bn(?:' + APOS + '|e' + GAP + ')(?:est|sont|vit|vivent)' + GAP + 'plus' + GAP + 'ici\\b',
  'i',
);

// Le DÉPART d'un artefact de code : le passé composé du verbe de départ, collé à un artefact
// BACK-TICKÉ — sujet juste avant, ou complément juste après. Le lecteur y apprend d'où l'artefact
// est parti, jamais ce qu'il est (#1343). Hors artefact back-tické, la forme reste HORS famille
// (angle mort déclaré à l'en-tête du test).
// Formes couvertes et faux positifs écartés : LITTÉRAUX dans `src/comment-poison-guard.test.ts`.
const QUITTE = '(?:a|ont)' + GAP + 'quitt[ée]e?s?(?![\\wÀ-ÿ])';
const TICKED = BT + '[^' + BT + '\\n]+' + BT;
const LEFT_ARTIFACT_RX = new RegExp(
  '(?:' + TICKED + GAP + QUITTE + '|\\b' + QUITTE + GAP + TICKED + ')',
  'i',
);

// Le RAPPEL D'ANCIEN ÉTAT le plus courant du dépôt : la locution de cessation suivie d'un artefact
// de CODE nommé, sans négation verbale (« … — plus de X », « (plus de X en dur) »). Même exigence
// que la famille voisine : le complément doit nommer un artefact de code, jamais une ressource de
// JEU (un pion, un créneau, un marqueur d'affichage), d'où le vocabulaire FERMÉ ci-dessous.
// Formes couvertes et faux positifs écartés : LITTÉRAUX dans `src/comment-poison-guard.test.ts`.
const CODE_ARTIFACT_NOUN =
  '(?:name-match|if-chain|hook-fonction|regex|liste|littéra(?:l|ux)|chaîne|clé|copie|doublon|parsing' +
  '|prédicat|dispatch|ternaire|hack|tableau|table|record|map|devinette|garde|gate|planner|match' +
  '|handler|hook|repli|fallback|bouton|ancre|drapeaux|drapeau|flag|champ|branche|module|registre' +
  '|entrée|helper|conversion|set|fsm|applier|wrapper|alias|surcharge|slot|méthode|fonction' +
  '|propriété|paramètre|argument|mode)';
// Locutions de QUANTITÉ et de COMPARAISON (« en plus de », « d'autant plus de », « pas plus de … que »)
// et le renvoi documentaire (« plus de détails dans … », dont le complément n'est pas un artefact) :
// écartés STRUCTURELLEMENT, jamais par liste de sites.
const QUANTITE_AVANT =
  '(?<!(?:\\ben|\\bde|\\bnon|\\bau|autant|beaucoup|peu|bien|toujours|encore|tant|jamais|guère|pas)[\\s*/]{1,24})';
// #1686 : le qualificatif de révolu NU, suivi d'un identifiant de CODE qui CLÔT la ligne — forme
// d'annotation en fin d'assertion ou de littéral, que les deux familles voisines laissent passer
// (l'une exige la parenthèse, l'autre le préfixe à tiret). Deux discriminants cumulés : la cible
// ressemble à du code (back-ticks, tiret/souligné interne, identifiant chameau, nom de fichier) et
// rien ne la suit sur la ligne — un complément de phrase ferait retomber le mot dans son sens
// courant (« un format lisible », « le propriétaire précédent »). Casse SIGNIFICATIVE : le
// discriminant chameau n'existe que si la majuscule interne compte.
// Formes couvertes et faux positifs écartés : LITTÉRAUX dans `src/comment-poison-guard.test.ts`.
const IDENT_CODE =
  '(?:' + BT + '[\\w./-]+' + BT +
  '|[A-Za-zÀ-ÿ][\\wÀ-ÿ]*[-_][\\wÀ-ÿ]+(?:[-_][\\wÀ-ÿ]+)*' +
  '|[a-zà-ÿ]+[A-Z][\\w]*' +
  '|[\\w-]+\\.[jt]sx?' +
  ')';
const ANCIEN_IDENT_EOL_RX = new RegExp(
  '\\b[Aa]ncien(?:ne|s|nes)?\\s+' + IDENT_CODE + '[ \\t]*(?:\\*+/)?[ \\t]*$',
  'm',
);
// ANGLE MORT (#1728) : le QUANTIFIEUR de vacuité (« plus aucun match », « plus aucune entrée ») est
// EXCLU de la famille. Sur `src/**`+`scripts/**`, ses sites sont presque tous des CONTRATS AU
// PRÉSENT (« plus AUCUN match par libellé », « plus aucune liste `specs[]`
// maintenue à la main ») — la forme « plus AUCUN X » affirme ce que le code NE FAIT PLUS par
// conception, quand « plus de X », en incise, rappelle un ÉTAT RÉVOLU. Deux sens, deux formes.
const NAMED_ARTIFACT_TOMBSTONE_RX = new RegExp(
  QUANTITE_AVANT + '\\bplus' + GAP + 'd(?:e' + GAP + '|' + APOS + ')' +
    CODE_ARTIFACT_NOUN + 's?(?![\\wÀ-ÿ-])(?!' + GAP + 'que\\b)',
  'i',
);

// L'ORIGINE d'un module ne se lit plus : le fichier dont il fut extrait (ou migré) a changé de nom, de
// forme ou n'existe plus — git porte cette histoire, le lecteur a besoin du contrat COURANT.
// Prépositions : « de », « d' », « du », « des », « depuis ».
// La CIBLE doit être un MODULE ou un SYMBOLE de module : back-ticks portant une majuscule interne ou
// un suffixe de fichier, identifiant chameau nu, ou nom de fichier nu (glob compris). Deux classes en
// sont donc exclues par construction — la citation de SOURCE (« extrait du chapitre LDB 13 », « extrait
// d'ADE II » : sigles sans minuscule interne) et la DÉRIVATION vivante (« arêtes extraites de `walled` » :
// un mot local en back-ticks décrit ce que le code FAIT, pas d'où il vient).
// Une MIGRATION n'est jamais vivante : elle se dit aussi par sa DESTINATION (« vers », « dans »), son
// origine peut porter l'article « l'ancien(ne) », et sa cible s'étend au chemin back-tické qui porte un
// « / » et à la constante de module back-tickée (SCREAMING_SNAKE). La donnée migrée d'une FORME à une
// autre (« migré du CODE en donnée ») reste hors cible.
const DEPUIS = `d(?:e\\s+|epuis\\s+|es\\s+|u\\s+|${APOS})`;
const MIGRE_OU = `(?:${DEPUIS}|vers\\s+|dans\\s+)(?:l${APOS}ancienn?e?\\s+)?`;
const MODULE_CIBLE =
  `${BT}[\\w/-]*(?:[a-zà-ÿ][A-Z]|\\.tsx?)[\\w/.-]*${BT}|[A-Z][a-zà-ÿ]+[A-Z][\\w]*|[\\w/*-]+\\.tsx?\\b`;
const MIGRATION_CIBLE = `${BT}[\\w.-]*/[\\w/.*-]*${BT}|${BT}[A-Z][A-Z0-9]*_[A-Z0-9_]+${BT}`;
const EXTRACTED_FROM_RX = new RegExp(
  `\\b(?:[Ee]xtraite?s?\\s+${DEPUIS}(?:${MODULE_CIBLE})|[Mm]igrée?s?\\s+${MIGRE_OU}(?:${MODULE_CIBLE}|${MIGRATION_CIBLE}))`,
);

/** @type {{ rx: RegExp, label: string }[]} */
export const TOMBSTONE_FAMILIES = [
  // NB : l'accord féminin/pluriel du participe passé est couvert par les suffixes optionnels
  // (« e »/« s »), sinon la famille ne matcherait jamais la forme la plus courante.
  //
  // Affinage #136 : la famille brute matcherait aussi un déplacement PHYSIQUE en jeu/UI, jamais
  // suivi d'un article en vrai tombstone de code (qui cible toujours un module ou un chemin, jamais
  // précédé d'un déterminant). Le lookahead négatif écarte l'article.
  { rx: /déplacée?s? (vers|dans) (?!la\b|le\b|un\b|une\b|les\b)/i, label: 'déplacé(e)(s) vers/dans (code)' },
  { rx: /anciennement/i, label: 'anciennement' },
  // Le préfixe du révolu INTRODUIT un artefact qui n'existe plus, quelle que soit la casse de ce
  // qui suit : exiger un back-tick ou une majuscule laisserait passer toute la moitié minuscule de
  // la classe (#828). Seule soustraction, LEXICALE et fermée : la locution latine « ex aequo », où
  // le mot est latin et non préfixe — aucun artefact de code ne porte ce nom, la soustraction
  // n'ouvre donc aucune échappatoire.
  { rx: new RegExp(`\\bex-(?!aequo\\b|æquo\\b)(?:${BT}|[\\wÀ-ÿ])`, 'i'), label: 'ex-Nom' },
  { rx: /désormais (dans|via|par)/i, label: 'désormais dans/via/par' },
  // Un « chemin » de code n'est visible que dans le tree courant : le qualifier d'ANCIEN ne désigne rien
  // que le lecteur puisse ouvrir. Distinct d'un ancien FORMAT (sauvegarde v3, document authoré d'hier),
  // qui existe encore sur disque et reste une information vivante pour le code de migration : la famille
  // ne matche que le mot `chemin`, jamais un format ni un schéma (#828).
  { rx: /\bl['’]ancien(?:ne)?s?\s+chemin\b/i, label: "l'ancien chemin (code disparu)" },
  // Ce qu'un symbole a REMPLACÉ ne se lit plus nulle part : seul son contrat courant sert le lecteur (#828).
  { rx: /\bremplac\w+\s+l['’]ancien/i, label: "remplace l'ancien X" },
  // Affinage #136 : la famille brute matcherait aussi le vocabulaire de JEU (un pion d'armure ou une
  // provision quittant l'inventaire EN JEU, pas du code quittant le dépôt). Une vraie pierre tombale de
  // code NOMME l'artefact : le mot "ancien", un identifiant entre back-ticks, ou un nom entre
  // guillemets — on exige l'un des trois à proximité.
  {
    rx: CODE_TOMBSTONE_RETIRE_RX,
    label: 'a été retiré/supprimé/renommé (code)',
  },
  // Affinage #136 : « avant : » nu matcherait aussi le vocabulaire de RENDU/JEU (façade, direction,
  // ou un état de PERSONNAGE antérieur à un entraînement). Une vraie pierre tombale de code compare
  // EXPLICITEMENT au comportement d'hier via une locution dédiée, ou cite la valeur/le message
  // d'avant entre guillemets.
  { rx: /(comme avant\s*:|avant\s*:\s*«)/i, label: 'avant : (comparaison au code)' },
  // #336 : la forme PARENTHÉSÉE est un état-d'avant encapsulé dans un commentaire de code — la
  // parenthèse est le discriminant de l'affinage ci-dessus.
  { rx: /\(avant\s*:/i, label: 'avant : (parenthésé — état d’avant)' },
  // #948 : jumelle de la précédente pour l'ARTEFACT révolu nommé entre parenthèses — forme que les
  // familles voisines laissent passer (l'une exige le mot « chemin », l'autre un tiret). Même
  // discriminant : la parenthèse. Hors parenthèse, le qualificatif désigne souvent une donnée encore
  // vivante (un format de sauvegarde lisible, le propriétaire précédent d'un objet EN JEU).
  // Formes couvertes et faux positifs écartés : LITTÉRAUX dans `src/comment-poison-guard.test.ts`.
  { rx: /\(ancien(?:ne)?s?\b|\(anciennement\b/i, label: 'ancien X (parenthésé — artefact disparu)' },
  { rx: ANCIEN_IDENT_EOL_RX, label: 'ancien <identifiant> en fin de ligne (artefact disparu)' },
  // #1385 : l'ORIGINE révolue d'un module (« extrait d'X », « extraits de X ») nomme un artefact que
  // le lecteur ne peut plus ouvrir, et que git porte déjà. Discriminant : la source doit RESSEMBLER à
  // du code — back-ticks, identifiant chameau (`IsoStage`, `GameStage3D`) ou nom de fichier `.ts(x)`.
  // Les citations de source RAW en sont exclues par construction (leurs sigles — LDB, ADE, EDOC — ne
  // portent aucune minuscule interne), comme l'extrait de texte au sens courant (minuscules).
  { rx: EXTRACTED_FROM_RX, label: 'extrait/migré de X (origine révolue du module)' },
  { rx: NO_MORE_ARTIFACT_RX, label: 'négation temporelle + artefact de code (état révolu)' },
  { rx: OF_YORE_RX, label: 'passé nostalgique (état révolu)' },
  { rx: NO_MORE_CODE_RX, label: 'n’est plus du code (nature révolue du site)' },
  { rx: NO_MORE_HERE_RX, label: 'n’est / ne vit plus ici (site quitté)' },
  { rx: LEFT_ARTIFACT_RX, label: 'artefact back-tické parti (départ révolu)' },
  // #1486 : la locution de cessation NUE devant un artefact de code nommé ; le vocabulaire fermé et les
  // exclusions de quantité/comparaison ramènent sa population aux seuls artefacts.
  { rx: NAMED_ARTIFACT_TOMBSTONE_RX, label: 'plus de <artefact de code> (état révolu)' },
];

/** @param {string} text @returns {string[]} labels des familles matchées */
export function tombstonesIn(text) {
  return TOMBSTONE_FAMILIES.filter((f) => f.rx.test(text)).map((f) => f.label);
}

/**
 * Scan complet d'un fichier source : toutes les pierres tombales trouvées dans ses commentaires.
 * @param {string} relPath chemin relatif (pour le libellé de la trouvaille)
 * @param {string} contenu source complet du fichier
 * @returns {{ line: number, detail: string }[]}
 */
export function scanTombstones(relPath, contenu) {
  const findings = [];
  for (const c of extractComments(contenu)) {
    for (const fam of TOMBSTONE_FAMILIES) {
      const m = fam.rx.exec(c.text);
      if (m) findings.push({ line: matchLine(c, m.index), detail: `[${fam.label}] ${excerptAt(c, m.index)}` });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------------------------
// Famille 2 — commentaire-EXCUSE (CLAUDE.md règle 6). Un tag `[entériné AAAA-MM-JJ]` dans le MÊME
// commentaire neutralise la détection (décision utilisateur traçable).
// ---------------------------------------------------------------------------------------------

/** Policy PARTAGÉE (test Vitest + hook pre-commit + hook au stylo — une seule source de vérité) :
 *  `true` : les hooks bloquent l'excuse sans tag `[entériné AAAA-MM-JJ]` et le test Vitest scanne
 *  tout src/** (#136, #177). Une excuse sans tag `[entériné]` échoue la CI et le commit. */
export const EXCUSE_GUARD_ACTIVE = true;

// Affinage (même méthode que les familles tombstone ci-dessus) : une vraie excuse nomme un artefact
// de CODE (paramètre, appelant, migration) ; le faux positif nomme un artefact de RÈGLE (Round,
// Test, Action, Sort — capitalisé dans les commentaires du repo) ou documente la sémantique
// null/false d'un champ d'état de partie. Les deux locutions suivies d'un participe de mécanique de
// jeu (état de partie, durée d'effet) sont écartées structurellement par les lookaheads
// ci-dessous ; la locution d'attente nue reste détectée (les vraies excuses du stock l'utilisent).
// Le texte que la regex cherche n'est PAS écrit ici — il est planté en chaîne dans
// `src/comment-poison-guard.test.ts`, que `extractComments` ne lit pas (#828).
const GAME_STATE_PARTICIPLE =
  '(lanc|tir[ée]|boug|dépens|défend|résol|jou|commenc|ouvert|agi\\b|explor|entraîn|connu|désign|roul|au niveau|à la mi|de [A-ZÀ-Ý])';
// Un DÉFAUT relevé puis renvoyé à un autre geste (« … à <verbe> <ailleurs> ») est une excuse : le
// commentaire signale une dette sans validation utilisateur traçable. La discrimination tient à la
// seule regex ci-dessous — elle exige l'INFINITIF d'un verbe de réparation SUIVI d'un renvoi
// (séparément/ailleurs/plus tard/à part/au propre) ; un participe qui décrit le PRÉSENT
// (« traité ailleurs », « comptés séparément ») n'a pas cette forme et ne matche pas.
// ANGLE MORT : une phrase DESCRIPTIVE au présent bâtie sur « est <infinitif de
// réparation> <renvoi> » (une localisation par zone, comptée chacune de son côté) porterait la même
// forme et matcherait ; la regex reste STRICTE tant que le corpus scanné n'en porte aucune.
const VERBES_REPARATION =
  '(corriger|traiter|régler|migrer|nettoyer|purger|réparer|reprendre|refaire|supprimer|instruire)';
const REPORT_AILLEURS = 'à ' + VERBES_REPARATION + ' (séparément|ailleurs|plus tard|à part|au propre)';
// Deux formes d'excuse : (i) la dette laissée EN ATTENTE, sans renvoi explicite — un verbe d'état
// suivi de l'infinitif de réparation ; (ii) l'alibi de PÉRIMÈTRE daté, qui justifie l'omission par
// l'état du chantier au moment du geste. Les deux sont des excuses au sens de la règle 6 : une
// dette signalée sans validation utilisateur traçable.
// ANGLE MORT, même clause que `REPORT_AILLEURS` ci-dessus : une prose DESCRIPTIVE au passé bâtie
// sur le verbe d'état + la première regex ci-dessous, suivi d'un complément de SOURCE et non d'un
// renvoi de chantier (un CONSTAT sur ce que l'extraction FR n'a pas couvert, pas une dette
// laissée), porte la même forme et MORDRAIT ; la regex reste STRICTE tant que le corpus scanné n'en
// porte aucune. Comme pour les familles ci-dessus, l'exemple LITTÉRAL n'est pas écrit ici (il
// mordrait sur ce commentaire même) : il est planté en chaîne dans
// `src/comment-poison-guard.test.ts` (#828).
const RESTE_A_REPARER = '(reste|restent|restait|restaient) à ' + VERBES_REPARATION;
const ALIBI_PERIMETRE = '(était|étaient) hors périmètre|hors périmètre le jour d';
// Dette laissée à la locution d'ATTENTE devant le mot « arbitrage » : le commentaire renvoie la
// décision à personne et à aucune date — c'est une excuse au sens de la règle 6. Regex STRICTE : le
// simple pointeur « arbitrage #N », qui NOMME le ticket où la question vit, reste hors regex. Comme
// les familles ci-dessus, la forme LITTÉRALE n'est pas écrite ici (elle mordrait sur ce commentaire
// même) : elle est plantée dans le test (#828).
const ATTENTE_ARBITRAGE = 'en attente d' + APOS + '\\s*(un )?arbitrage';
// Dette laissée à une LOCUTION D'ATTENTE qui NOMME la chose future (#1732) : le commentaire décrit
// un état à venir au lieu de ce que le code rend — excuse au sens de la règle 6.
// CE QUE LA REGEX FAIT, exactement : une des trois locutions d'attente (plantées en littéral dans le
// test, #828 — ce module est scanné par sa propre garde) suivie, DANS LA MÊME PHRASE, d'un MARQUEUR DE
// DETTE (`MARQUEUR_ATTENTE` ci-dessous) — la chose future est un artefact de chantier : une primitive,
// une mutualisation, une forme canonique, une factorisation, un lot numéroté, un ticket, une migration,
// une refonte.
// L'UNITÉ EST LA PHRASE, ni la ligne ni le bloc : un bloc s'enroule à ~100 colonnes, donc une
// phrase y tombe couramment sur deux lignes (le cas planté en littéral dans le test) ; la fenêtre
// traverse donc le retour de ligne ET le préfixe de continuation (` * ` d'un bloc, `//` de deux
// lignes jointes par `extractComments`), mais s'arrête au premier `.` `;` `!` `?`. Le bloc ENTIER
// comme fenêtre rapporterait des faux positifs de flux (une phrase d'état de partie suivie, phrase
// suivante, d'un mot de chantier) : contrôle négatif planté dans le test.
// POURQUOI LE MARQUEUR et pas la locution seule : sur le corpus des deux racines, ces locutions
// servent massivement le vocabulaire de FLUX du jeu — un pending, un effet gelé, un jet adverse,
// une offre de prolongation — et la chose attendue y est une pièce d'état de partie, jamais un
// artefact de chantier. C'est le test de CORPUS qui tient ce constat (aucun cardinal ici : il
// mentirait dès le prochain commit).
// ANGLE MORT (1) : une dette dont la chose future n'est PAS nommée avec ces mots (un renvoi à un nom
// propre de module, une périphrase) passe — la regex ne mesure qu'un vocabulaire.
// ANGLE MORT (2) : la frontière de phrase est LEXICALE, donc toute ponctuation de CODE rencontrée entre
// la locution et le marqueur ferme la fenêtre — le point d'un chemin de fichier ou d'une abréviation, le
// point d'un décimal, le point-virgule qui sépare deux propositions d'une même phrase. Une dette qui
// nomme son artefact APRÈS une telle ponctuation passe. La frontière de phrase SYNTAXIQUE : #1737.
const MARQUEUR_ATTENTE =
  '(primitives?|partagée?s?|mutualis\\w*|canoniqu\\w*|factoris\\w*|lots?\\s+\\d|#\\d+|migration|refonte)';
const LOCUTION_ATTENTE = '(en attendant|dans l' + APOS + 'attente d|en attente d)';
// Fenêtre-PHRASE : tout sauf une ponctuation forte, et le saut de ligne n'est franchi qu'avec son
// préfixe de continuation de commentaire.
const SUITE_DE_PHRASE = '(?:[^.;!?\\n]|\\n[ \\t]*(?:\\*|//)?[ \\t]*){0,80}?';
const ATTENTE_DE_X = LOCUTION_ATTENTE + SUITE_DE_PHRASE + MARQUEUR_ATTENTE;
export const EXCUSE_RX = new RegExp(
  "(assume|épargn[ée]\\w*(?!\\w)(?!\\s+(par|pour)\\s)|pour l'instant|" +
    REPORT_AILLEURS +
    '|' +
    RESTE_A_REPARER +
    '|' +
    ALIBI_PERIMETRE +
    '|' +
    ATTENTE_ARBITRAGE +
    '|' +
    ATTENTE_DE_X +
    '|pas encore (?!' +
    GAME_STATE_PARTICIPLE +
    ')|(?<!\\b(accordée?s?|prime|insensible)\\s)temporairement(?!\\s+(insensible|accordé|accordée|accordées|prime)))',
  'i',
);
export const ENTERINE_TAG_RX = /\[entériné \d{4}-\d{2}-\d{2}\]/;

/** @param {string} text @returns {RegExpExecArray | null} */
export function untaggedExcuseMatch(text) {
  if (ENTERINE_TAG_RX.test(text)) return null;
  return EXCUSE_RX.exec(text);
}

/**
 * Scan complet d'un fichier source : toutes les excuses non taguées trouvées dans ses commentaires.
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string }[]}
 */
export function scanExcuses(relPath, contenu) {
  const findings = [];
  for (const c of extractComments(contenu)) {
    const m = untaggedExcuseMatch(c.text);
    if (m) findings.push({ line: matchLine(c, m.index), detail: excerptAt(c, m.index) });
  }
  return findings;
}

// ---------------------------------------------------------------------------------------------
// Famille (e) — VOCABULAIRE DE L'ANCIEN ÉTAT (#1486, credo règle 1 : ni code mort, ni chemin de
// compatibilité, ni dette non comptée). Un commentaire qui NOMME l'état d'avant, ou le pont qui le
// fait survivre, décrit soit du code que le lecteur ne peut plus ouvrir, soit une dette que personne
// ne compte : le site MEURT, ou il porte le tag `[entériné AAAA-MM-JJ]` (mot réservé de
// l'utilisateur) dans le MÊME commentaire. Les mots couverts ne sont PAS écrits ici en prose — ce
// module est scanné par sa propre famille (#828) : ils vivent en LITTÉRAUX dans
// `src/comment-poison-guard.test.ts` (formes couvertes, faux positifs écartés) et dans le stock
// nominatif daté `scripts/guards/lib/legacyVocabStock.mjs`.
// ---------------------------------------------------------------------------------------------

// Frontière ALPHANUMÉRIQUE, jamais `\b` : le tiret bas n'en est pas une, pour qu'une CONSTANTE citée
// en commentaire reste un site, tandis qu'un identifiant chameau (`xxxCounts`, `charKeyXxx`) ou un
// nom de fichier cité en chemin n'en soit pas un — faux positifs plantés dans le test.
const NB_AVANT = '(?<![a-zA-ZÀ-ÿ0-9])';
const NB_APRES = '(?![a-zA-ZÀ-ÿ0-9])';
const FICHIER_APRES = '(?!\\.(?:mjs|mts|tsx?|jsx?|json))';
const MOT = '[a-zA-ZÀ-ÿ]+';

/** @type {{ rx: RegExp, label: string }[]} */
export const LEGACY_VOCAB_FAMILIES = [
  { rx: new RegExp(NB_AVANT + 'legacy' + NB_APRES + FICHIER_APRES, 'i'), label: 'legacy' },
  { rx: new RegExp(NB_AVANT + '(?:rétro|retro)-?compat\\w*', 'i'), label: 'rétro-compat' },
  { rx: new RegExp(NB_AVANT + 'backward[- ]?compat\\w*', 'i'), label: 'backward-compat' },
  { rx: new RegExp(NB_AVANT + 'deprecated' + NB_APRES, 'i'), label: 'deprecated' },
  { rx: new RegExp(NB_AVANT + 'déprécié\\w*', 'i'), label: 'déprécié' },
  { rx: new RegExp(NB_AVANT + 'obsol[eè]tes?' + NB_APRES, 'i'), label: 'obsolète' },
  { rx: new RegExp(NB_AVANT + 'shims?' + NB_APRES, 'i'), label: 'shim' },
  // Négation, verbe quelconque, adverbe facultatif, `plus`, `qu`. L'adverbe `pas`/`jamais` fait du
  // COMPARATIF (« ne coûte pas plus que »), autre construction, hors famille. La coupure de ligne ne
  // met pas la locution hors de portée (même `GAP`).
  {
    rx: new RegExp(
      NB_AVANT + '(?:ne' + GAP + '|n' + APOS + ')' + MOT + GAP + '(?:(?!(?:pas|jamais)' + NB_APRES + ')' + MOT + GAP + ')?' +
        'plus' + GAP + 'qu(?:e' + NB_APRES + '|' + APOS + ')',
      'i',
    ),
    label: 'ne … plus que',
  },
  // Adverbe de CHANGEMENT d'état (#1486, #1509).
  { rx: new RegExp(NB_AVANT + 'désormais' + NB_APRES, 'i'), label: 'désormais' },
];

/** Réf de livre : sigle d'`allAbbrAlternation` (`_lib.mjs`, #434) suivi d'un chapitre, d'une ligne,
 *  d'une page ou de `§`. Sa portée est le texte que l'appelant lui passe. */
export const BOOK_REF_RX = new RegExp(
  `\\b(${allAbbrAlternation()})\\b\\s*(\\d+|ch\\.?\\s*\\d+|l\\.\\s*\\d+|p\\.?\\s*\\d+|§)`,
  'i',
);

// EMPLOIS VIVANTS du mot, écartés par le CONTEXTE IMMÉDIAT (jamais par une liste de fichiers) : le
// mot y qualifie autre chose que du code de ce dépôt — une dépendance npm à monter de version, une
// couture de test montée pour Playwright, l'entrée d'une liste de garde sans correspondance. Aucun de
// ces sites ne peut « mourir » : la famille (e) veut des sites qui se soldent, pas des occurrences.
// L'exclusion ne vaut que si elle RECOUVRE le match : le texte que chaque regex cherche est planté en
// littéral dans le test.
/** @type {{ rx: RegExp, label: string }[]} */
export const LEGACY_VOCAB_EXCLUSIONS = [
  { rx: new RegExp('shims?' + GAP + 'DEV', 'gi'), label: 'couture DEV (Playwright)' },
  { rx: new RegExp('obsol[eè]tes?' + GAP + '\\(npm', 'gi'), label: 'dépendance npm à monter de version' },
  { rx: new RegExp('motifs?' + GAP + 'obsol[eè]tes?', 'gi'), label: 'entrée de garde sans correspondance' },
  {
    rx: new RegExp(NB_AVANT + 'n' + APOS + 'est' + GAP + 'plus' + GAP + 'que' + GAP + 'temps' + NB_APRES, 'gi'),
    label: 'locution « il n’est plus que temps »',
  },
  // Une citation n'est VERBATIM que portée par sa réf nue (réf de livre, `BOOK_REF_RX`) ou, pour un
  // arbitrage utilisateur, par sa date — à courte portée derrière le guillemet fermant.
  {
    rx: new RegExp('«[^»]*»' + '[\\s*/,:;.()`—–-]{0,12}' + '(?:' + BOOK_REF_RX.source + '|\\d{4}-\\d{2}-\\d{2})', 'gi'),
    label: 'citation VERBATIM suivie de sa réf',
  },
];

/** Le match `[index, index+len)` est-il RECOUVERT par un emploi vivant ? (frontière stricte : une
 *  exclusion adjacente ne couvre rien)
 * @param {string} text @param {number} index @param {number} len @returns {boolean} */
function emploiVivant(text, index, len) {
  for (const { rx } of LEGACY_VOCAB_EXCLUSIONS) {
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(text))) {
      if (m.index <= index && index + len <= m.index + m[0].length) return true;
      if (m.index === rx.lastIndex) rx.lastIndex++;
    }
  }
  return false;
}

/** @param {string} text @returns {string[]} labels des familles matchées */
export function legacyVocabIn(text) {
  const labels = [];
  for (const f of LEGACY_VOCAB_FAMILIES) {
    const m = f.rx.exec(text);
    if (m && !emploiVivant(text, m.index, m[0].length)) labels.push(f.label);
  }
  return labels;
}

/**
 * Vocabulaire de l'ancien état HORS du stock nominatif daté de #1486 : ce que les PORTES BLOQUANTES
 * (pre-commit, hook au stylo) doivent refuser. Les sites déjà recensés partent avec leur lot ; seul
 * un site NEUF arrête le commit. Le contrat inverse (une entrée de stock sans site = à purger) se
 * juge sur le corpus ENTIER, donc dans la suite Vitest, jamais sur un diff.
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string }[]}
 */
export function scanLegacyVocabHorsStock(relPath, contenu) {
  return scanLegacyVocab(relPath, contenu).filter((f) => {
    const motif = /^\[([^\]]+)\]/.exec(f.detail)?.[1] ?? '';
    return !LEGACY_VOCAB_SITES.some(
      (s) => s.motif === motif && matchesBaselineEntry({ file: relPath, line: f.line, detail: f.detail }, s),
    );
  });
}

/**
 * Scan complet d'un fichier : vocabulaire de l'ancien état dans les commentaires NON tagués.
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string }[]}
 */
export function scanLegacyVocab(relPath, contenu) {
  const findings = [];
  for (const c of extractComments(contenu)) {
    if (ENTERINE_TAG_RX.test(c.text)) continue;
    for (const fam of LEGACY_VOCAB_FAMILIES) {
      const m = fam.rx.exec(c.text);
      if (!m || emploiVivant(c.text, m.index, m[0].length)) continue;
      findings.push({ line: matchLine(c, m.index), detail: `[${fam.label}] ${excerptAt(c, m.index)}` });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------------------------
// Famille 3 — AFFIRMATION-RAW non ancrée (CLAUDE.md règle 6). Un commentaire qui AFFIRME ce que
// le RAW exige/n'exige pas, sans réf de livre ADJACENTE à la thèse, est du poison présumé :
// c'est la classe « bélier » (« RAW ne l'exige pas » — faux, ADE II ch.8 exige l'Équipe)
// — la vérité d'une thèse n'est pas machine-vérifiable, son ANCRAGE l'est. Canal ALERTE (jamais
// bloquant) : la session qui l'écrit doit ouvrir le Source et citer, ou reformuler en réf nue.
// ---------------------------------------------------------------------------------------------

/** @type {{ rx: RegExp, label: string }[]} */
export const RAW_CLAIM_FAMILIES = [
  { rx: /\bRAW\s+ne\s+(?:l['']\s?)?\w*\s?\w*(exige|demande|impose|précise|prévoit|couvre|définit|mentionne|chiffre|tranche|marque)\w*\s+(pas|rien|jamais)/i, label: 'RAW ne … pas' },
  { rx: /\b(pas|non|jamais)\s+(exigée?s?|demandée?s?|imposée?s?|prévue?s?|définie?s?|couverte?s?)\s+par\s+le\s+RAW/i, label: 'pas … par le RAW' },
  { rx: /\ble\s+(RAW|livre|Source)\s+n[e'']\s?\w*\s?\w*\s+(pas|rien|jamais)/i, label: 'le RAW/livre ne … pas' },
  { rx: /\bRAW\s+(est\s+)?(muet|silencieux)/i, label: 'RAW muet' },
  { rx: /\b(hors[- ]RAW|non[- ]RAW|pas\s+RAW)\b/i, label: 'hors-RAW nu' },
  { rx: /(laissée?s? au MJ|au choix du MJ|le MJ (décide|tranche|arbitre))/i, label: 'renvoi au MJ' },
];

// ---------------------------------------------------------------------------------------------
// Famille 4 — REVENDICATION D'AUTORITÉ non tracée (credo : « un commentaire-excuse n'est pas une
// autorisation », house-rule = paramétrable/taguée). Une revendication de ce type, sans TRACE de
// validation, est la justification fallacieuse qui habille une implémentation (classe « servir coûte
// l'Action », sœur de la classe « bélier »).
// SEULE trace reconnue (décision utilisateur 2026-07-07 : « je n'accepte aucune justification sans
// la mention explicite [entériné] ») : le tag [entériné AAAA-MM-JJ] — dont l'écriture est elle-même
// gardée par enterine-guard.mjs (dialogue de validation utilisateur). Date, citation, ancrage canon
// ne suffisent PAS : ils datent ou attribuent la décision, ils ne prouvent pas sa validation.
// ---------------------------------------------------------------------------------------------

/** @type {{ rx: RegExp, label: string }[]} */
export const DECISION_CLAIM_FAMILIES = [
  { rx: /\barbitrages?\s+(maison|de design|de modèle|assumée?s?|explicite|utilisateur)/i, label: 'arbitrage X' },
  { rx: /\b(notre|mon)\s+arbitrage/i, label: 'notre arbitrage' },
  { rx: /\bchoix\s+(maison|de design|de modèle|assumée?s?)/i, label: 'choix X' },
  { rx: /\b(décision|parti[- ]pris)\s+(assumée?s?|maison|de design)/i, label: 'décision/parti-pris' },
  { rx: /\bon\s+(a|avait)\s+(choisi|décidé|tranché)/i, label: 'on a décidé' },
];
export const DECISION_TRACE_RX = ENTERINE_TAG_RX;

/**
 * Scan complet d'un fichier : revendications d'autorité SANS trace de validation adjacente.
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string }[]}
 */
export function scanDecisionClaims(relPath, contenu) {
  const findings = [];
  for (const c of extractComments(contenu)) {
    for (const fam of DECISION_CLAIM_FAMILIES) {
      const m = fam.rx.exec(c.text);
      if (!m) continue;
      const window = c.text.slice(Math.max(0, m.index - 150), m.index + m[0].length + 150);
      if (DECISION_TRACE_RX.test(window)) continue;
      findings.push({ line: matchLine(c, m.index), detail: `[${fam.label}] ${excerptAt(c, m.index)}` });
    }
  }
  return findings;
}

/**
 * Scan complet d'un fichier : affirmations sur le RAW SANS réf de livre ADJACENTE à la thèse.
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string }[]}
 */
export function scanRawClaims(relPath, contenu) {
  const findings = [];
  for (const c of extractComments(contenu)) {
    for (const fam of RAW_CLAIM_FAMILIES) {
      const m = fam.rx.exec(c.text);
      if (!m) continue;
      // Ancrage de PROXIMITÉ : une réf de livre ADJACENTE à la thèse (±120 caractères) la rend
      // matériellement vérifiable. Le bloc ENTIER ne suffit pas : une réf citée ailleurs dans le bloc
      // laisse la thèse non sourcée.
      const window = c.text.slice(Math.max(0, m.index - 120), m.index + m[0].length + 120);
      if (BOOK_REF_RX.test(window)) continue;
      findings.push({ line: matchLine(c, m.index), detail: `[${fam.label}] ${excerptAt(c, m.index)}` });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------------------------
// BASELINE NOMINATIVE du canal ALERTE (familles 3 et 4). Un signal non bloquant qui revient à
// chaque commit finit par ne plus être lu : la baseline range les sites DÉJÀ tranchés sous une
// rubrique compacte, pour que la ligne NOUVELLE saute aux yeux. Elle nomme le site par
// FICHIER + ANCRE de texte (jamais un numéro de ligne, qui dérive au premier commit voisin), et
// porte sa raison + sa date — données dans `decisions-baseline.json`, mécanique ici.
// Contrepartie : une entrée qui ne matche plus rien dans un fichier SCANNÉ est signalée comme
// périmée, et se purge (les listes décroissent).
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {{ fichier: string, motif: string, ancre: string, raison: string, date: string }} BaselineEntry
 * @typedef {{ file: string, line: number, detail: string }} PlacedFinding
 */

export const DECISIONS_BASELINE_PATH = fileURLToPath(new URL('./decisions-baseline.json', import.meta.url));

/** Charge la baseline nominative. Fichier absent ou illisible → liste vide (le détecteur imprime
 *  alors tout en NOUVEAU : la perte de la baseline ne masque jamais un signal).
 * @param {string} [path] @returns {BaselineEntry[]} */
export function loadDecisionsBaseline(path = DECISIONS_BASELINE_PATH) {
  try {
    const doc = JSON.parse(readFileSync(path, 'utf8'));
    return Array.isArray(doc?.sites) ? doc.sites : [];
  } catch {
    return [];
  }
}

const normPath = (/** @type {string} */ p) => String(p).replace(/\\/g, '/');
/** Comparaison de texte insensible à la casse et aux blancs de continuation de commentaire
 *  (`*`/`//` en tête de ligne d'un bloc). L'ancre se recopie VERBATIM depuis le commentaire visé :
 *  ses accents comptent, seule la mise en page varie. */
const normText = (/** @type {string} */ s) =>
  String(s)
    .replace(/[\s*/]+/g, ' ')
    .toLowerCase()
    .trim();

/** Le signal `finding` est-il le site déclaré par `entry` ? (même fichier + ancre présente)
 * @param {PlacedFinding} finding @param {BaselineEntry} entry @returns {boolean} */
export function matchesBaselineEntry(finding, entry) {
  if (!entry?.ancre) return false;
  return normPath(finding.file) === normPath(entry.fichier) && normText(finding.detail).includes(normText(entry.ancre));
}

/**
 * Range les signaux en NOUVEAUX / connus (baseline), et relève les entrées de baseline périmées.
 * La péremption ne se juge que sur les fichiers RÉELLEMENT scannés (`scannedFiles`) : un hook
 * diff-scopé ne voit qu'une poignée de fichiers, il ne peut pas conclure qu'un site absent de son
 * diff a disparu du dépôt.
 * @param {PlacedFinding[]} findings
 * @param {BaselineEntry[]} baseline
 * @param {Iterable<string>} [scannedFiles] défaut : les fichiers portant au moins un signal
 * @returns {{ nouveaux: PlacedFinding[], connus: { finding: PlacedFinding, entry: BaselineEntry }[], perimees: BaselineEntry[] }}
 */
export function partitionBaseline(findings, baseline, scannedFiles) {
  /** @type {PlacedFinding[]} */ const nouveaux = [];
  /** @type {{ finding: PlacedFinding, entry: BaselineEntry }[]} */ const connus = [];
  const touchees = new Set();
  for (const f of findings) {
    const i = baseline.findIndex((e) => matchesBaselineEntry(f, e));
    if (i < 0) nouveaux.push(f);
    else {
      touchees.add(i);
      connus.push({ finding: f, entry: baseline[i] });
    }
  }
  const scanned = new Set([...(scannedFiles ?? findings.map((f) => f.file))].map(normPath));
  const perimees = baseline.filter((e, i) => !touchees.has(i) && scanned.has(normPath(e.fichier)));
  return { nouveaux, connus, perimees };
}

/**
 * Rendu texte du verdict : NOUVEAU en tête (la ligne à lire), BASELINE compacte ensuite (une ligne
 * par site), péremptions en dernier. Aucune section vide n'est imprimée ; liste vide = rien à dire.
 * @param {{ nouveaux: PlacedFinding[], connus: { finding: PlacedFinding, entry: BaselineEntry }[], perimees: BaselineEntry[] }} verdict
 * @returns {string[]} lignes prêtes à écrire
 */
export function formatBaselineReport({ nouveaux, connus, perimees }) {
  const out = [];
  if (nouveaux.length) {
    out.push(`NOUVEAU : ${nouveaux.length} signal(aux) hors baseline — traiter ou justifier :`);
    for (const f of nouveaux) out.push(`  ${f.file}:${f.line} ${f.detail}`);
  }
  if (connus.length) {
    out.push(`BASELINE (intentionnel) : ${connus.length} site(s)`);
    const vus = new Set();
    for (const { entry } of connus) {
      const cle = `${entry.fichier}|${entry.motif}`;
      if (vus.has(cle)) continue;
      vus.add(cle);
      out.push(`  ${entry.fichier} — ${entry.motif} (${entry.date}) : ${entry.raison}`);
    }
  }
  for (const e of perimees) out.push(`baseline périmée — purger l'entrée : ${e.fichier} — ${e.motif} (${e.date})`);
  return out;
}
