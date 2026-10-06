// Bibliothèque de DÉCOUPE des chapitres `Source/` : SOURCE UNIQUE du parsing et de la résolution.
// Une adresse rend la prose VERBATIM du livre sans la dupliquer ailleurs : un fragment de BLOCS
// — { sec, secOcc, b0, finSec?, finSecOcc?, b1 } — désigne une suite contiguë du FIL du chapitre
// (`filDuChapitre`), du bloc `b0` de sa section au bloc `b1` de sa section de fin, titres
// intermédiaires compris ; sa sœur, le fragment de CELLULE — { sec, secOcc, row, col } — rend une
// case de table par CLÉ (jamais par indice). Une `DescRef` monte jusqu'à `MAX_FRAGMENTS` fragments
// d'un même chapitre.
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

/** Fragment de BLOCS : l'INTERVALLE du fil (`filDuChapitre`) qui va du bloc `b0` de `sec#secOcc` au
 *  bloc `b1` de `finSec#finSecOcc` — par défaut la section de départ, et alors ABSENTE (forme
 *  canonique, `fragmentBlocs`) —, empreinte comprise. */
export interface FragmentBlocs {
  kind: 'blocs';
  sec: string;
  secOcc: number;
  b0: number;
  finSec?: string;
  finSecOcc?: number;
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

/** Adresse complète d'une prose : jusqu'à `MAX_FRAGMENTS` fragments d'un même chapitre d'un même livre. */
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
  | 'fragments-contigus'
  | 'fin-avant-depart'
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

export const estErreur = <T extends object>(r: T | ErreurResolution): r is ErreurResolution => 'error' in r;

/** Longueur normalisée minimale d'un texte DISCRIMINANT (en deçà, l'adresse n'est pas discriminante).
 *  Une `cellule` n'y est pas soumise — voir la règle D, `resoudreAdresse`. */
export const MIN_FRAGMENT = 40;
/** Nombre maximal de fragments d'une adresse. */
export const MAX_FRAGMENTS = 3;
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

/** Md d'un TITRE de section tel que le fil le rend (`filDuChapitre`) et que le texte libre le
 *  traduit (`unitesDuTexte`) : son titre affichable (`cleanTitle`, `Section.title`) en gras. */
const mdDuTitre = (titreAffichable: string): string => `**${titreAffichable}**`;

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

/**
 * Deux textes BRUTS sont-ils le même texte au sens de `normText` ? La comparaison « clé contre rendu »
 * et « rendu contre rendu » ; le texte libre contre un rendu passe par `aligner`.
 */
export const memeTexte = (a: string, b: string): boolean => normText(a) === normText(b);

/** Position d'une unité : section et rang du bloc (unité d'adresse ; `-1` pour le TITRE de la
 *  section, qui précède son bloc 0) ou rang du paragraphe (unité de texte), rang de ligne dans un
 *  bloc-table. */
export interface PositionDUnite { sec?: string; secOcc?: number; rang: number; ligne?: number }

/**
 * Unité de texte : ce que produisent le rendu d'un fragment (`unitesDe`) et la préparation d'un texte
 * libre (`unitesDuTexte`), et ce que compare `aligner`. Un rendu est la concaténation des `sep + md`.
 */
export interface Unite {
  md: string;
  /** Ce qui précède l'unité : rien pour la première, une ligne vide entre deux blocs ou deux
   *  paragraphes, un saut de ligne entre deux lignes d'un bloc-table. */
  sep: '' | '\n' | '\n\n';
  norm: string;
  pos: PositionDUnite;
  /** Descriptif : aucune décision ne le lit. */
  kind: 'titre' | 'bloc' | 'ligne' | 'cellule' | 'paragraphe';
  /** HABILLAGE d'adresse : la bannière absorbée par `parseTable` (`TableParse.titre`), la légende posée
   *  par `tablesOf` (`TableDeSection.legende`). `aligner` la consomme entière ou la saute ; une unité de
   *  texte n'en porte jamais. */
  habillage?: true;
}

/** Une unité, sa norme calculée. */
const unite = (md: string, sep: Unite['sep'], pos: PositionDUnite, kind: Unite['kind'], habillage = false): Unite =>
  ({ md, sep, norm: normText(md), pos, kind, ...(habillage ? { habillage: true as const } : {}) });

/** Une unité de CONTENU : de norme non vide, et pas une ligne délimiteuse de table (`estSeparateur`),
 *  qui est de la SYNTAXE. `aligner` ne compare que le contenu, des deux côtés. */
export const estDeContenu = (u: Unite): boolean => u.norm !== '' && !estSeparateur(u.md);

/**
 * LA découpe d'un paragraphe en morceaux d'unités, commune au rendu (`unitesDuBloc`) et au texte libre
 * (`unitesDuTexte`) : une unité par ligne si `parseTable` le lit comme une table, une seule sinon. Rend
 * aussi la lecture de table, dont le rendu tire sa bannière.
 */
function decoupeDuParagraphe(md: string): { lue: TableParse | null; morceaux: string[] } {
  const lue = parseTable(md);
  return { lue, morceaux: lue ? md.split('\n') : [md] };
}

/** Une ligne de titre markdown (`HEADING`) traduite en titre du fil (`mdDuTitre`) ; toute autre
 *  ligne telle quelle. */
const titreTraduit = (ligne: string): string => {
  const m = HEADING.exec(ligne);
  return m ? mdDuTitre(cleanTitle(m[2])) : ligne;
};

/**
 * Unités d'un TEXTE LIBRE, sa seule préparation : ses paragraphes (séparés par une ligne vide), découpés
 * comme un bloc (`decoupeDuParagraphe`), ceux de norme vide écartés ; une ligne de titre markdown y est
 * traduite comme le fil rend un titre de section (`titreTraduit`).
 */
export function unitesDuTexte(md: string): Unite[] {
  const out: Unite[] = [];
  md.split(/\n\s*\n/).forEach((p, rang) => {
    const { lue, morceaux } = decoupeDuParagraphe(p);
    morceaux.forEach((m, ligne) => {
      const pos = lue ? { rang, ligne } : { rang };
      const sep = !out.length ? '' : lue && ligne ? '\n' : '\n\n';
      const u = unite(m.split('\n').map(titreTraduit).join('\n'), sep, pos, lue ? 'ligne' : 'paragraphe');
      if (u.norm) out.push(u);
    });
  });
  return out;
}

/** Une coupe d'`aligner` : l'indice d'une unité d'adresse et la position de la coupe dans son `norm`. */
export interface Coupe { unite: number; coupe: number }

/** Ce qu'une adresse ajoute au texte : une unité non couverte (`entiere`), ou le reste d'une unité
 *  coupée, du côté où elle déborde. Nommé, jamais une chaîne ; un habillage sauté est `entiere`. */
export interface Ajout {
  unite: number;
  pos: PositionDUnite;
  kind: Unite['kind'];
  habillage?: true;
  cote: 'entiere' | 'gauche' | 'droite';
}

/** Témoin d'`aligner` : la LOCALISATION — la première et la dernière unité d'adresse touchées qui ne sont
 *  pas d'habillage, avec leurs coupes (début du texte dans la première, fin du texte dans la dernière),
 *  `null` quand le texte ne touche que de l'habillage —, et ce que l'adresse ajoute. */
export interface Alignement { couvertes: { premiere: Coupe; derniere: Coupe } | null; ajoute: Ajout[] }

/** Unités de contenu d'une adresse (`estDeContenu`), avec leur indice, et ce qu'`aligner` en tire. */
interface AdressePreparee { contenu: readonly { k: number; u: Unite }[]; chaine: string; habillee: boolean }

/** Mémo par IDENTITÉ d'une adresse GELÉE (`unitesDuBloc`) : sa préparation ne dépend que d'elle. */
const _preparees = new WeakMap<readonly Unite[], AdressePreparee>();

function preparee(adresse: readonly Unite[]): AdressePreparee {
  const memo = _preparees.get(adresse);
  if (memo) return memo;
  const contenu = adresse.flatMap((u, k) => (estDeContenu(u) ? [{ k, u }] : []));
  const p = { contenu, chaine: joinNorm(contenu.map((x) => x.u.norm)), habillee: contenu.some((x) => x.u.habillage) };
  if (Object.isFrozen(adresse)) _preparees.set(adresse, p);
  return p;
}

/** Ce qui sépare deux normes dans une chaîne jointe (`joinNorm`) : rien au contact d'un `|`. */
const jonction = (a: string, b: string): string => (a.endsWith('|') || b.startsWith('|') ? '' : ' ');

/** Un alignement candidat : les indices de contenu touchés, la coupe dans le premier, la fin dans le dernier. */
interface Chemin { touchees: number[]; coupe: number; fin: number }

/** `c` est-il préférable à `m` : plus d'unités touchées, puis la position la plus tôt ? */
const prefere = (c: Chemin, m: Chemin | null): boolean =>
  !m || c.touchees.length > m.touchees.length
  || (c.touchees.length === m.touchees.length && (c.touchees[0] < m.touchees[0] || (c.touchees[0] === m.touchees[0] && c.coupe < m.coupe)));

/**
 * Les alignements de `t` sur le contenu d'une adresse, le préféré (`prefere`) retenu : `t` y commence
 * dans une unité, se poursuit unité après unité — un habillage se saute —, et un habillage touché l'est
 * en entier.
 */
function meilleurChemin(t: string, contenu: AdressePreparee['contenu']): Chemin | null {
  let meilleur: Chemin | null = null;
  const retenir = (c: Chemin) => { if (prefere(c, meilleur)) meilleur = c; };
  const prolonger = (i: number, lu: number, chemin: number[], coupe: number) => {
    for (let q = i + 1; q < contenu.length; q++) {
      const u = contenu[q].u;
      const j = jonction(contenu[i].u.norm, u.norm);
      if (t.startsWith(j, lu)) {
        const m = lu + j.length;
        if (u.norm.startsWith(t.slice(m))) {
          if (!u.habillage || u.norm.length === t.length - m) retenir({ touchees: [...chemin, q], coupe, fin: t.length - m });
        } else if (t.startsWith(u.norm, m)) {
          prolonger(q, m + u.norm.length, [...chemin, q], coupe);
        }
      }
      if (!u.habillage) break;
    }
  };
  contenu.forEach(({ u }, p) => {
    for (let o = u.norm.indexOf(t[0]); o >= 0 && (!u.habillage || o === 0); o = u.norm.indexOf(t[0], o + 1)) {
      if (u.norm.startsWith(t, o)) {
        if (!u.habillage || u.norm.length === t.length) retenir({ touchees: [p], coupe: o, fin: o + t.length });
      } else if (t.startsWith(u.norm.slice(o))) {
        prolonger(p, u.norm.length - o, [p], o);
      }
    }
  });
  return meilleur;
}

/**
 * LA décision « texte libre contre rendu », sur le CONTENU des deux côtés (`estDeContenu` : la syntaxe
 * n'est ni comparée ni un ajout) : la chaîne du texte (`joinNorm` de ses unités) est-elle une sous-chaîne
 * de celle de l'adresse, dont chaque unité d'HABILLAGE est soit CONSOMMÉE ENTIÈRE, soit SAUTÉE — jamais
 * consommée en partie ? Entre deux alignements, le plus d'unités touchées, puis la position la plus tôt
 * (`meilleurChemin`). `null` sinon. L'ÉGALITÉ est un alignement dont `ajoute` est vide, la PARTIE STRICTE
 * un alignement dont `ajoute` ne l'est pas ; un habillage sauté est un ajout. Un texte sans unité de
 * contenu est refusé.
 */
export function aligner(texte: readonly Unite[], adresse: readonly Unite[]): Alignement | null {
  const t = joinNorm(texte.filter(estDeContenu).map((u) => u.norm));
  if (!t) throw new RangeError('aligner : texte sans unité de contenu');
  const { contenu, chaine, habillee } = preparee(adresse);
  if (!habillee && !chaine.includes(t)) return null;
  const choisi = meilleurChemin(t, contenu);
  if (!choisi) return null;

  const touchees = new Set(choisi.touchees);
  const tete = choisi.touchees[0];
  const queue = choisi.touchees[choisi.touchees.length - 1];
  const ajoute: Ajout[] = [];
  contenu.forEach(({ k, u }, i) => {
    const nomme = (cote: Ajout['cote']): Ajout =>
      ({ unite: k, pos: u.pos, kind: u.kind, ...(u.habillage ? { habillage: true as const } : {}), cote });
    if (!touchees.has(i)) { ajoute.push(nomme('entiere')); return; }
    if (i === tete && choisi.coupe > 0) ajoute.push(nomme('gauche'));
    if (i === queue && choisi.fin < u.norm.length) ajoute.push(nomme('droite'));
  });
  const localisees = choisi.touchees.filter((i) => !contenu[i].u.habillage);
  if (!localisees.length) return { couvertes: null, ajoute };
  const premiere = localisees[0];
  const derniere = localisees[localisees.length - 1];
  return {
    couvertes: {
      premiere: { unite: contenu[premiere].k, coupe: premiere === tete ? choisi.coupe : 0 },
      derniere: { unite: contenu[derniere].k, coupe: derniere === queue ? choisi.fin : contenu[derniere].u.norm.length },
    },
    ajoute,
  };
}

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

/** Ligne DÉLIMITEUSE de table GFM : `|` initial, chaque cellule faite d'au moins un tiret, bordé ou
 *  non de `:` (`| --- | :-: |`, `|-|-|`). Une cellule vide la refuse (`|--||`). */
export function estSeparateur(ligne: string): boolean {
  return /^\s*\|/.test(ligne) && cellulesDe(ligne).every((c) => /^:?-+:?$/.test(c));
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
 * `| Mouvement | … |`, `15 - Deplacement.md:18-20`) : le saut passe donc la bannière ET les
 * séparateurs qui la suivent, sans quoi les en-têtes seraient la ligne de tirets.
 * TROISIÈME volet de la garde : une bannière suivie DIRECTEMENT de données, sans rangée d'en-têtes
 * (`46 - Les regles magiques.md:34-36`, « TABLEAU DES INCANTATIONS IMPARFAITES MINEURES » puis
 * `| 01-05 | Signe de Sorcière… |`) n'est pas absorbable : la sauter promeut une FOURCHETTE en
 * en-tête et fait perdre à la table sa première rangée. `estCleDePlage` le reconnaît.
 * Seuil « ≥ 2 lettres » : le plancher mesuré du corpus est épinglé par le test
 * « tout titre absorbé du corpus a au moins 4 lettres » (`decoupe.test.ts`).
 */
export function parseTable(md: string): TableParse | null {
  const lignes = md.split('\n').filter((l) => TABLE_LINE.test(l));
  if (lignes.length < 2) return null;
  const corps = (from: number) => ({
    headers: cellulesDe(lignes[from]),
    rows: lignes.slice(from + 1).filter((l) => !estSeparateur(l)).map(cellulesDe),
  });
  const banniere = texteDeBanniere(cellulesDe(lignes[0]));
  if (banniere == null) return corps(0);
  let apresBandeau = 1;
  while (apresBandeau < lignes.length && estSeparateur(lignes[apresBandeau])) apresBandeau++;
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

/** Ligne de table dont une cellule vaut la clé cherchée, et son rang parmi les rangées de sa table. */
interface LigneTrouvee { block: Bloc; table?: string; headers: string[]; row: string[]; rangee: number; cols: number[] }

/** Recherche d'une CLÉ DÉJÀ NORMALISÉE : la case (ou l'en-tête) brute vaut-elle `cle` ? La clé ne se
 *  renormalise pas à chaque case. Préfiltre par égalité de chaîne, #2253. */
const caseVautCle = (brute: string, cle: string): boolean => normText(brute) === cle;

/**
 * Lignes d'une section dont une cellule vaut `target` (déjà normalisé, `caseVautCle`), dans la table
 * de clé `table` si elle est donnée. Une ligne qui répond dans plusieurs de ses colonnes ne compte
 * qu'une fois. Préfiltre des chercheurs, #2253.
 */
function rowsMatching(section: Section, target: string, table?: string): LigneTrouvee[] {
  const out: LigneTrouvee[] = [];
  for (const t of tablesOf(section)) {
    if (table != null && t.cle !== table) continue;
    t.table.rows.forEach((row, rangee) => {
      const cols = row.map((c, i) => (caseVautCle(c, target) ? i : -1)).filter((i) => i >= 0);
      if (cols.length) out.push({ block: t.block, ...(t.cle == null ? {} : { table: t.cle }), headers: t.table.headers, row, rangee, cols });
    });
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

/** Désignation lisible d'un fragment, portée par ses erreurs et par les rapports de l'outillage. */
export const ouDe = (frag: Fragment): string =>
  frag.kind === 'cellule'
    ? `§${frag.sec}#${frag.secOcc}${frag.table == null ? '' : ` table[${frag.table}]`} [${frag.row}]×[${frag.col}]`
    : frag.finSec == null
      ? `§${frag.sec}#${frag.secOcc} blocs ${frag.b0}-${frag.b1}`
      : `§${frag.sec}#${frag.secOcc} bloc ${frag.b0} → §${frag.finSec}#${frag.finSecOcc} bloc ${frag.b1}`;

/** Désignation lisible d'une adresse entière, ses fragments joints par ` + `. */
export const ouDeLAdresse = (ref: DescRef): string => `${ref.book} ch.${ref.ch} ${ref.parts.map(ouDe).join(' + ')}`;

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

/** Unités d'un fragment : celles que son rendu assemble, et ses folios. */
export interface UnitesResolues { unites: Unite[]; folios: number[] }

/** Mémo par IDENTITÉ du bloc : ses unités ne dépendent que de lui et de sa place. Partagé par tous
 *  les appelants, il est GELÉ (tableau, unités, positions). */
const _unitesDuBloc = new WeakMap<Bloc, readonly Unite[]>();

/** Une unité gelée, position comprise. */
const gelee = (u: Unite): Unite => Object.freeze({ ...u, pos: Object.freeze(u.pos) });

/** Unités du bloc `rang` d'une section, découpé comme un paragraphe (`decoupeDuParagraphe`) : une par
 *  ligne d'un bloc-table, une pour tout autre bloc ; `md` affichable (`mdAffichable`), la première sans
 *  séparateur. HABILLAGE : la ligne de la bannière absorbée (`TableParse.titre`, première ligne de table),
 *  le bloc légende d'une table de la section (`tablesOf`). Gelées (`_unitesDuBloc`). */
export function unitesDuBloc(section: Section, rang: number): readonly Unite[] {
  const b = section.blocks[rang];
  const memo = _unitesDuBloc.get(b);
  if (memo) return memo;
  const pos = { sec: section.slug, secOcc: section.occ, rang };
  const { lue, morceaux } = decoupeDuParagraphe(b.md);
  const banniere = lue?.titre == null ? -1 : morceaux.findIndex((l) => TABLE_LINE.test(l));
  const legende = !lue && LEGENDE.test(b.md) && tablesOf(section).some((t) => t.legende === b);
  const unites = Object.freeze((lue
    ? morceaux.map((l, ligne) => unite(mdAffichable(l), ligne ? '\n' : '', { ...pos, ligne }, 'ligne', ligne === banniere))
    : [unite(mdAffichable(b.md), '', pos, 'bloc', legende)]).map(gelee));
  _unitesDuBloc.set(b, unites);
  return unites;
}

/** Élément du FIL d'un chapitre : le TITRE d'une section à son ouverture (`mdDuTitre`), puis chacun
 *  de ses blocs à son rang `idx` ; `norm` est son texte normalisé. */
export type ElementDuFil =
  | { kind: 'titre'; sec: string; secOcc: number; md: string; norm: string }
  | { kind: 'bloc'; sec: string; secOcc: number; idx: number; md: string; norm: string };

/** Un bloc du fil désigné par sa section et son rang : le départ ou la fin d'un intervalle. */
export type BlocDuFil = Pick<Extract<ElementDuFil, { kind: 'bloc' }>, 'sec' | 'secOcc' | 'idx'>;

/** Le fil d'un chapitre, et la POSITION au fil du bloc 0 de chaque section (`cleSection`). */
interface FilIndexe { fil: readonly ElementDuFil[]; premierBloc: ReadonlyMap<string, number>; sections: ReadonlyMap<string, Section> }

/** Clé d'une section dans l'index du fil. */
const cleSection = (sec: string, secOcc: number): string => `${sec}#${secOcc}`;

/** Mémo par IDENTITÉ du chapitre parsé : la normalisation des ~1 300 blocs d'un chapitre est
 *  refaite à chaque recherche sans lui (le balayage d'un dataset en fait des dizaines de milliers). */
const _fils = new WeakMap<ChapitreParse, FilIndexe>();

function filIndexe(chapitre: ChapitreParse): FilIndexe {
  const memo = _fils.get(chapitre);
  if (memo) return memo;
  const fil: ElementDuFil[] = [];
  const premierBloc = new Map<string, number>();
  const sections = new Map<string, Section>();
  for (const s of chapitre.sections) {
    // Le préambule d'extraction (niveau 0) n'ouvre sur aucun titre.
    if (s.level > 0) {
      const md = mdDuTitre(s.title);
      fil.push({ kind: 'titre', sec: s.slug, secOcc: s.occ, md, norm: normText(md) });
    }
    premierBloc.set(cleSection(s.slug, s.occ), fil.length);
    sections.set(cleSection(s.slug, s.occ), s);
    s.blocks.forEach((b, idx) => {
      fil.push({ kind: 'bloc', sec: s.slug, secOcc: s.occ, idx, md: b.md, norm: normText(b.md) });
    });
  }
  const indexe = { fil, premierBloc, sections };
  _fils.set(chapitre, indexe);
  return indexe;
}

/** Le FIL d'un chapitre, en ordre de document : chaque section y ouvre sur son titre, puis ses blocs. */
export const filDuChapitre = (chapitre: ChapitreParse): readonly ElementDuFil[] => filIndexe(chapitre).fil;

/** POSITION au fil du bloc `idx` de la section `sec#secOcc`, ou `null` s'il n'existe pas. */
export function positionDuBloc(chapitre: ChapitreParse, { sec, secOcc, idx }: BlocDuFil): number | null {
  const { premierBloc, sections } = filIndexe(chapitre);
  const section = sections.get(cleSection(sec, secOcc));
  if (!section || !Number.isInteger(idx) || idx < 0 || idx >= section.blocks.length) return null;
  return premierBloc.get(cleSection(sec, secOcc))! + idx;
}

/** Le départ et la fin d'un fragment de BLOCS. */
const departDe = (frag: FragmentBlocs): BlocDuFil => ({ sec: frag.sec, secOcc: frag.secOcc, idx: frag.b0 });
export const finDe = (frag: FragmentBlocs): BlocDuFil => ({ sec: frag.finSec ?? frag.sec, secOcc: frag.finSecOcc ?? frag.secOcc, idx: frag.b1 });

/** Positions au fil du départ et de la fin d'un fragment de BLOCS, ou l'erreur qui l'en empêche. */
function bornesAuFil(chapitre: ChapitreParse, frag: FragmentBlocs): { depart: number; fin: number } | ErreurResolution {
  const { sections } = filIndexe(chapitre);
  const bornes: number[] = [];
  for (const [quelle, b] of [['départ', departDe(frag)], ['fin', finDe(frag)]] as const) {
    const section = sections.get(cleSection(b.sec, b.secOcc));
    if (!section) return { error: 'section-inconnue', detail: `§${b.sec}#${b.secOcc}` };
    const p = positionDuBloc(chapitre, b);
    if (p == null) {
      const laquelle = frag.finSec == null ? 'section' : `section de ${quelle} §${b.sec}#${b.secOcc}`;
      return { error: 'bornes-hors-limites', detail: `${ouDe(frag)} (${laquelle} : ${section.blocks.length} blocs)` };
    }
    bornes.push(p);
  }
  const [depart, fin] = bornes;
  if (fin < depart) return { error: 'fin-avant-depart', detail: `${ouDe(frag)} : la fin précède le départ dans le chapitre` };
  return { depart, fin };
}

/**
 * Unités d'un fragment de BLOCS, empreinte NON vérifiée : les éléments du fil de son départ à sa fin,
 * titres intermédiaires compris (le titre de la section de départ précède le départ : jamais rendu).
 * Ses folios, dans l'ordre : le courant du départ, puis les marqueurs internes de chaque bloc rendu
 * et le folio de chaque titre rendu (`Section.folio`, qui porte le marqueur de sa ligne).
 */
function blocsBruts(chapitre: ChapitreParse, frag: FragmentBlocs): UnitesResolues | ErreurResolution {
  const bornes = bornesAuFil(chapitre, frag);
  if (estErreur(bornes)) return bornes;
  const { fil, sections } = filIndexe(chapitre);
  const unites: Unite[] = [];
  const folios: (number | null)[] = [];
  for (let p = bornes.depart; p <= bornes.fin; p++) {
    const el = fil[p];
    const section = sections.get(cleSection(el.sec, el.secOcc))!;
    const sep = p === bornes.depart ? '' : '\n\n';
    if (el.kind === 'titre') {
      unites.push(unite(el.md, sep, { sec: el.sec, secOcc: el.secOcc, rang: -1 }, 'titre'));
      folios.push(section.folio);
      continue;
    }
    const bloc = section.blocks[el.idx];
    if (!sep) folios.push(bloc.folio);
    folios.push(...bloc.folios);
    const [tete, ...reste] = unitesDuBloc(section, el.idx);
    unites.push(sep ? { ...tete, sep } : tete, ...reste);
  }
  return { unites, folios: [...new Set(folios.filter((f): f is number => f != null))] };
}

/**
 * Unité d'un fragment de CELLULE (empreinte NON vérifiée) : la case de la ligne dont une cellule vaut
 * `row` (recherche dans TOUTES les colonnes de la section), croisée avec l'en-tête `col`.
 */
function celluleBrute(chapitre: ChapitreParse, frag: FragmentCellule): UnitesResolues | ErreurResolution {
  const section = sectionDe(chapitre, frag);
  if (!section) return { error: 'section-inconnue', detail: `§${frag.sec}#${frag.secOcc}` };
  const ou = ouDe(frag);
  const hits = rowsMatching(section, normText(String(frag.row ?? '')), frag.table);
  if (hits.length === 0) return { error: 'ligne-introuvable', detail: ou };
  if (hits.length > 1) return { error: 'ligne-ambigue', detail: `${ou} : ${hits.length} lignes` };
  const hit = hits[0];
  if (!hit.headers.some((h) => normText(h))) return { error: 'table-sans-en-tetes', detail: ou };
  const col = normText(String(frag.col ?? ''));
  const c = hit.headers.findIndex((h) => caseVautCle(h, col));
  if (c < 0) return { error: 'colonne-inconnue', detail: `${ou} : en-têtes = ${hit.headers.join(' / ')}` };
  // Le `<br>` de la cellule REDEVIENT le saut de ligne qu'il imprime (`brEnSaut`) : la chaîne
  // rendue garde la coupure du livre sans porter de HTML (règle 5).
  const pos = { sec: section.slug, secOcc: section.occ, rang: section.blocks.indexOf(hit.block) };
  return { unites: [unite(brEnSaut(hit.row[c] ?? ''), '', pos, 'cellule')], folios: foliosOf([hit.block]) };
}

/** Unités d'un fragment, empreinte NON vérifiée : ce que son rendu assemble (`resoudreBrut`). */
export const unitesDe = (chapitre: ChapitreParse, frag: Fragment): UnitesResolues | ErreurResolution =>
  frag.kind === 'cellule' ? celluleBrute(chapitre, frag) : blocsBruts(chapitre, frag);

/** Le rendu d'unités : la concaténation de leurs `sep + md`, seul assemblage. */
const assembler = (unites: readonly Unite[]): string => unites.map((x) => x.sep + x.md).join('');

/** Le texte résolu que des unités assemblent. */
const resolu = (u: UnitesResolues): Resolu => ({ md: assembler(u.unites), folios: u.folios });

/** Texte d'un fragment, empreinte NON vérifiée : l'assemblage de ses unités (`unitesDe`), seul chemin. */
function resoudreBrut(chapitre: ChapitreParse, frag: Fragment): Resolu | ErreurResolution {
  const u = unitesDe(chapitre, frag);
  return estErreur(u) ? u : resolu(u);
}

/** Unités d'UN fragment, empreinte comprise. */
function unitesVerifiees(chapitre: ChapitreParse, frag: Fragment): UnitesResolues | ErreurResolution {
  const u = unitesDe(chapitre, frag);
  if (estErreur(u)) return u;
  return checkSum(frag, assembler(u.unites), ouDe(frag)) ?? u;
}

/** Résout UN fragment d'un chapitre déjà parsé, empreinte comprise. */
export function resoudreFragment(chapitre: ChapitreParse, frag: Fragment): Resolu | ErreurResolution {
  const u = unitesVerifiees(chapitre, frag);
  return estErreur(u) ? u : resolu(u);
}

/** Empreinte à POSER sur un fragment que l'on vient de bâtir (l'adresse n'en porte pas encore). */
export function empreinteDe(chapitre: ChapitreParse, frag: Fragment): string | ErreurResolution {
  const res = resoudreBrut(chapitre, frag);
  return estErreur(res) ? res : sumOf(res.md);
}

/** Le fragment scellé (`sum` posé par `empreinteDe`), ou l'erreur de sa résolution. */
function scelleOuErreur<F extends Fragment>(chapitre: ChapitreParse, frag: F): F | ErreurResolution {
  const sum = empreinteDe(chapitre, frag);
  return typeof sum === 'string' ? { ...frag, sum } : sum;
}

/** SCELLE un fragment sur un chapitre : son `sum` est l'empreinte du texte qu'il résout, jamais une
 *  saisie ; vide quand il ne résout pas, et `resoudreFragment` dit alors pourquoi. */
export function scelle<F extends Fragment>(chapitre: ChapitreParse, frag: F): F {
  const s = scelleOuErreur(chapitre, frag);
  return estErreur(s) ? { ...frag, sum: '' } : s;
}

/** Ce que désigne un fragment de BLOCS : sa section et ses bornes, et sa section de fin quand elle
 *  n'est pas celle du départ. */
export type ChoixDeBlocs = Pick<FragmentBlocs, 'sec' | 'secOcc' | 'b0' | 'finSec' | 'finSecOcc' | 'b1'>;

/** Ce que désigne un fragment de CELLULE : sa section, sa clé de ligne, son en-tête de colonne et,
 *  posée, la clé de sa table. */
export type ChoixDeCellule = Pick<FragmentCellule, 'sec' | 'secOcc' | 'row' | 'col' | 'table'>;

/** Le fragment de BLOCS non scellé d'un choix, sous sa forme CANONIQUE : une section de fin égale à
 *  celle du départ n'est pas écrite. */
function blocsDe({ sec, secOcc, b0, finSec, finSecOcc, b1 }: ChoixDeBlocs): FragmentBlocs {
  const fin = finSec ?? sec;
  const finOcc = finSecOcc ?? secOcc;
  return fin === sec && finOcc === secOcc
    ? { kind: 'blocs', sec, secOcc, b0, b1, sum: '' }
    : { kind: 'blocs', sec, secOcc, b0, finSec: fin, finSecOcc: finOcc, b1, sum: '' };
}

/** Le fragment de BLOCS d'un choix, scellé (`scelle`), sous sa forme canonique (`blocsDe`). */
export const fragmentBlocs = (chapitre: ChapitreParse, choix: ChoixDeBlocs): FragmentBlocs =>
  scelle(chapitre, blocsDe(choix));

/** L'INTERVALLE du fil qui va du bloc `depart` au bloc `fin`, scellé (`fragmentBlocs`). */
export const intervalleDe = (chapitre: ChapitreParse, depart: BlocDuFil, fin: BlocDuFil): FragmentBlocs =>
  fragmentBlocs(chapitre, { sec: depart.sec, secOcc: depart.secOcc, b0: depart.idx, finSec: fin.sec, finSecOcc: fin.secOcc, b1: fin.idx });

/** Le fragment de CELLULE d'un choix, scellé (`scelle`) ; sans clé de table, il n'en porte aucune. */
export function fragmentCellule(chapitre: ChapitreParse, { sec, secOcc, row, col, table }: ChoixDeCellule): FragmentCellule {
  return scelle(chapitre, { kind: 'cellule', sec, secOcc, row, col, ...(table == null ? {} : { table }), sum: '' });
}

/** Ce qu'adresse `adresseDe` : une section, ou une table de section — et, `fin` posée, l'INTERVALLE du fil
 *  qu'elle ouvre jusqu'à ce bloc. */
export interface CibleDAdresse { section: Section; table?: TableDeSection; fin?: BlocDuFil }

/** Adresse d'une cible — section entière, ou légende et bloc d'une table (le tableau ENTIER) ; avec `fin`,
 *  de ce même départ jusqu'au bloc `fin` — dans le chapitre `ch` du livre `book`, empreinte calculée au
 *  texte résolu ; l'erreur de résolution sinon (section sans bloc, fin avant le départ). */
export function adresseDe(
  { book, ch }: Pick<DescRef, 'book' | 'ch'>, chapitre: ChapitreParse, { section, table, fin }: CibleDAdresse,
): DescRef | ErreurResolution {
  const b0 = table ? section.blocks.indexOf(table.legende ?? table.block) : 0;
  const arrivee = fin ?? { sec: section.slug, secOcc: section.occ, idx: table ? section.blocks.indexOf(table.block) : section.blocks.length - 1 };
  const frag = scelleOuErreur(chapitre, blocsDe({
    sec: section.slug, secOcc: section.occ, b0, finSec: arrivee.sec, finSecOcc: arrivee.secOcc, b1: arrivee.idx,
  }));
  return estErreur(frag) ? frag : { book, ch, parts: [frag] };
}

/**
 * PRÉFILTRE des chercheurs de blocs : toutes les positions du fil où un run contigu, commencé et
 * fini sur un élément `bloc` (titres intermédiaires compris), a une chaîne jointe (`joinNorm`) ÉGALE à
 * `target`. Les `startsWith` sont ses coupes, l'égalité sa décision de candidat ; pour `judge`, la
 * décision d'adresse reste `aligner`. Son COMPTE décide l'unicité d'un fragment de blocs
 * (`occurrences`, règle D). #2253.
 */
function runsPrefiltre(fil: readonly ElementDuFil[], target: string): { i: number; j: number }[] {
  const probe = target.slice(0, PROBE);
  const out: { i: number; j: number }[] = [];
  for (let i = 0; i < fil.length; i++) {
    if (fil[i].kind !== 'bloc') continue;
    if (!fil[i].norm || !fil[i].norm.startsWith(probe.slice(0, fil[i].norm.length))) continue;
    if (!target.startsWith(fil[i].norm.slice(0, PROBE))) continue;
    const parts: string[] = [];
    for (let j = i; j < fil.length; j++) {
      if (!fil[j].norm) break;
      parts.push(fil[j].norm);
      const acc = joinNorm(parts);
      if (acc === target && fil[j].kind === 'bloc') { out.push({ i, j }); break; }
      if (!target.startsWith(acc)) break;
    }
  }
  return out;
}

/** Le fragment d'un run du fil (`runsPrefiltre`) : UN intervalle de son premier à son dernier bloc. */
function fragmentDuRun(chapitre: ChapitreParse, run: { i: number; j: number }): FragmentBlocs {
  const fil = filDuChapitre(chapitre);
  return intervalleDe(chapitre, fil[run.i] as BlocDuFil, fil[run.j] as BlocDuFil);
}

/**
 * TOUS les runs contigus du fil dont la chaîne jointe vaut `targetNorm` (`runsPrefiltre`), chacun
 * rendu en UN fragment prêt à adresser (`fragmentDuRun`). `[]` si rien ne correspond. Des
 * CANDIDATS : `judge` en décide par `aligner` (`verifier`), le relocaliseur par le rendu à l'octet de
 * l'adresse proposée.
 *
 * L'ambiguïté d'un texte dans son chapitre devient ainsi OBSERVABLE : c'est ce que le relocaliseur
 * (`scripts/source/reparer-adresses.mjs`) doit voir pour refuser de poser au jugé — `findCells` rend
 * déjà tous ses hits, les blocs les rendent maintenant aussi.
 */
export function findAllRuns(chapitre: ChapitreParse, targetNorm: string): FragmentBlocs[] {
  return runsPrefiltre(filDuChapitre(chapitre), targetNorm).map((run) => fragmentDuRun(chapitre, run));
}

/**
 * Cherche dans UN chapitre le PREMIER run contigu du fil dont la chaîne jointe vaut `targetNorm`
 * (`findAllRuns`), et le rend en fragment prêt à adresser. `null` si rien ne correspond.
 */
export function findRuns(chapitre: ChapitreParse, targetNorm: string): FragmentBlocs | null {
  return findAllRuns(chapitre, targetNorm)[0] ?? null;
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
 * dernier recours ; à défaut, dans SA table (`table`, #1739). Le fragment retenu rend la même case
 * (`memeTexte`). Rend `null` si la ligne n'a pas de clé sûre ou la table pas d'en-têtes.
 */
export function cellRefFor(chapitre: ChapitreParse, hit: CelluleTrouvee): FragmentCellule | null {
  const col = hit.headers[hit.col];
  if (!col || !normText(col)) return null;
  const section = chapitre.sections.find((s) => s.slug === hit.sec && s.occ === hit.secOcc);
  if (!section) return null;
  const vise = hit.row[hit.col] ?? '';
  const candidates = hit.row
    .map((c, i) => ({ c: c.trim(), i }))
    .filter(({ c, i }) => c && i !== hit.col)
    .sort((a, b) => Number(estCleDePlage(a.c)) - Number(estCleDePlage(b.c)));
  for (const table of hit.table == null ? [undefined] : [undefined, hit.table]) {
    for (const { c } of candidates) {
      if (rowsMatching(section, normText(c), table).length !== 1) continue;
      const frag = fragmentCellule(chapitre, { sec: hit.sec, secOcc: hit.secOcc, row: c, col, table });
      const res = resoudreFragment(chapitre, frag);
      if (estErreur(res) || !memeTexte(res.md, vise)) continue;
      return frag;
    }
  }
  return null;
}

/** Nombre de places du chapitre où le texte normalisé d'un fragment se retrouve à l'identique. */
function occurrences(chapitre: ChapitreParse, frag: Fragment, texteNorm: string): number {
  if (frag.kind === 'cellule') return findCells(chapitre, texteNorm).length;
  return runsPrefiltre(filDuChapitre(chapitre), texteNorm).length;
}

/** Ce qu'un fragment COUVRE : les positions au fil (`filDuChapitre`) des blocs qu'il rend et, pour une
 *  CELLULE, sa case (rangée et colonne de sa table) dans le bloc-table qui la porte. */
export interface Couverture { blocs: ReadonlySet<number>; case?: { rangee: number; colonne: number } }

const AUCUNE_COUVERTURE: Couverture = Object.freeze({ blocs: new Set<number>() });

/**
 * Couverture d'un fragment — prédicat de couverture UNIQUE, partagé par le verrou de chevauchement et
 * par tout ce qui doit savoir ce qui est déjà cité (l'éditeur d'adresse, pour offrir un fragment neuf
 * sur un passage LIBRE). Un fragment de BLOCS couvre les positions des éléments `bloc` de son
 * intervalle ; un fragment de CELLULE, la position du bloc de SA table, celui où la clé de ligne la
 * résout SANS AMBIGUÏTÉ — la même condition que `celluleBrute` —, et sa case. Deux tables d'une même
 * section qui partagent une clé de ligne ne résolvent pas (`ligne-ambigue`) : la couverture est alors
 * VIDE, pas double. VIDE aussi quand le fragment ne résout pas — l'erreur est dite ailleurs.
 */
export function couvertureDe(chapitre: ChapitreParse, frag: Fragment): Couverture {
  if (frag.kind === 'blocs') {
    const bornes = bornesAuFil(chapitre, frag);
    if (estErreur(bornes)) return AUCUNE_COUVERTURE;
    const fil = filDuChapitre(chapitre);
    const blocs = new Set<number>();
    for (let p = bornes.depart; p <= bornes.fin; p++) if (fil[p].kind === 'bloc') blocs.add(p);
    return { blocs };
  }
  const section = sectionDe(chapitre, frag);
  if (!section) return AUCUNE_COUVERTURE;
  const hits = rowsMatching(section, normText(String(frag.row ?? '')), frag.table);
  if (hits.length !== 1) return AUCUNE_COUVERTURE;
  const [hit] = hits;
  const col = normText(String(frag.col ?? ''));
  const colonne = hit.headers.findIndex((h) => caseVautCle(h, col));
  const p = positionDuBloc(chapitre, { sec: section.slug, secOcc: section.occ, idx: section.blocks.indexOf(hit.block) });
  if (p == null || colonne < 0) return AUCUNE_COUVERTURE;
  return { blocs: new Set([p]), case: { rangee: hit.rangee, colonne } };
}

/** Deux couvertures se recouvrent-elles ? Elles partagent une position de bloc, sauf deux CASES
 *  distinctes d'un même bloc-table, qui citent bien deux textes. */
function seRecouvrent(a: Couverture, b: Couverture): boolean {
  if (![...b.blocs].some((p) => a.blocs.has(p))) return false;
  return !(a.case && b.case) || (a.case.rangee === b.case.rangee && a.case.colonne === b.case.colonne);
}

/**
 * Deux fragments d'un MONTAGE se recouvrent-ils ? Un montage cite des passages DISTINCTS : deux
 * fragments dont les couvertures se recouvrent (`seRecouvrent` : le cas dégénéré étant le fragment
 * répété, le cas mixte la table entière PUIS une de ses cellules, le cas à cheval un intervalle qui
 * traverse la section d'un autre fragment) rendraient le même texte deux fois, et l'adresse dirait
 * plus que le livre. Verrou STRUCTUREL, au même étage que le plafond `MAX_FRAGMENTS` : ni l'éditeur
 * ni une migration ne peuvent le contourner.
 *
 * L'erreur DÉSIGNE LE SECOND des deux (`fragment: j`) : c'est celui qu'on vient d'ajouter ou de
 * déplacer dans la quasi-totalité des gestes d'édition, donc celui à corriger ; son détail nomme le
 * premier, pour que l'auteur sache LEQUEL il redit.
 *
 * CE QUE LE VERROU NE COUVRE PAS : deux fragments à des POSITIONS différentes qui citent le même texte.
 * `fragment-ambigu` ne les attrape pas non plus quand chacun est unique DANS SON CHAPITRE au sens du
 * balayage de runs — un livre qui répète un encadré mot pour mot sous deux titres reste adressable
 * deux fois dans un même montage. Le juger demanderait de comparer les TEXTES résolus, pas les
 * positions : c'est une autre question, et elle n'a pas de cas mesuré.
 */
function chevauchementDe(chapitre: ChapitreParse, ref: DescRef): ErreurResolution | null {
  const couvertures = ref.parts.map((f) => couvertureDe(chapitre, f));
  for (let i = 0; i < ref.parts.length; i++) {
    for (let j = i + 1; j < ref.parts.length; j++) {
      if (!seRecouvrent(couvertures[i], couvertures[j])) continue;
      return {
        error: 'fragments-chevauchants',
        fragment: j,
        detail: `${ref.book} ch.${ref.ch} : ${ouDe(ref.parts[j])} cite le même passage que le fragment ${i + 1} (${ouDe(ref.parts[i])})`,
      };
    }
  }
  return null;
}

/**
 * Deux fragments de BLOCS CONSÉCUTIFS DANS L'ORDRE DE L'ADRESSE se touchent-ils ? Ils se touchent si le
 * premier élément `bloc` du fil après la fin du premier est le départ du second : un seul intervalle
 * les écrit, titres intermédiaires compris (forme canonique UNIQUE d'un passage). L'erreur désigne le
 * second. Deux fragments consécutifs au FIL mais écrits dans l'ordre inverse ne se touchent pas : le
 * montage réordonne le livre, ce qu'aucun intervalle n'écrit.
 */
function contiguiteDe(chapitre: ChapitreParse, ref: DescRef): ErreurResolution | null {
  const fil = filDuChapitre(chapitre);
  for (let i = 0; i + 1 < ref.parts.length; i++) {
    const a = ref.parts[i];
    const b = ref.parts[i + 1];
    if (a.kind !== 'blocs' || b.kind !== 'blocs') continue;
    const ba = bornesAuFil(chapitre, a);
    const bb = bornesAuFil(chapitre, b);
    if (estErreur(ba) || estErreur(bb)) continue;
    let suivant = ba.fin + 1;
    while (suivant < fil.length && fil[suivant].kind !== 'bloc') suivant++;
    if (suivant !== bb.depart) continue;
    return {
      error: 'fragments-contigus',
      fragment: i + 1,
      detail: `${ref.book} ch.${ref.ch} : ${ouDe(b)} reprend au bloc qui suit le fragment ${i + 1} (${ouDe(a)}) — un seul intervalle les écrit`,
    };
  }
  return null;
}

/**
 * Résout une adresse complète : chaque fragment, joints par une ligne vide, folios en union
 * ordonnée. Un montage (2 fragments et plus) plafonne à `MAX_FRAGMENTS`.
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
  const u = unitesDeLAdresse(chapitre, ref);
  return estErreur(u) ? u : resolu(u);
}

/**
 * Unités d'une adresse complète : celles que `resoudreAdresse` assemble, sous les mêmes refus (plafond,
 * chevauchement, contiguïté, empreintes, règle D) ; la première unité d'un fragment qui en suit un autre est
 * précédée d'une ligne vide.
 */
export function unitesDeLAdresse(chapitre: ChapitreParse, ref: DescRef): UnitesResolues | ErreurResolution {
  if (ref.parts.length > MAX_FRAGMENTS) {
    return {
      error: 'montage-hors-plafond',
      detail: `${ref.book} ch.${ref.ch} : ${ref.parts.length} fragments (plafond ${MAX_FRAGMENTS})`,
    };
  }
  const structure = chevauchementDe(chapitre, ref) ?? contiguiteDe(chapitre, ref);
  if (structure) return structure;
  const unites: Unite[] = [];
  const folios: number[] = [];
  for (let i = 0; i < ref.parts.length; i++) {
    const frag = ref.parts[i];
    const res = unitesVerifiees(chapitre, frag);
    if (estErreur(res)) return { ...res, fragment: i };
    if (ref.parts.length > 1 && frag.kind === 'blocs') {
      const n = normText(assembler(res.unites));
      const ou = `${ref.book} ch.${ref.ch} ${ouDe(frag)}`;
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
    const [tete, ...reste] = res.unites;
    unites.push(i ? { ...tete, sep: '\n\n' } : tete, ...reste);
    for (const f of res.folios) if (!folios.includes(f)) folios.push(f);
  }
  return { unites, folios };
}
