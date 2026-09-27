/**
 * VOCABULAIRE des bindings VIVANTS (#1692) — un binding vivant est la collection de la RACINE VIVANTE
 * qu'une clé de dataset désigne (`racines-vivantes.test.ts`) —, dérivé du SEAM lui-même (`src/data/overrides.ts`), jamais
 * une liste tenue à la main : les blocs `const ARRAYS = { … }` et `const OBJECTS = { … }` sont la
 * déclaration UNIQUE des datasets mutés en place, et ils donnent les deux choses dont une garde a besoin — la CLÉ de dataset (celle que
 * `versionDuDataset` connaît) et le NOM du binding exporté que les modules importent.
 *
 * Sert aux deux gardes structurelles :
 *  - « aucun index figé au niveau module sur un dataset mutable » (`index-vivant-guard.test.ts`) ;
 *  - « aucune écriture hors du seam » (`seam-ecriture-guard.test.ts`).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, posix } from 'node:path';
import ts from 'typescript';
import { listerArbre } from './lister.mjs';
import { scriptKindDe } from './dialecte.mjs';
import { estFichierVitest } from './fichierVitest.mjs';

export const RACINE = fileURLToPath(new URL('../../../', import.meta.url));

/** Retire commentaires de ligne et de bloc (jamais les chaînes : on ne lit que des déclarations).
 *  UNE alternance, gauche-droite : le motif le plus à gauche gagne, donc un `//` consomme sa ligne
 *  entière, ouverture de bloc comprise : un chemin à joker cité dans un commentaire de ligne
 *  n'ouvre aucun bloc, donc n'efface pas la source jusqu'au prochain fermant.
 *
 *  COUVERTURE, dite : ce balayage ne connaît pas les LITTÉRAUX DE REGEX. Une regex qui contient une
 *  barre échappée suivie d'une étoile y OUVRE un bloc de commentaire, et efface la source jusqu'au
 *  prochain fermant de bloc — mesuré sous `src/` aujourd'hui : 0 site réel, les 4 ouvertures de bloc
 *  hors commentaire étant toutes des annotations de pureté `@__PURE__`. */
export function sansCommentaires(src) {
  return src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
}

/** Le corps du littéral `const <nom> = { … }` d'un module (accolades équilibrées). */
function corpsDuLitteral(src, nom) {
  const debut = src.indexOf(`const ${nom} = {`);
  if (debut < 0) throw new Error(`bindingsVivants : \`const ${nom} = {\` introuvable dans overrides.ts`);
  const i = src.indexOf('{', debut);
  let profondeur = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') profondeur++;
    else if (src[j] === '}') {
      profondeur--;
      if (profondeur === 0) return src.slice(i + 1, j);
    }
  }
  throw new Error(`bindingsVivants : littéral \`${nom}\` non refermé`);
}

/** Découpe un corps de littéral en entrées, aux virgules de PROFONDEUR 0. */
function entrees(corps) {
  const out = [];
  let profondeur = 0, courant = '';
  for (const c of corps) {
    if ('([{'.includes(c)) profondeur++;
    else if (')]}'.includes(c)) profondeur--;
    if (c === ',' && profondeur === 0) { out.push(courant); courant = ''; continue; }
    courant += c;
  }
  out.push(courant);
  return out.map((e) => e.trim()).filter(Boolean);
}

/**
 * Le NOM SURVEILLÉ d'une entrée `clé: valeur` du littéral `ARRAYS`, selon la FORME de sa valeur :
 *  - IDENTIFIANT NU (`axes: allAxes`, `obsessions: OBSESSIONS as unknown as …`) → cet identifiant,
 *    c'est lui que les modules importent ;
 *  - MEMBRE (`shipHullSizes: shipConstruction.standard`) → l'objet PORTEUR, vivant et importable ;
 *  - APPEL (`miscastMinor: miscastEntries('miscast-mineure')`) → la CLÉ. Aucun binding n'existe sous
 *    le nom de la fabrique : la retenir posait un nom FANTÔME que personne n'importe, pendant que le
 *    nom réellement exporté du dataset (`miscastMinor`) sortait du vocabulaire des deux gardes.
 */
function bindingSurveille(cle, valeur) {
  const nu = valeur.match(/^([A-Za-z_$][\w$]*)\s*(?:!)?\s*(?:as\s[\s\S]*)?$/);
  if (nu) return nu[1];
  const membre = valeur.match(/^([A-Za-z_$][\w$]*)\s*[.[]/);
  return membre ? membre[1] : cle;
}

/** Les entrées du littéral `litteral` du seam (`ARRAYS`, `OBJECTS`) : `[clé de dataset, nom du
 *  binding]`. Un même binding peut porter PLUSIEURS clés (`shipConstruction.standard`/`.speedTraits`…) :
 *  la liste les garde toutes, l'index par binding n'en retient qu'une (il ne sert qu'à NOMMER le
 *  fautif). */
function entreesDuSeam(litteral) {
  const src = sansCommentaires(readFileSync(join(RACINE, 'src/data/overrides.ts'), 'utf8'));
  const out = [];
  for (const e of entrees(corpsDuLitteral(src, litteral))) {
    const avecCle = e.match(/^([A-Za-z_$][\w$]*)\s*:\s*([\s\S]+)$/);
    if (avecCle) { out.push([avecCle[1], bindingSurveille(avecCle[1], avecCle[2].trim())]); continue; }
    const seul = e.match(/^([A-Za-z_$][\w$]*)$/);
    if (seul) out.push([seul[1], seul[1]]);
  }
  if (out.length < (litteral === 'ARRAYS' ? 100 : 10)) throw new Error(`bindingsVivants : ${out.length} entrées lues, le littéral ${litteral} a changé de forme`);
  return out;
}

/** Les CLÉS de dataset-tableau déclarées par le seam — doit être exactement `DATASET_KEYS`. */
export function clesDuSeam() {
  return entreesDuSeam('ARRAYS').map(([cle]) => cle);
}

/** Nom du binding VIVANT → clé de dataset, pour tout dataset du seam, tableau (`ARRAYS`) ou objet
 *  (`OBJECTS`). */
export function bindingsVivants() {
  const parBinding = new Map();
  for (const [cle, binding] of [...entreesDuSeam('ARRAYS'), ...entreesDuSeam('OBJECTS')]) if (!parBinding.has(binding)) parBinding.set(binding, cle);
  return parBinding;
}

/** Les DOCUMENTS qui portent une clé de dataset, en chemins relatifs à la racine du dépôt : les imports
 *  du module généré `src/data/schemas/_racines-vivantes.generated.ts` (`scripts/gen-espaces.mts`, un
 *  import par document de l'image de `DATASET_FICHIER_DERIVE`), résolus depuis son dossier. */
let _documents = null;
const MODULE_DES_RACINES = 'src/data/schemas/_racines-vivantes.generated.ts';
export function documentsDesRacinesVivantes() {
  if (_documents) return _documents;
  const src = readFileSync(join(RACINE, MODULE_DES_RACINES), 'utf8');
  const out = new Set();
  for (const m of src.matchAll(/^import\s+r\d+\s+from\s+'([^']+\.json)';$/gm)) out.add(posix.join(posix.dirname(MODULE_DES_RACINES), m[1]));
  if (out.size < 100) throw new Error(`documentsDesRacinesVivantes : ${out.size} documents lus, ${MODULE_DES_RACINES} a changé de forme`);
  _documents = out;
  return out;
}

/** Les noms LOCAUX d'un fichier qui désignent un binding vivant — un nom IMPORTÉ, éventuellement renommé
 *  (`import { props as propsData }`), ou EXPORTÉ par le module propriétaire du dataset lui-même
 *  (`export const MOUNT_PROFILES`). Un homonyme local non exporté (`const props = []` dans une scène)
 *  n'est PAS le dataset : le vocabulaire ne le retient pas.
 *
 *  S'y ajoutent les deux formes par lesquelles un module ATTEINT son dataset sans jamais nommer le
 *  seam :
 *   - l'IMPORT JSON DIRECT (`import vehiclesJson from '../data/vehicles.json'`) d'un document qui porte
 *     une clé de dataset (`documentsDesRacinesVivantes`) — le document importé EST la racine vivante
 *     que le seam mute, quel que soit le nom de sa clé (`miscast.json` porte `miscastMinor`…). Le nom
 *     local désigne alors le DOCUMENT (`'vehicles.json'`), jamais une clé devinée du nom de fichier ;
 *   - l'ALIAS NU de niveau module (`const VEHICLES_LIST = vehiclesJson as VehicleData[]`,
 *     `export const IMPERIAL_MONTHS: ImperialMonth[] = calendarMonths`) — il ne copie rien, il donne
 *     un second nom au MÊME tableau vivant. Le nom dérivé hérite du dataset (même contamination par nom
 *     que celle d'`indexFiges`), et les chaînes d'alias suivent, les déclarations étant en ordre. */
export function nomsVivantsDuFichier(chemin, src, parBinding) {
  const noms = new Map();
  for (const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"][^'"]+['"]/g)) {
    for (const spec of m[1].split(',')) {
      const [source, alias] = spec.trim().split(/\s+as\s+/).map((x) => x.trim());
      if (parBinding.has(source)) noms.set(alias || source, parBinding.get(source));
    }
  }
  const documents = documentsDesRacinesVivantes();
  for (const m of src.matchAll(/import\s+([A-Za-z_$][\w$]*)\s+from\s*['"](\.{1,2}\/[^'"]+\.json)['"]/g)) {
    const cible = posix.join(posix.dirname(chemin), m[2]);
    if (documents.has(cible)) noms.set(m[1], posix.basename(cible));
  }
  for (const [binding, cle] of parBinding) {
    if (new RegExp(`^export (const|let|var) ${binding}\\b`, 'm').test(src)) noms.set(binding, cle);
  }
  for (const decl of declarationsDeNiveauModule(src)) {
    // La règle porte sur la DÉCLARATION ENTIÈRE, blancs REPLIÉS : un alias coupé en plusieurs lignes
    // (`const LISTE:\n  VehicleData[] = vehiclesJson as VehicleData[];`) est le même alias. La regex est
    // ANCRÉE aux deux bouts et ses parties libres sont bornées : sur une déclaration-monstre (littéral
    // de milliers de caractères) elle échoue sans backtracking.
    const texte = decl.texte.replace(/\s+/g, ' ').trim();
    const m = texte.match(/^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)(?:\s*:\s*[^=]{0,200})?\s*=\s*([A-Za-z_$][\w$]*)\s*!?\s*(?:as\s+[^;]{0,200})?;?\s*$/);
    if (m && noms.has(m[2]) && !noms.has(m[1])) noms.set(m[1], noms.get(m[2]));
  }
  return noms;
}

/** Les ALIAS d'un import NAMESPACE (`import * as D from '../data'`) : `D.traits` désigne le dataset
 *  aussi sûrement qu'un import nommé, et aucun `(?<![.\w])traits` ne le verrait. */
export function espacesDeNomsDuFichier(src) {
  return [...src.matchAll(/import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s*['"][^'"]+['"]/g)].map((m) => m[1]);
}

/** Les ACCESSEURS VIVANTS du dépôt : tout `const <nom> = memoParVersion|indexParId|indexParChamp(…)`
 *  déclaré sous `src/`. Les APPELER au niveau module (`const ENGINS = siegeEngines().filter(…)`)
 *  re-fige exactement ce que l'accesseur vient de dévier : la valeur rendue est celle de la version
 *  courante, capturée une fois pour toute la vie du module. Vocabulaire DÉRIVÉ, jamais recopié. */
let _accesseurs = null;
export function accesseursVivants() {
  if (_accesseurs) return _accesseurs;
  const out = new Set();
  for (const chemin of fichiersSources()) {
    const src = sansCommentaires(readFileSync(join(RACINE, chemin), 'utf8'));
    for (const m of src.matchAll(/(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:memoParVersion|indexParId|indexParChamp)\s*\(/g)) {
      out.add(m[1]);
    }
  }
  _accesseurs = out;
  return out;
}

/** Les noms LOCAUX d'un fichier qui désignent un ACCESSEUR VIVANT — importé (éventuellement renommé) ou
 *  déclaré sur place. Même règle que `nomsVivantsDuFichier` : un homonyme local non vivant n'y entre pas. */
export function accesseursDuFichier(src, vivants) {
  const noms = new Set();
  for (const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"][^'"]+['"]/g)) {
    for (const spec of m[1].split(',')) {
      const [source, alias] = spec.trim().split(/\s+as\s+/).map((x) => x.trim());
      if (vivants.has(source)) noms.add(alias || source);
    }
  }
  for (const m of src.matchAll(/(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:memoParVersion|indexParId|indexParChamp)\s*\(/g)) {
    noms.add(m[1]);
  }
  return noms;
}

/** Les DÉCLARATIONS de niveau module d'un source TS : `[const|let|var] … ;`, texte complet, hors
 *  toute fonction/classe/bloc (profondeur d'accolades 0 au moment de la déclaration). S'y ajoutent
 *  les trois autres formes qui s'ÉVALUENT tout autant à l'import et qu'aucun `const` ne porte :
 *  `export default <expr>;`, l'AFFECTATION NUE (`M = new Map(…)`, sur un `let` déclaré plus haut) et
 *  la BOUCLE de niveau module. Chaînes, gabarits, regex et commentaires sont traversés sans compter
 *  leurs délimiteurs. */
export function declarationsDeNiveauModule(src) {
  const out = [];
  let i = 0, profondeur = 0;
  const ligneDe = (pos) => src.slice(0, pos).split('\n').length;
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
    // Ouverture de bloc JAMAIS refermée (il en naît dans un littéral de regex, que ce balayage ne
    // connaît pas) : le curseur saute à la FIN, jamais à `indexOf` −1 — il avance toujours.
    if (c === '/' && src[i + 1] === '*') { const f = src.indexOf('*/', i); i = f < 0 ? src.length : f + 2; continue; }
    if (c === "'" || c === '"' || c === '`') { i = Math.max(finDeChaine(src, i), i + 1); continue; }
    if (c === '{') { profondeur++; i++; continue; }
    if (c === '}') { profondeur--; i++; continue; }
    if (profondeur === 0 && (i === 0 || /[\s;})]/.test(src[i - 1]))) {
      const reste = src.slice(i);
      if (/^(export\s+)?(const|let|var)\s+[A-Za-z_$]/.test(reste) || /^(export\s+)?(const|let|var)\s*[[{]/.test(reste)) {
        const fin = finDeDeclaration(src, i);
        out.push({ ligne: ligneDe(i), texte: src.slice(i, fin) });
        i = Math.max(fin, i + 1); // le curseur avance toujours, même sur une fin calculée ≤ i
        continue;
      }
      // `export default new Map(traits.map(…))` : aucun `const` ne le porte, et il s'évalue à l'import.
      if (/^export\s+default\b/.test(reste)) {
        const fin = finDeDeclaration(src, i);
        out.push({ ligne: ligneDe(i), texte: src.slice(i, fin) });
        i = Math.max(fin, i + 1); // le curseur avance toujours, même sur une fin calculée ≤ i
        continue;
      }
      // AFFECTATION NUE de module (`let M; … M = new Map(traits.map(…));`) : la déclaration `let M;`
      // est innocente, c'est l'affectation qui fige. `a === b`, `a =>` et `a += …` n'en sont pas.
      if (/^[A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*\s*=(?![=>])/.test(reste)) {
        const fin = finDeDeclaration(src, i);
        out.push({ ligne: ligneDe(i), texte: src.slice(i, fin) });
        i = Math.max(fin, i + 1); // le curseur avance toujours, même sur une fin calculée ≤ i
        continue;
      }
      // Une BOUCLE de niveau module remplit son index à l'import tout autant qu'un `new Map(…)` :
      // `const m = new Map(); for (const t of traits) m.set(t.id, t);` sert l'ancien monde pareil.
      if (/^(for|while)\s*\(/.test(reste)) {
        const fin = finDeBoucle(src, i);
        out.push({ ligne: ligneDe(i), texte: src.slice(i, fin), boucle: true });
        i = Math.max(fin, i + 1); // le curseur avance toujours, même sur une fin calculée ≤ i
        continue;
      }
    }
    i++;
  }
  return out;
}

/** Fin d'une boucle de niveau module : sa parenthèse refermée, puis son bloc `{…}` (ou son unique
 *  instruction jusqu'au `;`). */
function finDeBoucle(src, i) {
  let j = src.indexOf('(', i), profondeur = 0;
  for (; j < src.length; j++) {
    if (src[j] === '(') profondeur++;
    else if (src[j] === ')') { profondeur--; if (profondeur === 0) { j++; break; } }
  }
  while (j < src.length && /\s/.test(src[j])) j++;
  if (src[j] !== '{') return finDeDeclaration(src, j);
  profondeur = 0;
  for (; j < src.length; j++) {
    if (src[j] === '{') profondeur++;
    else if (src[j] === '}') { profondeur--; if (profondeur === 0) return j + 1; }
  }
  return src.length;
}

function finDeChaine(src, i) {
  const q = src[i];
  for (let j = i + 1; j < src.length; j++) {
    if (src[j] === '\\') { j++; continue; }
    if (src[j] === q) return j + 1;
  }
  return src.length;
}

/** Fin d'une déclaration de niveau module : le `;` ou le saut de ligne atteint à profondeur 0. */
function finDeDeclaration(src, i) {
  let profondeur = 0;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    // Délimiteur JAMAIS refermé (un `//` ou une ouverture de bloc née dans un littéral de regex, que
    // ce balayage ne connaît pas) : on rend la fin du source, jamais un curseur en arrière.
    if (c === '/' && src[j + 1] === '/') { const f = src.indexOf('\n', j); if (f < 0) return src.length; j = f - 1; continue; }
    if (c === '/' && src[j + 1] === '*') { const f = src.indexOf('*/', j); if (f < 0) return src.length; j = f + 1; continue; }
    if (c === "'" || c === '"' || c === '`') { j = Math.max(finDeChaine(src, j) - 1, j); continue; }
    if ('([{'.includes(c)) profondeur++;
    else if (')]}'.includes(c)) profondeur--;
    else if (c === ';' && profondeur === 0) return j + 1;
    if (profondeur < 0) return j;
  }
  return src.length;
}

const PRIMITIVES_VIVANTES = /\b(indexParId|indexParChamp|memoParVersion)\s*\(/;
/** Toute méthode qui rend une valeur DÉRIVÉE du contenu : l'APPELER au niveau module fige ce contenu,
 *  qu'on en fasse une `Map` (index) ou un tableau (vue). Les deux ont le même défaut de fond. La
 *  parenthèse d'APPEL fait partie du motif : `FILE.entries` (champ d'un document JSON) n'est pas
 *  `arr.entries()` — sans elle, tout CHAMP homonyme d'une méthode de tableau passait pour une lecture. */
const RECEVEUR = '(map|filter|flatMap|flat|reduce|reduceRight|slice|concat|find|findIndex|findLast|findLastIndex|some|every|sort|reverse|toSorted|toReversed|toSpliced|with|join|forEach|keys|values|entries|at)';

/** Les ENVELOPPES : les dérivations qui prennent le dataset EN ARGUMENT au lieu de l'appeler comme
 *  receveur. `new Set(traits)`, `Array.from(traits)`, `Object.keys(record)` figent le contenu tout
 *  autant qu'un `.map(…)`, et aucun motif de receveur ne les voit — le nom y est à droite de la
 *  parenthèse. `.includes(…)` n'en est pas une : elle rend un booléen, pas une structure. */
const enveloppes = (expr) => [
  `(?<![.\\w])new\\s+(?:Set|Map|WeakSet|WeakMap)\\s*\\(\\s*${expr}\\s*[,)]`,
  `(?<![.\\w])Array\\s*\\.\\s*from\\s*\\(\\s*${expr}\\s*[,)]`,
  `(?<![.\\w])Object\\s*\\.\\s*(?:keys|values|entries)\\s*\\(\\s*${expr}\\s*\\)`,
];
const MUTATEURS = 'push|splice|pop|shift|unshift|sort|reverse|fill|copyWithin';

/** Le VOCABULAIRE d'un fichier : chaque motif désigne une LECTURE du contenu d'un dataset du seam —
 *  binding importé/exporté (`traits.filter`), espace de noms (`D.traits.map`), accès par la clé
 *  (`datasetArray('traits').map`), et `for (const t of traits)`. */
function motifsDeLecture(noms, espaces, parBinding, accesseurs = new Set()) {
  const out = [];
  for (const nom of noms.keys()) {
    out.push([nom, `(?<![.\\w])${nom}\\s*\\.\\s*${RECEVEUR}\\s*\\(`]);
    // Le CAST PARENTHÉSÉ (`(traumasJson as TraumaFiche[]).find(…)`) : la lecture est la même, mais le
    // `as` s'interpose entre le nom et sa méthode — sans ce motif, l'annotation lave le dataset.
    out.push([nom, `\\(\\s*${nom}\\s+as\\s[^)]*\\)\\s*\\.\\s*${RECEVEUR}\\s*\\(`]);
    out.push([nom, `(?<![.\\w])for\\s*\\([^)]*\\bof\\s+${nom}\\s*\\)`]);
    out.push([nom, `\\[\\s*\\.\\.\\.\\s*${nom}\\s*[,\\]]`]);
    out.push([nom, `(?<![.\\w])${nom}\\s*(?:\\[|\\.\\s*length\\b)`]);
    // DÉSTRUCTURATION (`const [premier] = traits`, `const { length } = creatures`) : elle extrait le
    // contenu sans nommer aucune méthode ni aucun indice — l'élément capturé est figé comme un index.
    out.push([nom, `^\\s*(?:export\\s+)?(?:const|let|var)?\\s*[\\[{][^=;]*[\\]}]\\s*=\\s*${nom}(?![\\w$(])`]);
    for (const m of enveloppes(nom)) out.push([nom, m]);
  }
  // ACCESSEUR VIVANT RE-FIGÉ : `const ENGINS = siegeEngines().filter(…)`, `new Map(oupsTable().map(…))`.
  // L'appel au niveau module capture la valeur de la version COURANTE — la dévie de l'accesseur ne
  // change rien, le module servira cette valeur-là jusqu'au rechargement.
  for (const nom of accesseurs) out.push([`${nom}()`, `(?<![.\\w])${nom}\\s*\\(\\s*\\)`]);
  // Le MEMBRE d'un espace de noms et l'accès par la CLÉ s'enveloppent aussi bien qu'un binding nommé.
  const parLaCle = `datasetArray\\s*\\(\\s*['"][\\w$-]+['"]\\s*\\)(?:\\s+as\\s[^;=)]*)?`;
  for (const m of enveloppes(parLaCle)) out.push(['datasetArray(…)', m]);
  // `import * as D` ne nomme rien : c'est le MEMBRE qui désigne le dataset — tout le vocabulaire du
  // seam est donc candidat derrière un espace de noms, pas seulement ce que le fichier importe.
  for (const espace of espaces) {
    for (const binding of parBinding.keys()) {
      out.push([`${espace}.${binding}`, `(?<![.\\w])${espace}\\s*\\.\\s*${binding}\\s*(?:\\.\\s*${RECEVEUR}\\s*\\(|\\[|\\.\\s*length\\b)`]);
      for (const m of enveloppes(`${espace}\\s*\\.\\s*${binding}`)) out.push([`${espace}.${binding}`, m]);
    }
  }
  out.push(['datasetArray(…)', `datasetArray\\s*\\(\\s*['"][\\w$-]+['"]\\s*\\)\\s*(?:as\\s[^;=]*?)?\\.\\s*${RECEVEUR}\\s*\\(`]);
  return out;
}

/** Les ouvertures de CORPS DE FONCTION dans une déclaration : flèche, `function`, accesseur
 *  (`get x() {`) et méthode abrégée (`pool(): T {`) — un `if (…) {` n'en est pas une. */
const FRONTIERES_DE_CORPS = /=>|\bfunction\b|\b(?:get|set)\s+[A-Za-z_$][\w$]*\s*\(|(?<!\b(?:if|for|while|switch|catch|return)\s*)\b[A-Za-z_$][\w$]*\s*\([^()]*\)\s*(?::[^{;()]*)?\{/;

/** L'IIFE de module (`const M = (() => new Map(traits.map(…)))();`, `(function () {…})()`) : son corps
 *  N'EST PAS un abri — il s'exécute à l'import comme le reste de la déclaration. Reconnue par ses deux
 *  bouts : une parenthèse ouvrante qui enveloppe une flèche/`function` juste après le `=`, et l'appel
 *  `()` qui referme le déclarateur. */
const EST_IIFE = (texte) => /=\s*\(\s*(?:async\s+)?(?:function\b|\()/.test(texte) && /\)\s*\(\s*\)\s*;?\s*$/.test(texte.trim());

/** Une lecture est ÉVALUÉE À L'IMPORT si aucune frontière de corps ne la précède DANS son déclarateur :
 *  après l'une d'elles, elle vit dans un corps, donc à chaque APPEL (lecture vivante) — sauf si ce corps
 *  est celui d'une IIFE, appelée sur place. */
function positionVivante(texte, index) {
  if (EST_IIFE(texte)) return false;
  return FRONTIERES_DE_CORPS.test(texte.slice(0, index));
}

/** Les DÉCLARATEURS SŒURS d'une déclaration, aux virgules de PROFONDEUR 0 (`const a = () => x, B = …`
 *  en porte deux) : sans cette découpe, la flèche du PREMIER servirait d'abri au second. */
function declarateurs(texte) {
  const out = [];
  let profondeur = 0, debut = 0;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    // Commentaires TRAVERSÉS : une parenthèse de prose (« // 1) Espèces ») déséquilibrerait le
    // compteur et couperait le déclarateur en deux, ce qui rend vivant ce qui ne l'est pas.
    if (c === '/' && texte[i + 1] === '/') { const f = texte.indexOf('\n', i); if (f < 0) break; i = f; continue; }
    if (c === '/' && texte[i + 1] === '*') { const f = texte.indexOf('*/', i); if (f < 0) break; i = f + 1; continue; }
    if (c === "'" || c === '"' || c === '`') { i = finDeChaine(texte, i) - 1; continue; }
    if ('([{'.includes(c)) profondeur++;
    else if (')]}'.includes(c)) profondeur--;
    else if (c === ',' && profondeur === 0) { out.push(texte.slice(debut, i)); debut = i + 1; }
  }
  out.push(texte.slice(debut));
  return out;
}

/** Les VALEURS FIGÉES d'un source : index (`new Map(traits.map(…))`) ET vues dérivées
 *  (`const armes = trappings.filter(…)`) bâtis au niveau module sur un dataset du seam OU sur le
 *  retour d'un ACCESSEUR VIVANT appelé là (`siegeEngines().filter(…)`), sans passer par les primitives
 *  vivantes. Une valeur figée SERT L'ANCIEN MONDE après une édition au Codex.
 *  Le nom qu'une déclaration fautive DÉCLARE rejoint le vocabulaire : l'index bâti ensuite sur cette
 *  vue (`new Map(armes.map(…))`) est nommé lui aussi. Rend des lignes `fichier:ligne — …`. */
export function indexFiges(chemin, src, parBinding, vivants = accesseursVivants()) {
  const noms = nomsVivantsDuFichier(chemin, src, parBinding);
  const espaces = espacesDeNomsDuFichier(src);
  const accesseurs = accesseursDuFichier(src, vivants);
  if (!noms.size && !espaces.length && !accesseurs.size && !src.includes('datasetArray')) return [];
  const out = [];
  // Motifs COMPILÉS une fois, refaits seulement quand le vocabulaire grandit (contamination par nom
  // dérivé) : les recompiler à chaque déclaration coûtait |déclarations| × |motifs| regex par fichier.
  let motifs = motifsDeLecture(noms, espaces, parBinding, accesseurs).map(([nom, m]) => [nom, new RegExp(m)]);
  for (const decl of declarationsDeNiveauModule(src)) {
    if (PRIMITIVES_VIVANTES.test(decl.texte)) continue;
    const morceaux = decl.boucle ? [decl.texte] : declarateurs(decl.texte);
    let vu = false;
    for (const [nom, rx] of motifs) {
      for (const morceau of morceaux) {
        const m = morceau.match(rx);
        if (!m || (!decl.boucle && positionVivante(morceau, m.index))) continue;
        out.push(`${chemin}:${decl.ligne} — valeur figée à l’import sur la source vivante « ${nom} » : ${decl.texte.split('\n')[0].trim()}`);
        const declare = decl.texte.match(/^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)/);
        if (declare && !noms.has(declare[1])) {
          noms.set(declare[1], nom);
          motifs = motifsDeLecture(noms, espaces, parBinding, accesseurs).map(([n, x]) => [n, new RegExp(x)]);
        }
        vu = true;
        break;
      }
      if (vu) break;
    }
  }
  return out;
}

/** Les TROIS FORMES sous lesquelles `src/data` EXPORTE un résolveur, mesurées sur son source : la
 *  fonction qui rend un accesseur, l'ALIAS NU de l'accesseur, et la FLÈCHE qui l'appelle. Le nom
 *  capturé est le résolveur, le second l'accesseur — retenu s'il est vivant. */
const FORMES_RESOLVEUR = [
  // `export function findConditionById(id) { return etatParId(id); }`
  /export\s+function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)[^{]{0,200}\{\s*return\s+([A-Za-z_$][\w$]*)\s*\(/g,
  // `export const findPropById: (id: string) => PropData | undefined = propParId;`
  /export\s+const\s+([A-Za-z_$][\w$]*)\s*(?::[^;]{0,300})?=\s*([A-Za-z_$][\w$]*)\s*;/g,
  // `export const charAbr = (k: CharKey): string => charARoulerParId(k)?.abr ?? k;`
  /export\s+const\s+([A-Za-z_$][\w$]*)\s*(?::[^;]{0,300}?)?=\s*(?:async\s*)?\([^)]{0,300}\)\s*(?::[^=]{0,200})?=>\s*([A-Za-z_$][\w$]*)\s*\(/g,
];

/** Les RÉSOLVEURS D'ENTRÉE du dépôt : tout export de `src/data` qui donne accès à la donnée d'un
 *  dataset par un ACCESSEUR VIVANT (`indexParId`/`indexParChamp`/`memoParVersion`), sous l'une des
 *  `FORMES_RESOLVEUR`. Ce qu'un tel résolveur atteint n'est pas une copie : c'est l'ENTRÉE que le
 *  seam splice. La muter écrit dans le dataset sans le versionner (aucun index mémoïsé ne l'apprend)
 *  et change l'ORDRE D'INSERTION de ses clés, dont `JSON.stringify` dépend (#1717).
 *  La flèche qui rend un CHAMP de l'entrée (`… ?.abr ?? k`) entre dans le vocabulaire comme les
 *  autres : le critère est l'ACCÈS à la donnée vivante, et le classer au cas par cas rouvrirait la
 *  liste tenue à la main que cette dérivation remplace. */
let _resolveurs = null;
export function resolveursDentree() {
  if (_resolveurs) return _resolveurs;
  const accesseurs = accesseursVivants();
  const out = new Set();
  for (const chemin of fichiersSources()) {
    if (!chemin.startsWith('src/data/') || estFichierVitest(chemin)) continue;
    const src = sansCommentaires(readFileSync(join(RACINE, chemin), 'utf8'));
    for (const forme of FORMES_RESOLVEUR) {
      for (const m of src.matchAll(forme)) if (accesseurs.has(m[2])) out.add(m[1]);
    }
  }
  if (!out.size) throw new Error('resolveursDentree : aucun résolveur lu — la forme des résolveurs de `src/data` a changé');
  _resolveurs = out;
  return out;
}

const MUTANTES = new Set(MUTATEURS.split('|'));
/** Les méthodes qui TIRENT une entrée du tableau (`etats.find(…)` rend l'objet, pas une copie). */
const TIREUSES = new Set(['find', 'findLast', 'at']);
/** Les nœuds qui OUVRENT une portée de déclaration (`let`/`const`, paramètres, liant de `for…of`). */
const EST_PORTEE = (n) =>
  ts.isSourceFile(n) || ts.isBlock(n) || ts.isModuleBlock(n) || ts.isCaseBlock(n) || ts.isCatchClause(n) ||
  ts.isForStatement(n) || ts.isForOfStatement(n) || ts.isForInStatement(n) ||
  ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n) ||
  ts.isMethodDeclaration(n) || ts.isConstructorDeclaration(n) || ts.isClassDeclaration(n);
const EST_ENVELOPPE = (n) =>
  ts.isNonNullExpression(n) || ts.isParenthesizedExpression(n) || ts.isAsExpression(n) ||
  (ts.isSatisfiesExpression ? ts.isSatisfiesExpression(n) : false);

/** La BASE d'une chaîne d'accès : `ed.recover!.difficulty` → `ed`, `(etats as E[])[0]` → `etats`,
 *  `findConditionById('x')!.perStack` → l'APPEL lui-même (la chaîne part de la donnée vivante). */
function baseDe(n) {
  for (;;) {
    if (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n) || EST_ENVELOPPE(n)) { n = n.expression; continue; }
    return n;
  }
}

/** La portée qui PORTE une déclaration (le nœud de portée le plus proche qui l'enveloppe). */
function porteeDe(n) {
  for (let p = n.parent; p; p = p.parent) if (EST_PORTEE(p)) return p;
  return n.getSourceFile();
}

/**
 * La CIBLE VIVANTE d'une expression, nommée — `null` si rien de vivant. Sa BASE tranche à elle seule :
 * un binding importé EST le dataset ; un appel de résolveur, une tireuse posée sur du vivant, ou une
 * variable que la portée résout comme entrée, DÉSIGNENT une entrée. Une seule fonction sert les
 * deux usages du détecteur : dire d'où sort une valeur, et dire ce qu'une écriture atteint.
 */
function cibleVivante(expr, noms, resolveurs, resoudre) {
  const b = baseDe(expr);
  if (ts.isIdentifier(b)) {
    if (noms.has(b.text)) return `le dataset « ${b.text} »`;
    return resoudre(b.text, expr) ? `une ENTRÉE VIVANTE du dataset « ${b.text} »` : null;
  }
  if (ts.isCallExpression(b)) {
    const appele = b.expression;
    if (ts.isIdentifier(appele) && resolveurs.has(appele.text)) return `une ENTRÉE VIVANTE du dataset (« ${appele.text}(…) »)`;
    if (ts.isPropertyAccessExpression(appele) && TIREUSES.has(appele.name.text)) {
      const source = cibleVivante(appele.expression, noms, resolveurs, resoudre);
      return source ? `une ENTRÉE VIVANTE tirée de ${source}` : null;
    }
  }
  return null;
}

/**
 * Les DÉCLARATIONS d'un source, par portée : `nom → est-ce une ENTRÉE VIVANTE d'un dataset ?`. Une
 * déclaration non-vivante y entre AUSSI — c'est elle qui OMBRE l'homonyme d'une portée englobante (une
 * variable de boucle `for (const c of heroes)` n'est pas l'entrée `const c = findCreatureById(…)`
 * déclarée ailleurs dans le fichier). La vivacité se propage par FIXPOINT sur trois chemins : le
 * déclarateur nommé (`const rec = ed.recover`), le liant DÉSTRUCTURÉ (`const { recover } = ed` —
 * chaque élément hérite de l'initialiseur) et la RÉAFFECTATION d'un identifiant déjà déclaré
 * (`let ed = null; ed = findConditionById('x')`), qui rend vivant le nom dans la portée qui le déclare.
 */
function declarationsParPortee(sf, noms, resolveurs) {
  const parPortee = new Map();
  const poser = (nom, portee, entree) => {
    let m = parPortee.get(portee);
    if (!m) parPortee.set(portee, (m = new Map()));
    if (entree || !m.has(nom)) m.set(nom, entree);
  };
  const resoudre = (nom, depuis) => {
    for (let p = depuis; p; p = p.parent) {
      const m = parPortee.get(p);
      if (m && m.has(nom)) return m.get(nom);
    }
    return false;
  };
  const porteeQuiDeclare = (nom, depuis) => {
    for (let p = depuis; p; p = p.parent) {
      const m = parPortee.get(p);
      if (m && m.has(nom)) return p;
    }
    return null;
  };
  // La portée d'où l'on résout est celle de l'EXPRESSION elle-même : ses parents mènent au liant.
  const estVivant = (expr) => !!expr && !!cibleVivante(expr, noms, resolveurs, resoudre);
  const declarateurs = [];
  const promotions = [];
  /** Les noms qu'un liant DÉCLARE : identifiant nu, ou tous les éléments d'un motif imbriqué. */
  const nomsDuLiant = (liant, out = []) => {
    if (ts.isIdentifier(liant)) out.push(liant.text);
    else if (ts.isObjectBindingPattern(liant) || ts.isArrayBindingPattern(liant)) {
      for (const el of liant.elements) if (ts.isBindingElement(el)) nomsDuLiant(el.name, out);
    }
    return out;
  };
  const visiter = (n) => {
    if (ts.isVariableDeclaration(n)) {
      const portee = porteeDe(n);
      const declares = nomsDuLiant(n.name);
      for (const nom of declares) poser(nom, portee, false);
      declarateurs.push({ noms: declares, portee, init: n.initializer });
    } else if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(n.left)) {
      promotions.push({ nom: n.left.text, depuis: n, init: n.right });
    } else if (ts.isParameter(n) && ts.isIdentifier(n.name)) poser(n.name.text, porteeDe(n), false);
    else if ((ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) && n.name) poser(n.name.text, porteeDe(n), false);
    else if (ts.isImportSpecifier(n) || ts.isNamespaceImport(n)) poser(n.name.text, n.getSourceFile(), false);
    ts.forEachChild(n, visiter);
  };
  visiter(sf);
  // FIXPOINT : une entrée en engendre d'autres (`const rec = ed.recover`), et la propagation suit
  // les DÉPENDANCES, dans un ordre propre à elles. Borné par le nombre de sites — chaque tour en
  // promeut au moins un, sans quoi il s'arrête.
  for (let tour = 0; tour <= declarateurs.length + promotions.length; tour++) {
    let bouge = false;
    for (const d of declarateurs) {
      if (!estVivant(d.init)) continue;
      for (const nom of d.noms) if (!parPortee.get(d.portee).get(nom)) { poser(nom, d.portee, true); bouge = true; }
    }
    for (const p of promotions) {
      if (!estVivant(p.init)) continue;
      const portee = porteeQuiDeclare(p.nom, p.depuis);
      if (portee && !parPortee.get(portee).get(p.nom)) { poser(p.nom, portee, true); bouge = true; }
    }
    if (!bouge) break;
  }
  return resoudre;
}

/**
 * Les ÉCRITURES HORS SEAM d'un source, par analyse STRUCTURELLE (AST) — une seule lecture pour les
 * deux cibles, que `cibleVivante` distingue :
 *  - le BINDING d'un dataset (`traits.push(…)`, `traits.length = 0`, `traits[0].label = …`) ;
 *  - une ENTRÉE VIVANTE tirée du dataset (`const ed = findConditionById('brise')!` puis
 *    `delete ed.perStack`, `const { recover } = ed`, `findManeuverById('x')!.effects = …`) :
 *    l'objet muté EST celui du tableau.
 * Les gestes reconnus sont ceux qui changent l'objet en place : affectation (simple ou composée) à
 * un membre, `delete`, `++`/`--`, méthode mutante, `Object.assign` sur la cible.
 *
 * ANGLE MORT, dit : la passe est LOCALE À LA PORTÉE. Une entrée passée en ARGUMENT
 * (`muter(findConditionById('x'))`, puis `e.perStack = false` dans le corps de `muter`) sort de ce
 * que la pile de portées sait relier — le paramètre y est déclaré non-vivant, et le suivre demanderait
 * un graphe d'appels inter-procédural (le vérificateur de types de `tsProgram`, ~1,3 Go par
 * programme, pour une forme qu'aucun site du dépôt ne pratique). Ce qui reste couvert dans ce cas :
 * l'écriture faite DANS la portée qui résout l'entrée.
 */
export function ecrituresHorsSeam(chemin, src, parBinding, resolveurs = resolveursDentree()) {
  const noms = nomsVivantsDuFichier(chemin, src, parBinding);
  const candidateEntree = [...resolveurs].some((r) => src.includes(r));
  if (!noms.size && !candidateEntree) return [];
  const sf = ts.createSourceFile(chemin, src, ts.ScriptTarget.Latest, true, scriptKindDe(chemin));
  const resoudre = declarationsParPortee(sf, noms, resolveurs);
  const lignes = src.split('\n');
  const out = [];
  const cible = (expr) => cibleVivante(expr, noms, resolveurs, resoudre);
  /** Un MEMBRE de la cible, jamais la variable elle-même : réaffecter le nom local (`ed = autre`)
   *  ne touche pas la donnée, muter `ed.perStack` si. */
  const membre = (acces) =>
    ts.isPropertyAccessExpression(acces) || ts.isElementAccessExpression(acces) ? cible(acces) : null;
  const fauter = (n, quoi) => {
    const ligne = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line;
    out.push(`${chemin}:${ligne + 1} — écriture hors seam sur ${quoi} : ${(lignes[ligne] ?? '').trim()}`);
  };
  const visiter = (n) => {
    let quoi = null;
    if (ts.isDeleteExpression(n)) quoi = membre(n.expression);
    else if (ts.isBinaryExpression(n) && n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && n.operatorToken.kind <= ts.SyntaxKind.LastAssignment) quoi = membre(n.left);
    else if ((ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) && (n.operator === ts.SyntaxKind.PlusPlusToken || n.operator === ts.SyntaxKind.MinusMinusToken)) quoi = membre(n.operand);
    else if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const appele = n.expression;
      if (MUTANTES.has(appele.name.text)) quoi = cible(appele.expression);
      else if (appele.name.text === 'assign' && ts.isIdentifier(appele.expression) && appele.expression.text === 'Object' && n.arguments.length) {
        quoi = cible(n.arguments[0]);
      }
    }
    if (quoi) fauter(n, quoi);
    ts.forEachChild(n, visiter);
  };
  visiter(sf);
  return out;
}

/** Tous les `.ts`/`.tsx` de `src/`, chemins relatifs à la racine du dépôt, à ORDRE TOTAL
 *  (`listerArbre`, #1679 L3b : un listing brut suit l'ordre du système de fichiers). */
export function fichiersSources() {
  return listerArbre(join(RACINE, 'src'), { filtre: (rel) => /\.tsx?$/.test(rel) }).map((rel) => `src/${rel}`);
}

/** Le SEAM lui-même, DÉRIVÉ de ce que les fichiers DÉCLARENT — jamais une liste de chemins. Un
 *  fichier NON-test est le seam s'il DÉFINIT `bumperDataset` (le versionneur d'écriture) ou s'il
 *  l'IMPORTE (l'écrivain : muter en place et versionner est son métier). Ces deux-là PORTENT la
 *  mécanique que les gardes d'index et d'écriture cherchent chez les autres : les y chercher rendrait
 *  la garde fausse. Un INSTRUMENT Vitest — suite ou banc, `estFichierVitest` — n'est jamais le
 *  seam : il en parle, il ne le porte pas. */
let _seam = null;
export function fichiersDuSeam() {
  if (_seam) return _seam;
  const definit = /export\s+function\s+bumperDataset\b/;
  const importe = /import\s*\{[^}]*\bbumperDataset\b[^}]*\}\s*from/;
  const out = new Set();
  for (const chemin of fichiersSources()) {
    if (estFichierVitest(chemin)) continue;
    const src = sansCommentaires(readFileSync(join(RACINE, chemin), 'utf8'));
    if (definit.test(src) || importe.test(src)) out.add(chemin);
  }
  _seam = out;
  return out;
}
