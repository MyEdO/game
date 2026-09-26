// RENVOIS « page N » du texte d'un livre de `Source/`, résolus en ADRESSE (#1393, épique #1388).
// Un lien est DÉRIVÉ, jamais écrit dans le verbatim : ce module lit un texte, y trouve ses renvois, et
// rend pour chacun une `Resolution` qui porte son NIVEAU DE PREUVE et, quand la preuve suffit, une
// `DescRef` — le format d'adresse EXISTANT (`decoupe.ts`), section entière `b0=0..b1=blocs-1` (au niveau
// `page`, la cible est la page elle-même, `{ book, page }`), `sum`
// calculé ICI par `empreinteDe`, jamais écrit en donnée.
//
// Module PUR : aucune entrée/sortie. Les chapitres arrivent déjà parsés (`parseChapitre`), le livre
// par son id et sa `language` (`src/data/books.json`) ; la garde `scripts/raw/check-renvois.mjs` et
// les bancs les lisent sur le disque par `scripts/source/lecteur-fs.mjs`.
//
// NIVEAUX, du plus au moins prouvé :
//  - `table` : la clause nomme « X table », et UNE section du folio N, ou UNE table titrée (`tablesOf`)
//    dont le bloc porte le folio N, a pour titre X ; la cible d'une table est sa légende `**X**` et son
//    bloc, son bloc seul quand le titre est une bannière. Une table et une section d'un même fichier au
//    même titre sont UNE cible : la table ;
//  - `section-adjacente` : le titre de section du folio N le plus proche AVANT le renvoi, dans sa clause ;
//  - `section-phrase` : aucun titre dans la clause, UN seul titre du folio N ailleurs dans la phrase ;
//  - `page` : aucun titre, UN seul fichier porte du texte au folio N, la clause ne nomme pas de table ;
//    la cible est la PAGE, `{ book, page: N }` — jamais une section ;
//  - `ambigu` : plusieurs candidats (listés), ou une table nommée qu'aucun titre ne porte ;
//  - `introuvable` : aucun texte du livre au folio N.
// Une clause qui nomme une table ne se résout qu'en `table` ou `ambigu`. Deux sections d'un même
// fichier au même titre normalisé (un titre et l'intitulé de sa table) sont UNE cible : la première,
// l'englobante. Un titre à parenthèse finale (`Fear (Rating)`) se compare aussi sans elle. Un titre
// trouvé DANS l'étendue d'un autre titre trouvé n'est pas nommé (« Fate » dans « Fate and Fortune »).
// Design : #1393, lot 1 (2026-09-25).
import {
  empreinteDe,
  graphieDuFichier,
  normText,
  tablesOf,
  type Bloc,
  type ChapitreParse,
  type DescRef,
  type FragmentBlocs,
  type TableDeSection,
} from './decoupe.ts';
import type { SourceRef } from '../schemas/grammaire/valeurs.ts';

/** Formes d'un renvoi dans une LANGUE : mesurées sur le corpus, jamais écrites par livre. */
export interface MotifsDeRenvoi {
  /** Le mot « page », singulier et pluriel. */
  mots: string[];
  /** Ce qui peut précéder le mot dans le renvoi (inclus dans son étendue). */
  introducteurs: string[];
  /** Séparateurs de plage collés aux nombres (`196–197`). */
  tirets: string[];
  /** Liaisons de plage entre espaces (`183 and 356`). */
  liaisons: string[];
  /** Séparateurs d'une LISTE de pages (`301, 303`) : chaque page y est son propre renvoi. */
  separateursDeListe: string[];
  /** Liaison admise après un séparateur de liste (`156, and 162`). */
  liaisonsDeListe: string[];
  /** Le mot « table », singulier et pluriel. */
  tables: string[];
  /** Liaisons de la forme « table de X » (le mot « table » AVANT X). */
  liaisonsDeTable: string[];
  /** Marque du pluriel retirée en fin de mot (mot de 4 lettres ou plus) pour comparer les titres. */
  pluriel: string;
}

/**
 * Motifs par LANGUE (`books.json#language`). VO : comptage du CRB, mesure du 2026-09-25 sur 451 renvois —
 * introducteurs `(see` 143, `(` 129, `see` 85, `on` 26, `found on` 7, `listed on`, `described on`,
 * `explained on`, `presented on` 1 chacun ; plages `–` 8, `-` 1, `and` 3, `to` 1 ; listes `, ` 1
 * (`081 - Consumer Guide.md:13`), `, and ` 1 (`016 - 5. Talents, Trappings, and Final Game Details.md:45`) ;
 * « table of X » : 2 occurrences au CRB le 2026-09-26, dont 1 renvoi (`047 - Character Events.md:53`).
 */
export const MOTIFS_DE_RENVOI: Readonly<Partial<Record<string, MotifsDeRenvoi>>> = {
  VO: {
    mots: ['page', 'pages'],
    introducteurs: ['see', 'on', 'found on', 'listed on', 'described on', 'explained on', 'presented on'],
    tirets: ['–', '-'],
    liaisons: ['and', 'to'],
    separateursDeListe: [','],
    liaisonsDeListe: ['and'],
    tables: ['table', 'tables'],
    liaisonsDeTable: ['of'],
    pluriel: 's',
  },
};

/** Motifs d'une langue ; une langue sans motifs est une ERREUR, jamais un livre muet. */
function motifsDe(langue: string): MotifsDeRenvoi {
  const m = MOTIFS_DE_RENVOI[langue];
  if (!m) throw new Error(`renvoi : aucun motif de renvoi pour la langue « ${langue} »`);
  return m;
}

/** Un renvoi trouvé dans un texte : sa page, sa fin de plage, sa CLAUSE porteuse et sa PHRASE. */
export interface Renvoi {
  folio: number;
  fin: number | null;
  /** Position du renvoi dans le texte lu. */
  debut: number;
  /** Texte avant le renvoi, borné (début de phrase ou de ligne, `;`, parenthèse close, renvoi précédent). */
  clause: string;
  /** Phrase entière qui porte le renvoi. */
  phrase: string;
}

const echapper = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const alternative = (xs: string[]): string =>
  [...xs].sort((a, b) => b.length - a.length).map((x) => echapper(x).replace(/ /g, '\\s+')).join('|');

const motifRenvoi = (m: MotifsDeRenvoi): RegExp =>
  new RegExp(
    `\\(?(?:(?:${alternative(m.introducteurs)})\\s+)?\\b(?:${alternative(m.mots)})\\s+(\\d+)` +
      `(?:\\s*(?:${alternative(m.tirets)})\\s*(\\d+)|\\s+(?:${alternative(m.liaisons)})\\s+(\\d+))?` +
      `((?:${elementDeListe(m)})*)\\)?`,
    'giu',
  );

/** Un élément de liste de pages après le premier : séparateur, liaison facultative, nombre. */
const elementDeListe = (m: MotifsDeRenvoi): string =>
  `\\s*(?:${alternative(m.separateursDeListe)})\\s*(?:(?:${alternative(m.liaisonsDeListe)})\\s+)?\\d+`;

/** Début de la phrase qui contient la position `at` (ligne ou `. `). */
function debutDePhrase(texte: string, at: number): number {
  return Math.max(texte.lastIndexOf('\n', at - 1) + 1, texte.lastIndexOf('. ', at - 1) + 1);
}

/** Fin de la phrase ouverte avant `depuis`. */
function finDePhrase(texte: string, depuis: number): number {
  const bornes = [texte.indexOf('. ', depuis), texte.indexOf('\n', depuis)].filter((i) => i >= 0);
  return bornes.length ? Math.min(...bornes) : texte.length;
}

/** Renvois « page N » d'un texte, dans l'ordre. */
export function renvoisDe(texte: string, langue: string): Renvoi[] {
  const out: Renvoi[] = [];
  let finPrecedent = 0;
  for (const m of texte.matchAll(motifRenvoi(motifsDe(langue)))) {
    const at = m.index;
    const bout = at + m[0].length;
    const phrase = debutDePhrase(texte, at);
    const bornes = [phrase, texte.lastIndexOf(';', at - 1) + 1, texte.lastIndexOf('|', at - 1) + 1, finPrecedent];
    const ouvrante = texte.lastIndexOf('(', at - 1);
    const fermante = ouvrante >= 0 ? texte.indexOf(')', ouvrante) : -1;
    if (fermante >= 0 && fermante < at) bornes.push(fermante + 1);
    const fin = m[2] ?? m[3];
    const commun = { clause: texte.slice(Math.max(...bornes), at), phrase: texte.slice(phrase, finDePhrase(texte, bout)) };
    out.push({ folio: Number(m[1]), fin: fin == null ? null : Number(fin), debut: at, ...commun });
    const liste = m[4] ?? '';
    const origine = bout - (m[0].endsWith(')') ? 1 : 0) - liste.length;
    for (const n of liste.matchAll(/\d+/g)) out.push({ folio: Number(n[0]), fin: null, debut: origine + n.index, ...commun });
    finPrecedent = bout;
  }
  return out;
}

/** Un chapitre du livre : son nom de fichier et son parse. */
export interface ChapitreDuLivre { fichier: string; parse: ChapitreParse }

/** Une section qui porte du texte à un folio. */
export interface SectionAuFolio {
  fichier: string;
  slug: string;
  occ: number;
  titre: string;
  /** Rang de la section dans son fichier. */
  rang: number;
}

/** Livre prêt à résoudre : ses chapitres, et les sections qui portent du texte à chaque folio. */
export interface LivreIndexe {
  book: string;
  langue: string;
  chapitres: Map<string, ChapitreParse>;
  parFolio: Map<number, SectionAuFolio[]>;
}

/** Les folios où un bloc porte du texte : celui où il ouvre, et ceux de ses marqueurs. */
const foliosDuBloc = (b: Bloc): number[] => [...(b.folio == null ? [] : [b.folio]), ...b.folios];

/** Indexe un livre : un folio porte une section dès qu'un de ses blocs y ouvre ou y a un marqueur. */
export function indexerLivre(book: string, langue: string, chapitres: ChapitreDuLivre[]): LivreIndexe {
  const parFolio = new Map<number, SectionAuFolio[]>();
  for (const { fichier, parse } of chapitres) {
    parse.sections.forEach((s, rang) => {
      const folios = new Set<number>();
      for (const b of s.blocks) for (const f of foliosDuBloc(b)) folios.add(f);
      for (const f of folios) {
        if (!parFolio.has(f)) parFolio.set(f, []);
        parFolio.get(f)!.push({ fichier, slug: s.slug, occ: s.occ, titre: s.title, rang });
      }
    });
  }
  return { book, langue, chapitres: new Map(chapitres.map((c) => [c.fichier, c.parse])), parFolio };
}

export type Niveau = 'table' | 'section-adjacente' | 'section-phrase' | 'page' | 'ambigu' | 'introuvable';

/** Résolution d'un renvoi. `page` est ce que le livre dit, à tout niveau (fin de plage : `fin`) ; au
 *  niveau `page`, c'est LA cible. `cible` n'existe qu'aux niveaux `section-*` et `table` ; `candidats`
 *  nomme les sections en lice (`fichier § titre`) ; `table` est le X d'une clause qui nomme « X table ». */
export interface Resolution {
  niveau: Niveau;
  page: SourceRef;
  cible: DescRef | null;
  candidats: string[];
  fin: number | null;
  table: string | null;
}

/** Clé de comparaison d'un texte : normalisé, ponctuation aplatie en espaces. */
const cle = (s: string): string => normText(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Clé au singulier : la marque du pluriel retirée des mots de 4 lettres ou plus. */
const singulier = (k: string, pluriel: string): string =>
  k.split(' ').map((w) => (w.length >= 4 && w.endsWith(pluriel) ? w.slice(0, -pluriel.length) : w)).join(' ');

/** Une même cible par fichier et titre normalisé : la PREMIÈRE section, l'englobante. */
function unParTitre(sections: SectionAuFolio[]): SectionAuFolio[] {
  const vues = new Map<string, SectionAuFolio>();
  for (const s of [...sections].sort((a, b) => a.rang - b.rang)) {
    const k = `${s.fichier}\u0000${cle(s.titre)}`;
    if (!vues.has(k)) vues.set(k, s);
  }
  return sections.filter((s) => [...vues.values()].includes(s));
}

/** Une cible du niveau `table` : une section, ou une table titrée d'une section. */
interface Cible { s: SectionAuFolio; t?: TableDeSection }

const nommer = ({ s, t }: Cible): string => `${s.fichier} § ${t?.table.titre ?? s.titre}`;


/** Titre sans sa parenthèse finale (`Fear (Rating)` → `Fear`), ou `null` s'il n'en porte pas. */
const sansParametre = (titre: string): string | null => {
  const nu = titre.replace(/\s*\([^()]*\)\s*$/, '');
  return nu !== titre && nu.trim() ? nu : null;
};

/** Clés de comparaison d'un titre : le titre entier, et sans sa parenthèse finale. */
const clesDuTitre = (titre: string): string[] => {
  const nu = sansParametre(titre);
  return nu == null ? [cle(titre)] : [cle(titre), cle(nu)];
};

/** Étendue `[debut, fin)` d'un titre trouvé dans un texte. */
interface Etendue { debut: number; fin: number }

/** Titres NOMMÉS dans un texte bordé d'espaces : chaque occurrence ` k ` des clés de chaque section,
 *  hors celles qui tombent DANS l'étendue plus longue d'un autre titre trouvé (« Fate » dans
 *  « Fate and Fortune », `007 - Character Sheet Explained.md:14`). */
function nommes<T>(texte: string, cles: [T, string[]][]): Map<T, Etendue[]> {
  const trouves: { s: T; e: Etendue }[] = [];
  for (const [s, ks] of cles) {
    for (const k of ks) {
      for (let j = texte.indexOf(` ${k} `); j >= 0; j = texte.indexOf(` ${k} `, j + 1)) {
        trouves.push({ s, e: { debut: j + 1, fin: j + 1 + k.length } });
      }
    }
  }
  const out = new Map<T, Etendue[]>();
  for (const o of trouves) {
    const dedans = trouves.some((q) => q.s !== o.s && q.e.debut <= o.e.debut && o.e.fin <= q.e.fin
      && q.e.fin - q.e.debut > o.e.fin - o.e.debut);
    if (!dedans) out.set(o.s, [...(out.get(o.s) ?? []), o.e]);
  }
  return out;
}

/** La section parsée d'une section au folio, son chapitre et la graphie de son fichier. */
function lue(livre: LivreIndexe, s: SectionAuFolio) {
  const chapitre = livre.chapitres.get(s.fichier);
  const section = chapitre?.sections.find((x) => x.slug === s.slug && x.occ === s.occ);
  const ch = graphieDuFichier(s.fichier);
  if (!chapitre || !section || ch == null) throw new Error(`renvoi : section inconnue ${s.fichier} §${s.slug}#${s.occ}`);
  return { chapitre, section, ch };
}

/** Adresse d'une cible — section entière, ou légende et bloc d'une table —, empreinte calculée au texte
 *  résolu. */
function adresseDe(livre: LivreIndexe, { s, t }: Cible): DescRef {
  const { chapitre, section, ch } = lue(livre, s);
  const b1 = t ? section.blocks.indexOf(t.block) : section.blocks.length - 1;
  const b0 = t ? section.blocks.indexOf(t.legende ?? t.block) : 0;
  const frag: FragmentBlocs = { kind: 'blocs', sec: s.slug, secOcc: s.occ, b0, b1, sum: '' };
  const sum = empreinteDe(chapitre, frag);
  if (typeof sum !== 'string') throw new Error(`renvoi : ${sum.error} — ${sum.detail}`);
  return { book: livre.book, ch, parts: [{ ...frag, sum }] };
}

/** Résout un renvoi dans un livre indexé. */
export function resoudreRenvoi(livre: LivreIndexe, renvoi: Renvoi): Resolution {
  const motifs = motifsDe(livre.langue);
  const base = { page: { book: livre.book, page: renvoi.folio }, fin: renvoi.fin, table: null as string | null };
  const toutes = livre.parFolio.get(renvoi.folio) ?? [];
  if (!toutes.length) return { ...base, niveau: 'introuvable', cible: null, candidats: [] };
  const secs = unParTitre(toutes);
  const sg = (k: string): string => singulier(k, motifs.pluriel);
  const rendre = (niveau: Niveau, sections: SectionAuFolio[], table: string | null = null): Resolution =>
    rendreCibles(niveau, sections.map((s) => ({ s })), table);
  const rendreCibles = (niveau: Niveau, elues: Cible[], table: string | null): Resolution =>
    elues.length === 1
      ? { ...base, table, niveau, cible: adresseDe(livre, elues[0]), candidats: [nommer(elues[0])] }
      : { ...base, table, niveau: 'ambigu', cible: null, candidats: elues.map(nommer) };

  const clause = ` ${cle(renvoi.clause)} `;
  const motTable = `(?:${alternative(motifs.tables)})`;
  const nommee =
    new RegExp(` ([\\p{L}\\p{N} ]{2,60}?) ${motTable} $`, 'u').exec(clause) ??
    new RegExp(` ${motTable} (?:${alternative(motifs.liaisonsDeTable)}) ([\\p{L}\\p{N} ]{2,60}?) $`, 'u').exec(clause) ??
    new RegExp(` ([\\p{L}\\p{N} ]{2,60}?) ${motTable} (?:[\\p{L}\\p{N}]+ ){0,3}$`, 'u').exec(clause);
  if (nommee) {
    const x = ` ${sg(nommee[1].trim())} `;
    const finTable = new RegExp(` ${motTable}$`, 'u');
    const cleDe = ({ s, t }: Cible): string => sg(cle(t?.table.titre ?? s.titre).replace(finTable, ''));
    const tables = toutes.flatMap((s) =>
      tablesOf(lue(livre, s).section)
        .filter((t) => t.cle != null && foliosDuBloc(t.block).includes(renvoi.folio))
        .map((t): Cible => ({ s, t })));
    const cibles: Cible[] = [...secs.map((s) => ({ s })), ...tables];
    const trouves = nommes(x, cibles.map((c): [Cible, string[]] => [c, [cleDe(c)].filter((k) => k.length > 3)]));
    const touchees = cibles.filter((c) => trouves.get(c)?.some((e) => e.fin === x.length - 1));
    const elues = touchees.filter((c) => c.t || !touchees.some((u) => u.t && u.s.fichier === c.s.fichier && cleDe(u) === cleDe(c)));
    return rendreCibles('table', elues, nommee[1].trim());
  }

  const cles = secs.map((s): [SectionAuFolio, string[]] => [s, clesDuTitre(s.titre).map(sg).filter((k) => k.length > 1)]);
  const places = [...nommes(` ${sg(clause.trim())} `, cles)].map(([s, es]) => {
    const [e] = [...es].sort((a, b) => b.fin - a.fin || a.debut - b.debut);
    return { s, fin: e.fin, long: e.fin - e.debut };
  });
  if (places.length) {
    const plusProche = Math.max(...places.map((p) => p.fin));
    const aDistance = places.filter((p) => p.fin === plusProche);
    const long = Math.max(...aDistance.map((p) => p.long));
    return rendre('section-adjacente', aDistance.filter((p) => p.long === long).map((p) => p.s));
  }

  const dansPhrase = [...nommes(` ${sg(cle(renvoi.phrase))} `, cles).keys()];
  if (dansPhrase.length) return rendre('section-phrase', dansPhrase);
  const fichiers = new Set(toutes.map((s) => s.fichier));
  if (fichiers.size === 1) return { ...base, niveau: 'page', cible: null, candidats: [] };
  return rendre('ambigu', secs);
}

/** Un renvoi du livre à son site : fichier, section porteuse, rang parmi les renvois de la section
 *  vers le même folio, et sa résolution. */
export interface RenvoiDuLivre {
  fichier: string;
  slug: string;
  occ: number;
  rang: number;
  renvoi: Renvoi;
  resolution: Resolution;
}

/** Tous les renvois d'un livre indexé — titre de section puis blocs (`119 - Appendix IV.md:7`,
 *  `# **Ablaze (page 185)**`) —, résolus. */
export function renvoisDuLivre(livre: LivreIndexe): RenvoiDuLivre[] {
  const out: RenvoiDuLivre[] = [];
  for (const [fichier, parse] of livre.chapitres) {
    for (const s of parse.sections) {
      const rangs = new Map<number, number>();
      for (const texte of [s.title, ...s.blocks.map((b) => b.md)]) {
        for (const renvoi of renvoisDe(texte, livre.langue)) {
          const rang = (rangs.get(renvoi.folio) ?? 0) + 1;
          rangs.set(renvoi.folio, rang);
          out.push({ fichier, slug: s.slug, occ: s.occ, rang, renvoi, resolution: resoudreRenvoi(livre, renvoi) });
        }
      }
    }
  }
  return out;
}
