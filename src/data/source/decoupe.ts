// Bibliothèque de DÉCOUPE des chapitres `Source/` : SOURCE UNIQUE du parsing et de la résolution.
// Une adresse rend la prose VERBATIM du livre sans la dupliquer ailleurs : un fragment de BLOCS
// — { sec, secOcc, b0, b1 } — désigne une suite contiguë de blocs d'une section ; sa sœur, le
// fragment de CELLULE — { sec, secOcc, row, col } — rend une case de table par CLÉ (jamais par
// indice). Une `DescRef` monte jusqu'à trois fragments d'un même chapitre.
//
// Module PUR : aucune entrée/sortie, aucun registre de livres — le chapitre lui arrive déjà lu
// (`scripts/source/lecteur-fs.mjs`). Il est chargé tel quel par Node nu (`scripts/source/*.mjs`) et
// par vitest ; c'est cette absence d'entrée/sortie qui le laisse chargeable par le navigateur. Sous
// Node nu, sa syntaxe est effaçable et ses imports internes portent leur EXTENSION explicite.
//
// CONVENTIONS DE PARSING, mesurées sur l'extraction Marker réelle :
//  - HEADINGS : seuls les headings ATX (`#`..`######`) ouvrent une section. Les lignes en gras seul
//    (`**Agitateur – Bronze 2**`) NE sont PAS traitées comme des headings : mesure sur le livre de
//    base — `16 - Etats.md`, `21 - Psychologie.md`, `10 - Talents.md` en comptent 0 ; `08 - Statut.md`
//    en compte 44 pour 282 headings ATX, et il s'agit de noms de niveau de carrière ouvrant un
//    paragraphe, pas de titres de rubrique. Les prendre pour des headings fragmenterait les sections
//    sans gain d'adressage (les blocs, eux, restent identiques).
//  - Un heading peut être précédé sur SA ligne d'un marqueur de folio
//    (`<span id="page-169-0" data-folio="168"></span>### **Brisé**`, `16 - Etats.md:59`).
//  - SLUG : translittéré ASCII (accents retirés) — un slug se tape en ligne de commande et se pose
//    dans un JSON ; `occ` (rang 1-based parmi les slugs identiques du chapitre) lève l'ambiguïté des
//    titres répétés (« Évolution de Carrière » ×31 dans `08 - Statut.md`).
//  - BLOCS : segments séparés par une ou plusieurs lignes vides ; le heading lui-même n'est pas un
//    bloc. Les balises `<span …>` sont retirées du texte rendu, leur `data-folio` est collecté. `line`
//    est le numéro 1-based, dans le fichier du chapitre, de la ligne où commence `md` : la première
//    ligne du segment ouvrant dont le texte, spans retirés, est non vide (un segment réduit à un
//    marqueur de folio n'ouvre aucun bloc ; un bloc recollé garde la ligne de son premier morceau).
//  - FOLIO COURANT : les marqueurs `data-folio` sont rares et arbitrairement placés dans le flux ; le
//    folio ROULANT par ligne (`foliosRoulants`, `ancre-vide.ts`) donne à chaque bloc celui de sa ligne
//    `line`, à chaque section celui qui court au bout de la ligne de son titre (`folio`), en plus des marqueurs
//    INTERNES au bloc (`folios`). Une ancre VIDE (`ancreVide`) n'entre ni dans l'un ni dans l'autre.
//  - RECOLLAGE DE FOLIO : un saut de folio coupe des paragraphes en plein milieu
//    (`21 - Psychologie.md:45-48`, `05 - _gjdgxs.md:44`). Deux blocs séparés par une coupure PORTEUSE
//    DE FOLIO (bloc vide réduit à son marqueur, ou bloc suivant ouvert par un marqueur) sont recollés
//    par une espace quand le bloc précédent ne finit pas par une ponctuation finale (`.!?»”:;`) —
//    testée SOUS l'habillage markdown, un `…une autre.*` fermant une emphase étant bel et bien
//    terminé (`05 - _gjdgxs.md:438`) — et que le bloc suivant n'ouvre pas un paragraphe logique
//    (emphase `*`/`**`, puce, table).
import { normalize as normalizeCitation, sansBr, brEnSaut } from './normalize.ts';
import { hash32 } from '../hash.ts';
import { ANCRE_FOLIO, FOLIO_ATTR, ancreVide, foliosRoulants } from './ancre-vide.ts';

/** Bloc d'affichage : le markdown rendu, sa ligne de début dans le fichier du chapitre, le folio
 *  courant à son ouverture, ses marqueurs internes. */
export interface Bloc { md: string; line: number; folio: number | null; folios: number[] }

/** Section adressable d'un chapitre (`slug` + `occ` = son adresse). */
export interface Section {
  slug: string;
  occ: number;
  title: string;
  level: number;
  line: number;
  folio: number | null;
  blocks: Bloc[];
}

/** Chapitre parsé. */
export interface ChapitreParse { sections: Section[] }

/** Fragment de BLOCS : suite contiguë `b0..b1` des blocs d'une section, empreinte comprise. */
export interface FragmentBlocs {
  kind: 'blocs';
  sec: string;
  secOcc: number;
  b0: number;
  b1: number;
  sum: string;
}

/** Fragment de CELLULE : case d'une table, adressée par clé de ligne × en-tête de colonne. `table`
 *  (`TableDeSection.cle`) n'est posé que si la clé de ligne est ambiguë entre les tables de la section. */
export interface FragmentCellule {
  kind: 'cellule';
  sec: string;
  secOcc: number;
  row: string;
  col: string;
  table?: string;
  sum: string;
}

export type Fragment = FragmentBlocs | FragmentCellule;

/** Adresse complète d'une prose : jusqu'à trois fragments d'un même chapitre d'un même livre. */
export interface DescRef { book: string; ch: string; parts: Fragment[] }

/* ─── LE NUMÉRO DE CHAPITRE — sa maison UNIQUE (#1739) ───────────────────────────────────────
 * Le numéro est un ENTIER ; sa GRAPHIE (préfixe de fichier, `descRef.ch`, segment de route, libellé)
 * est zéro-paddée à la largeur du plus grand numéro DU LIVRE, deux au minimum. Tout ce qui suit est
 * PUR (aucune entrée/sortie) : le disque est l'affaire de `scripts/raw/_lib.mjs#chapterFile` et du
 * lecteur fs, qui prennent ICI leur prédicat, leur motif et leur résolution.
 * ────────────────────────────────────────────────────────────────────────────────────────────── */

/** Nom d'un fichier d'EXTRACTION : un numéro, ` - `, un titre, `.md`. L'index `00 - Index.md` en est
 *  un — c'est un fichier d'extraction, pas un chapitre. SEUL motif du dépôt. */
const NOM_EXTRACTION = /^(\d+) - (.+)\.md$/;

/** Largeur MINIMALE de la graphie d'un numéro de chapitre, quel que soit le livre. */
const LARGEUR_MIN_CHAPITRE = 2;

/** Un numéro de CHAPITRE est un ENTIER ≥ 1 : le `00` de l'index n'en est pas un, ni `''`, ni `NaN`.
 *  SEUL prédicat du dépôt — tout site qui décide « est-ce un chapitre ? » passe par lui. */
export const estNumeroDeChapitre = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 1;

/** Le même prédicat, en EXIGENCE : ce qui n'est pas un numéro de chapitre lève, nommément. */
function exigeNumeroDeChapitre(n: number, quoi: string): number {
  if (!estNumeroDeChapitre(n)) {
    throw new Error(`${quoi} : un numéro de chapitre est un entier ≥ 1, reçu ${JSON.stringify(n)}`);
  }
  return n;
}

/** Ce nom suit-il le motif d'extraction ? Index COMPRIS — la question des gardes de FORME, qui
 *  jugent tout `.md` servi. La question « est-ce un chapitre ? » est `numeroDuFichier`. */
export const estNomDExtraction = (nom: string): boolean => NOM_EXTRACTION.test(nom);

/** Numéro d'EXTRACTION porté par un nom de fichier, ou `null` — celui de l'index est `0`, et c'est
 *  sous ce numéro que les gardes de FORME le nomment (`AA 0 folio -2`). */
export function numeroDExtraction(nom: string): number | null {
  const m = NOM_EXTRACTION.exec(nom);
  return m ? Number(m[1]) : null;
}

/** Numéro de CHAPITRE porté par un nom de fichier, ou `null` — l'index `00 - Index.md` et tout
 *  préfixe nul en sont exclus par le prédicat. */
export function numeroDuFichier(nom: string): number | null {
  const n = numeroDExtraction(nom);
  return estNumeroDeChapitre(n) ? n : null;
}

/** GRAPHIE du numéro portée par un nom de fichier-chapitre, TELLE QUE LE FICHIER L'ÉCRIT, ou `null`. */
export function graphieDuFichier(nom: string): string | null {
  return numeroDuFichier(nom) == null ? null : NOM_EXTRACTION.exec(nom)![1];
}

/** TITRE porté par un nom de fichier d'extraction, ou `null` — index compris (il a un titre). */
export function titreDuFichier(nom: string): string | null {
  return NOM_EXTRACTION.exec(nom)?.[2] ?? null;
}

/**
 * Le fichier du chapitre `numero` dans un LISTING, ou `null`. La comparaison porte sur des ENTIERS :
 * 7, `'07'` et `'007'` désignent le même chapitre, et ce qui n'est pas un numéro de chapitre (`''`,
 * `0`, `'00'`, `null`) ne résout RIEN — l'index ne se résout pas comme un chapitre.
 * Le PREMIER du listing est rendu ; sur un listing en ordre total, c'est le premier-TRIÉ, donc deux
 * fichiers de même numéro rendent le même sur toute machine.
 */
export function fichierDuChapitre(fichiers: readonly string[], numero: unknown): string | null {
  const n = Number(numero);
  if (!estNumeroDeChapitre(n)) return null;
  return fichiers.find((f) => numeroDuFichier(f) === n) ?? null;
}

/** Graphies des chapitres d'un LISTING, telles que les fichiers les écrivent, triées par ENTIER —
 *  un tri de chaînes rangerait `100` avant `99` dès qu'un livre passe la centaine. */
export const prefixesDeChapitres = (fichiers: readonly string[]): string[] =>
  fichiers
    .map(graphieDuFichier)
    .filter((g): g is string => g != null)
    .sort((a, b) => Number(a) - Number(b));

/**
 * LARGEUR de la graphie des numéros de chapitre d'un LIVRE : celle de son plus grand numéro, deux au
 * minimum. Tous les préfixes d'un même dossier la partagent — sinon `07` et `100` se rangeraient
 * dans le désordre au tri lexicographique de n'importe quel listeur. SEULE définition du dépôt :
 * aucun autre site ne compte les chiffres d'un numéro de chapitre.
 */
export function largeurDeChapitre(plusGrandNumero: number): number {
  const n = exigeNumeroDeChapitre(plusGrandNumero, 'largeurDeChapitre');
  return Math.max(LARGEUR_MIN_CHAPITRE, String(n).length);
}

/**
 * GRAPHIE d'un numéro de chapitre à la largeur de son livre : le préfixe de `NNN - Titre.md`, le `ch`
 * d'une `DescRef`, le segment de la route `/source/<livre>/<NNN>.md`. SEULE définition du dépôt —
 * la largeur lui est DONNÉE (`largeurDeChapitre`), elle n'est écrite nulle part.
 */
export function graphieDeChapitre(numero: number, largeur: number): string {
  const n = exigeNumeroDeChapitre(numero, 'graphieDeChapitre');
  return String(n).padStart(Math.max(LARGEUR_MIN_CHAPITRE, largeur), '0');
}

/** GRAPHIE recevable pour le `ch` d'une adresse : des chiffres, DEUX au minimum, et un numéro de
 *  CHAPITRE (`'00'` désigne l'index, pas un chapitre). La largeur JUSTE pour le livre se juge à la
 *  résolution, là où le livre est connu (`src/data/prose-resolution.test.ts`, volet F). */
export const estGraphieDeChapitre = (s: string): boolean =>
  /^\d{2,}$/.test(s) && estNumeroDeChapitre(Number(s));

/* ─── Ligne 1 d'un fichier d'extraction : `*Pages PDF X*` / `*Pages PDF X-Y*` ─────────────────── */

/** Motif de la LIGNE 1. La borne haute est OPTIONNELLE — un fichier d'UNE page rend `*Pages PDF 48*`
 *  (LDB `06 - Classes.md` l.1). Ancré des DEUX côtés : rien ne suit la plage sur cette ligne. */
export const LIGNE1_PAGES = /^\*Pages PDF (\d+)(?:-(\d+))?\*$/;

/** PLAGE portée par la ligne 1 d'un fichier d'extraction, ou `null` si ce n'en est pas une. SEULE
 *  LECTURE du dépôt : tout site qui interroge cette ligne passe par elle (#1739, pilotage H-0). */
export function plageDeLigne1(ligne: string): { page: number; pageFin: number } | null {
  const m = LIGNE1_PAGES.exec(String(ligne ?? '').trim());
  return m ? { page: Number(m[1]), pageFin: Number(m[2] ?? m[1]) } : null;
}

/** PLAGE en texte, `'X'` ou `'X-Y'` — ce que l'index du livre imprime après `p.`. */
export function plageEnTexte(page: number, pageFin: number): string {
  if (!Number.isInteger(page) || !Number.isInteger(pageFin) || page < 1 || pageFin < page) {
    throw new Error(`plageEnTexte : une plage de pages va d'un entier ≥ 1 à un entier ≥ lui, reçu ${JSON.stringify(page)}…${JSON.stringify(pageFin)}`);
  }
  return pageFin > page ? `${page}-${pageFin}` : `${page}`;
}

/** LIGNE 1 d'un fichier d'extraction. SEULE ÉCRITURE du dépôt : tout découpeur passe par elle. */
export const ligne1DePlage = (page: number, pageFin: number): string =>
  `*Pages PDF ${plageEnTexte(page, pageFin)}*`;

export type CodeErreur =
  | 'section-inconnue'
  | 'bornes-hors-limites'
  | 'empreinte-divergente'
  | 'ligne-introuvable'
  | 'ligne-ambigue'
  | 'table-sans-en-tetes'
  | 'colonne-inconnue'
  | 'fragment-trop-court'
  | 'fragment-ambigu'
  | 'fragments-chevauchants'
  | 'montage-hors-plafond';

export interface ErreurResolution {
  error: CodeErreur;
  detail: string;
  /** Indice 0-based du fragment FAUTIF, quand l'erreur en désigne un — pour un chevauchement, le
   *  SECOND des deux (`chevauchementDe` : c'est celui que le geste vient d'ajouter ou de déplacer).
   *  Absent pour une erreur qui porte sur l'adresse entière (`montage-hors-plafond`).
   *  C'est ce qui permet à un éditeur d'afficher le refus DANS la rangée concernée. */
  fragment?: number;
}

export interface Resolu { md: string; folios: number[] }

export const estErreur = (r: Resolu | ErreurResolution): r is ErreurResolution => 'error' in r;

/** Longueur normalisée minimale d'un fragment de BLOCS en montage (en deçà, l'adresse n'est pas
 *  discriminante). Une `cellule` n'y est pas soumise — voir la règle D, `resoudreAdresse`. */
const MIN_FRAGMENT = 40;
/** Nombre maximal de fragments d'une adresse. */
const MAX_FRAGMENTS = 3;
/** Longueur d'amorce testée avant de tenter un run complet (filtre bon marché). */
const PROBE = 24;

const SPAN_TAG = /<\/?span[^>]*>/g;
const HEADING = /^(?:<span[^>]*>\s*<\/span>\s*)*(#{1,6})\s+(.*)$/;
const OPENS_ON_FOLIO = /^\s*<span[^>]*data-folio(?:-vide)?=/;
const TERMINAL = /[.!?»”:;]$/;
const TRAILING_DECOR = /[*_`~\s]+$/;
const OPENS_EMPHASIS = /^\s*\*/;
const TABLE_LINE = /^\s*\|/;
const BULLET = /^\s*(?:[-*•]|\d+[.)])\s/;
/** Clé de ligne de table trop positionnelle pour adresser (fourchette d100, numéro nu). */
const RANGE_KEY = /^\d+\s*[-–—]?\s*\d*$/;

/** Retire les balises `<span>` (le contenu textuel est conservé). */
export const stripSpans = (s: string): string => s.replace(SPAN_TAG, '');

/** Ancres de page VIDES (`ancreVide`) marquées `data-folio-vide` : elles coupent encore un paragraphe
 *  (`OPENS_ON_FOLIO`), mais ne portent aucun folio (`FOLIO_ATTR`) — ni roulant, ni dans `folios`. */
const marquerAncresVides = (t: string): string =>
  t.replace(ANCRE_FOLIO, (m: string, _folio: string, debut: number) =>
    (ancreVide(t, debut + m.length) ? m.replace('data-folio=', 'data-folio-vide=') : m));

/** Folios (`data-folio`) portés par un fragment de texte, dans l'ordre. */
function foliosIn(s: string): number[] {
  const out: number[] = [];
  for (const m of s.matchAll(FOLIO_ATTR)) out.push(Number(m[1]));
  return out;
}

/** Titre affichable d'un heading : markdown d'emphase et `#` de fermeture retirés. */
const cleanTitle = (s: string): string =>
  stripSpans(s).replace(/#+\s*$/, '').replace(/[*_`]/g, '').trim();

/** Slugifie un titre : minuscules, accents TRANSLITTÉRÉS, tout le reste en tirets. */
function slugify(titre: string): string {
  return cleanTitle(titre)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Normalisation de COMPARAISON (verbatim tolérant à l'habillage) : délègue au normaliseur de
 * citations de l'Atlas (`normalize` : emphase, guillemets, apostrophes, tirets, casse, espaces
 * insécables, accents CONSERVÉS) après retrait des balises `<span>` et absorption du `<br>` de
 * cellule (`sansBr` : un saut imprimé compte pour une espace — une clé de ligne ou un en-tête
 * coupé par l'extraction reste ADRESSABLE tel qu'il se lit), puis aplatit la ponctuation de
 * table (espaces autour des `|`, tirets de la ligne de séparation).
 */
export function normText(s: string): string {
  return normalizeCitation(sansBr(stripSpans(s)))
    .replace(/\s*\|\s*/g, '|')
    .replace(/-{2,}/g, '-')
    .trim();
}

/**
 * Joint des fragments DÉJÀ normalisés en une chaîne comparable : l'espace de jointure est réabsorbé
 * autour des `|` de table (`normText` colle déjà les cellules, un bloc-table recollé à la prose qui
 * le précède ne doit pas rouvrir cet espace).
 */
export const joinNorm = (parts: string[]): string =>
  parts.filter(Boolean).join(' ').replace(/\s*\|\s*/g, '|');

/** Un entier 32 bits en 8 hex. */
const hex8 = (n: number): string => n.toString(16).padStart(8, '0');

/**
 * Empreinte d'un texte résolu — helper UNIQUE : 64 bits en 16 hex, deux passes FNV-1a du texte
 * NORMALISÉ sous DEUX SELS distincts (`'a'` et `'b'` : un sel unique rendrait deux moitiés
 * identiques, donc 32 bits utiles). Portée par chaque fragment (`sum`) et vérifiée à la résolution :
 * une source ré-extraite qui bouge sous une adresse se signale au lieu de rendre un autre texte.
 */
export function sumOf(md: string): string {
  const n = normText(md);
  return hex8(hash32('a', n)) + hex8(hash32('b', n));
}

/** Deux blocs coupés par un saut de folio sont-ils recollables ? */
function recollable(prev: string, next: string): boolean {
  if (TERMINAL.test(prev.replace(TRAILING_DECOR, ''))) return false;
  if (TABLE_LINE.test(prev.split('\n').pop() ?? '')) return false;
  if (TABLE_LINE.test(next) || OPENS_EMPHASIS.test(next) || BULLET.test(next)) return false;
  return true;
}

/**
 * Découpe un corps de section en blocs d'affichage (spans retirés, folios collectés, recollage des
 * paragraphes coupés par un saut de folio).
 * @param debut ligne 1-based, dans le fichier du chapitre, de `lignes[0]`
 * @param roulant folio roulant de chaque ligne du chapitre (`foliosRoulants`, index 0-based)
 */
function toBlocks(
  lignes: string[], debut: number, roulant: (number | null)[],
): { blocks: Bloc[] } {
  const raw: { text: string; start: number }[] = [];
  let cur: string[] = [];
  let start = debut;
  lignes.forEach((l, k) => {
    if (l.trim() === '') {
      if (cur.length) { raw.push({ text: cur.join('\n'), start }); cur = []; }
    } else {
      if (!cur.length) start = debut + k;
      cur.push(l);
    }
  });
  if (cur.length) raw.push({ text: cur.join('\n'), start });

  const out: Bloc[] = [];
  let carry: number[] = [];
  let carryCut = false;
  for (const { text, start } of raw) {
    const folios = foliosIn(text);
    const md = stripSpans(text).trim();
    if (!md) { carry.push(...folios); carryCut = true; continue; }
    const line = start + text.split('\n').findIndex((l) => stripSpans(l).trim() !== '');
    const cut = carryCut || OPENS_ON_FOLIO.test(text);
    const blockFolios = [...carry, ...folios];
    carry = []; carryCut = false;
    const prev = out[out.length - 1];
    if (prev && cut && recollable(prev.md, md)) {
      prev.md = `${prev.md} ${md}`;
      prev.folios.push(...blockFolios);
    } else {
      out.push({ md, line, folio: roulant[line - 1], folios: blockFolios });
    }
  }
  return { blocks: out };
}

/**
 * Parse un chapitre en sections adressables, folio courant roulant compris.
 * @param texte contenu markdown du chapitre, quelles que soient ses fins de ligne
 */
export function parseChapitre(texte: string): ChapitreParse {
  // Fins de ligne ramenées au LF ICI, à l'entrée : ce module est PUR et reçoit son texte de
  // n'importe quel chargeur (lecteur fs, `fetch` d'un asset, fixture), dont tous ne normalisent pas.
  // Mesuré sur `21 - Psychologie.md` du livre de base : en CRLF, `HEADING` ne reconnaît aucun titre
  // (`.` ne franchit pas `\r`, et `$` sans `/m` ne se pose pas devant un `\r` final) — 1 section au
  // lieu de 17, et l'empreinte du premier bloc passe de `ad420a63fa3b93c2` à `3eef49e6fee82961`.
  const brutes = texte.replace(/\r\n?/g, '\n').split('\n');
  const roulant = foliosRoulants(brutes);
  const lignes = marquerAncresVides(brutes.join('\n')).split('\n');
  const sections: Section[] = [];
  const seen = new Map<string, number>();
  let cur: Omit<Section, 'blocks'> & { lines: string[]; debut: number } =
    { slug: '', occ: 1, title: '', level: 0, line: 1, folio: null, lines: [], debut: 1 };
  const push = () => {
    const { lines: body, debut, ...rest } = cur;
    const { blocks } = toBlocks(body, debut, roulant);
    sections.push({ ...rest, blocks });
  };
  for (let i = 0; i < lignes.length; i++) {
    const m = HEADING.exec(lignes[i]);
    if (!m) { cur.lines.push(lignes[i]); continue; }
    push();
    const title = cleanTitle(m[2]);
    const slug = slugify(m[2]) || '-';
    const occ = (seen.get(slug) ?? 0) + 1;
    seen.set(slug, occ);
    const head = foliosIn(lignes[i]);
    cur = { slug, occ, title, level: m[1].length, line: i + 1, folio: head.length ? head[head.length - 1] : roulant[i], lines: [], debut: i + 2 };
  }
  push();
  return { sections };
}

/** Section visée par un fragment, ou `null` si le chapitre n'en porte aucune à cette adresse. */
const sectionDe = (chapitre: ChapitreParse, frag: Fragment): Section | null =>
  chapitre.sections.find((s) => s.slug === frag.sec && s.occ === frag.secOcc) ?? null;

/** Plage de folios couverte par des blocs : courant du premier, plus tous les marqueurs internes. */
const foliosOf = (blocks: Bloc[]): number[] => [
  ...new Set(
    [blocks[0]?.folio, ...blocks.flatMap((b) => b.folios)].filter((f): f is number => f != null),
  ),
];

/** Contrôle d'empreinte : le `sum` d'un fragment est REQUIS et comparé au texte réellement résolu. */
function checkSum(frag: Fragment, md: string, ou: string): ErreurResolution | null {
  const got = sumOf(md);
  if (got === frag.sum) return null;
  return { error: 'empreinte-divergente', detail: `${ou} : sum=${frag.sum} attendu, texte résolu=${got}` };
}

/** Cellules d'une ligne de table markdown (barres de bord retirées, cellules détourées). */
export const cellulesDe = (l: string): string[] =>
  l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

/** Une ligne de SÉPARATEUR de table Markdown (`| --- | --- |`, `|--|--|--|`). */
export function estSeparateur(ligne: string): boolean {
  const t = ligne.trim().replace(/\s+/g, '');
  return t.startsWith('|') && /^[|:-]+$/.test(t) && t.includes('--');
}

/** Texte d'une rangée-BANNIÈRE — ≥ 2 cellules dont exactement UNE est non vide —, ou `null`. */
function texteDeBanniere(cells: string[]): string | null {
  const pleines = cells.filter((c) => c !== '');
  return cells.length >= 2 && pleines.length === 1 ? pleines[0] : null;
}

/** Texte TOUT EN MAJUSCULES d'au moins deux lettres (l'habillage markdown ne compte pas). */
function estMajuscule(s: string): boolean {
  const lettres = [...cleanTitle(s)].filter((c) => /\p{L}/u.test(c));
  return lettres.length >= 2 && lettres.every((c) => c === c.toUpperCase() && c !== c.toLowerCase());
}

/** Cette clé de ligne est-elle trop POSITIONNELLE pour adresser (fourchette d100, numéro nu) ?
 *  Prédicat UNIQUE : `cellRefFor` s'en sert pour reléguer ces clés en dernier recours, `parseTable`
 *  pour refuser d'absorber une bannière devant une table SANS en-têtes, et le détecteur de tables
 *  cassées pour reconnaître une continuation de table après saut de page (une telle clé en
 *  `headers[0]` n'est pas un en-tête). */
export const estCleDePlage = (s: string): boolean => RANGE_KEY.test(s);

/** Une table parsée : ses en-têtes, ses rangées de données, et ce que sa PREMIÈRE ligne portait. */
export interface TableParse {
  headers: string[];
  rows: string[][];
  /** TITRE de la table : bannière ABSORBÉE (titre imprimé en bandeau devant les en-têtes) ; `tablesOf` y
   *  porte aussi la légende `**X**` du paragraphe qui précède la table (#1739). */
  titre?: string;
  /** Bannière RECONNUE mais NON absorbée (texte non majuscule, ou table sans donnée après le saut) :
   *  la première ligne reste les en-têtes, exactement comme avant. C'est un résidu à trier au PDF —
   *  `scripts/raw/check-source-tables.mjs` le NOMME (famille `banniere-suspecte`). */
  banniereRefusee?: string;
}

/**
 * Parse un bloc-table markdown. Rend `null` si le bloc n'est pas une table.
 *
 * BANNIÈRE : l'extraction Marker rend le titre imprimé EN BANDEAU d'une table comme une rangée de
 * plus, devant les en-têtes (`| | TABLEAU DE PROGRESSION D'UN PERSONNAGE | | |`). Sans absorption,
 * les en-têtes RÉELS tombent en première rangée de données et la table entière est inadressable.
 * Elle est ABSORBÉE (sautée, gardée en `titre`) SOUS GARDE, précédent `recollable` : texte en
 * MAJUSCULES d'au moins deux lettres, ET au moins une rangée de données restante après le saut.
 * Sans la garde, un folio capté (`| | | 159 | |`), un séparateur d'index (`| A | |`) et l'en-tête
 * RÉEL d'une table à une seule colonne (`| Effet | |`) seraient sautés à tort.
 * Le bandeau porte son PROPRE séparateur (`| | TABLEAU DES MOUVEMENTS | |` puis `|--|--|--|` puis
 * `| Mouvement | … |`, `15 - Déplacement.md:18-20`) : le saut passe donc la bannière ET les
 * séparateurs qui la suivent, sans quoi les en-têtes seraient la ligne de tirets.
 * TROISIÈME volet de la garde : une bannière suivie DIRECTEMENT de données, sans rangée d'en-têtes
 * (`46 - Les règles magiques.md:34-36`, « TABLEAU DES INCANTATIONS IMPARFAITES MINEURES » puis
 * `| 01-05 | Signe de Sorcière… |`) n'est pas absorbable : la sauter promeut une FOURCHETTE en
 * en-tête et fait perdre à la table sa première rangée. `estCleDePlage` le reconnaît.
 * LATENCE CONNUE du seuil « ≥ 2 lettres » : un `II`, un `AI`, un `X-Y` de cellule serait pris pour
 * un titre. Aucun cas dans le corpus (le plus court titre absorbé mesuré est `URZO`) — à trancher
 * sur le premier cas réel, jamais en durcissant à l'aveugle un seuil que rien ne dément.
 */
export function parseTable(md: string): TableParse | null {
  const lignes = md.split('\n').filter((l) => TABLE_LINE.test(l));
  if (lignes.length < 2) return null;
  const isSeparator = (l: string) => cellulesDe(l).every((c) => /^:?-{2,}:?$/.test(c));
  const corps = (from: number) => ({
    headers: cellulesDe(lignes[from]),
    rows: lignes.slice(from + 1).filter((l) => !isSeparator(l)).map(cellulesDe),
  });
  const banniere = texteDeBanniere(cellulesDe(lignes[0]));
  if (banniere == null) return corps(0);
  let apresBandeau = 1;
  while (apresBandeau < lignes.length && isSeparator(lignes[apresBandeau])) apresBandeau++;
  const apres = apresBandeau < lignes.length ? corps(apresBandeau) : null;
  if (apres && estMajuscule(banniere) && apres.rows.length >= 1 && !estCleDePlage(apres.headers[0] ?? '')) {
    return { ...apres, titre: banniere };
  }
  return { ...corps(0), banniereRefusee: banniere };
}

/** Une table d'une section : le bloc qui la porte, sa lecture, le bloc de sa LÉGENDE `**X**` quand son
 *  titre en vient, et, TITRÉE, sa CLÉ d'adresse `titre#occ` — titre normalisé, `occ` = rang 1-based parmi
 *  les tables de même titre de la section. Sans titre, aucune clé : une position ne départage rien (#1739). */
export interface TableDeSection { block: Bloc; table: TableParse; legende?: Bloc; cle?: string }

/** Paragraphe LÉGENDE : un seul span gras, tout le bloc (#1739). */
const LEGENDE = /^\*\*([^*]+)\*\*$/;

/** Tables d'une section, dans l'ordre du document. Le `titre` est la bannière absorbée, sinon la
 *  légende `**X**` du bloc qui précède immédiatement la table. */
export function tablesOf(section: Section): TableDeSection[] {
  const vus = new Map<string, number>();
  return section.blocks.flatMap((b, i) => {
    const lue = parseTable(b.md);
    if (!lue) return [];
    const legende = lue.titre == null ? LEGENDE.exec(section.blocks[i - 1]?.md ?? '')?.[1] : undefined;
    const table = legende == null ? lue : { ...lue, titre: legende };
    const porte = legende == null ? { block: b, table } : { block: b, table, legende: section.blocks[i - 1] };
    const titre = normText(table.titre ?? '');
    if (!titre) return [porte];
    const occ = (vus.get(titre) ?? 0) + 1;
    vus.set(titre, occ);
    return [{ ...porte, cle: `${titre}#${occ}` }];
  });
}

/** Ligne de table dont une cellule vaut la clé cherchée. */
interface LigneTrouvee { block: Bloc; table?: string; headers: string[]; row: string[]; cols: number[] }

/**
 * Lignes d'une section dont une cellule vaut `target` (déjà normalisé), dans la table de clé `table`
 * si elle est donnée. Une ligne qui répond dans plusieurs de ses colonnes ne compte qu'une fois.
 */
function rowsMatching(section: Section, target: string, table?: string): LigneTrouvee[] {
  const out: LigneTrouvee[] = [];
  for (const t of tablesOf(section)) {
    if (table != null && t.cle !== table) continue;
    for (const row of t.table.rows) {
      const cols = row.map((c, i) => (normText(c) === target ? i : -1)).filter((i) => i >= 0);
      if (cols.length) out.push({ block: t.block, ...(t.cle == null ? {} : { table: t.cle }), headers: t.table.headers, row, cols });
    }
  }
  return out;
}

/** Nombre de lignes de la section que la clé `target` (normalisée) désigne, dans la table de clé `table`
 *  si elle est donnée — le critère d'adresse de `celluleBrute` et de `cellRefFor`. */
export const lignesDesignees = (section: Section, target: string, table?: string): number =>
  rowsMatching(section, target, table).length;

/** Les tables de la section qui portent la clé de ligne `row` (brute), dans la table de clé `table` si elle
 *  est donnée — celles des lignes de `rowsMatching`. */
export function tablesDeLaLigne(section: Section, row: string, table?: string): TableDeSection[] {
  const blocs = new Set(rowsMatching(section, normText(row), table).map((h) => h.block));
  return tablesOf(section).filter((t) => blocs.has(t.block));
}

/** Désignation lisible d'un fragment, portée par ses erreurs. */
const ouDe = (frag: Fragment): string =>
  frag.kind === 'cellule'
    ? `§${frag.sec}#${frag.secOcc}${frag.table == null ? '' : ` table[${frag.table}]`} [${frag.row}]×[${frag.col}]`
    : `§${frag.sec}#${frag.secOcc} blocs ${frag.b0}-${frag.b1}`;

/**
 * Md de BLOCS rendu AFFICHABLE : sur une ligne de TABLE seulement, le `<br>` compte pour une espace.
 * GFM n'a aucune façon de montrer un saut de ligne DANS une cellule (une rangée tient sur UNE ligne),
 * et `<Prose>` ne monte que `remarkGfm` (`src/ui/Prose.tsx:87`) — un `\n` de cellule y serait rendu
 * en espace de toute façon. La forme imprimée reste portée par la CHAÎNE d'une cellule adressée
 * (`brEnSaut`, `celluleBrute`) ; hors table, le md n'est pas touché — sans risque : le corpus VF
 * (16 livres de `BOOKS`) ne porte AUCUN `<br>` hors ligne de table, mesuré le 2026-09-14.
 */
const mdAffichable = (md: string): string =>
  md.split('\n').map((l) => (TABLE_LINE.test(l) ? sansBr(l) : l)).join('\n');

/** Résout un fragment de BLOCS (suite contiguë de blocs d'une section), empreinte NON vérifiée. */
function blocsBruts(chapitre: ChapitreParse, frag: FragmentBlocs): Resolu | ErreurResolution {
  const section = sectionDe(chapitre, frag);
  if (!section) return { error: 'section-inconnue', detail: `§${frag.sec}#${frag.secOcc}` };
  const { b0, b1 } = frag;
  if (!Number.isInteger(b0) || !Number.isInteger(b1) || b0 < 0 || b1 < b0 || b1 >= section.blocks.length) {
    return {
      error: 'bornes-hors-limites',
      detail: `${ouDe(frag)} (section : ${section.blocks.length} blocs)`,
    };
  }
  const blocks = section.blocks.slice(b0, b1 + 1);
  return { md: mdAffichable(blocks.map((b) => b.md).join('\n\n')), folios: foliosOf(blocks) };
}

/**
 * Résout un fragment de CELLULE (empreinte NON vérifiée) : la ligne dont une cellule vaut `row`
 * (recherche dans TOUTES les colonnes de la section), croisée avec l'en-tête `col`.
 */
function celluleBrute(chapitre: ChapitreParse, frag: FragmentCellule): Resolu | ErreurResolution {
  const section = sectionDe(chapitre, frag);
  if (!section) return { error: 'section-inconnue', detail: `§${frag.sec}#${frag.secOcc}` };
  const ou = ouDe(frag);
  const hits = rowsMatching(section, normText(String(frag.row ?? '')), frag.table);
  if (hits.length === 0) return { error: 'ligne-introuvable', detail: ou };
  if (hits.length > 1) return { error: 'ligne-ambigue', detail: `${ou} : ${hits.length} lignes` };
  const hit = hits[0];
  if (!hit.headers.some((h) => normText(h))) return { error: 'table-sans-en-tetes', detail: ou };
  const want = normText(String(frag.col ?? ''));
  const c = hit.headers.findIndex((h) => normText(h) === want);
  if (c < 0) return { error: 'colonne-inconnue', detail: `${ou} : en-têtes = ${hit.headers.join(' / ')}` };
  // Le `<br>` de la cellule REDEVIENT le saut de ligne qu'il imprime (`brEnSaut`) : la chaîne
  // rendue garde la coupure du livre sans porter de HTML (règle 5).
  return { md: brEnSaut(hit.row[c] ?? ''), folios: foliosOf([hit.block]) };
}

/** Texte d'un fragment, empreinte NON vérifiée. */
const resoudreBrut = (chapitre: ChapitreParse, frag: Fragment): Resolu | ErreurResolution =>
  frag.kind === 'cellule' ? celluleBrute(chapitre, frag) : blocsBruts(chapitre, frag);

/** Résout UN fragment d'un chapitre déjà parsé, empreinte comprise. */
export function resoudreFragment(chapitre: ChapitreParse, frag: Fragment): Resolu | ErreurResolution {
  const res = resoudreBrut(chapitre, frag);
  if (estErreur(res)) return res;
  return checkSum(frag, res.md, ouDe(frag)) ?? res;
}

/** Empreinte à POSER sur un fragment que l'on vient de bâtir (l'adresse n'en porte pas encore). */
export function empreinteDe(chapitre: ChapitreParse, frag: Fragment): string | ErreurResolution {
  const res = resoudreBrut(chapitre, frag);
  return estErreur(res) ? res : sumOf(res.md);
}

/** Bloc d'un chapitre vu à plat : son adresse de section, son rang, son texte normalisé. */
export interface BlocPlat { sec: string; secOcc: number; idx: number; md: string; norm: string }

/** Mémo par IDENTITÉ du chapitre parsé : la normalisation des ~1 300 blocs d'un chapitre est
 *  refaite à chaque recherche sans lui (le balayage d'un dataset en fait des dizaines de milliers). */
const _plats = new WeakMap<ChapitreParse, BlocPlat[]>();

/** Aplatit un chapitre en blocs adressables, en ordre de document. */
export function blocsPlats(chapitre: ChapitreParse): BlocPlat[] {
  const memo = _plats.get(chapitre);
  if (memo) return memo;
  const out: BlocPlat[] = [];
  for (const s of chapitre.sections) {
    s.blocks.forEach((b, idx) => {
      out.push({ sec: s.slug, secOcc: s.occ, idx, md: b.md, norm: normText(b.md) });
    });
  }
  _plats.set(chapitre, out);
  return out;
}

/** Toutes les positions du chapitre où un run contigu de blocs vaut exactement `target`. */
function runsBruts(blocks: BlocPlat[], target: string): { i: number; j: number }[] {
  const probe = target.slice(0, PROBE);
  const out: { i: number; j: number }[] = [];
  for (let i = 0; i < blocks.length; i++) {
    if (!blocks[i].norm || !blocks[i].norm.startsWith(probe.slice(0, blocks[i].norm.length))) continue;
    if (!target.startsWith(blocks[i].norm.slice(0, PROBE))) continue;
    const parts: string[] = [];
    for (let j = i; j < blocks.length; j++) {
      if (!blocks[j].norm) break;
      parts.push(blocks[j].norm);
      const acc = joinNorm(parts);
      if (acc === target) { out.push({ i, j }); break; }
      if (!target.startsWith(acc)) break;
    }
  }
  return out;
}

/** Convertit un run de blocs en fragments (un par section traversée), empreintes calculées. */
function runEnFragments(
  chapitre: ChapitreParse,
  blocks: BlocPlat[],
  run: { i: number; j: number },
): FragmentBlocs[] {
  const frags: FragmentBlocs[] = [];
  for (let k = run.i; k <= run.j; k++) {
    const b = blocks[k];
    const last = frags[frags.length - 1];
    if (last && last.sec === b.sec && last.secOcc === b.secOcc && b.idx === last.b1 + 1) {
      last.b1 = b.idx;
    } else {
      frags.push({ kind: 'blocs', sec: b.sec, secOcc: b.secOcc, b0: b.idx, b1: b.idx, sum: '' });
    }
  }
  for (const f of frags) {
    const sum = empreinteDe(chapitre, f);
    if (typeof sum === 'string') f.sum = sum;
  }
  return frags;
}

/**
 * TOUS les runs contigus de blocs du chapitre dont la concaténation normalisée vaut `targetNorm`,
 * chacun rendu en fragments prêts à adresser (un fragment par section traversée). `[]` si rien ne
 * correspond.
 *
 * L'ambiguïté d'un texte dans son chapitre devient ainsi OBSERVABLE : c'est ce que le relocaliseur
 * (`scripts/source/reparer-adresses.mjs`) doit voir pour refuser de poser au jugé — `findCells` rend
 * déjà tous ses hits, les blocs les rendent maintenant aussi.
 */
export function findAllRuns(chapitre: ChapitreParse, targetNorm: string): FragmentBlocs[][] {
  const blocks = blocsPlats(chapitre);
  return runsBruts(blocks, targetNorm).map((run) => runEnFragments(chapitre, blocks, run));
}

/**
 * Cherche dans UN chapitre le PREMIER run contigu de blocs dont la concaténation normalisée vaut
 * `targetNorm`, et le rend en fragments prêts à adresser. `null` si rien ne correspond.
 */
export function findRuns(chapitre: ChapitreParse, targetNorm: string): FragmentBlocs[] | null {
  const runs = findAllRuns(chapitre, targetNorm);
  return runs.length ? runs[0] : null;
}

/** Cellule d'un chapitre portant le texte cherché. */
export interface CelluleTrouvee { sec: string; secOcc: number; table?: string; headers: string[]; row: string[]; col: number }

/** Cellules du chapitre dont le texte normalisé vaut `targetNorm`. */
export function findCells(chapitre: ChapitreParse, targetNorm: string): CelluleTrouvee[] {
  const out: CelluleTrouvee[] = [];
  for (const s of chapitre.sections) {
    for (const hit of rowsMatching(s, targetNorm)) {
      for (const col of hit.cols) {
        out.push({ sec: s.slug, secOcc: s.occ, ...(hit.table == null ? {} : { table: hit.table }), headers: hit.headers, row: hit.row, col });
      }
    }
  }
  return out;
}

/**
 * Bâtit le fragment de cellule d'un `findCells` : clé de ligne = première cellule de la ligne qui la
 * désigne SANS AMBIGUÏTÉ dans sa section, les clés positionnelles (fourchette d100) passant en
 * dernier recours ; à défaut, dans SA table (`table`, #1739). Rend `null` si la ligne n'a pas de clé
 * sûre ou la table pas d'en-têtes.
 */
export function cellRefFor(chapitre: ChapitreParse, hit: CelluleTrouvee): FragmentCellule | null {
  const col = hit.headers[hit.col];
  if (!col || !normText(col)) return null;
  const section = chapitre.sections.find((s) => s.slug === hit.sec && s.occ === hit.secOcc);
  if (!section) return null;
  const vise = normText(hit.row[hit.col] ?? '');
  const candidates = hit.row
    .map((c, i) => ({ c: c.trim(), i }))
    .filter(({ c, i }) => c && i !== hit.col)
    .sort((a, b) => Number(estCleDePlage(a.c)) - Number(estCleDePlage(b.c)));
  for (const table of hit.table == null ? [undefined] : [undefined, hit.table]) {
    for (const { c } of candidates) {
      if (rowsMatching(section, normText(c), table).length !== 1) continue;
      const frag: FragmentCellule = { kind: 'cellule', sec: hit.sec, secOcc: hit.secOcc, row: c, col, ...(table == null ? {} : { table }), sum: '' };
      const sum = empreinteDe(chapitre, frag);
      if (typeof sum !== 'string') continue;
      const res = resoudreFragment(chapitre, { ...frag, sum });
      if (estErreur(res) || normText(res.md) !== vise) continue;
      return { ...frag, sum };
    }
  }
  return null;
}

/** Nombre de places du chapitre où le texte normalisé d'un fragment se retrouve à l'identique. */
function occurrences(chapitre: ChapitreParse, frag: Fragment, texteNorm: string): number {
  if (frag.kind === 'cellule') return findCells(chapitre, texteNorm).length;
  return runsBruts(blocsPlats(chapitre), texteNorm).length;
}

/**
 * Indices des BLOCS d'une section que ce fragment couvre — prédicat de couverture UNIQUE, partagé par
 * le verrou de chevauchement et par tout ce qui doit savoir ce qui est déjà cité (l'éditeur d'adresse,
 * pour offrir un fragment neuf sur un passage LIBRE). Un fragment de CELLULE couvre UN seul bloc :
 * celui de SA table, c'est-à-dire celui où la clé de ligne la résout SANS AMBIGUÏTÉ — la même
 * condition que `celluleBrute`. Deux tables d'une même section qui partagent une clé de ligne ne
 * résolvent pas (`ligne-ambigue`) : la couverture est alors VIDE, pas double.
 * Rend un ensemble VIDE quand la section ou la table n'existe pas — l'erreur est dite ailleurs.
 */
export function blocsCouverts(chapitre: ChapitreParse, frag: Fragment): Set<number> {
  const out = new Set<number>();
  const section = sectionDe(chapitre, frag);
  if (!section) return out;
  if (frag.kind === 'blocs') {
    for (let i = Math.max(0, frag.b0); i <= Math.min(frag.b1, section.blocks.length - 1); i++) out.add(i);
    return out;
  }
  const hits = rowsMatching(section, normText(String(frag.row ?? '')), frag.table);
  if (hits.length !== 1) return out;
  const idx = section.blocks.indexOf(hits[0].block);
  if (idx >= 0) out.add(idx);
  return out;
}

/**
 * Deux fragments d'un MONTAGE se recouvrent-ils ? Un montage cite des passages DISTINCTS : deux
 * fragments d'une MÊME section dont les blocs couverts se croisent (le cas dégénéré étant le fragment
 * répété, et le cas mixte la table entière PUIS une de ses cellules) rendraient le même texte deux
 * fois, et l'adresse dirait plus que le livre. Verrou STRUCTUREL, au même étage que le plafond de
 * trois fragments : ni l'éditeur ni une migration ne peuvent le contourner.
 *
 * L'erreur DÉSIGNE LE SECOND des deux (`fragment: j`) : c'est celui qu'on vient d'ajouter ou de
 * déplacer dans la quasi-totalité des gestes d'édition, donc celui à corriger ; son détail nomme le
 * premier, pour que l'auteur sache LEQUEL il redit.
 *
 * CE QUE LE VERROU NE COUVRE PAS : deux fragments de SECTIONS DIFFÉRENTES qui citent le même texte.
 * `fragment-ambigu` ne les attrape pas non plus quand chacun est unique DANS SON CHAPITRE au sens du
 * balayage de runs — un livre qui répète un encadré mot pour mot sous deux titres reste adressable
 * deux fois dans un même montage. Le juger demanderait de comparer les TEXTES résolus, pas les
 * positions : c'est une autre question, et elle n'a pas de cas mesuré.
 */
function chevauchementDe(chapitre: ChapitreParse, ref: DescRef): ErreurResolution | null {
  const memeSection = (a: Fragment, b: Fragment) => a.sec === b.sec && a.secOcc === b.secOcc;
  for (let i = 0; i < ref.parts.length; i++) {
    for (let j = i + 1; j < ref.parts.length; j++) {
      const a = ref.parts[i];
      const b = ref.parts[j];
      if (!memeSection(a, b)) continue;
      const couvertsA = blocsCouverts(chapitre, a);
      const memeCellule = a.kind === 'cellule' && b.kind === 'cellule' && a.row === b.row && a.col === b.col && a.table === b.table;
      const croise = memeCellule || [...blocsCouverts(chapitre, b)].some((k) => couvertsA.has(k));
      // Deux CELLULES du même bloc-table qui ne désignent PAS la même case citent bien deux textes.
      if (croise && !(a.kind === 'cellule' && b.kind === 'cellule' && !memeCellule)) {
        return {
          error: 'fragments-chevauchants',
          fragment: j,
          detail: `${ref.book} ch.${ref.ch} : ${ouDe(b)} cite le même passage que le fragment ${i + 1} (${ouDe(a)})`,
        };
      }
    }
  }
  return null;
}

/**
 * Résout une adresse complète : chaque fragment, joints par une ligne vide, folios en union
 * ordonnée. Un montage (2 fragments et plus) plafonne à trois fragments.
 *
 * RÈGLE D — le plancher de longueur et l'unicité ne valent que pour un fragment `blocs`. Un fragment
 * de blocs désigne son texte PAR CE TEXTE : trop court ou répété ailleurs, il retomberait sur un
 * autre passage à la première ré-extraction (769 des 5 397 blocs du livre de base portent un texte
 * qui apparaît ailleurs, mesure 2026-09-05). Une `cellule` ne désigne rien par son texte : elle est
 * adressée EXACTEMENT par (section, clé de ligne, en-tête de colonne), et l'ambiguïté d'une clé a
 * déjà son refus propre (`ligne-ambigue`, `resoudreFragment`). Lui appliquer le plancher rendait un
 * remède IMPOSSIBLE à l'écran — « étendez les bornes de blocs » sur un fragment qui n'a pas de
 * bornes (mesuré en recette : « Humain » d'une table de races, valide seul, refusé dès le 2ᵉ
 * fragment).
 */
export function resoudreAdresse(chapitre: ChapitreParse, ref: DescRef): Resolu | ErreurResolution {
  if (ref.parts.length > MAX_FRAGMENTS) {
    return {
      error: 'montage-hors-plafond',
      detail: `${ref.book} ch.${ref.ch} : ${ref.parts.length} fragments (plafond ${MAX_FRAGMENTS})`,
    };
  }
  const chevauchement = chevauchementDe(chapitre, ref);
  if (chevauchement) return chevauchement;
  const morceaux: string[] = [];
  const folios: number[] = [];
  for (let i = 0; i < ref.parts.length; i++) {
    const frag = ref.parts[i];
    const res = resoudreFragment(chapitre, frag);
    if (estErreur(res)) return { ...res, fragment: i };
    if (ref.parts.length > 1 && frag.kind === 'blocs') {
      const n = normText(res.md);
      const ou = `${ref.book} ch.${ref.ch} §${frag.sec}#${frag.secOcc}`;
      if (n.length < MIN_FRAGMENT) {
        return {
          error: 'fragment-trop-court',
          fragment: i,
          detail: `${ou} : ${n.length} caractères normalisés (minimum ${MIN_FRAGMENT})`,
        };
      }
      const vus = occurrences(chapitre, frag, n);
      if (vus !== 1) {
        return { error: 'fragment-ambigu', fragment: i, detail: `${ou} : ce texte apparaît ${vus} fois dans le chapitre` };
      }
    }
    morceaux.push(res.md);
    for (const f of res.folios) if (!folios.includes(f)) folios.push(f);
  }
  return { md: morceaux.join('\n\n'), folios };
}
